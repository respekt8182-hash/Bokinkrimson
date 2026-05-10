import { ExcursionOfferType, Prisma } from "@prisma/client";
import {
  db,
  isDatabaseTableAvailable,
  type DbClientLike,
  type DbTransactionClient,
} from "@/lib/db";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";
import {
  normalizeListingActionType,
  type ListingActionType,
} from "@/lib/listing-analytics";

export const ADMIN_VIEW_BOOST_DAILY_LIMIT = 30;
export const ADMIN_ACTION_BOOST_DAILY_LIMIT = 20;
export const ADMIN_VIEW_BOOST_TIME_ZONE = "Europe/Moscow";

const VIEW_BOOST_SETTING_PREFIX = "admin_view_boost";
const ACTION_BOOST_SETTING_PREFIX = "admin_action_boost";
const VIEW_BOOST_ENTITY_TYPES = ["property", "excursion", "transfer"] as const;

type ViewBoostEntityType = (typeof VIEW_BOOST_ENTITY_TYPES)[number];

type ViewBoostTargets = Record<ViewBoostEntityType, string[]>;

export type AdminStatisticsSummary = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  actionDailyLimit: number;
  actionUsedToday: number;
  actionRemainingToday: number;
  todayKey: string;
  todayLabel: string;
  lastBoostAt: string | null;
  lastActionBoostAt: string | null;
  totals: {
    publishedProperties: number;
    publishedExcursions: number;
    publishedTours: number;
    publishedTransfers: number;
    totalCards: number;
    totalViews: number;
    totalActions: number;
  };
};

export type AdminViewBoostResult = {
  metricType: "views";
  addedPerCard: number;
  updatedCards: number;
  summary: AdminStatisticsSummary;
};

export type AdminActionBoostResult = {
  metricType: "actions";
  actionType: ListingActionType;
  addedPerCard: number;
  updatedCards: number;
  summary: AdminStatisticsSummary;
};

function readMoscowDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_VIEW_BOOST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function formatMoscowDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getViewLogDate(date = new Date()): Date {
  const today = new Date(date);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function getUsageSettingKey(todayKey = readMoscowDateKey()): string {
  return `${VIEW_BOOST_SETTING_PREFIX}:${todayKey}`;
}

function getActionUsageSettingKey(todayKey = readMoscowDateKey()): string {
  return `${ACTION_BOOST_SETTING_PREFIX}:${todayKey}`;
}

function parseSettingUsage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sumValue(value: number | null | undefined): number {
  return Math.max(0, Number(value ?? 0));
}

async function getPublishedViewBoostTargets(client: DbClientLike): Promise<ViewBoostTargets> {
  const [properties, excursions, transfers] = await Promise.all([
    client.property.findMany({
      where: buildPublishedPropertyVisibilityWhere(),
      select: { id: true },
    }),
    client.excursion.findMany({
      where: buildPublishedExcursionVisibilityWhere(),
      select: { id: true },
    }),
    client.transfer.findMany({
      where: buildPublishedTransferVisibilityWhere(),
      select: { id: true },
    }),
  ]);

  return {
    property: properties.map((item) => item.id),
    excursion: excursions.map((item) => item.id),
    transfer: transfers.map((item) => item.id),
  };
}

async function createMissingViewLogs(
  tx: DbTransactionClient,
  entityType: ViewBoostEntityType,
  entityIds: string[],
  date: Date,
) {
  if (entityIds.length === 0) {
    return;
  }

  await tx.viewLog.createMany({
    data: entityIds.map((entityId) => ({
      entityType,
      entityId,
      date,
      count: 0,
    })),
    skipDuplicates: true,
  });
}

async function incrementViewLogs(
  tx: DbTransactionClient,
  entityType: ViewBoostEntityType,
  entityIds: string[],
  date: Date,
  amount: number,
) {
  if (entityIds.length === 0) {
    return;
  }

  await tx.viewLog.updateMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      date,
    },
    data: {
      count: { increment: amount },
    },
  });
}

async function reserveDailyViewBoostUsage(
  tx: DbTransactionClient,
  amount: number,
): Promise<number> {
  const todayKey = readMoscowDateKey();
  const usageKey = getUsageSettingKey(todayKey);
  return reserveDailyBoostUsage(tx, usageKey, amount, ADMIN_VIEW_BOOST_DAILY_LIMIT);
}

async function reserveDailyActionBoostUsage(
  tx: DbTransactionClient,
  amount: number,
): Promise<number> {
  const todayKey = readMoscowDateKey();
  const usageKey = getActionUsageSettingKey(todayKey);
  return reserveDailyBoostUsage(tx, usageKey, amount, ADMIN_ACTION_BOOST_DAILY_LIMIT);
}

async function reserveDailyBoostUsage(
  tx: DbTransactionClient,
  usageKey: string,
  amount: number,
  dailyLimit: number,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ value: string }>>(Prisma.sql`
    INSERT INTO "public"."site_settings" ("key", "value", "updated_at")
    VALUES (${usageKey}, ${String(amount)}, NOW())
    ON CONFLICT ("key") DO UPDATE
    SET
      "value" = (
        (
          CASE
            WHEN "public"."site_settings"."value" ~ '^[0-9]+$'
            THEN "public"."site_settings"."value"::integer
            ELSE 0
          END
        ) + ${amount}
      )::text,
      "updated_at" = NOW()
    WHERE
      (
        CASE
          WHEN "public"."site_settings"."value" ~ '^[0-9]+$'
          THEN "public"."site_settings"."value"::integer
          ELSE 0
        END
      ) + ${amount} <= ${dailyLimit}
    RETURNING "value"
  `);

  if (rows.length === 0) {
    throw new Error("ADMIN_BOOST_DAILY_LIMIT_REACHED");
  }

  return parseSettingUsage(rows[0]?.value);
}

export function isAdminViewBoostLimitError(error: unknown): boolean {
  return error instanceof Error && error.message === "ADMIN_BOOST_DAILY_LIMIT_REACHED";
}

export function isAdminActionStatsUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.message === "ADMIN_ACTION_STATS_TABLE_MISSING";
}

export function normalizeViewBoostAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(amount) || amount < 1 || amount > ADMIN_VIEW_BOOST_DAILY_LIMIT) {
    return null;
  }

  return amount;
}

export function normalizeActionBoostAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(amount) || amount < 1 || amount > ADMIN_ACTION_BOOST_DAILY_LIMIT) {
    return null;
  }

  return amount;
}

export function normalizeActionBoostType(value: unknown): ListingActionType | null {
  return normalizeListingActionType(value);
}

async function createMissingActionLogs(
  tx: DbTransactionClient,
  entityType: ViewBoostEntityType,
  entityIds: string[],
  actionType: ListingActionType,
  date: Date,
) {
  if (entityIds.length === 0) {
    return;
  }

  await tx.engagementLog.createMany({
    data: entityIds.map((entityId) => ({
      entityType,
      entityId,
      actionType,
      date,
      count: 0,
    })),
    skipDuplicates: true,
  });
}

async function incrementActionLogs(
  tx: DbTransactionClient,
  entityType: ViewBoostEntityType,
  entityIds: string[],
  actionType: ListingActionType,
  date: Date,
  amount: number,
) {
  if (entityIds.length === 0) {
    return;
  }

  await tx.engagementLog.updateMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      actionType,
      date,
    },
    data: {
      count: { increment: amount },
    },
  });
}

async function getTotalActions(client: DbClientLike): Promise<number> {
  if (!(await isDatabaseTableAvailable("EngagementLog", client))) {
    return 0;
  }

  try {
    const result = await client.engagementLog.aggregate({
      _sum: { count: true },
    });

    return sumValue(result._sum.count);
  } catch {
    return 0;
  }
}

export async function getAdminStatisticsSummary(
  client: DbClientLike = db,
): Promise<AdminStatisticsSummary> {
  const todayKey = readMoscowDateKey();
  const usageKey = getUsageSettingKey(todayKey);
  const actionUsageKey = getActionUsageSettingKey(todayKey);

  const [
    usageSetting,
    actionUsageSetting,
    propertyStats,
    excursionStats,
    tourStats,
    transferStats,
    totalActions,
  ] = await Promise.all([
      client.siteSetting.findUnique({
        where: { key: usageKey },
        select: { value: true, updatedAt: true },
      }),
      client.siteSetting.findUnique({
        where: { key: actionUsageKey },
        select: { value: true, updatedAt: true },
      }),
      client.property.aggregate({
        where: buildPublishedPropertyVisibilityWhere(),
        _count: { _all: true },
        _sum: { profileViews: true },
      }),
      client.excursion.aggregate({
        where: {
          ...buildPublishedExcursionVisibilityWhere(),
          offerType: ExcursionOfferType.EXCURSION,
        },
        _count: { _all: true },
        _sum: { profileViews: true },
      }),
      client.excursion.aggregate({
        where: {
          ...buildPublishedExcursionVisibilityWhere(),
          offerType: ExcursionOfferType.TOUR,
        },
        _count: { _all: true },
        _sum: { profileViews: true },
      }),
      client.transfer.aggregate({
        where: buildPublishedTransferVisibilityWhere(),
        _count: { _all: true },
        _sum: { profileViews: true },
      }),
      getTotalActions(client),
  ]);

  const usedToday = Math.min(ADMIN_VIEW_BOOST_DAILY_LIMIT, parseSettingUsage(usageSetting?.value));
  const actionUsedToday = Math.min(
    ADMIN_ACTION_BOOST_DAILY_LIMIT,
    parseSettingUsage(actionUsageSetting?.value),
  );
  const publishedProperties = propertyStats._count._all;
  const publishedExcursions = excursionStats._count._all;
  const publishedTours = tourStats._count._all;
  const publishedTransfers = transferStats._count._all;

  return {
    dailyLimit: ADMIN_VIEW_BOOST_DAILY_LIMIT,
    usedToday,
    remainingToday: Math.max(0, ADMIN_VIEW_BOOST_DAILY_LIMIT - usedToday),
    actionDailyLimit: ADMIN_ACTION_BOOST_DAILY_LIMIT,
    actionUsedToday,
    actionRemainingToday: Math.max(0, ADMIN_ACTION_BOOST_DAILY_LIMIT - actionUsedToday),
    todayKey,
    todayLabel: formatMoscowDateLabel(todayKey),
    lastBoostAt: usageSetting?.updatedAt ? usageSetting.updatedAt.toISOString() : null,
    lastActionBoostAt: actionUsageSetting?.updatedAt
      ? actionUsageSetting.updatedAt.toISOString()
      : null,
    totals: {
      publishedProperties,
      publishedExcursions,
      publishedTours,
      publishedTransfers,
      totalCards: publishedProperties + publishedExcursions + publishedTours + publishedTransfers,
      totalViews:
        sumValue(propertyStats._sum.profileViews) +
        sumValue(excursionStats._sum.profileViews) +
        sumValue(tourStats._sum.profileViews) +
        sumValue(transferStats._sum.profileViews),
      totalActions,
    },
  };
}

export async function applyAdminViewBoost(amount: number): Promise<AdminViewBoostResult> {
  return db.$transaction(
    async (tx) => {
      const targets = await getPublishedViewBoostTargets(tx);
      const updatedCards =
        targets.property.length + targets.excursion.length + targets.transfer.length;

      await reserveDailyViewBoostUsage(tx, amount);

      if (targets.property.length > 0) {
        await tx.property.updateMany({
          where: { id: { in: targets.property } },
          data: { profileViews: { increment: amount } },
        });
      }

      if (targets.excursion.length > 0) {
        await tx.excursion.updateMany({
          where: { id: { in: targets.excursion } },
          data: { profileViews: { increment: amount } },
        });
      }

      if (targets.transfer.length > 0) {
        await tx.transfer.updateMany({
          where: { id: { in: targets.transfer } },
          data: { profileViews: { increment: amount } },
        });
      }

      const viewLogDate = getViewLogDate();
      await Promise.all(
        VIEW_BOOST_ENTITY_TYPES.map((entityType) =>
          createMissingViewLogs(tx, entityType, targets[entityType], viewLogDate),
        ),
      );
      await Promise.all(
        VIEW_BOOST_ENTITY_TYPES.map((entityType) =>
          incrementViewLogs(tx, entityType, targets[entityType], viewLogDate, amount),
        ),
      );

      return {
        metricType: "views",
        addedPerCard: amount,
        updatedCards,
        summary: await getAdminStatisticsSummary(tx),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function applyAdminActionBoost(
  amount: number,
  actionType: ListingActionType,
): Promise<AdminActionBoostResult> {
  if (!(await isDatabaseTableAvailable("EngagementLog"))) {
    throw new Error("ADMIN_ACTION_STATS_TABLE_MISSING");
  }

  return db.$transaction(
    async (tx) => {
      const targets = await getPublishedViewBoostTargets(tx);
      const updatedCards =
        targets.property.length + targets.excursion.length + targets.transfer.length;

      await reserveDailyActionBoostUsage(tx, amount);

      const viewLogDate = getViewLogDate();
      await Promise.all(
        VIEW_BOOST_ENTITY_TYPES.map((entityType) =>
          createMissingActionLogs(tx, entityType, targets[entityType], actionType, viewLogDate),
        ),
      );
      await Promise.all(
        VIEW_BOOST_ENTITY_TYPES.map((entityType) =>
          incrementActionLogs(tx, entityType, targets[entityType], actionType, viewLogDate, amount),
        ),
      );

      return {
        metricType: "actions",
        actionType,
        addedPerCard: amount,
        updatedCards,
        summary: await getAdminStatisticsSummary(tx),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
