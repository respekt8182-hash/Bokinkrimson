import { db, isDatabaseTableAvailable, type DbClientLike } from "@/lib/db";
import {
  LISTING_ACTION_LABELS,
  LISTING_ACTION_TYPES,
  LEAD_ACTION_TYPES,
  MESSENGER_ACTION_TYPES,
  PHONE_ACTION_TYPES,
  type ListingActionType,
  type ListingEntityType,
} from "@/lib/listing-analytics";

export type ListingDailyActivity = {
  date: string;
  views: number;
  actions: number;
};

export type ListingMonthlyActivity = {
  month: string;
  label: string;
  views: number;
  actions: number;
  phoneActions: number;
  messengerActions: number;
  leadActions: number;
  websiteActions: number;
  breakdown: ListingActionBreakdownItem[];
};

export type ListingActionBreakdownItem = {
  actionType: string;
  label: string;
  count: number;
};

export type ListingActionSummary = {
  total: number;
  phoneActions: number;
  messengerActions: number;
  leadActions: number;
  websiteActions: number;
  breakdown: ListingActionBreakdownItem[];
};

export type ListingStatsData = {
  totalViews: number;
  totalActions: number;
  periodViews: number;
  periodActions: number;
  periodLabel: string;
  dailyViews: Array<{ date: string; count: number }>;
  dailyActions: Array<{ date: string; count: number }>;
  dailyActivity: ListingDailyActivity[];
  weeklyTotal: number;
  monthlyTotal: number;
  weeklyActions: number;
  monthlyActions: number;
  monthlyHistory: ListingMonthlyActivity[];
  actionBreakdown: ListingActionBreakdownItem[];
  actionSummary: {
    today: ListingActionSummary;
    week: ListingActionSummary;
    month30: ListingActionSummary;
    period: ListingActionSummary;
  };
  messengerActions: number;
  phoneActions: number;
  leadActions: number;
  websiteActions: number;
};

type ViewLogRow = {
  date: Date;
  count: number;
};

type EngagementLogRow = {
  date: Date;
  actionType: string;
  count: number;
};

type ListingStatsInput = {
  entityType: ListingEntityType;
  entityId: string;
  totalViews: number;
  fromDate?: Date | null;
  now?: Date;
  client?: DbClientLike;
};

function normalizeUtcDate(date: Date) {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function toDateKey(date: Date): string {
  return normalizeUtcDate(date).toISOString().split("T")[0];
}

function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getRollingSixMonthRange(now = new Date()) {
  const current = normalizeUtcDate(now);
  const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 5, 1));
  const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    return toMonthKey(date);
  });

  return {
    start,
    end,
    months,
    label: `${formatMonthLabel(months[0]!).replace(/\s+\d{4}$/u, "")} - ${formatMonthLabel(
      months[months.length - 1]!,
    )}`,
  };
}

function buildDateRange(from: Date, to: Date) {
  const result: string[] = [];
  for (const date = new Date(from); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
    result.push(toDateKey(date));
  }
  return result;
}

function addToMap(map: Map<string, number>, key: string, count: number) {
  map.set(key, (map.get(key) ?? 0) + Math.max(0, count));
}

function addToNestedActionMap(
  map: Map<string, Map<string, number>>,
  key: string,
  actionType: string,
  count: number,
) {
  const bucket = map.get(key) ?? new Map<string, number>();
  addToMap(bucket, actionType, count);
  map.set(key, bucket);
}

function mergeActionMaps(maps: Array<Map<string, number> | undefined>): Map<string, number> {
  const result = new Map<string, number>();

  for (const map of maps) {
    if (!map) {
      continue;
    }

    for (const [actionType, count] of map.entries()) {
      addToMap(result, actionType, count);
    }
  }

  return result;
}

function buildActionBreakdown(actionBreakdown: Map<string, number>): ListingActionBreakdownItem[] {
  const normalizedActionTypes = new Set<string>(LISTING_ACTION_TYPES);

  return [...actionBreakdown.entries()]
    .map(([actionType, count]) => ({
      actionType,
      label: normalizedActionTypes.has(actionType)
        ? LISTING_ACTION_LABELS[actionType as ListingActionType]
        : actionType,
      count,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ru"));
}

function sumActionTypes(
  actionBreakdown: Map<string, number>,
  actionTypes: readonly ListingActionType[],
): number {
  return actionTypes.reduce((sum, actionType) => sum + (actionBreakdown.get(actionType) ?? 0), 0);
}

function buildActionSummary(actionBreakdown: Map<string, number>): ListingActionSummary {
  const phoneActions = sumActionTypes(actionBreakdown, PHONE_ACTION_TYPES);
  const messengerActions = sumActionTypes(actionBreakdown, MESSENGER_ACTION_TYPES);
  const leadActions = sumActionTypes(actionBreakdown, LEAD_ACTION_TYPES);
  const websiteActions = actionBreakdown.get("website") ?? 0;

  return {
    total: [...actionBreakdown.values()].reduce((sum, count) => sum + Math.max(0, count), 0),
    phoneActions,
    messengerActions,
    leadActions,
    websiteActions,
    breakdown: buildActionBreakdown(actionBreakdown),
  };
}

async function getEngagementLogs(
  client: DbClientLike,
  entityType: ListingEntityType,
  entityId: string,
  start: Date,
  end: Date,
): Promise<EngagementLogRow[]> {
  if (!(await isDatabaseTableAvailable("EngagementLog", client))) {
    return [];
  }

  try {
    return await client.engagementLog.findMany({
      where: {
        entityType,
        entityId,
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [{ date: "asc" }, { actionType: "asc" }],
      select: {
        date: true,
        actionType: true,
        count: true,
      },
    });
  } catch {
    return [];
  }
}

export async function getListingStatsData({
  entityType,
  entityId,
  totalViews,
  fromDate = null,
  now = new Date(),
  client = db,
}: ListingStatsInput): Promise<ListingStatsData> {
  const today = normalizeUtcDate(now);
  const dailyStart = new Date(today);
  dailyStart.setUTCDate(dailyStart.getUTCDate() - 29);
  const sixMonths = getRollingSixMonthRange(today);
  const queryStart = sixMonths.start < dailyStart ? sixMonths.start : dailyStart;
  const queryEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [viewLogs, actionLogs] = await Promise.all([
    client.viewLog.findMany({
      where: {
        entityType,
        entityId,
        date: {
          gte: queryStart,
          lt: queryEnd,
        },
      },
      orderBy: { date: "asc" },
      select: { date: true, count: true },
    }) as Promise<ViewLogRow[]>,
    getEngagementLogs(client, entityType, entityId, queryStart, queryEnd),
  ]);

  const viewByDate = new Map<string, number>();
  const actionsByDate = new Map<string, number>();
  const viewByMonth = new Map<string, number>();
  const actionsByMonth = new Map<string, number>();
  const actionBreakdownByDate = new Map<string, Map<string, number>>();
  const actionBreakdownByMonth = new Map<string, Map<string, number>>();
  const actionBreakdown = new Map<string, number>();

  for (const log of viewLogs) {
    addToMap(viewByDate, toDateKey(log.date), log.count);
    addToMap(viewByMonth, toMonthKey(log.date), log.count);
  }

  for (const log of actionLogs) {
    const dateKey = toDateKey(log.date);
    const monthKey = toMonthKey(log.date);

    addToMap(actionsByDate, dateKey, log.count);
    addToMap(actionsByMonth, monthKey, log.count);
    addToNestedActionMap(actionBreakdownByDate, dateKey, log.actionType, log.count);
    addToNestedActionMap(actionBreakdownByMonth, monthKey, log.actionType, log.count);
    addToMap(actionBreakdown, log.actionType, log.count);
  }

  const effectiveDailyStart =
    fromDate && normalizeUtcDate(fromDate) > dailyStart ? normalizeUtcDate(fromDate) : dailyStart;
  const dailyKeys = buildDateRange(
    effectiveDailyStart > today ? today : effectiveDailyStart,
    today,
  );
  const dailyActivity = dailyKeys.map((date) => ({
    date,
    views: viewByDate.get(date) ?? 0,
    actions: actionsByDate.get(date) ?? 0,
  }));

  const monthlyHistory = sixMonths.months.map((month) => {
    const summary = buildActionSummary(actionBreakdownByMonth.get(month) ?? new Map());

    return {
      month,
      label: formatMonthLabel(month),
      views: viewByMonth.get(month) ?? 0,
      actions: actionsByMonth.get(month) ?? 0,
      phoneActions: summary.phoneActions,
      messengerActions: summary.messengerActions,
      leadActions: summary.leadActions,
      websiteActions: summary.websiteActions,
      breakdown: summary.breakdown,
    };
  });
  const periodViews = monthlyHistory.reduce((sum, item) => sum + item.views, 0);
  const periodActions = monthlyHistory.reduce((sum, item) => sum + item.actions, 0);
  const sortedActionBreakdown = buildActionBreakdown(actionBreakdown);
  const todayKey = toDateKey(today);
  const weekActionSummary = buildActionSummary(
    mergeActionMaps(dailyActivity.slice(-7).map((item) => actionBreakdownByDate.get(item.date))),
  );
  const month30ActionSummary = buildActionSummary(
    mergeActionMaps(dailyActivity.map((item) => actionBreakdownByDate.get(item.date))),
  );
  const periodActionSummary = buildActionSummary(actionBreakdown);

  return {
    totalViews: Math.max(0, totalViews),
    totalActions: periodActions,
    periodViews,
    periodActions,
    periodLabel: sixMonths.label,
    dailyViews: dailyActivity.map((item) => ({ date: item.date, count: item.views })),
    dailyActions: dailyActivity.map((item) => ({ date: item.date, count: item.actions })),
    dailyActivity,
    weeklyTotal: dailyActivity.slice(-7).reduce((sum, item) => sum + item.views, 0),
    monthlyTotal: dailyActivity.reduce((sum, item) => sum + item.views, 0),
    weeklyActions: dailyActivity.slice(-7).reduce((sum, item) => sum + item.actions, 0),
    monthlyActions: dailyActivity.reduce((sum, item) => sum + item.actions, 0),
    monthlyHistory,
    actionBreakdown: sortedActionBreakdown,
    actionSummary: {
      today: buildActionSummary(actionBreakdownByDate.get(todayKey) ?? new Map()),
      week: weekActionSummary,
      month30: month30ActionSummary,
      period: periodActionSummary,
    },
    messengerActions: periodActionSummary.messengerActions,
    phoneActions: periodActionSummary.phoneActions,
    leadActions: periodActionSummary.leadActions,
    websiteActions: periodActionSummary.websiteActions,
  };
}
