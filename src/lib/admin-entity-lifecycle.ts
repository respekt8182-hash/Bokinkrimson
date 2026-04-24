import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import { areDatabaseColumnsAvailable, type DbClientLike } from "@/lib/db";
import {
  deleteExcursionStorageEntries,
  EXCURSION_STORAGE_CLEANUP_SELECT,
} from "@/lib/excursions";
import {
  deletePropertyStorageEntries,
  PROPERTY_STORAGE_CLEANUP_SELECT,
} from "@/lib/properties";
import { deleteFromStorage } from "@/lib/storage";

export const OWNER_ACTIVE_PROPERTY_DRAFT_LIMIT = 3;
export const OWNER_ACTIVE_EXCURSION_DRAFT_LIMIT = 3;
export const ADMIN_SOFT_DELETE_RETENTION_DAYS = 1;
const USER_SOFT_DELETE_COLUMNS = ["deletedAt", "deletionExpiresAt"] as const;
const EXCURSION_SOFT_DELETE_COLUMNS = [
  "deletedAt",
  "deletionExpiresAt",
  "isPublishedVisible",
] as const;

export function getAdminSoftDeleteExpiresAt(from: Date = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + ADMIN_SOFT_DELETE_RETENTION_DAYS);
  return expiresAt;
}

export function isSoftDeleteWindowActive(
  deletionExpiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!deletionExpiresAt) {
    return false;
  }

  return deletionExpiresAt.getTime() > now.getTime();
}

export async function countOwnerActivePropertyDrafts(
  client: DbClientLike,
  ownerId: string,
): Promise<number> {
  return client.property.count({
    where: {
      ownerId,
      ownerDeletedAt: null,
      status: PropertyStatus.DRAFT,
    },
  });
}

export async function countOwnerActiveExcursionDrafts(
  client: DbClientLike,
  ownerId: string,
): Promise<number> {
  return client.excursion.count({
    where: {
      ownerId,
      deletedAt: null,
      status: ExcursionStatus.DRAFT,
    },
  });
}

export async function purgeExpiredDeletedProperties(
  client: DbClientLike,
  now: Date = new Date(),
): Promise<number> {
  const expired = await client.property.findMany({
    where: {
      ownerDeletedAt: { not: null },
      ownerDeletionExpiresAt: { not: null, lte: now },
    },
    select: PROPERTY_STORAGE_CLEANUP_SELECT,
  });

  if (expired.length === 0) {
    return 0;
  }

  await deletePropertyStorageEntries(expired);

  const result = await client.property.deleteMany({
    where: {
      id: { in: expired.map((item) => item.id) },
    },
  });

  return result.count;
}

export async function purgeExpiredDeletedExcursions(
  client: DbClientLike,
  now: Date = new Date(),
): Promise<number> {
  if (!(await areDatabaseColumnsAvailable("Excursion", EXCURSION_SOFT_DELETE_COLUMNS))) {
    return 0;
  }

  const expired = await client.excursion.findMany({
    where: {
      deletedAt: { not: null },
      deletionExpiresAt: { not: null, lte: now },
    },
    select: EXCURSION_STORAGE_CLEANUP_SELECT,
  });

  if (expired.length === 0) {
    return 0;
  }

  await deleteExcursionStorageEntries(expired);

  const result = await client.excursion.deleteMany({
    where: {
      id: { in: expired.map((item) => item.id) },
    },
  });

  return result.count;
}

export async function purgeExpiredDeletedUsers(
  client: DbClientLike,
  now: Date = new Date(),
): Promise<number> {
  if (!(await areDatabaseColumnsAvailable("User", USER_SOFT_DELETE_COLUMNS))) {
    return 0;
  }

  const expiredUsers = await client.user.findMany({
    where: {
      deletedAt: { not: null },
      deletionExpiresAt: { not: null, lte: now },
    },
    select: {
      id: true,
      avatarStorageKey: true,
      properties: {
        select: PROPERTY_STORAGE_CLEANUP_SELECT,
      },
      excursions: {
        select: EXCURSION_STORAGE_CLEANUP_SELECT,
      },
    },
  });

  if (expiredUsers.length === 0) {
    return 0;
  }

  const propertyEntries = expiredUsers.flatMap((user) => user.properties);
  const excursionEntries = expiredUsers.flatMap((user) => user.excursions);
  const avatarKeys = expiredUsers
    .map((user) => user.avatarStorageKey)
    .filter((item): item is string => Boolean(item));

  await Promise.all([
    deletePropertyStorageEntries(propertyEntries),
    deleteExcursionStorageEntries(excursionEntries),
    Promise.all(avatarKeys.map((key) => deleteFromStorage(key).catch(() => null))),
  ]);

  const result = await client.user.deleteMany({
    where: {
      id: { in: expiredUsers.map((user) => user.id) },
    },
  });

  return result.count;
}
