// Cron endpoint: delete property drafts older than 14 days (including storage files).
//
// Call daily via any external scheduler (Vercel Cron, GitHub Actions, system cron):
//   GET /api/cron/cleanup-drafts
//   Authorization: Bearer <CRON_SECRET>
//
// Vercel Cron sends the Authorization header automatically when CRON_SECRET is set.
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purgeExpiredPropertyDrafts } from "@/lib/properties";

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
    const deleted = await purgeExpiredPropertyDrafts(db);
    console.log(`[cron/cleanup-drafts] deleted=${deleted}`);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("[cron/cleanup-drafts]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Allow POST as well for manual curl invocations.
export const POST = GET;
