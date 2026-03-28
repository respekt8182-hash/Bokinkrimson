-- Add queue for admin-managed password reset requests.
DO $$
BEGIN
  CREATE TYPE "PasswordResetRequestStatus" AS ENUM ('PENDING', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PasswordResetRequest" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "processedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PasswordResetRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PasswordResetRequest_processedById_fkey"
    FOREIGN KEY ("processedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PasswordResetRequest_status_createdAt_idx"
  ON "PasswordResetRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_userId_status_createdAt_idx"
  ON "PasswordResetRequest"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_processedById_createdAt_idx"
  ON "PasswordResetRequest"("processedById", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_email_createdAt_idx"
  ON "PasswordResetRequest"("email", "createdAt");
