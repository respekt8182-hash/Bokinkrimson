CREATE TABLE "public"."EngagementLog" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" VARCHAR(40) NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EngagementLog_entityType_entityId_actionType_date_key"
ON "public"."EngagementLog"("entityType", "entityId", "actionType", "date");

CREATE INDEX "EngagementLog_entityType_entityId_date_idx"
ON "public"."EngagementLog"("entityType", "entityId", "date");

CREATE INDEX "EngagementLog_entityType_actionType_date_idx"
ON "public"."EngagementLog"("entityType", "actionType", "date");
