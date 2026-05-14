import { NextResponse } from "next/server";
import {
  buildCalendarExportUrl,
  ensureRoomCalendarSync,
  ensureRoomCalendarImportSources,
  ensureRoomCalendarSyncFallback,
  getAccessibleCalendarRoom,
  replaceRoomCalendarImportSources,
  serializeFallbackRoomCalendarSync,
  serializeRoomCalendarSync,
  updateRoomCalendarSyncFallback,
  validateCalendarImportSourcesInput,
} from "@/lib/calendar-sync";
import { areDatabaseColumnsAvailable, db, isDatabaseTableAvailable } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";

type RouteContext = {
  params: Promise<{ id: string; roomId: string }>;
};

async function isCalendarSyncSchemaReady() {
  return (
    (await isDatabaseTableAvailable("RoomCalendarSync")) &&
    (await isDatabaseTableAvailable("RoomCalendarImportSource")) &&
    (await areDatabaseColumnsAvailable("RoomOccupancy", [
      "externalCalendarSyncId",
      "externalCalendarSourceId",
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
  const sources = await ensureRoomCalendarImportSources(db, sync);
  return NextResponse.json({
    item: serializeRoomCalendarSync(
      sync,
      buildCalendarExportUrl(request.url, sync.exportToken),
      sources,
    ),
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
  const validatedSources = validateCalendarImportSourcesInput(
    "importSources" in input ? input.importSources : undefined,
    {
      importUrl: rawImportUrl,
      isImportEnabled,
    },
  );

  if (!validatedSources.ok) {
    return NextResponse.json({ error: validatedSources.error }, { status: 400 });
  }

  if (!(await isCalendarSyncSchemaReady())) {
    const sync = await updateRoomCalendarSyncFallback(db, room.id, {
      importSources: validatedSources.sources,
    });

    return NextResponse.json({
      item: serializeFallbackRoomCalendarSync(
        sync,
        buildCalendarExportUrl(request.url, sync.exportToken),
      ),
    });
  }

  const existing = await ensureRoomCalendarSync(db, room.id);
  await ensureRoomCalendarImportSources(db, existing);
  const { sync, sources } = await db.$transaction(async (tx) => {
    return replaceRoomCalendarImportSources(tx, existing.id, validatedSources.sources);
  });

  return NextResponse.json({
    item: serializeRoomCalendarSync(
      sync,
      buildCalendarExportUrl(request.url, sync.exportToken),
      sources,
    ),
  });
}
