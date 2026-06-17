import { NextRequest, NextResponse } from "next/server";
import { markContactHoneypotHit } from "@/lib/listing-contact-reveal";
import { normalizeAnalyticsVisitorId } from "@/lib/listing-analytics-request";

async function mark(request: NextRequest): Promise<NextResponse> {
  const visitorId =
    normalizeAnalyticsVisitorId(request.nextUrl.searchParams.get("visitorId")) ??
    normalizeAnalyticsVisitorId(
      ((await request
        .json()
        .catch(() => null)) as { visitorId?: unknown } | null)?.visitorId,
    );

  markContactHoneypotHit(request, visitorId);

  return NextResponse.json(
    { error: "NOT_FOUND" },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  return mark(request);
}

export async function POST(request: NextRequest) {
  return mark(request);
}
