ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "faqItems" JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "likesCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dislikesCount" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewReactionValue') THEN
    CREATE TYPE "ReviewReactionValue" AS ENUM ('like', 'dislike');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewReaction" (
  "reviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" "ReviewReactionValue" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewReaction_pkey" PRIMARY KEY ("reviewId", "userId")
);

CREATE INDEX IF NOT EXISTS "ReviewReaction_userId_createdAt_idx"
  ON "ReviewReaction"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReviewReaction_reviewId_value_idx"
  ON "ReviewReaction"("reviewId", "value");

ALTER TABLE "ReviewReaction"
  ADD CONSTRAINT "ReviewReaction_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewReaction"
  ADD CONSTRAINT "ReviewReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
