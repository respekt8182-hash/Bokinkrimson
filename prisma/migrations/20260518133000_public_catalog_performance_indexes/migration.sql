CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "property_catalog_location_visible_updated_idx"
  ON "Property" ("locationId", "status", "isPublishedVisible", "updatedAt");

CREATE INDEX IF NOT EXISTS "property_catalog_type_visible_updated_idx"
  ON "Property" ("type", "status", "isPublishedVisible", "updatedAt");

CREATE INDEX IF NOT EXISTS "property_catalog_rating_visible_idx"
  ON "Property" ("avgRating", "status", "isPublishedVisible");

CREATE INDEX IF NOT EXISTS "property_catalog_created_idx"
  ON "Property" ("createdAt");

CREATE INDEX IF NOT EXISTS "property_catalog_geo_idx"
  ON "Property" ("latitude", "longitude");

CREATE INDEX IF NOT EXISTS "property_catalog_name_trgm_idx"
  ON "Property" USING gin (lower(coalesce("name", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "property_catalog_location_name_trgm_idx"
  ON "Property" USING gin (lower(coalesce("locationName", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "property_catalog_address_trgm_idx"
  ON "Property" USING gin (lower(coalesce("address", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "room_price_price_idx"
  ON "RoomPrice" ("price");

CREATE INDEX IF NOT EXISTS "room_price_date_range_idx"
  ON "RoomPrice" ("dateFrom", "dateTo");

CREATE INDEX IF NOT EXISTS "media_property_type_room_sort_idx"
  ON "Media" ("propertyId", "type", "roomId", "sortOrder");
