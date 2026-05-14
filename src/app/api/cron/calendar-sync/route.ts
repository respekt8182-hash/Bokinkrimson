import { type NextRequest, NextResponse } from "next/server";
import { runAutomaticRoomCalendarImports } from "@/lib/calendar-sync";
import { areDatabaseColumnsAvailable, isDatabaseTableAvailable } from "@/lib/db";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isCalendarSyncSchemaReady())) {
    return NextResponse.json({ error: "Calendar sync schema is not ready" }, { status: 503 });
  }

  try {
    const result = await runAutomaticRoomCalendarImports();
    console.log(
      `[cron/calendar-sync] scanned=${result.scanned} refreshed=${result.refreshed} failed=${result.failed}`,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/calendar-sync]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = GET;
