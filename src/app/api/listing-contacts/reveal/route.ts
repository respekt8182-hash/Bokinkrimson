import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/csrf";
import {
  ContactRevealRateLimitError,
  ContactRevealUnavailableError,
  revealListingContacts,
} from "@/lib/listing-contact-reveal";
import { normalizeAnalyticsVisitorId } from "@/lib/listing-analytics-request";
import { normalizeListingEntityType } from "@/lib/listing-analytics";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "CSRF_CHECK_FAILED" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    entityType?: unknown;
    entityId?: unknown;
    visitorId?: unknown;
  } | null;
  const entityType = normalizeListingEntityType(body?.entityType);
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";
  const visitorId = normalizeAnalyticsVisitorId(body?.visitorId);

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "INVALID_LISTING" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const payload = await revealListingContacts({
      request,
      entityType,
      entityId,
      visitorId,
      userId: session?.id ?? null,
    });

    if (!payload) {
      return NextResponse.json({ error: "LISTING_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ContactRevealRateLimitError) {
      return NextResponse.json(
        { error: "RATE_LIMITED", retryAfterSeconds: error.result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(error.result.retryAfterSeconds),
          },
        },
      );
    }

    if (error instanceof ContactRevealUnavailableError) {
      return NextResponse.json(
        { error: "CONTACT_REVEAL_UNAVAILABLE" },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    throw error;
  }
}
