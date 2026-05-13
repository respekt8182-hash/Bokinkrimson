import { Prisma } from "@prisma/client";
import { db, isDatabaseTableAvailable } from "@/lib/db";
import {
  BOOKING_ACTION_TYPES,
  MESSENGER_ACTION_TYPES,
  PHONE_ACTION_TYPES,
  normalizeListingActionType,
  type ListingEntityType,
} from "@/lib/listing-analytics";
import type { RankingBehaviorMetrics } from "@/lib/ranking-v2";

export type RankingStatsWindow = RankingBehaviorMetrics & {
  actions: number;
};

export type EntityRankingStats = {
  last7Days: RankingStatsWindow;
  last30Days: RankingStatsWindow;
  last90Days: RankingStatsWindow;
};

const emptyWindow = (): RankingStatsWindow => ({
  impressions: 0,
  cardViews: 0,
  favorites: 0,
  phoneClicks: 0,
  messengerClicks: 0,
  emailClicks: 0,
  createBookingClicks: 0,
  actions: 0,
});

function normalizeUtcDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toBreakdownEntries(value: Prisma.JsonValue): Array<[string, number]> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, rawValue]) => {
    const actionType = normalizeListingActionType(key);
    const count = Number(rawValue);

    return actionType && Number.isFinite(count) && count > 0 ? [[actionType, count]] : [];
  });
}

function addActionBreakdown(target: RankingStatsWindow, actionBreakdown: Prisma.JsonValue): void {
  for (const [actionType, count] of toBreakdownEntries(actionBreakdown)) {
    target.actions += count;

    if ((PHONE_ACTION_TYPES as readonly string[]).includes(actionType)) {
      target.phoneClicks = (target.phoneClicks ?? 0) + count;
    } else if ((MESSENGER_ACTION_TYPES as readonly string[]).includes(actionType)) {
      target.messengerClicks = (target.messengerClicks ?? 0) + count;
    } else if ((BOOKING_ACTION_TYPES as readonly string[]).includes(actionType)) {
      target.createBookingClicks = (target.createBookingClicks ?? 0) + count;
    } else if (actionType === "email") {
      target.emailClicks = (target.emailClicks ?? 0) + count;
    }
  }
}

function createEntityStats(): EntityRankingStats {
  return {
    last7Days: emptyWindow(),
    last30Days: emptyWindow(),
    last90Days: emptyWindow(),
  };
}

function addAggregateRow(input: {
  stats: EntityRankingStats;
  periodStart: Date;
  now: Date;
  views: number;
  actionBreakdown: Prisma.JsonValue;
}): void {
  const ageDays = Math.floor(
    (normalizeUtcDate(input.now).getTime() - normalizeUtcDate(input.periodStart).getTime()) /
      86_400_000,
  );

  const windows: RankingStatsWindow[] = [];
  if (ageDays < 7) windows.push(input.stats.last7Days);
  if (ageDays < 30) windows.push(input.stats.last30Days);
  if (ageDays < 90) windows.push(input.stats.last90Days);

  for (const window of windows) {
    window.cardViews = (window.cardViews ?? 0) + Math.max(0, input.views);
    addActionBreakdown(window, input.actionBreakdown);
  }
}

export async function getRankingStatsByEntity(
  entityType: ListingEntityType,
  entityIds: string[],
  now = new Date(),
): Promise<Map<string, EntityRankingStats>> {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  const result = new Map(ids.map((id) => [id, createEntityStats()]));

  if (ids.length === 0 || !(await isDatabaseTableAvailable("ListingAnalyticsDailyAggregate"))) {
    return result;
  }

  const fromDate = addDays(normalizeUtcDate(now), -90);
  const rows = await db.listingAnalyticsDailyAggregate
    .findMany({
      where: {
        entityType,
        entityId: { in: ids },
        periodStart: { gte: fromDate },
      },
      select: {
        entityId: true,
        periodStart: true,
        views: true,
        actionBreakdown: true,
      },
    })
    .catch(() => []);

  for (const row of rows) {
    const stats = result.get(row.entityId);
    if (!stats) {
      continue;
    }

    addAggregateRow({
      stats,
      periodStart: row.periodStart,
      now,
      views: row.views,
      actionBreakdown: row.actionBreakdown,
    });
  }

  return result;
}
