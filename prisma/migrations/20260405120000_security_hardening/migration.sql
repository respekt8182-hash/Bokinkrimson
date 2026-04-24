ALTER TABLE "User"
ADD COLUMN "pendingEmail" TEXT,
ADD COLUMN "emailChangeTokenHash" TEXT,
ADD COLUMN "emailChangeTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "emailChangeRequestedAt" TIMESTAMP(3),
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedByAdminId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSessionState" (
    "login" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSessionState_pkey" PRIMARY KEY ("login")
);

CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerPaymentId" TEXT,
    "localPaymentId" TEXT,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookReceipt_pkey" PRIMARY KEY ("id")
);

WITH ranked_property_reviews AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "propertyId"
            ORDER BY
                CASE WHEN "status" = 'active' THEN 0 WHEN "status" = 'pending' THEN 1 ELSE 2 END,
                "createdAt" ASC,
                "id" ASC
        ) AS row_number
    FROM "Review"
    WHERE "propertyId" IS NOT NULL
),
property_review_duplicates AS (
    SELECT "id"
    FROM ranked_property_reviews
    WHERE row_number > 1
)
UPDATE "Review"
SET
    "status" = 'deleted',
    "deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP)
WHERE "id" IN (SELECT "id" FROM property_review_duplicates);

WITH ranked_excursion_reviews AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "excursionId"
            ORDER BY
                CASE WHEN "status" = 'active' THEN 0 WHEN "status" = 'pending' THEN 1 ELSE 2 END,
                "createdAt" ASC,
                "id" ASC
        ) AS row_number
    FROM "Review"
    WHERE "excursionId" IS NOT NULL
),
excursion_review_duplicates AS (
    SELECT "id"
    FROM ranked_excursion_reviews
    WHERE row_number > 1
)
UPDATE "Review"
SET
    "status" = 'deleted',
    "deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP)
WHERE "id" IN (SELECT "id" FROM excursion_review_duplicates);

CREATE INDEX "User_pendingEmail_idx" ON "User"("pendingEmail");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE INDEX "PasswordResetToken_expiresAt_usedAt_idx" ON "PasswordResetToken"("expiresAt", "usedAt");
CREATE UNIQUE INDEX "WebhookReceipt_provider_fingerprint_key" ON "WebhookReceipt"("provider", "fingerprint");
CREATE INDEX "WebhookReceipt_provider_providerPaymentId_processedAt_idx" ON "WebhookReceipt"("provider", "providerPaymentId", "processedAt");
CREATE INDEX "WebhookReceipt_localPaymentId_processedAt_idx" ON "WebhookReceipt"("localPaymentId", "processedAt");
CREATE UNIQUE INDEX "Review_userId_propertyId_key" ON "Review"("userId", "propertyId");
CREATE UNIQUE INDEX "Review_userId_excursionId_key" ON "Review"("userId", "excursionId");

ALTER TABLE "PasswordResetToken"
ADD CONSTRAINT "PasswordResetToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
