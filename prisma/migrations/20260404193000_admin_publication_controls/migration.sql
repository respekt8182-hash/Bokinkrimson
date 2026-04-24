ALTER TABLE "public"."User"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletionExpiresAt" TIMESTAMP(3);

ALTER TABLE "public"."Property"
ADD COLUMN "isPublishedVisible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "public"."Excursion"
ADD COLUMN "isPublishedVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletionExpiresAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_deletionExpiresAt_createdAt_idx"
ON "public"."User"("deletedAt", "deletionExpiresAt", "createdAt");

CREATE INDEX "Property_isPublishedVisible_status_updatedAt_idx"
ON "public"."Property"("isPublishedVisible", "status", "updatedAt");

CREATE INDEX "Excursion_isPublishedVisible_status_updatedAt_idx"
ON "public"."Excursion"("isPublishedVisible", "status", "updatedAt");

CREATE INDEX "Excursion_deletedAt_deletionExpiresAt_idx"
ON "public"."Excursion"("deletedAt", "deletionExpiresAt");
