-- CreateEnum
CREATE TYPE "ExcursionLocationKind" AS ENUM ('city', 'town', 'village', 'landmark', 'beach', 'trail', 'other');

-- CreateEnum
CREATE TYPE "ExcursionFormat" AS ENUM ('group', 'private');

-- CreateEnum
CREATE TYPE "ExcursionPriceType" AS ENUM ('per_person', 'per_group');

-- CreateEnum
CREATE TYPE "ExcursionDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "ExcursionScheduleMode" AS ENUM ('text', 'rules', 'sessions');

-- CreateEnum
CREATE TYPE "ExcursionSessionStatus" AS ENUM ('available', 'sold_out', 'canceled');

-- CreateTable
CREATE TABLE "ExcursionDistrict" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcursionCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcursionLocation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "kind" "ExcursionLocationKind" NOT NULL DEFAULT 'other',
    "districtId" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcursionPickupLocation" (
    "excursionId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcursionPickupLocation_pkey" PRIMARY KEY ("excursionId","locationId")
);

-- CreateTable
CREATE TABLE "ExcursionRouteLocation" (
    "excursionId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcursionRouteLocation_pkey" PRIMARY KEY ("excursionId","locationId","sortOrder")
);

-- CreateTable
CREATE TABLE "ExcursionSession" (
    "id" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "priceOverride" DECIMAL(10,2),
    "status" "ExcursionSessionStatus" NOT NULL DEFAULT 'available',
    "bookingDeadlineMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcursionScheduleRule" (
    "id" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "dateFrom" DATE,
    "dateTo" DATE,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timeStarts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durationMinutes" INTEGER,
    "capacityDefault" INTEGER,
    "priceOverride" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcursionScheduleException" (
    "id" TEXT NOT NULL,
    "excursionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "overrideTimeStarts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overrideCapacity" INTEGER,
    "overridePrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcursionScheduleException_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Excursion"
ADD COLUMN "mainLocationId" TEXT,
ADD COLUMN "anchorLocationId" TEXT,
ADD COLUMN "districtId" TEXT,
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "meetingPointText" TEXT,
ADD COLUMN "meetingLocationId" TEXT,
ADD COLUMN "shortDescription" TEXT,
ADD COLUMN "fullDescription" TEXT,
ADD COLUMN "scheduleMode" "ExcursionScheduleMode" NOT NULL DEFAULT 'text',
ADD COLUMN "format" "ExcursionFormat",
ADD COLUMN "groupSizeMin" INTEGER,
ADD COLUMN "groupSizeMax" INTEGER,
ADD COLUMN "languageCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "ageLimit" INTEGER,
ADD COLUMN "isKidFriendly" BOOLEAN,
ADD COLUMN "difficulty" "ExcursionDifficulty",
ADD COLUMN "priceType" "ExcursionPriceType" NOT NULL DEFAULT 'per_person',
ADD COLUMN "priceTo" DECIMAL(10,2),
ADD COLUMN "includedText" TEXT,
ADD COLUMN "notIncludedText" TEXT,
ADD COLUMN "cancellationPolicy" TEXT,
ADD COLUMN "pickupAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "instantConfirmation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionDistrict_slug_key" ON "ExcursionDistrict"("slug");

-- CreateIndex
CREATE INDEX "ExcursionDistrict_isActive_name_idx" ON "ExcursionDistrict"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionCategory_slug_key" ON "ExcursionCategory"("slug");

-- CreateIndex
CREATE INDEX "ExcursionCategory_isActive_sortOrder_name_idx" ON "ExcursionCategory"("isActive", "sortOrder", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionLocation_slug_key" ON "ExcursionLocation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionLocation_normalizedName_key" ON "ExcursionLocation"("normalizedName");

-- CreateIndex
CREATE INDEX "ExcursionLocation_districtId_isMajor_idx" ON "ExcursionLocation"("districtId", "isMajor");

-- CreateIndex
CREATE INDEX "ExcursionLocation_name_idx" ON "ExcursionLocation"("name");

-- CreateIndex
CREATE INDEX "ExcursionPickupLocation_locationId_idx" ON "ExcursionPickupLocation"("locationId");

-- CreateIndex
CREATE INDEX "ExcursionRouteLocation_excursionId_sortOrder_idx" ON "ExcursionRouteLocation"("excursionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ExcursionRouteLocation_locationId_idx" ON "ExcursionRouteLocation"("locationId");

-- CreateIndex
CREATE INDEX "ExcursionSession_excursionId_startAt_idx" ON "ExcursionSession"("excursionId", "startAt");

-- CreateIndex
CREATE INDEX "ExcursionSession_status_startAt_idx" ON "ExcursionSession"("status", "startAt");

-- CreateIndex
CREATE INDEX "ExcursionScheduleRule_excursionId_dateFrom_dateTo_idx" ON "ExcursionScheduleRule"("excursionId", "dateFrom", "dateTo");

-- CreateIndex
CREATE UNIQUE INDEX "ExcursionScheduleException_excursionId_date_key" ON "ExcursionScheduleException"("excursionId", "date");

-- CreateIndex
CREATE INDEX "ExcursionScheduleException_date_idx" ON "ExcursionScheduleException"("date");

-- CreateIndex
CREATE INDEX "Excursion_anchorLocationId_status_updatedAt_idx" ON "Excursion"("anchorLocationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Excursion_mainLocationId_status_updatedAt_idx" ON "Excursion"("mainLocationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Excursion_districtId_status_updatedAt_idx" ON "Excursion"("districtId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Excursion_categoryId_status_updatedAt_idx" ON "Excursion"("categoryId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Excursion_meetingLocationId_idx" ON "Excursion"("meetingLocationId");

-- CreateIndex
CREATE INDEX "Excursion_scheduleMode_idx" ON "Excursion"("scheduleMode");

-- CreateIndex
CREATE INDEX "Excursion_pickupAvailable_idx" ON "Excursion"("pickupAvailable");

-- AddForeignKey
ALTER TABLE "ExcursionLocation" ADD CONSTRAINT "ExcursionLocation_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "ExcursionDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionPickupLocation" ADD CONSTRAINT "ExcursionPickupLocation_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionPickupLocation" ADD CONSTRAINT "ExcursionPickupLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ExcursionLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionRouteLocation" ADD CONSTRAINT "ExcursionRouteLocation_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionRouteLocation" ADD CONSTRAINT "ExcursionRouteLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ExcursionLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionSession" ADD CONSTRAINT "ExcursionSession_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionScheduleRule" ADD CONSTRAINT "ExcursionScheduleRule_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcursionScheduleException" ADD CONSTRAINT "ExcursionScheduleException_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excursion" ADD CONSTRAINT "Excursion_mainLocationId_fkey" FOREIGN KEY ("mainLocationId") REFERENCES "ExcursionLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excursion" ADD CONSTRAINT "Excursion_anchorLocationId_fkey" FOREIGN KEY ("anchorLocationId") REFERENCES "ExcursionLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excursion" ADD CONSTRAINT "Excursion_meetingLocationId_fkey" FOREIGN KEY ("meetingLocationId") REFERENCES "ExcursionLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excursion" ADD CONSTRAINT "Excursion_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "ExcursionDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excursion" ADD CONSTRAINT "Excursion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExcursionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed districts
INSERT INTO "ExcursionDistrict" ("id", "slug", "name", "isActive", "createdAt", "updatedAt") VALUES
('district_west', 'zapadnyy-krym', 'Западный Крым', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('district_south_coast', 'yuzhnyy-bereg-kryma', 'Южный берег Крыма', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('district_east', 'vostochnyy-krym', 'Восточный Крым', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('district_center', 'centralnyy-krym', 'Центральный Крым', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('district_sevastopol', 'sevastopolskiy-region', 'Севастопольский регион', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed categories
INSERT INTO "ExcursionCategory" ("id", "slug", "name", "description", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
('cat_sea', 'morskie-progulki', 'Морские прогулки / дайвинг / рыбалка', 'Морские экскурсии, дайвинг, яхты, рыбалка', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_mountains', 'gory-i-trekking', 'Горы / трекинг / водопады', 'Пешие маршруты, тропы и горные точки', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_history', 'istoriya-i-arhitektura', 'История и архитектура', 'Дворцы, музеи и исторические объекты', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_jeep', 'dzhip-tury-i-aktiv', 'Джип-туры / квадроциклы / актив', 'Внедорожные и активные форматы', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_wine', 'vinnye-i-gastro', 'Винные туры / гастро', 'Дегустации и гастрономические маршруты', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_family', 'detskie-i-semeynye', 'Детские / семейные', 'Сценарии для семей и поездок с детьми', true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_photo', 'foto-tury', 'Фото-туры / рассветы / закаты', 'Маршруты с упором на фото и видовые точки', true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed major anchor cities
INSERT INTO "ExcursionLocation" (
  "id", "slug", "name", "normalizedName", "kind", "districtId", "latitude", "longitude", "aliases", "isMajor", "createdAt", "updatedAt"
) VALUES
('loc_alupka', 'alupka', 'Алупка', 'алупка', 'city', 'district_south_coast', 44.4197, 34.0453, ARRAY['алупка']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_alushta', 'alushta', 'Алушта', 'алушта', 'city', 'district_south_coast', 44.6765, 34.4095, ARRAY['алушта']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_evpatoria', 'evpatoria', 'Евпатория', 'евпатория', 'city', 'district_west', 45.2009, 33.3669, ARRAY['евпатория', 'евпа']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_kerch', 'kerch', 'Керчь', 'керчь', 'city', 'district_east', 45.3562, 36.4674, ARRAY['керчь']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_sevastopol', 'sevastopol', 'Севастополь', 'севастополь', 'city', 'district_sevastopol', 44.6166, 33.5254, ARRAY['севастополь', 'севас']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_sudak', 'sudak', 'Судак', 'судак', 'city', 'district_east', 44.8491, 34.9747, ARRAY['судак']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_feodosiya', 'feodosiya', 'Феодосия', 'феодосия', 'city', 'district_east', 45.0368, 35.3824, ARRAY['феодосия']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_schelkino', 'schelkino', 'Щёлкино', 'щелкино', 'city', 'district_east', 45.4291, 35.8259, ARRAY['щелкино', 'щёлкино']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('loc_yalta', 'yalta', 'Ялта', 'ялта', 'city', 'district_south_coast', 44.4952, 34.1663, ARRAY['ялта']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "normalizedName" = EXCLUDED."normalizedName",
  "kind" = EXCLUDED."kind",
  "districtId" = EXCLUDED."districtId",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude",
  "aliases" = EXCLUDED."aliases",
  "isMajor" = EXCLUDED."isMajor",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Backfill anchor/main/district for existing excursions by legacy location slug
UPDATE "Excursion" AS e
SET
  "anchorLocationId" = l."id",
  "mainLocationId" = COALESCE(e."mainLocationId", l."id"),
  "districtId" = COALESCE(e."districtId", l."districtId"),
  "locationName" = COALESCE(e."locationName", l."name")
FROM "ExcursionLocation" AS l
WHERE e."locationId" = l."slug";

-- For old records, reuse short text fields where helpful.
UPDATE "Excursion"
SET "meetingPointText" = COALESCE("meetingPointText", "startPoint")
WHERE "meetingPointText" IS NULL AND "startPoint" IS NOT NULL;

UPDATE "Excursion"
SET "shortDescription" = COALESCE("shortDescription", "description")
WHERE "shortDescription" IS NULL AND "description" IS NOT NULL;

UPDATE "Excursion"
SET "fullDescription" = COALESCE("fullDescription", "routeDescription")
WHERE "fullDescription" IS NULL AND "routeDescription" IS NOT NULL;
