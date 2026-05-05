// Cron endpoint: delete empty property/excursion drafts older than 15 days.
//
// Call daily via any external scheduler (Vercel Cron, GitHub Actions, system cron):
//   GET /api/cron/cleanup-drafts
//   Authorization: Bearer <CRON_SECRET>
//
// Vercel Cron sends the Authorization header automatically when CRON_SECRET is set.
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purgeExpiredExcursionDrafts } from "@/lib/excursions";
import { purgeExpiredPropertyDrafts } from "@/lib/properties";
import { pruneUnusedPublicUploads } from "@/lib/storage-cleanup";

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
    const [deletedProperties, deletedExcursions] = await Promise.all([
      purgeExpiredPropertyDrafts(db),
      purgeExpiredExcursionDrafts(db),
    ]);
    const uploadCleanup = await pruneUnusedPublicUploads(db);

    console.log(
      `[cron/cleanup-drafts] deletedProperties=${deletedProperties} deletedExcursions=${deletedExcursions} orphanUploadsDeleted=${uploadCleanup.deleted}`,
    );
    return NextResponse.json({
      deletedProperties,
      deletedExcursions,
      orphanUploadsDeleted: uploadCleanup.deleted,
      orphanUploadsScanned: uploadCleanup.scanned,
      deleted: deletedProperties + deletedExcursions,
    });
  } catch (error) {
    console.error("[cron/cleanup-drafts]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Allow POST as well for manual curl invocations.
export const POST = GET;
