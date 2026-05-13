import { NextResponse } from "next/server";
import {
  ensureRoomCalendarSync,
  getAccessibleCalendarRoom,
  runRoomCalendarImport,
  runRoomCalendarImportFallback,
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

export async function POST(_request: Request, context: RouteContext) {
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
    try {
      const result = await runRoomCalendarImportFallback(room.id);
      return NextResponse.json({ result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Не удалось импортировать календарь" },
        { status: 400 },
      );
    }
  }

  const sync = await ensureRoomCalendarSync(db, room.id);

  if (!sync.isImportEnabled || !sync.importUrl) {
    return NextResponse.json(
      { error: "Сначала сохраните ссылку импорта и включите импорт" },
      { status: 400 },
    );
  }

  try {
    const result = await runRoomCalendarImport(sync.id);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось импортировать календарь" },
      { status: 400 },
    );
  }
}
