-- Legal/privacy foundation migration.
-- Before applying in production, create a PostgreSQL backup, for example:
-- pg_dump "$DATABASE_URL" --format=custom --file=backup-before-legal-compliance.dump

ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'requires_registry_review';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'sent_to_owner';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'viewed_by_owner';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'owner_responded';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'cancelled_by_user';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LegalListingType') THEN
    CREATE TYPE "LegalListingType" AS ENUM (
      'private_rental',
      'guest_house',
      'classified_accommodation',
      'non_accommodation_listing'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccommodationRegistryStatus') THEN
    CREATE TYPE "AccommodationRegistryStatus" AS ENUM (
      'active',
      'suspended',
      'expired',
      'not_verified'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentSubjectType') THEN
    CREATE TYPE "ConsentSubjectType" AS ENUM (
      'visitor',
      'user',
      'listing_owner',
      'applicant',
      'platform_service_buyer',
      'claimant',
      'public_contact_owner'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentType') THEN
    CREATE TYPE "ConsentType" AS ENUM (
      'personal_data',
      'public_data_distribution',
      'marketing',
      'cookies_functional',
      'cookies_analytics',
      'review_publication'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentAction') THEN
    CREATE TYPE "ConsentAction" AS ENUM ('granted', 'revoked', 'updated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformServiceOrderStatus') THEN
    CREATE TYPE "PlatformServiceOrderStatus" AS ENUM (
      'created',
      'paid',
      'receipt_pending_manual_issue',
      'receipt_issued',
      'refund_requested',
      'refunded',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NpdReceiptStatus') THEN
    CREATE TYPE "NpdReceiptStatus" AS ENUM (
      'receipt_pending_manual_issue',
      'created',
      'sent',
      'failed',
      'refund_pending',
      'refunded'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundRequestStatus') THEN
    CREATE TYPE "RefundRequestStatus" AS ENUM (
      'new',
      'in_review',
      'approved',
      'rejected',
      'paid',
      'cancelled'
    );
  END IF;
END $$;

ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "legalListingType" "LegalListingType" NOT NULL DEFAULT 'private_rental',
  ADD COLUMN IF NOT EXISTS "registryId" TEXT,
  ADD COLUMN IF NOT EXISTS "registryUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "registryStatus" "AccommodationRegistryStatus" NOT NULL DEFAULT 'not_verified',
  ADD COLUMN IF NOT EXISTS "registryCheckedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registryType" TEXT,
  ADD COLUMN IF NOT EXISTS "registryCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "publicDataConsentGrantedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publicDataConsentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "contactsPublicationAllowed" BOOLEAN NOT NULL DEFAULT false;

-- Do not infer public-data consent for existing listings.
-- Registry-review backfill is intentionally placed in the next migration because PostgreSQL
-- cannot safely use a newly added enum value in the same transaction.

CREATE TABLE IF NOT EXISTS "ConsentEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "subjectType" "ConsentSubjectType" NOT NULL,
  "subjectId" TEXT,
  "consentType" "ConsentType" NOT NULL,
  "action" "ConsentAction" NOT NULL,
  "documentVersion" VARCHAR(40) NOT NULL,
  "url" VARCHAR(500) NOT NULL,
  "ipAddress" VARCHAR(80),
  "userAgent" VARCHAR(500),
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentKey" VARCHAR(80) NOT NULL,
  "version" VARCHAR(40) NOT NULL,
  "title" TEXT NOT NULL,
  "url" VARCHAR(500) NOT NULL,
  "effectiveAt" DATE NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checksum" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformServiceOrder" (
  "id" TEXT NOT NULL,
  "orderNumber" VARCHAR(40) NOT NULL,
  "userId" TEXT,
  "paymentId" TEXT,
  "serviceCode" VARCHAR(80) NOT NULL,
  "serviceName" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
  "offerVersion" VARCHAR(40) NOT NULL,
  "consentEvidence" JSONB NOT NULL,
  "status" "PlatformServiceOrderStatus" NOT NULL DEFAULT 'created',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformServiceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NpdReceipt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "refundRequestId" TEXT,
  "status" "NpdReceiptStatus" NOT NULL DEFAULT 'receipt_pending_manual_issue',
  "provider" VARCHAR(40) NOT NULL DEFAULT 'manual',
  "providerReceiptId" TEXT,
  "receiptUrl" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "deadlineAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NpdReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RefundRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" VARCHAR(40) NOT NULL,
  "orderId" TEXT,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "serviceType" VARCHAR(120) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "reason" VARCHAR(120) NOT NULL,
  "comment" TEXT,
  "preliminaryAmount" DECIMAL(10,2),
  "finalAmount" DECIMAL(10,2),
  "documentedExpenses" DECIMAL(10,2),
  "status" "RefundRequestStatus" NOT NULL DEFAULT 'new',
  "consentEvidence" JSONB NOT NULL,
  "decisionHistory" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentVersion_documentKey_version_key" ON "DocumentVersion"("documentKey", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformServiceOrder_orderNumber_key" ON "PlatformServiceOrder"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "RefundRequest_requestNumber_key" ON "RefundRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "Property_legalListingType_registryStatus_registryCheckedAt_idx" ON "Property"("legalListingType", "registryStatus", "registryCheckedAt");
CREATE INDEX IF NOT EXISTS "Property_contactsPublicationAllowed_publicDataConsentGrantedAt_idx" ON "Property"("contactsPublicationAllowed", "publicDataConsentGrantedAt");
CREATE INDEX IF NOT EXISTS "ConsentEvent_userId_consentType_createdAt_idx" ON "ConsentEvent"("userId", "consentType", "createdAt");
CREATE INDEX IF NOT EXISTS "ConsentEvent_subjectType_subjectId_consentType_createdAt_idx" ON "ConsentEvent"("subjectType", "subjectId", "consentType", "createdAt");
CREATE INDEX IF NOT EXISTS "ConsentEvent_consentType_action_createdAt_idx" ON "ConsentEvent"("consentType", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "DocumentVersion_documentKey_isActive_idx" ON "DocumentVersion"("documentKey", "isActive");
CREATE INDEX IF NOT EXISTS "PlatformServiceOrder_userId_createdAt_idx" ON "PlatformServiceOrder"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformServiceOrder_paymentId_idx" ON "PlatformServiceOrder"("paymentId");
CREATE INDEX IF NOT EXISTS "PlatformServiceOrder_status_createdAt_idx" ON "PlatformServiceOrder"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "NpdReceipt_orderId_status_createdAt_idx" ON "NpdReceipt"("orderId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "NpdReceipt_refundRequestId_idx" ON "NpdReceipt"("refundRequestId");
CREATE INDEX IF NOT EXISTS "NpdReceipt_status_deadlineAt_idx" ON "NpdReceipt"("status", "deadlineAt");
CREATE INDEX IF NOT EXISTS "RefundRequest_orderId_createdAt_idx" ON "RefundRequest"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "RefundRequest_userId_createdAt_idx" ON "RefundRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsentEvent_userId_fkey'
  ) THEN
    ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformServiceOrder_userId_fkey'
  ) THEN
    ALTER TABLE "PlatformServiceOrder" ADD CONSTRAINT "PlatformServiceOrder_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformServiceOrder_paymentId_fkey'
  ) THEN
    ALTER TABLE "PlatformServiceOrder" ADD CONSTRAINT "PlatformServiceOrder_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NpdReceipt_orderId_fkey'
  ) THEN
    ALTER TABLE "NpdReceipt" ADD CONSTRAINT "NpdReceipt_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "PlatformServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NpdReceipt_refundRequestId_fkey'
  ) THEN
    ALTER TABLE "NpdReceipt" ADD CONSTRAINT "NpdReceipt_refundRequestId_fkey"
      FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_orderId_fkey'
  ) THEN
    ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "PlatformServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_userId_fkey'
  ) THEN
    ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
