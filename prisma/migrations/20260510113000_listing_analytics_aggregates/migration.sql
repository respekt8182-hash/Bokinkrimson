CREATE TABLE "public"."ListingAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownerId" TEXT,
    "eventType" VARCHAR(40) NOT NULL,
    "eventDate" DATE NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ListingAnalyticsDailyAggregate" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "actions" INTEGER NOT NULL DEFAULT 0,
    "phoneActions" INTEGER NOT NULL DEFAULT 0,
    "messengerActions" INTEGER NOT NULL DEFAULT 0,
    "leadActions" INTEGER NOT NULL DEFAULT 0,
    "websiteActions" INTEGER NOT NULL DEFAULT 0,
    "bookingActions" INTEGER NOT NULL DEFAULT 0,
    "otherActions" INTEGER NOT NULL DEFAULT 0,
    "actionBreakdown" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingAnalyticsDailyAggregate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ListingAnalyticsMonthlyAggregate" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "actions" INTEGER NOT NULL DEFAULT 0,
    "phoneActions" INTEGER NOT NULL DEFAULT 0,
    "messengerActions" INTEGER NOT NULL DEFAULT 0,
    "leadActions" INTEGER NOT NULL DEFAULT 0,
    "websiteActions" INTEGER NOT NULL DEFAULT 0,
    "bookingActions" INTEGER NOT NULL DEFAULT 0,
    "otherActions" INTEGER NOT NULL DEFAULT 0,
    "actionBreakdown" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingAnalyticsMonthlyAggregate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ListingAnalyticsRefreshState" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'idle',
    "lastAggregatedAt" TIMESTAMP(3),
    "nextAutoUpdateAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "manualRefreshDate" DATE,
    "manualRefreshCount" INTEGER NOT NULL DEFAULT 0,
    "refreshStartedAt" TIMESTAMP(3),
    "refreshFinishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingAnalyticsRefreshState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "la_event_entity_date_idx"
ON "public"."ListingAnalyticsEvent"("entityType", "entityId", "eventDate");

CREATE INDEX "la_event_type_date_idx"
ON "public"."ListingAnalyticsEvent"("entityType", "eventType", "eventDate");

CREATE INDEX "la_event_owner_date_idx"
ON "public"."ListingAnalyticsEvent"("ownerId", "eventDate");

CREATE INDEX "la_event_occurred_idx"
ON "public"."ListingAnalyticsEvent"("occurredAt");

CREATE UNIQUE INDEX "la_daily_entity_period_key"
ON "public"."ListingAnalyticsDailyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "la_daily_entity_period_idx"
ON "public"."ListingAnalyticsDailyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "la_daily_period_idx"
ON "public"."ListingAnalyticsDailyAggregate"("periodStart");

CREATE UNIQUE INDEX "la_monthly_entity_period_key"
ON "public"."ListingAnalyticsMonthlyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "la_monthly_entity_period_idx"
ON "public"."ListingAnalyticsMonthlyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "la_monthly_period_idx"
ON "public"."ListingAnalyticsMonthlyAggregate"("periodStart");

CREATE UNIQUE INDEX "la_refresh_entity_key"
ON "public"."ListingAnalyticsRefreshState"("entityType", "entityId");

CREATE INDEX "la_refresh_owner_updated_idx"
ON "public"."ListingAnalyticsRefreshState"("ownerId", "updatedAt");

CREATE INDEX "la_refresh_status_next_idx"
ON "public"."ListingAnalyticsRefreshState"("status", "nextAutoUpdateAt");

CREATE INDEX "la_refresh_last_agg_idx"
ON "public"."ListingAnalyticsRefreshState"("lastAggregatedAt");
