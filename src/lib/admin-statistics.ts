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
import { getStaticAttractions } from "@/lib/static-attractions";
import {
  LISTING_ACTION_LABELS,
  normalizeListingActionType,
  type ListingActionType,
} from "@/lib/listing-analytics";

export const ADMIN_VIEW_BOOST_DAILY_LIMIT = 30;
export const ADMIN_ACTION_BOOST_DAILY_LIMIT = 20;
export const ADMIN_VIEW_BOOST_TIME_ZONE = "Europe/Moscow";

const VIEW_BOOST_SETTING_PREFIX = "admin_view_boost";
const ACTION_BOOST_SETTING_PREFIX = "admin_action_boost";
const BOOST_JOURNAL_SETTING_KEY = "admin_metric_boost_journal";
const BOOST_JOURNAL_LIMIT = 20;
const VIEW_BOOST_ENTITY_TYPES = ["property", "excursion", "transfer", "attraction"] as const;

type ViewBoostEntityType = (typeof VIEW_BOOST_ENTITY_TYPES)[number];

type ViewBoostTargets = Record<ViewBoostEntityType, string[]>;

export type AdminStatisticsJournalEntry = {
  id: string;
  createdAt: string;
  metricType: "views" | "actions";
  actionType: ListingActionType | null;
  actionLabel: string | null;
  amountPerCard: number;
  cardsCount: number;
  totalAdded: number;
  adminLogin: string | null;
};

export type AdminStatisticsMetricPeriod = {
  key: "last6Months" | `month:${string}`;
  label: string;
  views: number;
  actions: number;
};

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
    publishedAttractions: number;
    totalCards: number;
    totalViews: number;
    totalActions: number;
  };
  metricPeriods: {
    defaultKey: AdminStatisticsMetricPeriod["key"];
    last6Months: AdminStatisticsMetricPeriod;
    months: AdminStatisticsMetricPeriod[];
  };
  journal: AdminStatisticsJournalEntry[];
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

function toMonthKey(date: Date): string {
  const normalized = getViewLogDate(date);
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

function getRollingSixMonthKeys(now = new Date()): string[] {
  const today = getViewLogDate(now);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));

  return Array.from({ length: 6 }, (_, index) =>
    toMonthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1))),
  );
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readPositiveInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parseBoostJournal(value: string | null | undefined): AdminStatisticsJournalEntry[] {
  if (!value) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item): AdminStatisticsJournalEntry | null => {
      if (!isPlainRecord(item)) {
        return null;
      }

      const metricType =
        item.metricType === "actions" ? "actions" : item.metricType === "views" ? "views" : null;
      const createdAt = readString(item.createdAt);
      const id = readString(item.id);
      const amountPerCard = readPositiveInteger(item.amountPerCard);
      const cardsCount = readPositiveInteger(item.cardsCount);
      const totalAdded = readPositiveInteger(item.totalAdded);

      if (
        !metricType ||
        !createdAt ||
        !id ||
        amountPerCard <= 0 ||
        cardsCount <= 0 ||
        totalAdded <= 0
      ) {
        return null;
      }

      const actionType =
        metricType === "actions" ? normalizeListingActionType(item.actionType) : null;

      return {
        id,
        createdAt,
        metricType,
        actionType,
        actionLabel:
          metricType === "actions" && actionType
            ? LISTING_ACTION_LABELS[actionType]
            : readString(item.actionLabel),
        amountPerCard,
        cardsCount,
        totalAdded,
        adminLogin: readString(item.adminLogin),
      };
    })
    .filter((item): item is AdminStatisticsJournalEntry => item !== null)
    .slice(0, BOOST_JOURNAL_LIMIT);
}

async function getBoostJournal(client: DbClientLike): Promise<AdminStatisticsJournalEntry[]> {
  const setting = await client.siteSetting.findUnique({
    where: { key: BOOST_JOURNAL_SETTING_KEY },
    select: { value: true },
  });

  return parseBoostJournal(setting?.value);
}

async function appendBoostJournalEntry(
  tx: DbTransactionClient,
  entry: Omit<AdminStatisticsJournalEntry, "id" | "createdAt" | "totalAdded">,
) {
  const currentSetting = await tx.siteSetting.findUnique({
    where: { key: BOOST_JOURNAL_SETTING_KEY },
    select: { value: true },
  });
  const currentJournal = parseBoostJournal(currentSetting?.value);
  const createdAt = new Date().toISOString();
  const nextEntry: AdminStatisticsJournalEntry = {
    ...entry,
    id: `${createdAt}:${entry.metricType}:${entry.actionType ?? "views"}`,
    createdAt,
    totalAdded: entry.amountPerCard * entry.cardsCount,
  };
  const nextJournal = [nextEntry, ...currentJournal].slice(0, BOOST_JOURNAL_LIMIT);

  await tx.siteSetting.upsert({
    where: { key: BOOST_JOURNAL_SETTING_KEY },
    create: {
      key: BOOST_JOURNAL_SETTING_KEY,
      value: JSON.stringify(nextJournal),
    },
    update: {
      value: JSON.stringify(nextJournal),
    },
  });
}

async function getPublishedViewBoostTargets(client: DbClientLike): Promise<ViewBoostTargets> {
  const [properties, excursions, transfers, attractions] = await Promise.all([
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
    getStaticAttractions(),
  ]);

  return {
    property: properties.map((item) => item.id),
    excursion: excursions.map((item) => item.id),
    transfer: transfers.map((item) => item.id),
    attraction: attractions.map((item) => item.id),
  };
}

function countViewBoostTargets(targets: ViewBoostTargets): number {
  return VIEW_BOOST_ENTITY_TYPES.reduce((sum, entityType) => sum + targets[entityType].length, 0);
}

async function getTotalViewLogCount(
  client: DbClientLike,
  entityType: ViewBoostEntityType,
  entityIds: string[],
): Promise<number> {
  if (entityIds.length === 0) {
    return 0;
  }

  try {
    const result = await client.viewLog.aggregate({
      where: {
        entityType,
        entityId: { in: entityIds },
      },
      _sum: { count: true },
    });

    return sumValue(result._sum.count);
  } catch {
    return 0;
  }
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

export function isAdminBoostNoTargetsError(error: unknown): boolean {
  return error instanceof Error && error.message === "ADMIN_BOOST_NO_TARGETS";
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

async function getTotalActions(client: DbClientLike, targets: ViewBoostTargets): Promise<number> {
  if (!(await isDatabaseTableAvailable("EngagementLog", client))) {
    return 0;
  }

  try {
    const results = await Promise.all(
      VIEW_BOOST_ENTITY_TYPES.map(async (entityType) => {
        const entityIds = targets[entityType];

        if (entityIds.length === 0) {
          return 0;
        }

        const result = await client.engagementLog.aggregate({
          where: {
            entityType,
            entityId: { in: entityIds },
          },
          _sum: { count: true },
        });

        return sumValue(result._sum.count);
      }),
    );

    return results.reduce((sum, value) => sum + value, 0);
  } catch {
    return 0;
  }
}

async function getAdminMonthlyMetricPeriods(
  client: DbClientLike,
  targets: ViewBoostTargets,
  now = new Date(),
): Promise<AdminStatisticsSummary["metricPeriods"]> {
  const monthKeys = getRollingSixMonthKeys(now);
  const firstMonth = monthKeys[0]!;
  const lastMonth = monthKeys[monthKeys.length - 1]!;
  const start = monthKeyToUtcDate(firstMonth);
  const end = new Date(
    Date.UTC(
      monthKeyToUtcDate(lastMonth).getUTCFullYear(),
      monthKeyToUtcDate(lastMonth).getUTCMonth() + 1,
      1,
    ),
  );
  const targetFilters = VIEW_BOOST_ENTITY_TYPES.filter(
    (entityType) => targets[entityType].length > 0,
  ).map((entityType) => ({
    entityType,
    entityId: { in: targets[entityType] },
  }));
  const viewByMonth = new Map(monthKeys.map((month) => [month, 0]));
  const actionsByMonth = new Map(monthKeys.map((month) => [month, 0]));

  if (targetFilters.length > 0) {
    const [viewRows, actionRows] = await Promise.all([
      client.viewLog.findMany({
        where: {
          OR: targetFilters,
          date: {
            gte: start,
            lt: end,
          },
        },
        select: {
          date: true,
          count: true,
        },
      }),
      isDatabaseTableAvailable("EngagementLog", client).then((available) =>
        available
          ? client.engagementLog.findMany({
              where: {
                OR: targetFilters,
                date: {
                  gte: start,
                  lt: end,
                },
              },
              select: {
                date: true,
                count: true,
              },
            })
          : [],
      ),
    ]);

    for (const row of viewRows) {
      const month = toMonthKey(row.date);
      if (viewByMonth.has(month)) {
        viewByMonth.set(month, (viewByMonth.get(month) ?? 0) + sumValue(row.count));
      }
    }

    for (const row of actionRows) {
      const month = toMonthKey(row.date);
      if (actionsByMonth.has(month)) {
        actionsByMonth.set(month, (actionsByMonth.get(month) ?? 0) + sumValue(row.count));
      }
    }
  }

  const months = monthKeys.map((month): AdminStatisticsMetricPeriod => ({
    key: `month:${month}`,
    label: formatMonthLabel(month),
    views: viewByMonth.get(month) ?? 0,
    actions: actionsByMonth.get(month) ?? 0,
  }));
  const last6Months: AdminStatisticsMetricPeriod = {
    key: "last6Months",
    label: "6 месяцев",
    views: months.reduce((sum, month) => sum + month.views, 0),
    actions: months.reduce((sum, month) => sum + month.actions, 0),
  };

  return {
    defaultKey: months[months.length - 1]?.key ?? "last6Months",
    last6Months,
    months,
  };
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
    boostTargets,
    journal,
    propertyStats,
    excursionStats,
    tourStats,
    transferStats,
  ] = await Promise.all([
    client.siteSetting.findUnique({
      where: { key: usageKey },
      select: { value: true, updatedAt: true },
    }),
    client.siteSetting.findUnique({
      where: { key: actionUsageKey },
      select: { value: true, updatedAt: true },
    }),
    getPublishedViewBoostTargets(client),
    getBoostJournal(client),
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
  ]);
  const [totalActions, attractionViews, metricPeriods] = await Promise.all([
    getTotalActions(client, boostTargets),
    getTotalViewLogCount(client, "attraction", boostTargets.attraction),
    getAdminMonthlyMetricPeriods(client, boostTargets),
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
  const publishedAttractions = boostTargets.attraction.length;

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
      publishedAttractions,
      totalCards:
        publishedProperties +
        publishedExcursions +
        publishedTours +
        publishedTransfers +
        publishedAttractions,
      totalViews:
        sumValue(propertyStats._sum.profileViews) +
        sumValue(excursionStats._sum.profileViews) +
        sumValue(tourStats._sum.profileViews) +
        sumValue(transferStats._sum.profileViews) +
        attractionViews,
      totalActions,
    },
    metricPeriods,
    journal,
  };
}

export async function applyAdminViewBoost(
  amount: number,
  adminLogin: string | null = null,
): Promise<AdminViewBoostResult> {
  return db.$transaction(
    async (tx) => {
      const targets = await getPublishedViewBoostTargets(tx);
      const updatedCards = countViewBoostTargets(targets);

      if (updatedCards <= 0) {
        throw new Error("ADMIN_BOOST_NO_TARGETS");
      }

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
      await appendBoostJournalEntry(tx, {
        metricType: "views",
        actionType: null,
        actionLabel: null,
        amountPerCard: amount,
        cardsCount: updatedCards,
        adminLogin,
      });

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
  adminLogin: string | null = null,
): Promise<AdminActionBoostResult> {
  if (!(await isDatabaseTableAvailable("EngagementLog"))) {
    throw new Error("ADMIN_ACTION_STATS_TABLE_MISSING");
  }

  return db.$transaction(
    async (tx) => {
      const targets = await getPublishedViewBoostTargets(tx);
      const updatedCards = countViewBoostTargets(targets);

      if (updatedCards <= 0) {
        throw new Error("ADMIN_BOOST_NO_TARGETS");
      }

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
      await appendBoostJournalEntry(tx, {
        metricType: "actions",
        actionType,
        actionLabel: LISTING_ACTION_LABELS[actionType],
        amountPerCard: amount,
        cardsCount: updatedCards,
        adminLogin,
      });

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
