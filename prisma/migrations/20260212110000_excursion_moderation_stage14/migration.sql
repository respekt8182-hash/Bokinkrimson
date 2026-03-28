ALTER TYPE "ExcursionStatus" ADD VALUE IF NOT EXISTS 'pending_moderation';
ALTER TYPE "ExcursionStatus" ADD VALUE IF NOT EXISTS 'needs_fix';
ALTER TYPE "ExcursionStatus" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "Excursion"
  ADD COLUMN "moderationNotes" TEXT,
  ADD COLUMN "moderatedById" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3);
