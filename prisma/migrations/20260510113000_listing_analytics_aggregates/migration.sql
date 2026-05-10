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

CREATE INDEX "ListingAnalyticsEvent_entityType_entityId_eventDate_idx"
ON "public"."ListingAnalyticsEvent"("entityType", "entityId", "eventDate");

CREATE INDEX "ListingAnalyticsEvent_entityType_eventType_eventDate_idx"
ON "public"."ListingAnalyticsEvent"("entityType", "eventType", "eventDate");

CREATE INDEX "ListingAnalyticsEvent_ownerId_eventDate_idx"
ON "public"."ListingAnalyticsEvent"("ownerId", "eventDate");

CREATE INDEX "ListingAnalyticsEvent_occurredAt_idx"
ON "public"."ListingAnalyticsEvent"("occurredAt");

CREATE UNIQUE INDEX "ListingAnalyticsDailyAggregate_entityType_entityId_periodStart_key"
ON "public"."ListingAnalyticsDailyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "ListingAnalyticsDailyAggregate_entityType_entityId_periodStart_idx"
ON "public"."ListingAnalyticsDailyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "ListingAnalyticsDailyAggregate_periodStart_idx"
ON "public"."ListingAnalyticsDailyAggregate"("periodStart");

CREATE UNIQUE INDEX "ListingAnalyticsMonthlyAggregate_entityType_entityId_periodStart_key"
ON "public"."ListingAnalyticsMonthlyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "ListingAnalyticsMonthlyAggregate_entityType_entityId_periodStart_idx"
ON "public"."ListingAnalyticsMonthlyAggregate"("entityType", "entityId", "periodStart");

CREATE INDEX "ListingAnalyticsMonthlyAggregate_periodStart_idx"
ON "public"."ListingAnalyticsMonthlyAggregate"("periodStart");

CREATE UNIQUE INDEX "ListingAnalyticsRefreshState_entityType_entityId_key"
ON "public"."ListingAnalyticsRefreshState"("entityType", "entityId");

CREATE INDEX "ListingAnalyticsRefreshState_ownerId_updatedAt_idx"
ON "public"."ListingAnalyticsRefreshState"("ownerId", "updatedAt");

CREATE INDEX "ListingAnalyticsRefreshState_status_nextAutoUpdateAt_idx"
ON "public"."ListingAnalyticsRefreshState"("status", "nextAutoUpdateAt");

CREATE INDEX "ListingAnalyticsRefreshState_lastAggregatedAt_idx"
ON "public"."ListingAnalyticsRefreshState"("lastAggregatedAt");
