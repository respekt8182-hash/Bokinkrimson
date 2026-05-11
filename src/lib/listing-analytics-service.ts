import { Prisma } from "@prisma/client";
import {
  db,
  isDatabaseTableAvailable,
  type DbClientLike,
  type DbTransactionClient,
} from "@/lib/db";
import type { EditorSession } from "@/lib/editor-access";
import {
  LISTING_ACTION_LABELS,
  buildListingActionCounterGroup,
  normalizeListingActionType,
  type ListingActionType,
  type ListingEntityType,
} from "@/lib/listing-analytics";
import { getListingStatsData } from "@/lib/listing-statistics";
import {
  LISTING_ANALYTICS_CRON_SETTING_KEY,
  LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT,
  LISTING_ANALYTICS_REFRESH_LOCK_MINUTES,
  LISTING_ANALYTICS_STALE_AFTER_HOURS,
  getListingAnalyticsDedupWindowMinutes,
  getListingAnalyticsAutoUpdateHour,
  getListingAnalyticsCronBatchLimit,
  getListingAnalyticsTimeZone,
} from "@/lib/listing-analytics-config";
import type { ListingAnalyticsActorRole } from "@/lib/listing-analytics-request";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const AGGREGATE_TABLES = [
  "ListingAnalyticsDailyAggregate",
  "ListingAnalyticsMonthlyAggregate",
  "ListingAnalyticsRefreshState",
] as const;

export type ListingAnalyticsPeriodKey =
  | "today"
  | "last7Days"
  | "last30Days"
  | "last6Months"
  | `month:${string}`;

export type ListingAnalyticsBreakdown = {
  phones: number;
  messengers: number;
  leads: number;
  website: number;
  booking: number;
  other: number;
};

export type ListingAnalyticsBreakdownItem = {
  actionType: string;
  label: string;
  count: number;
};

export type ListingAnalyticsRawEvent = {
  id: string;
  entityType: ListingEntityType;
  entityId: string;
  entityPublicId: number | null;
  eventType: string;
  occurredAt: string;
  actorRole: ListingAnalyticsActorRole;
  userId: string | null;
  isUnique: boolean;
  channel: string | null;
  leadNumber: string | null;
  source: string | null;
};

export type ListingAnalyticsPeriodSummary = {
  views: number;
  actions: number;
  conversion: number | null;
};

export type ListingAnalyticsChartPoint = {
  date: string;
  views: number;
  actions: number;
};

export type ListingAnalyticsMonth = ListingAnalyticsPeriodSummary & {
  month: string;
  label: string;
  activityLevel: "none" | "low" | "medium" | "high";
  breakdown: ListingAnalyticsBreakdown;
  breakdownItems: ListingAnalyticsBreakdownItem[];
};

export type ListingAnalyticsPayload = {
  entityType: ListingEntityType;
  entityId: string;
  entityPublicId: number | null;
  entityName: string;
  ownerId: string | null;
  lastUpdatedAt: string | null;
  nextAutoUpdateAt: string | null;
  updateStatus: "idle" | "updating" | "success" | "error";
  isStale: boolean;
  staleReason: string | null;
  manualRefresh: {
    limitPerDay: number;
    usedToday: number;
    remainingToday: number;
    canRefresh: boolean;
    isUpdating: boolean;
  };
  summary: {
    today: ListingAnalyticsPeriodSummary;
    last7Days: ListingAnalyticsPeriodSummary;
    last30Days: ListingAnalyticsPeriodSummary;
    last6Months: ListingAnalyticsPeriodSummary;
  };
  selectedPeriod: ListingAnalyticsPeriodSummary & {
    key: ListingAnalyticsPeriodKey;
    label: string;
    breakdown: ListingAnalyticsBreakdown;
    breakdownItems: ListingAnalyticsBreakdownItem[];
    chart: ListingAnalyticsChartPoint[];
  };
  dailyActivity: ListingAnalyticsChartPoint[];
  months: ListingAnalyticsMonth[];
  meta: {
    autoUpdateHour: number;
    timeZone: string;
    source: "aggregated" | "legacy";
    lastEventAt: string | null;
    lastError: string | null;
  };
  adminRawEvents?: ListingAnalyticsRawEvent[];
};

type ListingAnalyticsEntity = {
  id: string;
  publicId: number | null;
  ownerId: string;
  name: string;
  totalViews: number;
  createdAt: Date;
  publishedAt: Date;
};

type ViewSourceRow = {
  date: Date;
  count: number;
  updatedAt: Date;
};

type ActionSourceRow = {
  date: Date;
  actionType: string;
  count: number;
  updatedAt: Date;
};

type AggregateAccumulator = {
  periodStart: Date;
  views: number;
  actionBreakdown: Map<string, number>;
  lastEventAt: Date | null;
};

type AggregateRow = {
  entityType: ListingEntityType;
  entityId: string;
  periodStart: Date;
  views: number;
  actions: number;
  phoneActions: number;
  messengerActions: number;
  leadActions: number;
  websiteActions: number;
  bookingActions: number;
  otherActions: number;
  actionBreakdown: Prisma.InputJsonObject;
};

export class ListingAnalyticsServiceError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "TABLES_UNAVAILABLE"
      | "MANUAL_LIMIT_REACHED"
      | "REFRESH_IN_PROGRESS",
    message: string,
  ) {
    super(message);
  }
}

function normalizeUtcDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function toDateKey(date: Date): string {
  return normalizeUtcDate(date).toISOString().slice(0, 10);
}

function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toMonthKey(date: Date): string {
  const normalized = normalizeUtcDate(date);
  return `${normalized.getUTCFullYear()}-${String(normalized.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToUtcDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, 1));
}

function formatMonthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthKeyToUtcDate(monthKey));
}

function getZonedDateKey(date = new Date(), timeZone = getListingAnalyticsTimeZone()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function getNextAutoUpdateAt(now = new Date()): Date {
  const autoHour = getListingAnalyticsAutoUpdateHour();
  const todayKey = getZonedDateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  let candidate = new Date(Date.UTC(year, month - 1, day, autoHour - 3, 0, 0, 0));

  if (candidate <= now) {
    candidate = new Date(candidate.getTime() + DAY_MS);
  }

  return candidate;
}

function buildDateRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const cursor = normalizeUtcDate(start);
  const normalizedEnd = normalizeUtcDate(end);

  while (cursor <= normalizedEnd) {
    result.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function getRollingSixMonthKeys(now = new Date()): string[] {
  const today = normalizeUtcDate(now);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));

  return Array.from({ length: 6 }, (_, index) =>
    toMonthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1))),
  );
}

function addCount(map: Map<string, number>, key: string, count: number): void {
  map.set(key, (map.get(key) ?? 0) + Math.max(0, Number(count ?? 0)));
}

function mergeBreakdown(
  target: Map<string, number>,
  source: Map<string, number> | Record<string, unknown>,
): void {
  const entries = source instanceof Map ? source.entries() : Object.entries(source);

  for (const [actionType, value] of entries) {
    const normalized = normalizeListingActionType(actionType);
    const count = Number(value);

    if (!normalized || !Number.isFinite(count) || count <= 0) {
      continue;
    }

    addCount(target, normalized, count);
  }
}

function toBreakdownJson(actionBreakdown: Map<string, number>): Prisma.InputJsonObject {
  return Object.fromEntries(
    [...actionBreakdown.entries()].filter(([, count]) => count > 0),
  ) as Prisma.InputJsonObject;
}

function toBreakdownMap(value: Prisma.JsonValue | Prisma.InputJsonValue | null): Map<string, number> {
  const result = new Map<string, number>();

  if (!value || Array.isArray(value) || typeof value !== "object") {
    return result;
  }

  mergeBreakdown(result, value as Record<string, unknown>);
  return result;
}

function buildBreakdownItems(
  actionBreakdown: Map<string, number>,
): ListingAnalyticsBreakdownItem[] {
  return [...actionBreakdown.entries()]
    .map(([actionType, count]) => ({
      actionType,
      label:
        normalizeListingActionType(actionType) !== null
          ? LISTING_ACTION_LABELS[actionType as ListingActionType]
          : actionType,
      count,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ru"));
}

function buildAggregateRow(
  entityType: ListingEntityType,
  entityId: string,
  accumulator: AggregateAccumulator,
): AggregateRow {
  const counters = buildListingActionCounterGroup(accumulator.actionBreakdown);
  const actions = [...accumulator.actionBreakdown.values()].reduce(
    (sum, count) => sum + Math.max(0, count),
    0,
  );

  return {
    entityType,
    entityId,
    periodStart: accumulator.periodStart,
    views: Math.max(0, accumulator.views),
    actions,
    phoneActions: counters.phones,
    messengerActions: counters.messengers,
    leadActions: counters.leads,
    websiteActions: counters.website,
    bookingActions: counters.booking,
    otherActions: counters.other,
    actionBreakdown: toBreakdownJson(accumulator.actionBreakdown),
  };
}

function buildPeriodSummary(views: number, actions: number): ListingAnalyticsPeriodSummary {
  return {
    views,
    actions,
    conversion: views > 0 ? Number(((actions / views) * 100).toFixed(1)) : null,
  };
}

function toActivityLevel(views: number, actions: number): ListingAnalyticsMonth["activityLevel"] {
  const score = views + actions * 4;

  if (score <= 0) {
    return "none";
  }

  if (score < 10) {
    return "low";
  }

  if (score < 50) {
    return "medium";
  }

  return "high";
}

async function areAggregateTablesAvailable(client: DbClientLike = db): Promise<boolean> {
  const availability = await Promise.all(
    AGGREGATE_TABLES.map((tableName) => isDatabaseTableAvailable(tableName, client)),
  );

  return availability.every(Boolean);
}

async function resolveListingEntity(
  entityType: ListingEntityType,
  entityId: string,
  client: DbClientLike = db,
): Promise<ListingAnalyticsEntity | null> {
  if (entityType === "property") {
    const property = await client.property.findFirst({
      where: { id: entityId, ownerDeletedAt: null },
      select: {
        id: true,
        publicId: true,
        ownerId: true,
        name: true,
        profileViews: true,
        status: true,
        createdAt: true,
        moderatedAt: true,
      },
    });

    if (!property) {
      return null;
    }

    return {
      id: property.id,
      publicId: property.publicId ?? null,
      ownerId: property.ownerId,
      name: property.name?.trim() || "Объект размещения",
      totalViews: Math.max(0, property.profileViews),
      createdAt: property.createdAt,
      publishedAt:
        property.status === "PUBLISHED" ? (property.moderatedAt ?? property.createdAt) : property.createdAt,
    };
  }

  if (entityType === "excursion") {
    const excursion = await client.excursion.findFirst({
      where: { id: entityId, deletedAt: null },
      select: {
        id: true,
        publicId: true,
        ownerId: true,
        title: true,
        profileViews: true,
        status: true,
        offerType: true,
        createdAt: true,
        moderatedAt: true,
      },
    });

    if (!excursion) {
      return null;
    }

    return {
      id: excursion.id,
      publicId: excursion.publicId ?? null,
      ownerId: excursion.ownerId,
      name:
        excursion.title?.trim() ||
        (excursion.offerType === "TOUR" ? "Тур" : "Экскурсия"),
      totalViews: Math.max(0, excursion.profileViews),
      createdAt: excursion.createdAt,
      publishedAt:
        excursion.status === "PUBLISHED"
          ? (excursion.moderatedAt ?? excursion.createdAt)
          : excursion.createdAt,
    };
  }

  const transfer = await client.transfer.findFirst({
    where: { id: entityId },
    select: {
      id: true,
      publicId: true,
      ownerId: true,
      title: true,
      profileViews: true,
      status: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  if (!transfer) {
    return null;
  }

  return {
    id: transfer.id,
    publicId: transfer.publicId ?? null,
    ownerId: transfer.ownerId,
    name: transfer.title?.trim() || "Трансфер",
    totalViews: Math.max(0, transfer.profileViews),
    createdAt: transfer.createdAt,
    publishedAt:
      transfer.status === "PUBLISHED" ? (transfer.publishedAt ?? transfer.createdAt) : transfer.createdAt,
  };
}

export async function getListingAnalyticsEntityForEditor(
  entityType: ListingEntityType,
  entityId: string,
  editor: EditorSession | null,
): Promise<ListingAnalyticsEntity | null> {
  if (!editor) {
    return null;
  }

  const entity = await resolveListingEntity(entityType, entityId);

  if (!entity) {
    return null;
  }

  if (!editor.isAdmin && entity.ownerId !== editor.id) {
    return null;
  }

  return entity;
}

async function markRefreshState(
  entityType: ListingEntityType,
  entity: ListingAnalyticsEntity,
  status: "updating" | "success" | "error",
  input?: {
    lastAggregatedAt?: Date | null;
    lastEventAt?: Date | null;
    lastError?: string | null;
  },
): Promise<void> {
  if (!(await isDatabaseTableAvailable("ListingAnalyticsRefreshState"))) {
    return;
  }

  const now = new Date();

  await db.listingAnalyticsRefreshState.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId: entity.id,
      },
    },
    create: {
      entityType,
      entityId: entity.id,
      ownerId: entity.ownerId,
      status,
      refreshStartedAt: status === "updating" ? now : null,
      refreshFinishedAt: status === "updating" ? null : now,
      lastAggregatedAt: input?.lastAggregatedAt ?? null,
      lastEventAt: input?.lastEventAt ?? null,
      nextAutoUpdateAt: getNextAutoUpdateAt(now),
      lastError: input?.lastError ?? null,
    },
    update: {
      ownerId: entity.ownerId,
      status,
      refreshStartedAt: status === "updating" ? now : undefined,
      refreshFinishedAt: status === "updating" ? null : now,
      lastAggregatedAt: input?.lastAggregatedAt ?? undefined,
      lastEventAt: input?.lastEventAt ?? undefined,
      nextAutoUpdateAt: getNextAutoUpdateAt(now),
      lastError: input?.lastError ?? null,
    },
  });
}

async function readSourceRows(
  entityType: ListingEntityType,
  entityId: string,
  fromDate: Date,
  client: DbClientLike = db,
): Promise<{ views: ViewSourceRow[]; actions: ActionSourceRow[] }> {
  const queryStart = normalizeUtcDate(fromDate);
  const [views, actions] = await Promise.all([
    client.viewLog.findMany({
      where: {
        entityType,
        entityId,
        date: {
          gte: queryStart,
        },
      },
      select: { date: true, count: true, updatedAt: true },
      orderBy: { date: "asc" },
    }) as Promise<ViewSourceRow[]>,
    isDatabaseTableAvailable("EngagementLog", client).then((available) => {
      if (!available) {
        return [] as ActionSourceRow[];
      }

      return client.engagementLog.findMany({
        where: {
          entityType,
          entityId,
          date: {
            gte: queryStart,
          },
        },
        select: { date: true, actionType: true, count: true, updatedAt: true },
        orderBy: [{ date: "asc" }, { actionType: "asc" }],
      }) as Promise<ActionSourceRow[]>;
    }),
  ]);

  return { views, actions };
}

function buildAggregateRowsFromSource(
  entityType: ListingEntityType,
  entityId: string,
  sourceRows: { views: ViewSourceRow[]; actions: ActionSourceRow[] },
): { dailyRows: AggregateRow[]; monthlyRows: AggregateRow[]; lastEventAt: Date | null } {
  const byDate = new Map<string, AggregateAccumulator>();
  const byMonth = new Map<string, AggregateAccumulator>();
  let lastEventAt: Date | null = null;

  const getDateAccumulator = (date: Date): AggregateAccumulator => {
    const key = toDateKey(date);
    const existing = byDate.get(key);

    if (existing) {
      return existing;
    }

    const next: AggregateAccumulator = {
      periodStart: dateKeyToUtcDate(key),
      views: 0,
      actionBreakdown: new Map(),
      lastEventAt: null,
    };
    byDate.set(key, next);
    return next;
  };

  const getMonthAccumulator = (date: Date): AggregateAccumulator => {
    const key = toMonthKey(date);
    const existing = byMonth.get(key);

    if (existing) {
      return existing;
    }

    const next: AggregateAccumulator = {
      periodStart: monthKeyToUtcDate(key),
      views: 0,
      actionBreakdown: new Map(),
      lastEventAt: null,
    };
    byMonth.set(key, next);
    return next;
  };

  const touch = (updatedAt: Date) => {
    if (!lastEventAt || updatedAt > lastEventAt) {
      lastEventAt = updatedAt;
    }
  };

  for (const row of sourceRows.views) {
    const count = Math.max(0, row.count);
    getDateAccumulator(row.date).views += count;
    getMonthAccumulator(row.date).views += count;
    touch(row.updatedAt);
  }

  for (const row of sourceRows.actions) {
    const actionType = normalizeListingActionType(row.actionType);
    const count = Math.max(0, row.count);

    if (!actionType || count <= 0) {
      continue;
    }

    addCount(getDateAccumulator(row.date).actionBreakdown, actionType, count);
    addCount(getMonthAccumulator(row.date).actionBreakdown, actionType, count);
    touch(row.updatedAt);
  }

  return {
    dailyRows: [...byDate.values()]
      .map((item) => buildAggregateRow(entityType, entityId, item))
      .sort((left, right) => left.periodStart.getTime() - right.periodStart.getTime()),
    monthlyRows: [...byMonth.values()]
      .map((item) => buildAggregateRow(entityType, entityId, item))
      .sort((left, right) => left.periodStart.getTime() - right.periodStart.getTime()),
    lastEventAt,
  };
}

export async function refreshListingAnalyticsForEntity(input: {
  entityType: ListingEntityType;
  entityId: string;
  trigger: "auto" | "manual" | "initial";
}): Promise<void> {
  if (!(await areAggregateTablesAvailable())) {
    throw new ListingAnalyticsServiceError(
      "TABLES_UNAVAILABLE",
      "Таблицы агрегированной статистики ещё не созданы.",
    );
  }

  const entity = await resolveListingEntity(input.entityType, input.entityId);

  if (!entity) {
    throw new ListingAnalyticsServiceError("NOT_FOUND", "Карточка не найдена.");
  }

  await markRefreshState(input.entityType, entity, "updating");

  try {
    const sourceRows = await readSourceRows(input.entityType, input.entityId, entity.publishedAt);
    const { dailyRows, monthlyRows, lastEventAt } = buildAggregateRowsFromSource(
      input.entityType,
      input.entityId,
      sourceRows,
    );
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.listingAnalyticsDailyAggregate.deleteMany({
        where: { entityType: input.entityType, entityId: input.entityId },
      });
      await tx.listingAnalyticsMonthlyAggregate.deleteMany({
        where: { entityType: input.entityType, entityId: input.entityId },
      });

      if (dailyRows.length > 0) {
        await tx.listingAnalyticsDailyAggregate.createMany({ data: dailyRows });
      }

      if (monthlyRows.length > 0) {
        await tx.listingAnalyticsMonthlyAggregate.createMany({ data: monthlyRows });
      }

      await tx.listingAnalyticsRefreshState.upsert({
        where: {
          entityType_entityId: {
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        create: {
          entityType: input.entityType,
          entityId: input.entityId,
          ownerId: entity.ownerId,
          status: "success",
          lastAggregatedAt: now,
          nextAutoUpdateAt: getNextAutoUpdateAt(now),
          lastEventAt,
          refreshStartedAt: null,
          refreshFinishedAt: now,
          lastError: null,
        },
        update: {
          ownerId: entity.ownerId,
          status: "success",
          lastAggregatedAt: now,
          nextAutoUpdateAt: getNextAutoUpdateAt(now),
          lastEventAt,
          refreshFinishedAt: now,
          lastError: null,
        },
      });
    });
  } catch (error) {
    await markRefreshState(input.entityType, entity, "error", {
      lastError: error instanceof Error ? error.message : "Неизвестная ошибка обновления.",
    });
    throw error;
  }
}

function buildLegacyPayload(
  entityType: ListingEntityType,
  entity: ListingAnalyticsEntity,
  periodKey: ListingAnalyticsPeriodKey,
  stats: Awaited<ReturnType<typeof getListingStatsData>>,
): ListingAnalyticsPayload {
  const today = normalizeUtcDate(new Date());
  const todayKey = toDateKey(today);
  const dailyActivity = stats.dailyActivity;
  const actionSummary = stats.actionSummary;
  const selectedMonth =
    periodKey.startsWith("month:")
      ? stats.monthlyHistory.find((month) => month.month === periodKey.slice("month:".length)) ??
        null
      : null;
  const selectedKey = selectedMonth ? "month" : periodKey === "last6Months" ? "last6Months" : periodKey;
  const selectedSummary =
    selectedKey === "today"
      ? actionSummary.today
      : selectedKey === "last7Days"
        ? actionSummary.week
        : selectedKey === "month"
          ? {
              total: selectedMonth?.actions ?? 0,
              phoneActions: selectedMonth?.phoneActions ?? 0,
              messengerActions: selectedMonth?.messengerActions ?? 0,
              leadActions: selectedMonth?.leadActions ?? 0,
              websiteActions: selectedMonth?.websiteActions ?? 0,
              breakdown: selectedMonth?.breakdown ?? [],
            }
        : selectedKey === "last6Months"
          ? actionSummary.period
          : actionSummary.month30;
  const selectedViews =
    selectedKey === "today"
      ? (dailyActivity.find((item) => item.date === todayKey)?.views ?? 0)
      : selectedKey === "last7Days"
        ? stats.weeklyTotal
        : selectedKey === "month"
          ? (selectedMonth?.views ?? 0)
        : selectedKey === "last6Months"
          ? stats.periodViews
          : stats.monthlyTotal;
  const selectedActions = selectedSummary.total;
  const selectedBreakdown: ListingAnalyticsBreakdown = {
    phones: selectedSummary.phoneActions,
    messengers: selectedSummary.messengerActions,
    leads: selectedSummary.leadActions,
    website: selectedSummary.websiteActions,
    booking: 0,
    other: 0,
  };

  return {
    entityType,
    entityId: entity.id,
    entityPublicId: entity.publicId,
    entityName: entity.name,
    ownerId: entity.ownerId,
    lastUpdatedAt: null,
    nextAutoUpdateAt: getNextAutoUpdateAt().toISOString(),
    updateStatus: "idle",
    isStale: true,
    staleReason: "Агрегированные таблицы ещё не применены. Показан совместимый расчёт.",
    manualRefresh: {
      limitPerDay: LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT,
      usedToday: 0,
      remainingToday: LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT,
      canRefresh: false,
      isUpdating: false,
    },
    summary: {
      today: buildPeriodSummary(
        dailyActivity.find((item) => item.date === todayKey)?.views ?? 0,
        actionSummary.today.total,
      ),
      last7Days: buildPeriodSummary(stats.weeklyTotal, stats.weeklyActions),
      last30Days: buildPeriodSummary(stats.monthlyTotal, stats.monthlyActions),
      last6Months: buildPeriodSummary(stats.periodViews, stats.periodActions),
    },
    selectedPeriod: {
      key: periodKey,
      label:
        selectedKey === "today"
          ? "Сегодня"
          : selectedKey === "last7Days"
            ? "7 дней"
            : selectedKey === "last6Months"
              ? "6 месяцев"
              : selectedKey === "month"
                ? (selectedMonth?.label ?? "Выбранный месяц")
                : "30 дней",
      ...buildPeriodSummary(selectedViews, selectedActions),
      breakdown: selectedBreakdown,
      breakdownItems: selectedSummary.breakdown,
      chart: dailyActivity,
    },
    dailyActivity,
    months: stats.monthlyHistory.map((month) => ({
      month: month.month,
      label: month.label,
      ...buildPeriodSummary(month.views, month.actions),
      activityLevel: toActivityLevel(month.views, month.actions),
      breakdown: {
        phones: month.phoneActions,
        messengers: month.messengerActions,
        leads: month.leadActions,
        website: month.websiteActions,
        booking: 0,
        other: 0,
      },
      breakdownItems: month.breakdown,
    })),
    meta: {
      autoUpdateHour: getListingAnalyticsAutoUpdateHour(),
      timeZone: getListingAnalyticsTimeZone(),
      source: "legacy",
      lastEventAt: null,
      lastError: null,
    },
  };
}

function getPeriodDateKeys(periodKey: ListingAnalyticsPeriodKey, now = new Date()): {
  key: ListingAnalyticsPeriodKey;
  label: string;
  start: Date;
  end: Date;
} {
  const today = normalizeUtcDate(now);

  if (periodKey === "today") {
    return { key: periodKey, label: "Сегодня", start: today, end: today };
  }

  if (periodKey === "last7Days") {
    return {
      key: periodKey,
      label: "7 дней",
      start: new Date(today.getTime() - 6 * DAY_MS),
      end: today,
    };
  }

  if (periodKey === "last6Months") {
    const monthKeys = getRollingSixMonthKeys(today);
    return {
      key: periodKey,
      label: "6 месяцев",
      start: monthKeyToUtcDate(monthKeys[0]!),
      end: today,
    };
  }

  if (periodKey.startsWith("month:")) {
    const month = periodKey.slice("month:".length);
    const start = monthKeyToUtcDate(month);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));

    return {
      key: periodKey,
      label: formatMonthLabel(month),
      start,
      end: end > today ? today : end,
    };
  }

  return {
    key: "last30Days",
    label: "30 дней",
    start: new Date(today.getTime() - 29 * DAY_MS),
    end: today,
  };
}

function collectPeriod(
  dateKeys: string[],
  dailyRowsByDate: Map<string, AggregateRow>,
): ListingAnalyticsPeriodSummary & {
  actionBreakdown: Map<string, number>;
  breakdown: ListingAnalyticsBreakdown;
  breakdownItems: ListingAnalyticsBreakdownItem[];
  chart: ListingAnalyticsChartPoint[];
} {
  let views = 0;
  let actions = 0;
  const actionBreakdown = new Map<string, number>();
  const chart: ListingAnalyticsChartPoint[] = [];

  for (const date of dateKeys) {
    const row = dailyRowsByDate.get(date);
    const rowViews = row?.views ?? 0;
    const rowActions = row?.actions ?? 0;
    views += rowViews;
    actions += rowActions;

    if (row) {
      mergeBreakdown(actionBreakdown, row.actionBreakdown);
    }

    chart.push({
      date,
      views: rowViews,
      actions: rowActions,
    });
  }

  const counters = buildListingActionCounterGroup(actionBreakdown);

  return {
    ...buildPeriodSummary(views, actions),
    actionBreakdown,
    breakdown: {
      phones: counters.phones,
      messengers: counters.messengers,
      leads: counters.leads,
      website: counters.website,
      booking: counters.booking,
      other: counters.other,
    },
    breakdownItems: buildBreakdownItems(actionBreakdown),
    chart,
  };
}

function normalizeActorRole(value: string): ListingAnalyticsActorRole {
  return value === "owner" || value === "admin" ? value : "guest";
}

async function getRawListingAnalyticsEvents(input: {
  entityType: ListingEntityType;
  entityId: string;
  start: Date;
  end: Date;
  limit?: number;
}): Promise<ListingAnalyticsRawEvent[]> {
  if (!(await isDatabaseTableAvailable("ListingAnalyticsEvent"))) {
    return [];
  }

  const rows = await db.listingAnalyticsEvent
    .findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        occurredAt: {
          gte: input.start,
          lt: new Date(input.end.getTime() + DAY_MS),
        },
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        entityPublicId: true,
        eventType: true,
        occurredAt: true,
        actorRole: true,
        userId: true,
        isUnique: true,
        channel: true,
        leadNumber: true,
        source: true,
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit ?? 100,
    })
    .catch(() => []);

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType as ListingEntityType,
    entityId: row.entityId,
    entityPublicId: row.entityPublicId ?? null,
    eventType: row.eventType,
    occurredAt: row.occurredAt.toISOString(),
    actorRole: normalizeActorRole(row.actorRole),
    userId: row.userId ?? null,
    isUnique: row.isUnique,
    channel: row.channel ?? null,
    leadNumber: row.leadNumber ?? null,
    source: row.source ?? null,
  }));
}

async function getManualRefreshState(
  entityType: ListingEntityType,
  entityId: string,
): Promise<{
  usedToday: number;
  isUpdating: boolean;
  lastUpdatedAt: Date | null;
  nextAutoUpdateAt: Date | null;
  lastEventAt: Date | null;
  status: ListingAnalyticsPayload["updateStatus"];
  lastError: string | null;
}> {
  const state = await db.listingAnalyticsRefreshState.findUnique({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
  });
  const todayKey = getZonedDateKey();
  const usedToday =
    state?.manualRefreshDate && toDateKey(state.manualRefreshDate) === todayKey
      ? Math.max(0, state.manualRefreshCount)
      : 0;
  const isUpdating = state?.status === "updating";

  return {
    usedToday,
    isUpdating,
    lastUpdatedAt: state?.lastAggregatedAt ?? null,
    nextAutoUpdateAt: state?.nextAutoUpdateAt ?? getNextAutoUpdateAt(),
    lastEventAt: state?.lastEventAt ?? null,
    status:
      state?.status === "updating" || state?.status === "success" || state?.status === "error"
        ? state.status
        : "idle",
    lastError: state?.lastError ?? null,
  };
}

export async function getListingAnalyticsStatsPayload(input: {
  entityType: ListingEntityType;
  entityId: string;
  periodKey?: ListingAnalyticsPeriodKey;
  allowInitialRefresh?: boolean;
  includeRawEvents?: boolean;
}): Promise<ListingAnalyticsPayload> {
  const entity = await resolveListingEntity(input.entityType, input.entityId);

  if (!entity) {
    throw new ListingAnalyticsServiceError("NOT_FOUND", "Карточка не найдена.");
  }

  const periodKey = input.periodKey ?? "last30Days";

  if (!(await areAggregateTablesAvailable())) {
    const legacyStats = await getListingStatsData({
      entityType: input.entityType,
      entityId: input.entityId,
      totalViews: entity.totalViews,
      fromDate: entity.publishedAt,
    });
    return buildLegacyPayload(input.entityType, entity, periodKey, legacyStats);
  }

  const stateBefore = await db.listingAnalyticsRefreshState.findUnique({
    where: {
      entityType_entityId: {
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    select: { lastAggregatedAt: true, status: true },
  });

  if (
    input.allowInitialRefresh !== false &&
    !stateBefore?.lastAggregatedAt &&
    stateBefore?.status !== "updating"
  ) {
    await refreshListingAnalyticsForEntity({
      entityType: input.entityType,
      entityId: input.entityId,
      trigger: "initial",
    }).catch((error) => {
      console.error("[listing-analytics/initial-refresh]", input.entityType, input.entityId, error);
    });
  }

  const now = new Date();
  const today = normalizeUtcDate(now);
  const monthKeys = getRollingSixMonthKeys(today);
  const sixMonthStart = monthKeyToUtcDate(monthKeys[0]!);
  const queryEnd = new Date(today.getTime() + DAY_MS);
  const [dailyRows, monthlyRows, state] = await Promise.all([
    db.listingAnalyticsDailyAggregate.findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        periodStart: {
          gte: sixMonthStart,
          lt: queryEnd,
        },
      },
      orderBy: { periodStart: "asc" },
    }),
    db.listingAnalyticsMonthlyAggregate.findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        periodStart: {
          gte: sixMonthStart,
          lt: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
        },
      },
      orderBy: { periodStart: "asc" },
    }),
    getManualRefreshState(input.entityType, input.entityId),
  ]);

  const dailyRowsByDate = new Map(
    dailyRows.map((row) => [
      toDateKey(row.periodStart),
      {
        entityType: input.entityType,
        entityId: input.entityId,
        periodStart: row.periodStart,
        views: row.views,
        actions: row.actions,
        phoneActions: row.phoneActions,
        messengerActions: row.messengerActions,
        leadActions: row.leadActions,
        websiteActions: row.websiteActions,
        bookingActions: row.bookingActions,
        otherActions: row.otherActions,
        actionBreakdown: toBreakdownJson(toBreakdownMap(row.actionBreakdown)),
      },
    ]),
  );
  const monthlyRowsByMonth = new Map(monthlyRows.map((row) => [toMonthKey(row.periodStart), row]));
  const todayRange = getPeriodDateKeys("today", now);
  const last7Range = getPeriodDateKeys("last7Days", now);
  const last30Range = getPeriodDateKeys("last30Days", now);
  const last6Range = getPeriodDateKeys("last6Months", now);
  const selectedRange = getPeriodDateKeys(periodKey, now);
  const todayStats = collectPeriod(buildDateRange(todayRange.start, todayRange.end), dailyRowsByDate);
  const last7Stats = collectPeriod(buildDateRange(last7Range.start, last7Range.end), dailyRowsByDate);
  const last30Stats = collectPeriod(
    buildDateRange(last30Range.start, last30Range.end),
    dailyRowsByDate,
  );
  const last6Stats = collectPeriod(buildDateRange(last6Range.start, last6Range.end), dailyRowsByDate);
  const selectedStats = collectPeriod(
    buildDateRange(selectedRange.start, selectedRange.end),
    dailyRowsByDate,
  );
  const dailyActivity = collectPeriod(
    buildDateRange(last30Range.start, last30Range.end),
    dailyRowsByDate,
  ).chart;
  const maxMonthScore = Math.max(
    ...monthKeys.map((month) => {
      const row = monthlyRowsByMonth.get(month);
      return (row?.views ?? 0) + (row?.actions ?? 0);
    }),
    1,
  );
  const months = monthKeys.map((month): ListingAnalyticsMonth => {
    const row = monthlyRowsByMonth.get(month);
    const actionBreakdown = toBreakdownMap(row?.actionBreakdown ?? null);
    const counters = buildListingActionCounterGroup(actionBreakdown);
    const views = row?.views ?? 0;
    const actions = row?.actions ?? 0;
    const activityLevel =
      views + actions <= 0
        ? "none"
        : views + actions >= maxMonthScore * 0.66
          ? "high"
          : views + actions >= maxMonthScore * 0.25
            ? "medium"
            : "low";

    return {
      month,
      label: formatMonthLabel(month),
      ...buildPeriodSummary(views, actions),
      activityLevel,
      breakdown: {
        phones: counters.phones,
        messengers: counters.messengers,
        leads: counters.leads,
        website: counters.website,
        booking: counters.booking,
        other: counters.other,
      },
      breakdownItems: buildBreakdownItems(actionBreakdown),
    };
  });
  const staleByAge =
    state.lastUpdatedAt === null ||
    now.getTime() - state.lastUpdatedAt.getTime() > LISTING_ANALYTICS_STALE_AFTER_HOURS * HOUR_MS;
  const staleByEvent =
    Boolean(state.lastEventAt && state.lastUpdatedAt && state.lastEventAt > state.lastUpdatedAt);
  const isStale = staleByAge || staleByEvent;
  const remainingToday = Math.max(
    0,
    LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT - state.usedToday,
  );
  const adminRawEvents = input.includeRawEvents
    ? await getRawListingAnalyticsEvents({
        entityType: input.entityType,
        entityId: input.entityId,
        start: selectedRange.start,
        end: selectedRange.end,
        limit: 200,
      })
    : undefined;

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    entityPublicId: entity.publicId,
    entityName: entity.name,
    ownerId: entity.ownerId,
    lastUpdatedAt: state.lastUpdatedAt?.toISOString() ?? null,
    nextAutoUpdateAt: (state.nextAutoUpdateAt ?? getNextAutoUpdateAt(now)).toISOString(),
    updateStatus: state.status,
    isStale,
    staleReason: isStale
      ? staleByEvent
        ? "После последнего пересчёта появились новые события."
        : "Статистика давно не пересчитывалась."
      : null,
    manualRefresh: {
      limitPerDay: LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT,
      usedToday: state.usedToday,
      remainingToday,
      canRefresh: remainingToday > 0 && !state.isUpdating,
      isUpdating: state.isUpdating,
    },
    summary: {
      today: {
        views: todayStats.views,
        actions: todayStats.actions,
        conversion: todayStats.conversion,
      },
      last7Days: {
        views: last7Stats.views,
        actions: last7Stats.actions,
        conversion: last7Stats.conversion,
      },
      last30Days: {
        views: last30Stats.views,
        actions: last30Stats.actions,
        conversion: last30Stats.conversion,
      },
      last6Months: {
        views: last6Stats.views,
        actions: last6Stats.actions,
        conversion: last6Stats.conversion,
      },
    },
    selectedPeriod: {
      key: selectedRange.key,
      label: selectedRange.label,
      views: selectedStats.views,
      actions: selectedStats.actions,
      conversion: selectedStats.conversion,
      breakdown: selectedStats.breakdown,
      breakdownItems: selectedStats.breakdownItems,
      chart: selectedStats.chart,
    },
    dailyActivity,
    months,
    meta: {
      autoUpdateHour: getListingAnalyticsAutoUpdateHour(),
      timeZone: getListingAnalyticsTimeZone(),
      source: "aggregated",
      lastEventAt: state.lastEventAt?.toISOString() ?? null,
      lastError: state.lastError,
    },
    ...(adminRawEvents ? { adminRawEvents } : {}),
  };
}

async function ensureRefreshStateForManualRefresh(
  tx: DbTransactionClient,
  entityType: ListingEntityType,
  entity: ListingAnalyticsEntity,
): Promise<void> {
  const now = new Date();
  const lockThreshold = new Date(now.getTime() - LISTING_ANALYTICS_REFRESH_LOCK_MINUTES * 60 * 1000);
  const todayDate = dateKeyToUtcDate(getZonedDateKey(now));

  await tx.listingAnalyticsRefreshState.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId: entity.id,
      },
    },
    create: {
      entityType,
      entityId: entity.id,
      ownerId: entity.ownerId,
      status: "idle",
      nextAutoUpdateAt: getNextAutoUpdateAt(now),
      manualRefreshDate: null,
      manualRefreshCount: 0,
    },
    update: {
      ownerId: entity.ownerId,
      nextAutoUpdateAt: getNextAutoUpdateAt(now),
    },
  });

  const state = await tx.listingAnalyticsRefreshState.findUniqueOrThrow({
    where: {
      entityType_entityId: {
        entityType,
        entityId: entity.id,
      },
    },
  });

  if (state.status === "updating" && state.refreshStartedAt && state.refreshStartedAt > lockThreshold) {
    throw new ListingAnalyticsServiceError(
      "REFRESH_IN_PROGRESS",
      "Статистика этой карточки уже обновляется.",
    );
  }

  const usedToday =
    state.manualRefreshDate && toDateKey(state.manualRefreshDate) === toDateKey(todayDate)
      ? Math.max(0, state.manualRefreshCount)
      : 0;

  if (usedToday >= LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT) {
    throw new ListingAnalyticsServiceError(
      "MANUAL_LIMIT_REACHED",
      "Лимит ручных обновлений на сегодня исчерпан.",
    );
  }

  await tx.listingAnalyticsRefreshState.update({
    where: { id: state.id },
    data: {
      status: "updating",
      manualRefreshDate: todayDate,
      manualRefreshCount: usedToday + 1,
      refreshStartedAt: now,
      refreshFinishedAt: null,
      lastError: null,
    },
  });
}

export async function runManualListingAnalyticsRefresh(input: {
  entityType: ListingEntityType;
  entityId: string;
  editor: EditorSession | null;
}): Promise<ListingAnalyticsPayload> {
  if (!(await areAggregateTablesAvailable())) {
    throw new ListingAnalyticsServiceError(
      "TABLES_UNAVAILABLE",
      "Таблицы агрегированной статистики ещё не созданы.",
    );
  }

  const entity = await getListingAnalyticsEntityForEditor(
    input.entityType,
    input.entityId,
    input.editor,
  );

  if (!entity) {
    throw new ListingAnalyticsServiceError("NOT_FOUND", "Карточка не найдена.");
  }

  await db.$transaction(
    (tx) => ensureRefreshStateForManualRefresh(tx, input.entityType, entity),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await refreshListingAnalyticsForEntity({
    entityType: input.entityType,
    entityId: input.entityId,
    trigger: "manual",
  });

  return getListingAnalyticsStatsPayload({
    entityType: input.entityType,
    entityId: input.entityId,
    allowInitialRefresh: false,
  });
}

async function updateRefreshStateLastEvent(input: {
  entityType: ListingEntityType;
  entityId: string;
  ownerId?: string | null;
  occurredAt: Date;
}): Promise<void> {
  if (!(await isDatabaseTableAvailable("ListingAnalyticsRefreshState"))) {
    return;
  }

  await db.listingAnalyticsRefreshState.upsert({
    where: {
      entityType_entityId: {
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      ownerId: input.ownerId ?? null,
      status: "idle",
      lastEventAt: input.occurredAt,
      nextAutoUpdateAt: getNextAutoUpdateAt(input.occurredAt),
    },
    update: {
      ownerId: input.ownerId ?? undefined,
      lastEventAt: input.occurredAt,
    },
  });
}

export type RecordListingAnalyticsResult = {
  isUnique: boolean;
  countedForOwner: boolean;
};

type RecordListingEventBaseInput = {
  entityType: ListingEntityType;
  entityId: string;
  entityPublicId?: number | null;
  ownerId?: string | null;
  actorRole?: ListingAnalyticsActorRole;
  userId?: string | null;
  visitorKey?: string | null;
  channel?: string | null;
  leadId?: string | null;
  leadNumber?: string | null;
  source?: string | null;
  metadata?: Prisma.InputJsonObject | null;
  occurredAt?: Date;
};

export type ListingLeadResult = {
  id: string;
  leadNumber: string;
  sequence: number;
  entityPublicId: number | null;
  createdAt: string;
};

let listingLeadStoragePromise: Promise<boolean> | null = null;

function shouldCountEventForOwner(actorRole: ListingAnalyticsActorRole, isUnique: boolean): boolean {
  return actorRole === "guest" && isUnique;
}

function getListingEventChannel(actionType: ListingActionType): string | null {
  if (actionType.startsWith("phone_")) {
    return "phone";
  }

  if (
    actionType === "whatsapp" ||
    actionType === "telegram" ||
    actionType === "vk" ||
    actionType === "vk_bot" ||
    actionType === "max" ||
    actionType === "ok" ||
    actionType === "website"
  ) {
    return actionType;
  }

  if (actionType === "lead_copy") {
    return "lead_copy";
  }

  if (actionType === "lead_form" || actionType === "lead_phrase" || actionType === "request") {
    return "lead";
  }

  if (actionType === "booking") {
    return "booking";
  }

  return null;
}

function formatListingLeadNumber(sequence: number): string {
  return `KV-${String(sequence).padStart(6, "0")}`;
}

async function createListingLeadStorage(): Promise<boolean> {
  await db.$executeRaw(Prisma.sql`CREATE SEQUENCE IF NOT EXISTS listing_lead_sequence_seq START WITH 1`);
  await db.$executeRaw(Prisma.sql`
    CREATE TABLE IF NOT EXISTS "ListingLead" (
      "id" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL DEFAULT nextval('listing_lead_sequence_seq'),
      "leadNumber" VARCHAR(20) NOT NULL,
      "entityType" VARCHAR(20) NOT NULL,
      "entityId" TEXT NOT NULL,
      "entityPublicId" INTEGER,
      "ownerId" TEXT,
      "actorRole" VARCHAR(20) NOT NULL DEFAULT 'guest',
      "userId" TEXT,
      "visitorKey" VARCHAR(80),
      "source" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "ListingLead_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRaw(
    Prisma.sql`CREATE UNIQUE INDEX IF NOT EXISTS "ListingLead_sequence_key" ON "ListingLead"("sequence")`,
  );
  await db.$executeRaw(
    Prisma.sql`CREATE UNIQUE INDEX IF NOT EXISTS "ListingLead_leadNumber_key" ON "ListingLead"("leadNumber")`,
  );
  await db.$executeRaw(
    Prisma.sql`CREATE INDEX IF NOT EXISTS "listing_lead_entity_created_idx" ON "ListingLead"("entityType", "entityId", "createdAt")`,
  );
  await db.$executeRaw(
    Prisma.sql`CREATE INDEX IF NOT EXISTS "listing_lead_public_entity_created_idx" ON "ListingLead"("entityType", "entityPublicId", "createdAt")`,
  );
  await db.$executeRaw(
    Prisma.sql`CREATE INDEX IF NOT EXISTS "listing_lead_owner_created_idx" ON "ListingLead"("ownerId", "createdAt")`,
  );
  await db.$executeRaw(
    Prisma.sql`CREATE INDEX IF NOT EXISTS "listing_lead_actor_created_idx" ON "ListingLead"("actorRole", "createdAt")`,
  );

  return isDatabaseTableAvailable("ListingLead");
}

async function ensureListingLeadStorageAvailable(): Promise<boolean> {
  if (await isDatabaseTableAvailable("ListingLead")) {
    return true;
  }

  listingLeadStoragePromise ??= createListingLeadStorage()
    .catch(() => false)
    .then((available) => {
      if (!available) {
        listingLeadStoragePromise = null;
      }

      return available;
    });

  return listingLeadStoragePromise;
}

async function isUniqueListingAnalyticsEvent(input: {
  entityType: ListingEntityType;
  entityId: string;
  eventType: string;
  actorRole: ListingAnalyticsActorRole;
  visitorKey?: string | null;
  channel?: string | null;
  occurredAt: Date;
}): Promise<boolean> {
  if (!input.visitorKey || !(await isDatabaseTableAvailable("ListingAnalyticsEvent"))) {
    return true;
  }

  const dedupWindowMs = getListingAnalyticsDedupWindowMinutes() * 60 * 1000;
  const threshold = new Date(input.occurredAt.getTime() - dedupWindowMs);

  const existing = await db.listingAnalyticsEvent
    .findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        actorRole: input.actorRole,
        visitorKey: input.visitorKey,
        channel: input.channel ?? null,
        occurredAt: {
          gte: threshold,
          lt: input.occurredAt,
        },
      },
      select: { id: true },
      orderBy: { occurredAt: "desc" },
    })
    .catch(() => null);

  return existing === null;
}

async function createRawListingAnalyticsEvent(input: {
  eventType: string;
  eventDate: Date;
  occurredAt: Date;
  isUnique: boolean;
} & RecordListingEventBaseInput): Promise<void> {
  if (!(await isDatabaseTableAvailable("ListingAnalyticsEvent"))) {
    return;
  }

  await db.listingAnalyticsEvent
    .create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        entityPublicId: input.entityPublicId ?? null,
        ownerId: input.ownerId ?? null,
        eventType: input.eventType,
        eventDate: input.eventDate,
        occurredAt: input.occurredAt,
        actorRole: input.actorRole ?? "guest",
        userId: input.userId ?? null,
        visitorKey: input.visitorKey ?? null,
        isUnique: input.isUnique,
        channel: input.channel ?? null,
        leadId: input.leadId ?? null,
        leadNumber: input.leadNumber ?? null,
        source: input.source ?? null,
        metadata: input.metadata ?? undefined,
      },
    })
    .catch(() => undefined);
}

export async function recordListingViewEvent(input: {
  entityType: ListingEntityType;
  entityId: string;
  entityPublicId?: number | null;
  ownerId?: string | null;
  actorRole?: ListingAnalyticsActorRole;
  userId?: string | null;
  visitorKey?: string | null;
  source?: string | null;
  metadata?: Prisma.InputJsonObject | null;
  occurredAt?: Date;
}): Promise<RecordListingAnalyticsResult> {
  const occurredAt = input.occurredAt ?? new Date();
  const eventDate = normalizeUtcDate(occurredAt);
  const actorRole = input.actorRole ?? "guest";
  const channel = "view";
  const isUnique = await isUniqueListingAnalyticsEvent({
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: "view",
    actorRole,
    visitorKey: input.visitorKey,
    channel,
    occurredAt,
  });
  const countedForOwner = shouldCountEventForOwner(actorRole, isUnique);

  await Promise.all([
    countedForOwner
      ? db.viewLog.upsert({
          where: {
            entityType_entityId_date: {
              entityType: input.entityType,
              entityId: input.entityId,
              date: eventDate,
            },
          },
          create: {
            entityType: input.entityType,
            entityId: input.entityId,
            date: eventDate,
            count: 1,
          },
          update: { count: { increment: 1 } },
        })
      : Promise.resolve(),
    createRawListingAnalyticsEvent({
      ...input,
      actorRole,
      eventType: "view",
      eventDate,
      occurredAt,
      channel,
      isUnique,
    }),
    countedForOwner
      ? updateRefreshStateLastEvent({
          entityType: input.entityType,
          entityId: input.entityId,
          ownerId: input.ownerId,
          occurredAt,
        }).catch(() => undefined)
      : Promise.resolve(),
  ]);

  return { isUnique, countedForOwner };
}

export async function recordListingActionEvent(input: {
  entityType: ListingEntityType;
  entityId: string;
  actionType: ListingActionType;
  entityPublicId?: number | null;
  ownerId?: string | null;
  actorRole?: ListingAnalyticsActorRole;
  userId?: string | null;
  visitorKey?: string | null;
  channel?: string | null;
  leadId?: string | null;
  leadNumber?: string | null;
  source?: string | null;
  metadata?: Prisma.InputJsonObject | null;
  occurredAt?: Date;
}): Promise<RecordListingAnalyticsResult> {
  const occurredAt = input.occurredAt ?? new Date();
  const eventDate = normalizeUtcDate(occurredAt);
  const actorRole = input.actorRole ?? "guest";
  const channel = input.channel ?? getListingEventChannel(input.actionType);
  const isUnique = await isUniqueListingAnalyticsEvent({
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.actionType,
    actorRole,
    visitorKey: input.visitorKey,
    channel,
    occurredAt,
  });
  const countedForOwner = shouldCountEventForOwner(actorRole, isUnique);

  await Promise.all([
    countedForOwner
      ? isDatabaseTableAvailable("EngagementLog").then((available) =>
          available
            ? db.engagementLog.upsert({
                where: {
                  entityType_entityId_actionType_date: {
                    entityType: input.entityType,
                    entityId: input.entityId,
                    actionType: input.actionType,
                    date: eventDate,
                  },
                },
                create: {
                  entityType: input.entityType,
                  entityId: input.entityId,
                  actionType: input.actionType,
                  date: eventDate,
                  count: 1,
                },
                update: { count: { increment: 1 } },
              })
            : undefined,
        )
      : Promise.resolve(),
    createRawListingAnalyticsEvent({
      ...input,
      actorRole,
      eventType: input.actionType,
      eventDate,
      occurredAt,
      channel,
      isUnique,
    }),
    countedForOwner
      ? updateRefreshStateLastEvent({
          entityType: input.entityType,
          entityId: input.entityId,
          ownerId: input.ownerId,
          occurredAt,
        }).catch(() => undefined)
      : Promise.resolve(),
  ]);

  return { isUnique, countedForOwner };
}

export async function createListingLead(input: RecordListingEventBaseInput): Promise<ListingLeadResult> {
  if (!(await ensureListingLeadStorageAvailable())) {
    throw new ListingAnalyticsServiceError(
      "TABLES_UNAVAILABLE",
      "Таблица обращений еще не создана.",
    );
  }

  const actorRole = input.actorRole ?? "guest";
  const lead = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ sequence: number }>>(Prisma.sql`
      SELECT nextval('listing_lead_sequence_seq')::integer AS "sequence"
    `);
    const sequence = Number(rows[0]?.sequence ?? 0);

    if (!Number.isInteger(sequence) || sequence <= 0) {
      throw new Error("Lead sequence did not return a valid number.");
    }

    return tx.listingLead.create({
      data: {
        sequence,
        leadNumber: formatListingLeadNumber(sequence),
        entityType: input.entityType,
        entityId: input.entityId,
        entityPublicId: input.entityPublicId ?? null,
        ownerId: input.ownerId ?? null,
        actorRole,
        userId: input.userId ?? null,
        visitorKey: input.visitorKey ?? null,
        source: input.source ?? null,
        metadata: input.metadata ?? undefined,
      },
      select: {
        id: true,
        sequence: true,
        leadNumber: true,
        entityPublicId: true,
        createdAt: true,
      },
    });
  });

  await recordListingActionEvent({
    ...input,
    actorRole,
    actionType: "lead_form",
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    channel: "lead",
  });

  return {
    id: lead.id,
    sequence: lead.sequence,
    leadNumber: lead.leadNumber,
    entityPublicId: lead.entityPublicId ?? null,
    createdAt: lead.createdAt.toISOString(),
  };
}

async function readCronSince(): Promise<Date> {
  const setting = await db.siteSetting.findUnique({
    where: { key: LISTING_ANALYTICS_CRON_SETTING_KEY },
    select: { value: true },
  });
  const parsed = setting?.value ? new Date(setting.value) : null;

  if (parsed && Number.isFinite(parsed.getTime())) {
    return new Date(parsed.getTime() - HOUR_MS);
  }

  return new Date(Date.now() - 48 * HOUR_MS);
}

async function getChangedAnalyticsTargets(
  since: Date,
  limit: number,
): Promise<Array<{ entityType: ListingEntityType; entityId: string }>> {
  const [viewRows, actionRows, dueRows] = await Promise.all([
    db.viewLog.findMany({
      where: { updatedAt: { gte: since } },
      distinct: ["entityType", "entityId"],
      select: { entityType: true, entityId: true },
      take: limit,
    }),
    isDatabaseTableAvailable("EngagementLog").then((available) =>
      available
        ? db.engagementLog.findMany({
            where: { updatedAt: { gte: since } },
            distinct: ["entityType", "entityId"],
            select: { entityType: true, entityId: true },
            take: limit,
          })
        : [],
    ),
    db.listingAnalyticsRefreshState.findMany({
      where: {
        OR: [{ nextAutoUpdateAt: { lte: new Date() } }, { lastAggregatedAt: null }],
        NOT: { status: "updating" },
      },
      select: { entityType: true, entityId: true },
      take: limit,
      orderBy: [{ nextAutoUpdateAt: "asc" }, { updatedAt: "asc" }],
    }),
  ]);
  const byKey = new Map<string, { entityType: ListingEntityType; entityId: string }>();

  for (const row of [...viewRows, ...actionRows, ...dueRows]) {
    const entityType =
      row.entityType === "property" || row.entityType === "excursion" || row.entityType === "transfer"
        ? row.entityType
        : null;

    if (!entityType || !row.entityId) {
      continue;
    }

    byKey.set(`${entityType}:${row.entityId}`, { entityType, entityId: row.entityId });

    if (byKey.size >= limit) {
      break;
    }
  }

  return [...byKey.values()];
}

export async function refreshDueListingAnalytics(): Promise<{
  scanned: number;
  refreshed: number;
  failed: number;
  errors: Array<{ entityType: ListingEntityType; entityId: string; message: string }>;
}> {
  if (!(await areAggregateTablesAvailable())) {
    throw new ListingAnalyticsServiceError(
      "TABLES_UNAVAILABLE",
      "Таблицы агрегированной статистики ещё не созданы.",
    );
  }

  const limit = getListingAnalyticsCronBatchLimit();
  const since = await readCronSince();
  const targets = await getChangedAnalyticsTargets(since, limit);
  const errors: Array<{ entityType: ListingEntityType; entityId: string; message: string }> = [];
  let refreshed = 0;

  for (const target of targets) {
    try {
      await refreshListingAnalyticsForEntity({ ...target, trigger: "auto" });
      refreshed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка.";
      console.error("[listing-analytics/cron]", target.entityType, target.entityId, error);
      errors.push({ ...target, message });
    }
  }

  await db.siteSetting.upsert({
    where: { key: LISTING_ANALYTICS_CRON_SETTING_KEY },
    create: { key: LISTING_ANALYTICS_CRON_SETTING_KEY, value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  return {
    scanned: targets.length,
    refreshed,
    failed: errors.length,
    errors,
  };
}

export const __listingAnalyticsServiceTestUtils = {
  buildAggregateRowsFromSource,
  buildPeriodSummary,
  getPeriodDateKeys,
  toBreakdownMap,
};
