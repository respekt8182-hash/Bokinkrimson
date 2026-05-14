import { createHash, randomBytes } from "node:crypto";
import {
  Prisma,
  type CalendarSyncStatus,
  type RoomCalendarImportSource,
  type RoomCalendarSync,
} from "@prisma/client";
import { db, type DbClientLike } from "@/lib/db";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/pricing";
import { resolveBaseUrl } from "@/lib/seo/site";

const maxCalendarUrlLength = 1000;
const maxCalendarImportSources = 10;
const maxCalendarSourceLabelLength = 80;
const maxCalendarTextLength = 2_000_000;
const calendarFetchTimeoutMs = 12_000;
const calendarSourceLabel = "Синхронизация календаря";
const importedCalendarFallbackTag = "Календарь";
const calendarSyncMetaKey = "calendarSync";
const fallbackUidMarkerPrefix = "calendar-sync:";

export type CalendarSyncEditor = {
  id: string;
  isAdmin: boolean;
};

export type SerializedRoomCalendarSync = {
  roomId: string;
  exportUrl: string;
  importUrl: string;
  isImportEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: CalendarSyncStatus | null;
  lastSyncMessage: string | null;
  updatedAt: string;
  importSources: SerializedCalendarImportSource[];
};

export type SerializedCalendarImportSource = {
  id: string;
  label: string;
  importUrl: string;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: CalendarSyncStatus | null;
  lastSyncMessage: string | null;
  updatedAt: string;
};

export type CalendarImportSourceInput = {
  id?: string;
  label: string;
  importUrl: string;
  isEnabled: boolean;
};

export type CalendarImportResult = {
  importedCount: number;
  skippedCount: number;
  removedCount: number;
  warningCount: number;
  message: string;
  status: CalendarSyncStatus;
};

type ParsedCalendarEvent = {
  uid: string;
  dateFrom: string;
  dateTo: string;
  summary: string | null;
};

type ParseCalendarResult = {
  events: ParsedCalendarEvent[];
  warnings: string[];
};

type CalendarExportOccupancy = {
  id: string;
  dateFrom: Date;
  dateTo: Date;
  tag: string | null;
  source: string | null;
  guestName: string | null;
  updatedAt: Date;
  createdAt: Date;
};

type CalendarExportRoom = {
  id: string;
  title: string;
  property: {
    name: string | null;
  };
};

type CalendarSyncMeta = {
  exportToken: string;
  importUrl: string;
  isImportEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: CalendarSyncStatus | null;
  lastSyncMessage: string | null;
  updatedAt: string;
  importSources: CalendarImportSourceMeta[];
};

type CalendarImportSourceMeta = {
  id: string;
  label: string;
  importUrl: string;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: CalendarSyncStatus | null;
  lastSyncMessage: string | null;
  updatedAt: string;
};

type FallbackRoomCalendarSync = CalendarSyncMeta & {
  roomId: string;
};

type CalendarFallbackExportRoom = CalendarExportRoom & {
  property: CalendarExportRoom["property"] & {
    ownerDeletedAt: Date | null;
  };
};

function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isCalendarSyncStatus(value: unknown): value is CalendarSyncStatus {
  return value === "SUCCESS" || value === "PARTIAL" || value === "ERROR";
}

function createFallbackSourceId(): string {
  return `source_${randomBytes(10).toString("hex")}`;
}

function normalizeCalendarSourceLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) {
    return null;
  }
  return normalized.length <= maxCalendarSourceLabelLength
    ? normalized
    : normalized.slice(0, maxCalendarSourceLabelLength);
}

function getCalendarImportSourceFallbackLabel(importUrl: string, index = 0): string {
  try {
    const hostname = new URL(importUrl).hostname.replace(/^www\./i, "");
    return normalizeCalendarSourceLabel(hostname) ?? `Сайт ${index + 1}`;
  } catch {
    return `Сайт ${index + 1}`;
  }
}

function getImportedCalendarSourceLabel(label: string | null | undefined): string {
  return (
    truncateText(normalizeCalendarSourceLabel(label) ?? calendarSourceLabel, 80) ??
    calendarSourceLabel
  );
}

function normalizeRoomMeta(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? { ...value } : {};
}

function readCalendarImportSourcesMeta(
  rawSync: Record<string, unknown>,
): CalendarImportSourceMeta[] {
  const rawSources = Array.isArray(rawSync.importSources) ? rawSync.importSources : [];
  const sources: CalendarImportSourceMeta[] = [];
  const seenUrls = new Set<string>();

  rawSources.forEach((rawSource, index) => {
    if (!isPlainRecord(rawSource) || typeof rawSource.importUrl !== "string") {
      return;
    }

    const importUrl = rawSource.importUrl.trim();
    if (!importUrl || seenUrls.has(importUrl)) {
      return;
    }

    seenUrls.add(importUrl);
    sources.push({
      id:
        typeof rawSource.id === "string" && rawSource.id.trim()
          ? rawSource.id.trim()
          : createFallbackSourceId(),
      label:
        normalizeCalendarSourceLabel(
          typeof rawSource.label === "string" ? rawSource.label : null,
        ) ?? getCalendarImportSourceFallbackLabel(importUrl, index),
      importUrl,
      isEnabled: "isEnabled" in rawSource ? Boolean(rawSource.isEnabled) : true,
      lastSyncedAt: typeof rawSource.lastSyncedAt === "string" ? rawSource.lastSyncedAt : null,
      lastSyncStatus: isCalendarSyncStatus(rawSource.lastSyncStatus)
        ? rawSource.lastSyncStatus
        : null,
      lastSyncMessage:
        typeof rawSource.lastSyncMessage === "string" && rawSource.lastSyncMessage.trim()
          ? rawSource.lastSyncMessage
          : null,
      updatedAt:
        typeof rawSource.updatedAt === "string" && rawSource.updatedAt.trim()
          ? rawSource.updatedAt
          : new Date().toISOString(),
    });
  });

  if (sources.length === 0 && typeof rawSync.importUrl === "string" && rawSync.importUrl.trim()) {
    const importUrl = rawSync.importUrl.trim();
    sources.push({
      id: "legacy",
      label: getCalendarImportSourceFallbackLabel(importUrl),
      importUrl,
      isEnabled: Boolean(rawSync.isImportEnabled),
      lastSyncedAt: typeof rawSync.lastSyncedAt === "string" ? rawSync.lastSyncedAt : null,
      lastSyncStatus: isCalendarSyncStatus(rawSync.lastSyncStatus) ? rawSync.lastSyncStatus : null,
      lastSyncMessage:
        typeof rawSync.lastSyncMessage === "string" && rawSync.lastSyncMessage.trim()
          ? rawSync.lastSyncMessage
          : null,
      updatedAt:
        typeof rawSync.updatedAt === "string" && rawSync.updatedAt.trim()
          ? rawSync.updatedAt
          : new Date().toISOString(),
    });
  }

  return sources;
}

function getLatestSourceBySyncDate<T extends { lastSyncedAt: string | Date | null }>(
  sources: T[],
): T | null {
  return sources.reduce<T | null>((latest, source) => {
    if (!source.lastSyncedAt) {
      return latest;
    }
    if (!latest?.lastSyncedAt) {
      return source;
    }
    return new Date(source.lastSyncedAt).getTime() > new Date(latest.lastSyncedAt).getTime()
      ? source
      : latest;
  }, null);
}

function getAggregateCalendarStatus(
  sources: Array<{ lastSyncStatus: CalendarSyncStatus | null }>,
): CalendarSyncStatus | null {
  if (sources.some((source) => source.lastSyncStatus === "ERROR")) {
    return "ERROR";
  }
  if (sources.some((source) => source.lastSyncStatus === "PARTIAL")) {
    return "PARTIAL";
  }
  if (sources.some((source) => source.lastSyncStatus === "SUCCESS")) {
    return "SUCCESS";
  }
  return null;
}

function readCalendarSyncMeta(value: unknown): CalendarSyncMeta | null {
  const meta = normalizeRoomMeta(value);
  const rawSync = meta[calendarSyncMetaKey];

  if (!isPlainRecord(rawSync) || typeof rawSync.exportToken !== "string") {
    return null;
  }

  const importSources = readCalendarImportSourcesMeta(rawSync);
  const firstSource = importSources[0] ?? null;
  const latestSource = getLatestSourceBySyncDate(importSources);

  return {
    exportToken: rawSync.exportToken,
    importUrl:
      firstSource?.importUrl ?? (typeof rawSync.importUrl === "string" ? rawSync.importUrl : ""),
    isImportEnabled:
      importSources.length > 0
        ? importSources.some((source) => source.isEnabled)
        : Boolean(rawSync.isImportEnabled),
    lastSyncedAt:
      latestSource?.lastSyncedAt ??
      (typeof rawSync.lastSyncedAt === "string" ? rawSync.lastSyncedAt : null),
    lastSyncStatus:
      getAggregateCalendarStatus(importSources) ??
      (isCalendarSyncStatus(rawSync.lastSyncStatus) ? rawSync.lastSyncStatus : null),
    lastSyncMessage:
      latestSource?.lastSyncMessage ??
      (typeof rawSync.lastSyncMessage === "string" && rawSync.lastSyncMessage.trim()
        ? rawSync.lastSyncMessage
        : null),
    updatedAt:
      typeof rawSync.updatedAt === "string" && rawSync.updatedAt.trim()
        ? rawSync.updatedAt
        : new Date().toISOString(),
    importSources,
  };
}

function buildCalendarSyncMeta(
  previous: CalendarSyncMeta | null,
  patch: Partial<CalendarSyncMeta> = {},
): CalendarSyncMeta {
  const nowIso = new Date().toISOString();
  const importSources = patch.importSources ?? previous?.importSources ?? [];
  const firstSource = importSources[0] ?? null;
  const latestSource = getLatestSourceBySyncDate(importSources);

  return {
    exportToken: patch.exportToken ?? previous?.exportToken ?? createCalendarExportToken(),
    importUrl: patch.importUrl ?? firstSource?.importUrl ?? previous?.importUrl ?? "",
    isImportEnabled:
      patch.isImportEnabled ??
      (importSources.length > 0
        ? importSources.some((source) => source.isEnabled)
        : (previous?.isImportEnabled ?? false)),
    lastSyncedAt:
      patch.lastSyncedAt ?? latestSource?.lastSyncedAt ?? previous?.lastSyncedAt ?? null,
    lastSyncStatus:
      patch.lastSyncStatus ??
      getAggregateCalendarStatus(importSources) ??
      previous?.lastSyncStatus ??
      null,
    lastSyncMessage:
      patch.lastSyncMessage ?? latestSource?.lastSyncMessage ?? previous?.lastSyncMessage ?? null,
    updatedAt: nowIso,
    importSources,
  };
}

function buildRoomMetaWithCalendarSync(
  currentMeta: unknown,
  syncMeta: CalendarSyncMeta,
): Prisma.InputJsonValue {
  const nextMeta = normalizeRoomMeta(currentMeta);
  nextMeta[calendarSyncMetaKey] = syncMeta;
  return nextMeta as Prisma.InputJsonValue;
}

function truncateText(value: string | null | undefined, maxLength: number): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

export function createCalendarExportToken(): string {
  return randomBytes(24).toString("hex");
}

export function buildCalendarExportUrl(_requestUrl: string, exportToken: string): string {
  return new URL(`/api/calendar/rooms/${exportToken}.ics`, resolveBaseUrl()).toString();
}

export function stripCalendarTokenSuffix(rawToken: string): string {
  return rawToken.endsWith(".ics") ? rawToken.slice(0, -4) : rawToken;
}

export function serializeRoomCalendarSync(
  sync: RoomCalendarSync,
  exportUrl: string,
  importSources: RoomCalendarImportSource[] = [],
): SerializedRoomCalendarSync {
  const firstSource = importSources[0] ?? null;
  return {
    roomId: sync.roomId,
    exportUrl,
    importUrl: firstSource?.importUrl ?? sync.importUrl ?? "",
    isImportEnabled:
      importSources.length > 0
        ? importSources.some((source) => source.isEnabled)
        : sync.isImportEnabled,
    lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: sync.lastSyncStatus,
    lastSyncMessage: sync.lastSyncMessage,
    updatedAt: sync.updatedAt.toISOString(),
    importSources: importSources.map(serializeCalendarImportSource),
  };
}

export function serializeFallbackRoomCalendarSync(
  sync: FallbackRoomCalendarSync,
  exportUrl: string,
): SerializedRoomCalendarSync {
  return {
    roomId: sync.roomId,
    exportUrl,
    importUrl: sync.importUrl,
    isImportEnabled: sync.isImportEnabled,
    lastSyncedAt: sync.lastSyncedAt,
    lastSyncStatus: sync.lastSyncStatus,
    lastSyncMessage: sync.lastSyncMessage,
    updatedAt: sync.updatedAt,
    importSources: sync.importSources,
  };
}

function serializeCalendarImportSource(
  source: RoomCalendarImportSource,
): SerializedCalendarImportSource {
  return {
    id: source.id,
    label: source.label,
    importUrl: source.importUrl,
    isEnabled: source.isEnabled,
    lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: source.lastSyncStatus,
    lastSyncMessage: source.lastSyncMessage,
    updatedAt: source.updatedAt.toISOString(),
  };
}

export async function ensureRoomCalendarSync(
  client: DbClientLike,
  roomId: string,
): Promise<RoomCalendarSync> {
  const existing = await client.roomCalendarSync.findUnique({
    where: { roomId },
  });

  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await client.roomCalendarSync.create({
        data: {
          roomId,
          exportToken: createCalendarExportToken(),
        },
      });
    } catch (error) {
      if (!isPrismaUniqueError(error)) {
        throw error;
      }

      const createdByParallelRequest = await client.roomCalendarSync.findUnique({
        where: { roomId },
      });
      if (createdByParallelRequest) {
        return createdByParallelRequest;
      }
    }
  }

  throw new Error("Не удалось подготовить ссылку календаря");
}

export async function ensureRoomCalendarImportSources(
  client: DbClientLike,
  sync: RoomCalendarSync,
): Promise<RoomCalendarImportSource[]> {
  let sources = await client.roomCalendarImportSource.findMany({
    where: { syncId: sync.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (sources.length > 0 || !sync.importUrl) {
    return sources;
  }

  try {
    await client.roomCalendarImportSource.create({
      data: {
        syncId: sync.id,
        label: getCalendarImportSourceFallbackLabel(sync.importUrl),
        importUrl: sync.importUrl,
        isEnabled: sync.isImportEnabled,
        lastSyncedAt: sync.lastSyncedAt,
        lastSyncStatus: sync.lastSyncStatus,
        lastSyncMessage: sync.lastSyncMessage,
      },
    });
  } catch (error) {
    if (!isPrismaUniqueError(error)) {
      throw error;
    }
  }

  sources = await client.roomCalendarImportSource.findMany({
    where: { syncId: sync.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  await refreshCalendarSyncAggregate(client, sync.id, sources);
  return sources;
}

async function refreshCalendarSyncAggregate(
  client: DbClientLike,
  syncId: string,
  knownSources?: RoomCalendarImportSource[],
): Promise<RoomCalendarSync> {
  const sources =
    knownSources ??
    (await client.roomCalendarImportSource.findMany({
      where: { syncId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }));
  const firstSource = sources[0] ?? null;
  const latestSource = getLatestSourceBySyncDate(sources);

  return client.roomCalendarSync.update({
    where: { id: syncId },
    data: {
      importUrl: firstSource?.importUrl ?? null,
      isImportEnabled: sources.some((source) => source.isEnabled),
      lastSyncedAt: latestSource?.lastSyncedAt ?? null,
      lastSyncStatus: getAggregateCalendarStatus(sources),
      lastSyncMessage: latestSource?.lastSyncMessage ?? null,
    },
  });
}

export async function replaceRoomCalendarImportSources(
  client: DbClientLike,
  syncId: string,
  inputSources: CalendarImportSourceInput[],
): Promise<{ sync: RoomCalendarSync; sources: RoomCalendarImportSource[] }> {
  const existingSources = await client.roomCalendarImportSource.findMany({
    where: { syncId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  await client.roomOccupancy.deleteMany({
    where: {
      externalCalendarSyncId: syncId,
      externalCalendarSourceId: null,
      source: calendarSourceLabel,
    },
  });
  const existingById = new Map(existingSources.map((source) => [source.id, source]));
  const existingByUrl = new Map(existingSources.map((source) => [source.importUrl, source]));
  const keptIds = new Set<string>();

  for (const input of inputSources) {
    const existing =
      (input.id ? existingById.get(input.id) : null) ?? existingByUrl.get(input.importUrl);
    if (existing) {
      const importUrlChanged = existing.importUrl !== input.importUrl;
      if (importUrlChanged) {
        await client.roomOccupancy.deleteMany({
          where: { externalCalendarSourceId: existing.id },
        });
      }

      const updated = await client.roomCalendarImportSource.update({
        where: { id: existing.id },
        data: {
          label: input.label,
          importUrl: input.importUrl,
          isEnabled: input.isEnabled,
          lastSyncedAt: importUrlChanged ? null : existing.lastSyncedAt,
          lastSyncStatus: importUrlChanged ? null : existing.lastSyncStatus,
          lastSyncMessage: importUrlChanged ? null : existing.lastSyncMessage,
        },
      });
      keptIds.add(updated.id);
      continue;
    }

    const created = await client.roomCalendarImportSource.create({
      data: {
        syncId,
        label: input.label,
        importUrl: input.importUrl,
        isEnabled: input.isEnabled,
      },
    });
    keptIds.add(created.id);
  }

  const staleSourceIds = existingSources
    .filter((source) => !keptIds.has(source.id))
    .map((source) => source.id);

  if (staleSourceIds.length > 0) {
    await client.roomOccupancy.deleteMany({
      where: { externalCalendarSourceId: { in: staleSourceIds } },
    });
    await client.roomCalendarImportSource.deleteMany({
      where: { id: { in: staleSourceIds } },
    });
  }

  const sources = await client.roomCalendarImportSource.findMany({
    where: { syncId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const sync = await refreshCalendarSyncAggregate(client, syncId, sources);

  return { sync, sources };
}

export async function ensureRoomCalendarSyncFallback(
  client: DbClientLike,
  roomId: string,
): Promise<FallbackRoomCalendarSync> {
  const room = await client.room.findUnique({
    where: { id: roomId },
    select: { id: true, meta: true },
  });

  if (!room) {
    throw new Error("Номер не найден");
  }

  const existing = readCalendarSyncMeta(room.meta);
  if (existing?.exportToken) {
    return { roomId: room.id, ...existing };
  }

  const syncMeta = buildCalendarSyncMeta(existing);
  await client.room.update({
    where: { id: room.id },
    data: {
      meta: buildRoomMetaWithCalendarSync(room.meta, syncMeta),
    },
  });

  return { roomId: room.id, ...syncMeta };
}

export async function updateRoomCalendarSyncFallback(
  client: DbClientLike,
  roomId: string,
  input: {
    importSources: CalendarImportSourceInput[];
  },
): Promise<FallbackRoomCalendarSync> {
  const room = await client.room.findUnique({
    where: { id: roomId },
    select: { id: true, meta: true },
  });

  if (!room) {
    throw new Error("Номер не найден");
  }

  const previous = readCalendarSyncMeta(room.meta);
  const existingById = new Map(
    (previous?.importSources ?? []).map((source) => [source.id, source]),
  );
  const nextSourceIds = new Set(
    input.importSources.flatMap((source) => (source.id ? [source.id] : [])),
  );
  const sourceLabelsToClear = new Set<string>();
  const nextSources = input.importSources.map((source) => {
    const previousSource = source.id ? existingById.get(source.id) : undefined;
    const importUrlChanged = Boolean(
      previousSource && previousSource.importUrl !== source.importUrl,
    );
    const nowIso = new Date().toISOString();

    if (previousSource && importUrlChanged) {
      sourceLabelsToClear.add(getImportedCalendarSourceLabel(previousSource.label));
    }

    return {
      id: previousSource?.id ?? source.id ?? createFallbackSourceId(),
      label:
        normalizeCalendarSourceLabel(source.label) ??
        getCalendarImportSourceFallbackLabel(source.importUrl),
      importUrl: source.importUrl,
      isEnabled: source.isEnabled,
      lastSyncedAt: importUrlChanged ? null : (previousSource?.lastSyncedAt ?? null),
      lastSyncStatus: importUrlChanged ? null : (previousSource?.lastSyncStatus ?? null),
      lastSyncMessage: importUrlChanged ? null : (previousSource?.lastSyncMessage ?? null),
      updatedAt: nowIso,
    };
  });

  for (const previousSource of previous?.importSources ?? []) {
    if (!nextSourceIds.has(previousSource.id)) {
      sourceLabelsToClear.add(getImportedCalendarSourceLabel(previousSource.label));
    }
  }

  const syncMeta = buildCalendarSyncMeta(previous, {
    importSources: nextSources,
    importUrl: nextSources[0]?.importUrl ?? "",
    isImportEnabled: nextSources.some((source) => source.isEnabled),
    ...(nextSources.length === 0
      ? {
          lastSyncedAt: null,
          lastSyncStatus: null,
          lastSyncMessage: null,
        }
      : {}),
  });

  if (sourceLabelsToClear.size > 0) {
    await client.roomOccupancy.deleteMany({
      where: {
        roomId: room.id,
        source: { in: Array.from(sourceLabelsToClear) },
      },
    });
  }

  await client.room.update({
    where: { id: room.id },
    data: {
      meta: buildRoomMetaWithCalendarSync(room.meta, syncMeta),
    },
  });

  return { roomId: room.id, ...syncMeta };
}

export async function getAccessibleCalendarRoom(
  propertyId: string,
  roomId: string,
  editor: CalendarSyncEditor,
) {
  return db.room.findFirst({
    where: {
      id: roomId,
      propertyId,
      isActive: true,
      property: editor.isAdmin
        ? {
            ownerDeletedAt: null,
          }
        : {
            ownerId: editor.id,
            ownerDeletedAt: null,
          },
    },
    select: {
      id: true,
      title: true,
      propertyId: true,
    },
  });
}

function isForbiddenIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isForbiddenHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isIpv6 = normalized.includes(":");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "metadata.google.internal" ||
    (isIpv6 &&
      (normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe80"))) ||
    isForbiddenIpv4(normalized)
  );
}

export function validateCalendarImportUrl(
  rawValue: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const value = rawValue.trim();
  if (!value) {
    return { ok: true, url: "" };
  }

  if (value.length > maxCalendarUrlLength) {
    return { ok: false, error: "Ссылка календаря слишком длинная" };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Введите корректную ссылку календаря" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Календарь должен открываться по http или https" };
  }

  if (url.username || url.password) {
    return { ok: false, error: "Ссылка календаря не должна содержать логин или пароль" };
  }

  if (isForbiddenHostname(url.hostname)) {
    return { ok: false, error: "Этот адрес нельзя использовать для импорта календаря" };
  }

  url.hash = "";
  return { ok: true, url: url.toString() };
}

export function validateCalendarImportSourcesInput(
  rawSources: unknown,
  legacyInput?: { importUrl: string; isImportEnabled: boolean },
): { ok: true; sources: CalendarImportSourceInput[] } | { ok: false; error: string } {
  const rawItems = Array.isArray(rawSources) ? rawSources : null;
  if (!rawItems && legacyInput?.isImportEnabled && !legacyInput.importUrl.trim()) {
    return { ok: false, error: "Укажите ссылку для импорта или выключите импорт" };
  }
  const normalizedItems =
    rawItems ??
    (legacyInput?.importUrl.trim()
      ? [
          {
            label: getCalendarImportSourceFallbackLabel(legacyInput.importUrl),
            importUrl: legacyInput.importUrl,
            isEnabled: legacyInput.isImportEnabled,
          },
        ]
      : []);

  if (normalizedItems.length > maxCalendarImportSources) {
    return {
      ok: false,
      error: `Можно подключить не больше ${maxCalendarImportSources} календарей`,
    };
  }

  const sources: CalendarImportSourceInput[] = [];
  const seenUrls = new Set<string>();

  for (let index = 0; index < normalizedItems.length; index += 1) {
    const rawSource = normalizedItems[index];
    if (!isPlainRecord(rawSource)) {
      return { ok: false, error: "Некорректный список календарей" };
    }

    const rawLabel = typeof rawSource.label === "string" ? rawSource.label : "";
    const label = normalizeCalendarSourceLabel(rawLabel);
    if (!label) {
      return { ok: false, error: "Укажите название сайта для каждой синхронизации" };
    }

    if (rawLabel.trim().length > maxCalendarSourceLabelLength) {
      return {
        ok: false,
        error: `Название сайта должно быть не длиннее ${maxCalendarSourceLabelLength} символов`,
      };
    }

    const rawImportUrl = typeof rawSource.importUrl === "string" ? rawSource.importUrl : "";
    const validatedUrl = validateCalendarImportUrl(rawImportUrl);
    if (!validatedUrl.ok) {
      return { ok: false, error: validatedUrl.error };
    }

    if (!validatedUrl.url) {
      return { ok: false, error: "Укажите ссылку для каждой синхронизации" };
    }

    if (seenUrls.has(validatedUrl.url)) {
      return { ok: false, error: "Эта ссылка уже добавлена" };
    }
    seenUrls.add(validatedUrl.url);

    sources.push({
      id: typeof rawSource.id === "string" && rawSource.id.trim() ? rawSource.id.trim() : undefined,
      label,
      importUrl: validatedUrl.url,
      isEnabled: "isEnabled" in rawSource ? Boolean(rawSource.isEnabled) : true,
    });
  }

  return { ok: true, sources };
}

function unfoldCalendarLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
      continue;
    }

    unfolded.push(line);
  }

  return unfolded;
}

function splitCalendarProperty(line: string): { name: string; value: string } | null {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  const name = line.slice(0, separatorIndex).split(";", 1)[0]?.trim().toUpperCase() ?? "";
  const value = line.slice(separatorIndex + 1).trim();
  return name ? { name, value } : null;
}

function unescapeCalendarText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseCalendarDate(value: string): string | null {
  const compactDateMatch = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  if (compactDateMatch) {
    const [, year, month, day] = compactDateMatch;
    const iso = `${year}-${month}-${day}`;
    return parseIsoDate(iso) ? iso : null;
  }

  const dashedDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (dashedDateMatch) {
    const [, year, month, day] = dashedDateMatch;
    const iso = `${year}-${month}-${day}`;
    return parseIsoDate(iso) ? iso : null;
  }

  return null;
}

function normalizeCalendarUid(rawUid: string, fallback: string): string {
  const normalized = unescapeCalendarText(rawUid || fallback)
    .replace(/\s+/g, " ")
    .trim();
  const source = normalized || fallback;

  if (source.length <= 180) {
    return source;
  }

  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `${source.slice(0, 160)}-${digest}`;
}

export function parseBusyEventsFromCalendar(text: string): ParseCalendarResult {
  const lines = unfoldCalendarLines(text);
  const events: ParsedCalendarEvent[] = [];
  const warnings: string[] = [];
  let currentEventLines: string[] | null = null;

  for (const line of lines) {
    const normalizedLine = line.trim();
    if (normalizedLine.toUpperCase() === "BEGIN:VEVENT") {
      currentEventLines = [];
      continue;
    }

    if (normalizedLine.toUpperCase() === "END:VEVENT") {
      if (currentEventLines) {
        const properties = new Map<string, string[]>();
        for (const eventLine of currentEventLines) {
          const property = splitCalendarProperty(eventLine);
          if (!property) {
            continue;
          }
          const values = properties.get(property.name) ?? [];
          values.push(property.value);
          properties.set(property.name, values);
        }

        const status = properties.get("STATUS")?.[0]?.toUpperCase() ?? "";
        const transparency = properties.get("TRANSP")?.[0]?.toUpperCase() ?? "";
        const dateFrom = parseCalendarDate(properties.get("DTSTART")?.[0] ?? "");
        const rawDateTo = parseCalendarDate(properties.get("DTEND")?.[0] ?? "");

        if (status !== "CANCELLED" && transparency !== "TRANSPARENT" && dateFrom) {
          const parsedStart = parseIsoDate(dateFrom);
          const parsedEnd = rawDateTo ? parseIsoDate(rawDateTo) : null;
          const dateTo =
            parsedStart && (!parsedEnd || parsedEnd <= parsedStart)
              ? toIsoDate(addDays(parsedStart, 1))
              : rawDateTo;

          if (dateTo && parseIsoDate(dateTo)) {
            const summary = truncateText(
              unescapeCalendarText(properties.get("SUMMARY")?.[0] ?? ""),
              120,
            );
            events.push({
              uid: normalizeCalendarUid(
                properties.get("UID")?.[0] ?? "",
                `${dateFrom}-${dateTo}-${summary ?? "busy"}-${events.length + 1}`,
              ),
              dateFrom,
              dateTo,
              summary,
            });
          } else {
            warnings.push("Событие без корректной даты окончания пропущено");
          }
        }
      }
      currentEventLines = null;
      continue;
    }

    if (currentEventLines) {
      currentEventLines.push(line);
    }
  }

  const seenUidCounts = new Map<string, number>();
  const dedupedEvents = events.map((event) => {
    const count = seenUidCounts.get(event.uid) ?? 0;
    seenUidCounts.set(event.uid, count + 1);
    return count === 0 ? event : { ...event, uid: `${event.uid}#${count + 1}` };
  });

  return { events: dedupedEvents, warnings };
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatCalendarTimestamp(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatCalendarDate(value: Date): string {
  return toIsoDate(value).replace(/-/g, "");
}

function foldCalendarLine(line: string): string[] {
  if (line.length <= 75) {
    return [line];
  }

  const foldedLines = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    foldedLines.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) {
    foldedLines.push(` ${rest}`);
  }
  return foldedLines;
}

function getExclusiveCalendarEndDate(dateFrom: Date, dateTo: Date): Date {
  return dateTo > dateFrom ? dateTo : addDays(dateFrom, 1);
}

export function buildRoomOccupancyCalendar(input: {
  room: CalendarExportRoom;
  occupancies: CalendarExportOccupancy[];
}): string {
  const now = new Date();
  const calendarName = input.room.property.name
    ? `${input.room.property.name} - ${input.room.title}`
    : input.room.title;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bokinkrimson//Room Occupancy//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeCalendarText(calendarName)}`,
  ];

  for (const occupancy of input.occupancies) {
    const summary =
      truncateText(occupancy.tag ?? occupancy.source ?? occupancy.guestName, 80) ?? "Занято";
    const dateTo = getExclusiveCalendarEndDate(occupancy.dateFrom, occupancy.dateTo);

    lines.push(
      "BEGIN:VEVENT",
      `UID:room-occupancy-${occupancy.id}@bokinkrimson`,
      `DTSTAMP:${formatCalendarTimestamp(occupancy.updatedAt ?? now)}`,
      `DTSTART;VALUE=DATE:${formatCalendarDate(occupancy.dateFrom)}`,
      `DTEND;VALUE=DATE:${formatCalendarDate(dateTo)}`,
      `SUMMARY:${escapeCalendarText(summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR", "");
  return lines.flatMap(foldCalendarLine).join("\r\n");
}

async function fetchCalendarText(importUrl: string, redirectsRemaining = 3): Promise<string> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), calendarFetchTimeoutMs);

  try {
    const response = await fetch(importUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/calendar, application/octet-stream;q=0.8, */*;q=0.5",
      },
      redirect: "manual",
      signal: abortController.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectsRemaining <= 0) {
        throw new Error("Слишком много перенаправлений календаря");
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Календарь вернул перенаправление без адреса");
      }

      const redirectedUrl = new URL(location, importUrl).toString();
      const validatedUrl = validateCalendarImportUrl(redirectedUrl);
      if (!validatedUrl.ok || !validatedUrl.url) {
        throw new Error(
          validatedUrl.ok ? "Некорректное перенаправление календаря" : validatedUrl.error,
        );
      }

      return await fetchCalendarText(validatedUrl.url, redirectsRemaining - 1);
    }

    if (!response.ok) {
      throw new Error(`Календарь вернул HTTP ${response.status}`);
    }

    const lengthHeader = response.headers.get("content-length");
    const contentLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : 0;
    if (contentLength > maxCalendarTextLength) {
      throw new Error("Файл календаря слишком большой");
    }

    const text = await response.text();
    if (text.length > maxCalendarTextLength) {
      throw new Error("Файл календаря слишком большой");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateImportSourceResult(
  sourceId: string,
  status: CalendarSyncStatus,
  message: string,
): Promise<void> {
  const source = await db.roomCalendarImportSource.update({
    where: { id: sourceId },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: status,
      lastSyncMessage: truncateText(message, 255),
    },
    select: { syncId: true },
  });
  await refreshCalendarSyncAggregate(db, source.syncId);
}

async function updateFallbackSyncResult(
  roomId: string,
  sourceId: string,
  status: CalendarSyncStatus,
  message: string,
): Promise<void> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { meta: true },
  });

  if (!room) {
    return;
  }

  const previous = readCalendarSyncMeta(room.meta);
  const nowIso = new Date().toISOString();
  const nextSources = (previous?.importSources ?? []).map((source) =>
    source.id === sourceId
      ? {
          ...source,
          lastSyncedAt: nowIso,
          lastSyncStatus: status,
          lastSyncMessage: truncateText(message, 255),
          updatedAt: nowIso,
        }
      : source,
  );
  const syncMeta = buildCalendarSyncMeta(previous, {
    importSources: nextSources,
  });

  await db.room.update({
    where: { id: roomId },
    data: {
      meta: buildRoomMetaWithCalendarSync(room.meta, syncMeta),
    },
  });
}

function getFallbackUidMarker(uid: string, sourceId = "legacy"): string {
  const digest = createHash("sha256").update(`${sourceId}:${uid}`).digest("hex").slice(0, 24);
  return `${fallbackUidMarkerPrefix}${digest}`;
}

function readFallbackUidMarker(description: string | null): string | null {
  const match = new RegExp(`${fallbackUidMarkerPrefix}[a-f0-9]{24}`).exec(description ?? "");
  return match?.[0] ?? null;
}

function buildImportedCalendarDescription(
  event: ParsedCalendarEvent,
  sourceLabel: string,
  sourceId = "legacy",
): string {
  const marker = getFallbackUidMarker(event.uid, sourceId);
  const label = event.summary
    ? `Импортировано из ${sourceLabel}: ${event.summary}`
    : `Импортировано из ${sourceLabel}`;

  return truncateText(`${marker} ${label}`, 250) ?? marker;
}

async function runRoomCalendarImportSource(input: {
  syncId: string;
  roomId: string;
  source: RoomCalendarImportSource;
}): Promise<CalendarImportResult> {
  if (!input.source.isEnabled || !input.source.importUrl) {
    throw new Error("Источник календаря отключен");
  }

  try {
    const sourceLabel = getImportedCalendarSourceLabel(input.source.label);
    const calendarText = await fetchCalendarText(input.source.importUrl);
    const parsed = parseBusyEventsFromCalendar(calendarText);
    const uniqueUids = Array.from(new Set(parsed.events.map((event) => event.uid)));

    const result = await db.$transaction(async (tx) => {
      const removed = await tx.roomOccupancy.deleteMany({
        where: {
          externalCalendarSourceId: input.source.id,
          ...(uniqueUids.length > 0
            ? {
                externalCalendarUid: {
                  notIn: uniqueUids,
                },
              }
            : {}),
        },
      });

      let importedCount = 0;
      let skippedCount = 0;

      for (const event of parsed.events) {
        const dateFrom = parseIsoDate(event.dateFrom);
        const dateTo = parseIsoDate(event.dateTo);
        if (!dateFrom || !dateTo || dateTo < dateFrom) {
          skippedCount += 1;
          continue;
        }

        const existingImported = await tx.roomOccupancy.findUnique({
          where: {
            externalCalendarSourceId_externalCalendarUid: {
              externalCalendarSourceId: input.source.id,
              externalCalendarUid: event.uid,
            },
          },
          select: { id: true },
        });
        const overlap = await tx.roomOccupancy.findFirst({
          where: {
            roomId: input.roomId,
            dateFrom: { lte: dateTo },
            dateTo: { gte: dateFrom },
            OR: [
              { externalCalendarSourceId: null },
              { externalCalendarSourceId: { not: input.source.id } },
            ],
            ...(existingImported ? { id: { not: existingImported.id } } : {}),
          },
          select: { id: true },
        });

        if (overlap) {
          if (existingImported) {
            await tx.roomOccupancy.delete({
              where: { id: existingImported.id },
            });
          }
          skippedCount += 1;
          continue;
        }

        const occupancyData = {
          dateFrom,
          dateTo,
          status: "CONFIRMED" as const,
          tag: truncateText(event.summary, 20) ?? importedCalendarFallbackTag,
          source: sourceLabel,
          color: "VIOLET",
          adultsCount: 1,
          childrenCount: 0,
          guestName: truncateText(event.summary, 120) ?? "Внешняя бронь",
          guestPhone: null,
          guestContacts: null,
          description: buildImportedCalendarDescription(event, sourceLabel, input.source.id),
        };

        await tx.roomOccupancy.upsert({
          where: {
            externalCalendarSourceId_externalCalendarUid: {
              externalCalendarSourceId: input.source.id,
              externalCalendarUid: event.uid,
            },
          },
          update: occupancyData,
          create: {
            roomId: input.roomId,
            ...occupancyData,
            externalCalendarSyncId: input.syncId,
            externalCalendarSourceId: input.source.id,
            externalCalendarUid: event.uid,
          },
        });
        importedCount += 1;
      }

      return {
        importedCount,
        skippedCount,
        removedCount: removed.count,
        warningCount: parsed.warnings.length,
      };
    });

    const status: CalendarSyncStatus =
      result.skippedCount > 0 || result.warningCount > 0 ? "PARTIAL" : "SUCCESS";
    const message = `Импортировано: ${result.importedCount}, пропущено: ${result.skippedCount}, удалено старых: ${result.removedCount}`;

    await updateImportSourceResult(input.source.id, status, message);

    return {
      ...result,
      status,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать календарь";
    await updateImportSourceResult(input.source.id, "ERROR", message);
    throw error;
  }
}

export async function runRoomCalendarImport(syncId: string): Promise<CalendarImportResult> {
  const sync = await db.roomCalendarSync.findUnique({
    where: { id: syncId },
  });

  if (!sync) {
    throw new Error("Настройки календаря не найдены");
  }

  const sources = (await ensureRoomCalendarImportSources(db, sync)).filter(
    (source) => source.isEnabled && source.importUrl,
  );

  if (sources.length === 0) {
    throw new Error("Для номера не подключены активные календари импорта");
  }

  const results: CalendarImportResult[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      results.push(
        await runRoomCalendarImportSource({ syncId: sync.id, roomId: sync.roomId, source }),
      );
    } catch (error) {
      errors.push(`${source.label}: ${error instanceof Error ? error.message : "ошибка импорта"}`);
    }
  }

  const importedCount = results.reduce((sum, result) => sum + result.importedCount, 0);
  const skippedCount = results.reduce((sum, result) => sum + result.skippedCount, 0);
  const removedCount = results.reduce((sum, result) => sum + result.removedCount, 0);
  const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0);
  const status: CalendarSyncStatus =
    errors.length > 0
      ? results.length > 0
        ? "PARTIAL"
        : "ERROR"
      : results.some((result) => result.status === "PARTIAL")
        ? "PARTIAL"
        : "SUCCESS";
  const message =
    errors.length > 0
      ? `Источников: ${sources.length}, успешно: ${results.length}, с ошибкой: ${errors.length}`
      : `Источников: ${sources.length}, импортировано: ${importedCount}, пропущено: ${skippedCount}, удалено старых: ${removedCount}`;

  await refreshCalendarSyncAggregate(db, sync.id);

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.slice(0, 2).join("; "));
  }

  return {
    importedCount,
    skippedCount,
    removedCount,
    warningCount: warningCount + errors.length,
    status,
    message,
  };
}

async function runFallbackCalendarImportSource(input: {
  roomId: string;
  source: CalendarImportSourceMeta;
}): Promise<CalendarImportResult> {
  if (!input.source.isEnabled || !input.source.importUrl) {
    throw new Error("Источник календаря отключен");
  }

  try {
    const sourceLabel = getImportedCalendarSourceLabel(input.source.label);
    const calendarText = await fetchCalendarText(input.source.importUrl);
    const parsed = parseBusyEventsFromCalendar(calendarText);
    const uniqueMarkers = new Set(
      parsed.events.map((event) => getFallbackUidMarker(event.uid, input.source.id)),
    );

    const result = await db.$transaction(async (tx) => {
      const importedOccupancies = await tx.roomOccupancy.findMany({
        where: {
          roomId: input.roomId,
          source: sourceLabel,
        },
        select: {
          id: true,
          description: true,
        },
      });

      const existingByMarker = new Map<string, { id: string }>();
      const staleIds: string[] = [];

      for (const occupancy of importedOccupancies) {
        const marker = readFallbackUidMarker(occupancy.description);
        if (!marker) {
          continue;
        }

        if (uniqueMarkers.has(marker)) {
          existingByMarker.set(marker, { id: occupancy.id });
        } else {
          staleIds.push(occupancy.id);
        }
      }

      const removed =
        staleIds.length > 0
          ? await tx.roomOccupancy.deleteMany({
              where: {
                id: { in: staleIds },
              },
            })
          : { count: 0 };

      let importedCount = 0;
      let skippedCount = 0;

      for (const event of parsed.events) {
        const dateFrom = parseIsoDate(event.dateFrom);
        const dateTo = parseIsoDate(event.dateTo);
        if (!dateFrom || !dateTo || dateTo < dateFrom) {
          skippedCount += 1;
          continue;
        }

        const marker = getFallbackUidMarker(event.uid, input.source.id);
        const existing = existingByMarker.get(marker);
        const overlap = await tx.roomOccupancy.findFirst({
          where: {
            roomId: input.roomId,
            dateFrom: { lte: dateTo },
            dateTo: { gte: dateFrom },
            source: { not: sourceLabel },
            ...(existing ? { id: { not: existing.id } } : {}),
          },
          select: { id: true },
        });

        if (overlap) {
          if (existing) {
            await tx.roomOccupancy.delete({
              where: {
                id: existing.id,
              },
            });
            existingByMarker.delete(marker);
          }
          skippedCount += 1;
          continue;
        }

        const data = {
          dateFrom,
          dateTo,
          status: "CONFIRMED" as const,
          tag: truncateText(event.summary, 20) ?? importedCalendarFallbackTag,
          source: sourceLabel,
          color: "VIOLET",
          adultsCount: 1,
          childrenCount: 0,
          guestName: truncateText(event.summary, 120) ?? "Внешняя бронь",
          guestPhone: null,
          guestContacts: null,
          description: buildImportedCalendarDescription(event, sourceLabel, input.source.id),
        };

        if (existing) {
          await tx.roomOccupancy.update({
            where: {
              id: existing.id,
            },
            data,
          });
        } else {
          await tx.roomOccupancy.create({
            data: {
              roomId: input.roomId,
              ...data,
            },
          });
        }

        importedCount += 1;
      }

      return {
        importedCount,
        skippedCount,
        removedCount: removed.count,
        warningCount: parsed.warnings.length,
      };
    });

    const status: CalendarSyncStatus =
      result.skippedCount > 0 || result.warningCount > 0 ? "PARTIAL" : "SUCCESS";
    const message = `Импортировано: ${result.importedCount}, пропущено: ${result.skippedCount}, удалено старых: ${result.removedCount}`;

    await updateFallbackSyncResult(input.roomId, input.source.id, status, message);

    return {
      ...result,
      status,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать календарь";
    await updateFallbackSyncResult(input.roomId, input.source.id, "ERROR", message);
    throw error;
  }
}

export async function runRoomCalendarImportFallback(roomId: string): Promise<CalendarImportResult> {
  const sync = await ensureRoomCalendarSyncFallback(db, roomId);
  const sources = sync.importSources.filter((source) => source.isEnabled && source.importUrl);

  if (sources.length === 0) {
    throw new Error("Для номера не подключены активные календари импорта");
  }

  const results: CalendarImportResult[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      results.push(await runFallbackCalendarImportSource({ roomId: sync.roomId, source }));
    } catch (error) {
      errors.push(`${source.label}: ${error instanceof Error ? error.message : "ошибка импорта"}`);
    }
  }

  const importedCount = results.reduce((sum, result) => sum + result.importedCount, 0);
  const skippedCount = results.reduce((sum, result) => sum + result.skippedCount, 0);
  const removedCount = results.reduce((sum, result) => sum + result.removedCount, 0);
  const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0);
  const status: CalendarSyncStatus =
    errors.length > 0
      ? results.length > 0
        ? "PARTIAL"
        : "ERROR"
      : results.some((result) => result.status === "PARTIAL")
        ? "PARTIAL"
        : "SUCCESS";
  const message =
    errors.length > 0
      ? `Источников: ${sources.length}, успешно: ${results.length}, с ошибкой: ${errors.length}`
      : `Источников: ${sources.length}, импортировано: ${importedCount}, пропущено: ${skippedCount}, удалено старых: ${removedCount}`;

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.slice(0, 2).join("; "));
  }

  return {
    importedCount,
    skippedCount,
    removedCount,
    warningCount: warningCount + errors.length,
    status,
    message,
  };
}

export async function runAutomaticRoomCalendarImports(limit = 50): Promise<{
  scanned: number;
  refreshed: number;
  failed: number;
}> {
  const syncs = await db.roomCalendarSync.findMany({
    where: {
      importSources: {
        some: {
          isEnabled: true,
        },
      },
    },
    orderBy: [{ lastSyncedAt: "asc" }, { updatedAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  let refreshed = 0;
  let failed = 0;

  for (const sync of syncs) {
    try {
      await runRoomCalendarImport(sync.id);
      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[calendar-sync/automatic]",
        sync.id,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    scanned: syncs.length,
    refreshed,
    failed,
  };
}

export async function findFallbackCalendarRoomByToken(
  token: string,
): Promise<CalendarFallbackExportRoom | null> {
  const room = await db.room.findFirst({
    where: {
      meta: {
        path: [calendarSyncMetaKey, "exportToken"],
        equals: token,
      },
    },
    select: {
      id: true,
      title: true,
      property: {
        select: {
          name: true,
          ownerDeletedAt: true,
        },
      },
    },
  });

  return room;
}
