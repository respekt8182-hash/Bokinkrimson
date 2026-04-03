-- CreateEnum
CREATE TYPE "public"."ExcursionOfferType" AS ENUM ('excursion', 'tour');

-- CreateEnum
CREATE TYPE "public"."ExcursionAvailabilityMode" AS ENUM ('regular', 'dated', 'on_request');

-- AlterTable
ALTER TABLE "public"."Excursion"
ADD COLUMN "accommodationComment" TEXT,
ADD COLUMN "accommodationFormat" TEXT,
ADD COLUMN "accommodationNights" INTEGER,
ADD COLUMN "accommodationProvided" BOOLEAN,
ADD COLUMN "accommodationType" TEXT,
ADD COLUMN "availabilityMode" "public"."ExcursionAvailabilityMode" NOT NULL DEFAULT 'regular',
ADD COLUMN "availabilityNote" TEXT,
ADD COLUMN "durationDays" INTEGER,
ADD COLUMN "durationNights" INTEGER,
ADD COLUMN "extraOptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "finishPoint" TEXT,
ADD COLUMN "highlights" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "itineraryDays" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "mealPlan" TEXT,
ADD COLUMN "offerType" "public"."ExcursionOfferType" NOT NULL DEFAULT 'excursion',
ADD COLUMN "priceUnitLabel" TEXT,
ADD COLUMN "subtypeLabel" TEXT;
