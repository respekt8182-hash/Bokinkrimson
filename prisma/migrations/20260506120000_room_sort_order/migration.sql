ALTER TABLE "Room" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_rooms AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "propertyId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS position
  FROM "Room"
)
UPDATE "Room"
SET "sortOrder" = ordered_rooms.position
FROM ordered_rooms
WHERE "Room"."id" = ordered_rooms."id";

CREATE INDEX "Room_propertyId_isActive_sortOrder_idx" ON "Room"("propertyId", "isActive", "sortOrder");
