import "server-only";

import type { DbClientLike } from "@/lib/db";
import {
  deleteFromStorage,
  getStorageKeyFromPublicUrl,
  listPublicUploadStorageObjects,
  normalizeStorageKey,
} from "@/lib/storage";

const MANAGED_UPLOAD_PREFIXES = [
  "properties/",
  "excursions/",
  "transfers/",
  "avatars/",
  "users/",
  "support-chat/",
  "chat-managers/",
] as const;

const DEFAULT_MIN_UNUSED_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;

type PruneUnusedPublicUploadsOptions = {
  dryRun?: boolean;
  minAgeMs?: number;
  now?: Date;
};

export type PruneUnusedPublicUploadsResult = {
  scanned: number;
  kept: number;
  skippedRecent: number;
  deleted: number;
};

function addStorageKey(keys: Set<string>, key: string | null | undefined): void {
  if (!key) {
    return;
  }

  try {
    keys.add(normalizeStorageKey(key));
  } catch {
    // Ignore invalid legacy data.
  }
}

function isManagedUploadKey(key: string): boolean {
  return MANAGED_UPLOAD_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function collectPublicStorageKeysFromUnknown(value: unknown, keys: Set<string>): void {
  if (typeof value === "string") {
    const keyFromUrl = getStorageKeyFromPublicUrl(value);
    if (keyFromUrl) {
      addStorageKey(keys, keyFromUrl);
      return;
    }

    if (isManagedUploadKey(value)) {
      addStorageKey(keys, value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPublicStorageKeysFromUnknown(item, keys);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectPublicStorageKeysFromUnknown(item, keys);
    }
  }
}

async function collectUsedPublicUploadKeys(client: DbClientLike): Promise<Set<string>> {
  const keys = new Set<string>();

  const [
    media,
    documents,
    users,
    properties,
    excursions,
    transfers,
    attractions,
    supportMessages,
    chatManagers,
  ] = await Promise.all([
    client.media.findMany({ select: { storageKey: true } }),
    client.propertyDocument.findMany({ select: { storageKey: true } }),
    client.user.findMany({
      where: { avatarStorageKey: { not: null } },
      select: { avatarStorageKey: true },
    }),
    client.property.findMany({ select: { publishedSnapshot: true } }),
    client.excursion.findMany({
      select: {
        photoUrls: true,
        sectionPhotoGroups: true,
        videoUrls: true,
        timeline: true,
        itineraryDays: true,
        publishedSnapshot: true,
      },
    }),
    client.transfer.findMany({
      select: {
        photoUrls: true,
        fleet: true,
        publishedSnapshot: true,
      },
    }),
    client.attraction.findMany({ select: { photoUrls: true } }),
    client.supportMessage.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
    client.chatManager.findMany({
      where: { photoUrl: { not: null } },
      select: { photoUrl: true },
    }),
  ]);

  for (const item of media) addStorageKey(keys, item.storageKey);
  for (const item of documents) addStorageKey(keys, item.storageKey);
  for (const item of users) addStorageKey(keys, item.avatarStorageKey);

  for (const item of properties) {
    collectPublicStorageKeysFromUnknown(item.publishedSnapshot, keys);
  }

  for (const item of excursions) {
    collectPublicStorageKeysFromUnknown(item.photoUrls, keys);
    collectPublicStorageKeysFromUnknown(item.sectionPhotoGroups, keys);
    collectPublicStorageKeysFromUnknown(item.videoUrls, keys);
    collectPublicStorageKeysFromUnknown(item.timeline, keys);
    collectPublicStorageKeysFromUnknown(item.itineraryDays, keys);
    collectPublicStorageKeysFromUnknown(item.publishedSnapshot, keys);
  }

  for (const item of transfers) {
    collectPublicStorageKeysFromUnknown(item.photoUrls, keys);
    collectPublicStorageKeysFromUnknown(item.fleet, keys);
    collectPublicStorageKeysFromUnknown(item.publishedSnapshot, keys);
  }

  for (const item of attractions) collectPublicStorageKeysFromUnknown(item.photoUrls, keys);
  for (const item of supportMessages) collectPublicStorageKeysFromUnknown(item.imageUrl, keys);
  for (const item of chatManagers) collectPublicStorageKeysFromUnknown(item.photoUrl, keys);

  return keys;
}

export async function pruneUnusedPublicUploads(
  client: DbClientLike,
  options: PruneUnusedPublicUploadsOptions = {},
): Promise<PruneUnusedPublicUploadsResult> {
  const minAgeMs = options.minAgeMs ?? DEFAULT_MIN_UNUSED_UPLOAD_AGE_MS;
  const nowMs = options.now?.getTime() ?? Date.now();
  const usedKeys = await collectUsedPublicUploadKeys(client);
  const objects = (await listPublicUploadStorageObjects(MANAGED_UPLOAD_PREFIXES)).filter((item) =>
    isManagedUploadKey(item.key),
  );
  const result: PruneUnusedPublicUploadsResult = {
    scanned: objects.length,
    kept: 0,
    skippedRecent: 0,
    deleted: 0,
  };

  for (const object of objects) {
    if (usedKeys.has(object.key)) {
      result.kept += 1;
      continue;
    }

    if (nowMs - object.modifiedAt < minAgeMs) {
      result.skippedRecent += 1;
      continue;
    }

    if (!options.dryRun) {
      await deleteFromStorage(object.key).catch(() => null);
    }
    result.deleted += 1;
  }

  return result;
}
