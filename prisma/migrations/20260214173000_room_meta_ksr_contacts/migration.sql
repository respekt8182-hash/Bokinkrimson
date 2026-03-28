ALTER TABLE "Property"
  ADD COLUMN "contactPersonName" TEXT,
  ADD COLUMN "contactPersonRole" TEXT,
  ADD COLUMN "listingChannels" TEXT;

ALTER TABLE "Room"
  ADD COLUMN "meta" JSONB;
