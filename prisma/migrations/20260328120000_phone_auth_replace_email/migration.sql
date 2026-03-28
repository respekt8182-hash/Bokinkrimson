-- Step 1: Ensure all User rows have a phone value.
-- For existing users without phone, derive it from email prefix or set a placeholder.
UPDATE "User" SET "phone" = COALESCE("phone", REPLACE("email", '@', '')) WHERE "phone" IS NULL;

-- Step 2: Make phone required and unique on User; make email optional.
-- Drop old unique constraint on email.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

-- Make phone NOT NULL.
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- Make email nullable.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Add unique constraint on phone.
ALTER TABLE "User" ADD CONSTRAINT "User_phone_key" UNIQUE ("phone");

-- Step 3: Update PasswordResetRequest — replace email column with phone.
-- Add phone column.
ALTER TABLE "PasswordResetRequest" ADD COLUMN "phone" TEXT;

-- Populate phone from the related user.
UPDATE "PasswordResetRequest" pr
SET "phone" = u."phone"
FROM "User" u
WHERE pr."userId" = u."id";

-- Set a fallback for any orphaned rows (shouldn't happen due to FK, but safe).
UPDATE "PasswordResetRequest" SET "phone" = '' WHERE "phone" IS NULL;

-- Make phone NOT NULL.
ALTER TABLE "PasswordResetRequest" ALTER COLUMN "phone" SET NOT NULL;

-- Drop old email-based index and column.
DROP INDEX IF EXISTS "PasswordResetRequest_email_createdAt_idx";
ALTER TABLE "PasswordResetRequest" DROP COLUMN "email";

-- Create new index on phone.
CREATE INDEX "PasswordResetRequest_phone_createdAt_idx" ON "PasswordResetRequest"("phone", "createdAt");
