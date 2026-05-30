import { type NextRequest, NextResponse } from "next/server";
import { copyNextYearRoomPricesAutomatically } from "@/lib/chessboard-year-copy";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await copyNextYearRoomPricesAutomatically();

    console.log(`[cron/chessboard-year-transfer] ${JSON.stringify(result)}`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/chessboard-year-transfer]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = GET;
