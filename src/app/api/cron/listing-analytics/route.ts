import { type NextRequest, NextResponse } from "next/server";
import {
  ListingAnalyticsServiceError,
  refreshDueListingAnalytics,
} from "@/lib/listing-analytics-service";

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
    const result = await refreshDueListingAnalytics();
    console.log(
      `[cron/listing-analytics] scanned=${result.scanned} refreshed=${result.refreshed} failed=${result.failed}`,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof ListingAnalyticsServiceError &&
      error.code === "TABLES_UNAVAILABLE"
    ) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[cron/listing-analytics]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = GET;
