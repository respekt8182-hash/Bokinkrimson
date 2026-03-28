-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ExcursionFormat" ADD VALUE 'individual';
ALTER TYPE "public"."ExcursionFormat" ADD VALUE 'vip';

-- DropIndex
DROP INDEX "public"."Review_status_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."PasswordResetRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "mealOptions" TEXT,
ADD COLUMN     "parkingInfo" TEXT,
ADD COLUMN     "prepaymentPolicy" TEXT;
