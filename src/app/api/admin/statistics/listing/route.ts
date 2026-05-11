import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { normalizeListingEntityType } from "@/lib/listing-analytics";
import {
  ListingAnalyticsServiceError,
  getListingAnalyticsStatsPayload,
  runManualListingAnalyticsRefresh,
  type ListingAnalyticsPeriodKey,
} from "@/lib/listing-analytics-service";

function normalizePeriodKey(value: string | null): ListingAnalyticsPeriodKey {
  if (
    value === "today" ||
    value === "last7Days" ||
    value === "last30Days" ||
    value === "last6Months"
  ) {
    return value;
  }

  if (value?.startsWith("month:") && /^\d{4}-\d{2}$/.test(value.slice("month:".length))) {
    return value as ListingAnalyticsPeriodKey;
  }

  return "last30Days";
}

function statusFromError(error: unknown): number {
  if (!(error instanceof ListingAnalyticsServiceError)) {
    return 500;
  }

  if (error.code === "NOT_FOUND") {
    return 404;
  }

  if (error.code === "MANUAL_LIMIT_REACHED") {
    return 429;
  }

  if (error.code === "REFRESH_IN_PROGRESS") {
    return 409;
  }

  if (error.code === "TABLES_UNAVAILABLE") {
    return 503;
  }

  return 500;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось загрузить статистику.";
}

export async function GET(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const url = new URL(request.url);
  const entityType = normalizeListingEntityType(url.searchParams.get("entityType"));
  const entityId = url.searchParams.get("id")?.trim() ?? "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Некорректная карточка" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await getListingAnalyticsStatsPayload({
        entityType,
        entityId,
        periodKey: normalizePeriodKey(url.searchParams.get("period")),
        includeRawEvents: true,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const url = new URL(request.url);
  const entityType = normalizeListingEntityType(url.searchParams.get("entityType"));
  const entityId = url.searchParams.get("id")?.trim() ?? "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Некорректная карточка" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await runManualListingAnalyticsRefresh({
        entityType,
        entityId,
        editor: {
          kind: "admin",
          id: admin.id,
          isAdmin: true,
        },
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}
