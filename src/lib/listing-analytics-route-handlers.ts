import { NextResponse } from "next/server";
import { getEditorSession } from "@/lib/editor-access";
import type { ListingEntityType } from "@/lib/listing-analytics";
import {
  ListingAnalyticsServiceError,
  getListingAnalyticsEntityForEditor,
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

export async function handleListingAnalyticsGet(
  request: Request,
  entityType: ListingEntityType,
  entityId: string,
) {
  const editor = await getEditorSession();
  const entity = await getListingAnalyticsEntityForEditor(entityType, entityId, editor);

  if (!editor) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!entity) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  }

  const url = new URL(request.url);

  try {
    return NextResponse.json(
      await getListingAnalyticsStatsPayload({
        entityType,
        entityId,
        periodKey: normalizePeriodKey(url.searchParams.get("period")),
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}

export async function handleListingAnalyticsRefresh(
  entityType: ListingEntityType,
  entityId: string,
) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const payload = await runManualListingAnalyticsRefresh({ entityType, entityId, editor });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}
