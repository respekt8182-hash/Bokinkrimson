import { NextResponse } from "next/server";
import {
  buildCalendarExportUrl,
  ensureRoomCalendarSync,
  ensureRoomCalendarSyncFallback,
  getAccessibleCalendarRoom,
  serializeFallbackRoomCalendarSync,
  serializeRoomCalendarSync,
  updateRoomCalendarSyncFallback,
  validateCalendarImportUrl,
} from "@/lib/calendar-sync";
import { areDatabaseColumnsAvailable, db, isDatabaseTableAvailable } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";

type RouteContext = {
  params: Promise<{ id: string; roomId: string }>;
};

async function isCalendarSyncSchemaReady() {
  return (
    (await isDatabaseTableAvailable("RoomCalendarSync")) &&
    (await areDatabaseColumnsAvailable("RoomOccupancy", [
      "externalCalendarSyncId",
      "externalCalendarUid",
    ]))
  );
}

export async function GET(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleCalendarRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  if (!(await isCalendarSyncSchemaReady())) {
    const sync = await ensureRoomCalendarSyncFallback(db, room.id);
    return NextResponse.json({
      item: serializeFallbackRoomCalendarSync(
        sync,
        buildCalendarExportUrl(request.url, sync.exportToken),
      ),
    });
  }

  const sync = await ensureRoomCalendarSync(db, room.id);
  return NextResponse.json({
    item: serializeRoomCalendarSync(sync, buildCalendarExportUrl(request.url, sync.exportToken)),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleCalendarRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const input = payload && typeof payload === "object" ? payload : {};
  const rawImportUrl =
    "importUrl" in input && typeof input.importUrl === "string" ? input.importUrl : "";
  const isImportEnabled =
    "isImportEnabled" in input ? Boolean(input.isImportEnabled) : rawImportUrl.trim().length > 0;
  const validatedUrl = validateCalendarImportUrl(rawImportUrl);

  if (!validatedUrl.ok) {
    return NextResponse.json({ error: validatedUrl.error }, { status: 400 });
  }

  if (isImportEnabled && !validatedUrl.url) {
    return NextResponse.json(
      { error: "Укажите ссылку для импорта или выключите импорт" },
      { status: 400 },
    );
  }

  if (!(await isCalendarSyncSchemaReady())) {
    const sync = await updateRoomCalendarSyncFallback(db, room.id, {
      importUrl: validatedUrl.url || "",
      isImportEnabled: Boolean(isImportEnabled && validatedUrl.url),
    });

    return NextResponse.json({
      item: serializeFallbackRoomCalendarSync(
        sync,
        buildCalendarExportUrl(request.url, sync.exportToken),
      ),
    });
  }

  const existing = await ensureRoomCalendarSync(db, room.id);
  const sync = await db.roomCalendarSync.update({
    where: { id: existing.id },
    data: {
      importUrl: validatedUrl.url || null,
      isImportEnabled: Boolean(isImportEnabled && validatedUrl.url),
      lastSyncStatus: validatedUrl.url ? existing.lastSyncStatus : null,
      lastSyncMessage: validatedUrl.url ? existing.lastSyncMessage : null,
      lastSyncedAt: validatedUrl.url ? existing.lastSyncedAt : null,
    },
  });

  return NextResponse.json({
    item: serializeRoomCalendarSync(sync, buildCalendarExportUrl(request.url, sync.exportToken)),
  });
}
