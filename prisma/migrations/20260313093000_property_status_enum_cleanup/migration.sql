CREATE TYPE "PropertyStatus_new" AS ENUM ('draft', 'pending_moderation', 'published', 'rejected');

ALTER TABLE "Property"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Property"
ALTER COLUMN "status" TYPE "PropertyStatus_new"
USING ("status"::text::"PropertyStatus_new");

ALTER TABLE "Property"
ALTER COLUMN "pendingEditStatus" TYPE "PropertyStatus_new"
USING ("pendingEditStatus"::text::"PropertyStatus_new");

DROP TYPE "PropertyStatus";

ALTER TYPE "PropertyStatus_new" RENAME TO "PropertyStatus";

ALTER TABLE "Property"
ALTER COLUMN "status" SET DEFAULT 'draft';
