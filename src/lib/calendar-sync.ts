import { createHash, randomBytes } from "node:crypto";
import { Prisma, type CalendarSyncStatus, type RoomCalendarSync } from "@prisma/client";
import { db, type DbClientLike } from "@/lib/db";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/pricing";

const maxCalendarUrlLength = 1000;
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

function normalizeRoomMeta(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? { ...value } : {};
}

function readCalendarSyncMeta(value: unknown): CalendarSyncMeta | null {
  const meta = normalizeRoomMeta(value);
  const rawSync = meta[calendarSyncMetaKey];

  if (!isPlainRecord(rawSync) || typeof rawSync.exportToken !== "string") {
    return null;
  }

  return {
    exportToken: rawSync.exportToken,
    importUrl: typeof rawSync.importUrl === "string" ? rawSync.importUrl : "",
    isImportEnabled: Boolean(rawSync.isImportEnabled),
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
  };
}

function buildCalendarSyncMeta(
  previous: CalendarSyncMeta | null,
  patch: Partial<CalendarSyncMeta> = {},
): CalendarSyncMeta {
  const nowIso = new Date().toISOString();

  return {
    exportToken: patch.exportToken ?? previous?.exportToken ?? createCalendarExportToken(),
    importUrl: patch.importUrl ?? previous?.importUrl ?? "",
    isImportEnabled: patch.isImportEnabled ?? previous?.isImportEnabled ?? false,
    lastSyncedAt: patch.lastSyncedAt ?? previous?.lastSyncedAt ?? null,
    lastSyncStatus: patch.lastSyncStatus ?? previous?.lastSyncStatus ?? null,
    lastSyncMessage: patch.lastSyncMessage ?? previous?.lastSyncMessage ?? null,
    updatedAt: nowIso,
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

export function buildCalendarExportUrl(requestUrl: string, exportToken: string): string {
  const url = new URL(requestUrl);
  return `${url.origin}/api/calendar/rooms/${exportToken}.ics`;
}

export function stripCalendarTokenSuffix(rawToken: string): string {
  return rawToken.endsWith(".ics") ? rawToken.slice(0, -4) : rawToken;
}

export function serializeRoomCalendarSync(
  sync: RoomCalendarSync,
  exportUrl: string,
): SerializedRoomCalendarSync {
  return {
    roomId: sync.roomId,
    exportUrl,
    importUrl: sync.importUrl ?? "",
    isImportEnabled: sync.isImportEnabled,
    lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: sync.lastSyncStatus,
    lastSyncMessage: sync.lastSyncMessage,
    updatedAt: sync.updatedAt.toISOString(),
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
    importUrl: string;
    isImportEnabled: boolean;
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
  const syncMeta = buildCalendarSyncMeta(previous, {
    importUrl: input.importUrl,
    isImportEnabled: input.isImportEnabled,
    lastSyncedAt: input.importUrl ? (previous?.lastSyncedAt ?? null) : null,
    lastSyncStatus: input.importUrl ? (previous?.lastSyncStatus ?? null) : null,
    lastSyncMessage: input.importUrl ? (previous?.lastSyncMessage ?? null) : null,
  });

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

async function updateSyncResult(
  syncId: string,
  status: CalendarSyncStatus,
  message: string,
): Promise<void> {
  await db.roomCalendarSync.update({
    where: { id: syncId },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: status,
      lastSyncMessage: truncateText(message, 255),
    },
  });
}

async function updateFallbackSyncResult(
  roomId: string,
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
  const syncMeta = buildCalendarSyncMeta(previous, {
    lastSyncedAt: new Date().toISOString(),
    lastSyncStatus: status,
    lastSyncMessage: truncateText(message, 255),
  });

  await db.room.update({
    where: { id: roomId },
    data: {
      meta: buildRoomMetaWithCalendarSync(room.meta, syncMeta),
    },
  });
}

function getFallbackUidMarker(uid: string): string {
  const digest = createHash("sha256").update(uid).digest("hex").slice(0, 24);
  return `${fallbackUidMarkerPrefix}${digest}`;
}

function readFallbackUidMarker(description: string | null): string | null {
  const match = new RegExp(`${fallbackUidMarkerPrefix}[a-f0-9]{24}`).exec(description ?? "");
  return match?.[0] ?? null;
}

function buildImportedCalendarDescription(event: ParsedCalendarEvent): string {
  const marker = getFallbackUidMarker(event.uid);
  const label = event.summary
    ? `Импортировано из календаря: ${event.summary}`
    : "Импортировано из календаря";

  return truncateText(`${marker} ${label}`, 250) ?? marker;
}

export async function runRoomCalendarImport(syncId: string): Promise<CalendarImportResult> {
  const sync = await db.roomCalendarSync.findUnique({
    where: { id: syncId },
    select: {
      id: true,
      roomId: true,
      importUrl: true,
      isImportEnabled: true,
    },
  });

  if (!sync) {
    throw new Error("Настройки календаря не найдены");
  }

  if (!sync.isImportEnabled || !sync.importUrl) {
    throw new Error("Для номера не включен импорт календаря");
  }

  try {
    const calendarText = await fetchCalendarText(sync.importUrl);
    const parsed = parseBusyEventsFromCalendar(calendarText);
    const uniqueUids = Array.from(new Set(parsed.events.map((event) => event.uid)));

    const result = await db.$transaction(async (tx) => {
      const removed = await tx.roomOccupancy.deleteMany({
        where: {
          externalCalendarSyncId: sync.id,
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

        const overlap = await tx.roomOccupancy.findFirst({
          where: {
            roomId: sync.roomId,
            dateFrom: { lte: dateTo },
            dateTo: { gte: dateFrom },
            OR: [{ externalCalendarSyncId: null }, { externalCalendarSyncId: { not: sync.id } }],
          },
          select: { id: true },
        });

        if (overlap) {
          await tx.roomOccupancy.deleteMany({
            where: {
              externalCalendarSyncId: sync.id,
              externalCalendarUid: event.uid,
            },
          });
          skippedCount += 1;
          continue;
        }

        await tx.roomOccupancy.upsert({
          where: {
            externalCalendarSyncId_externalCalendarUid: {
              externalCalendarSyncId: sync.id,
              externalCalendarUid: event.uid,
            },
          },
          update: {
            dateFrom,
            dateTo,
            status: "CONFIRMED",
            tag: truncateText(event.summary, 20) ?? importedCalendarFallbackTag,
            source: calendarSourceLabel,
            color: "VIOLET",
            adultsCount: 1,
            childrenCount: 0,
            guestName: truncateText(event.summary, 120) ?? "Внешняя бронь",
            guestPhone: null,
            guestContacts: null,
            description: truncateText(
              event.summary
                ? `Импортировано из календаря: ${event.summary}`
                : "Импортировано из календаря",
              250,
            ),
          },
          create: {
            roomId: sync.roomId,
            dateFrom,
            dateTo,
            status: "CONFIRMED",
            tag: truncateText(event.summary, 20) ?? importedCalendarFallbackTag,
            source: calendarSourceLabel,
            color: "VIOLET",
            adultsCount: 1,
            childrenCount: 0,
            guestName: truncateText(event.summary, 120) ?? "Внешняя бронь",
            guestPhone: null,
            guestContacts: null,
            description: truncateText(
              event.summary
                ? `Импортировано из календаря: ${event.summary}`
                : "Импортировано из календаря",
              250,
            ),
            externalCalendarSyncId: sync.id,
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

    await updateSyncResult(sync.id, status, message);

    return {
      ...result,
      status,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать календарь";
    await updateSyncResult(sync.id, "ERROR", message);
    throw error;
  }
}

export async function runRoomCalendarImportFallback(roomId: string): Promise<CalendarImportResult> {
  const sync = await ensureRoomCalendarSyncFallback(db, roomId);

  if (!sync.isImportEnabled || !sync.importUrl) {
    throw new Error("Для номера не включен импорт календаря");
  }

  try {
    const calendarText = await fetchCalendarText(sync.importUrl);
    const parsed = parseBusyEventsFromCalendar(calendarText);
    const uniqueMarkers = new Set(parsed.events.map((event) => getFallbackUidMarker(event.uid)));

    const result = await db.$transaction(async (tx) => {
      const importedOccupancies = await tx.roomOccupancy.findMany({
        where: {
          roomId: sync.roomId,
          source: calendarSourceLabel,
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

        const marker = getFallbackUidMarker(event.uid);
        const existing = existingByMarker.get(marker);
        const overlap = await tx.roomOccupancy.findFirst({
          where: {
            roomId: sync.roomId,
            dateFrom: { lte: dateTo },
            dateTo: { gte: dateFrom },
            source: { not: calendarSourceLabel },
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
          source: calendarSourceLabel,
          color: "VIOLET",
          adultsCount: 1,
          childrenCount: 0,
          guestName: truncateText(event.summary, 120) ?? "Внешняя бронь",
          guestPhone: null,
          guestContacts: null,
          description: buildImportedCalendarDescription(event),
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
              roomId: sync.roomId,
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

    await updateFallbackSyncResult(sync.roomId, status, message);

    return {
      ...result,
      status,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать календарь";
    await updateFallbackSyncResult(sync.roomId, "ERROR", message);
    throw error;
  }
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
