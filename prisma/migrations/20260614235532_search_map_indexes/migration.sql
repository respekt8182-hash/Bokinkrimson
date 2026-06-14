CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "property_map_visible_geo_idx"
  ON "Property" ("status", "isPublishedVisible", "latitude", "longitude");

CREATE INDEX IF NOT EXISTS "property_map_location_type_updated_idx"
  ON "Property" ("status", "isPublishedVisible", "locationId", "type", "updatedAt");

CREATE INDEX IF NOT EXISTS "property_search_rating_reviews_updated_idx"
  ON "Property" ("status", "isPublishedVisible", "avgRating", "reviewsCount", "updatedAt");

CREATE INDEX IF NOT EXISTS "excursion_map_visible_geo_idx"
  ON "Excursion" ("status", "isPublishedVisible", "latitude", "longitude");

CREATE INDEX IF NOT EXISTS "excursion_map_offer_category_updated_idx"
  ON "Excursion" ("status", "isPublishedVisible", "offerType", "categoryId", "updatedAt");

CREATE INDEX IF NOT EXISTS "excursion_map_anchor_offer_updated_idx"
  ON "Excursion" ("status", "isPublishedVisible", "anchorLocationId", "offerType", "updatedAt");

CREATE INDEX IF NOT EXISTS "excursion_search_price_updated_idx"
  ON "Excursion" ("status", "isPublishedVisible", "priceFrom", "updatedAt");

CREATE INDEX IF NOT EXISTS "property_search_text_trgm_idx"
  ON "Property"
  USING gin (
    lower(
      coalesce("name", '') || ' ' ||
      coalesce("locationName", '') || ' ' ||
      coalesce("address", '') || ' ' ||
      coalesce("type", '')
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS "excursion_search_text_trgm_idx"
  ON "Excursion"
  USING gin (
    lower(
      coalesce("title", '') || ' ' ||
      coalesce("locationName", '') || ' ' ||
      coalesce("startPoint", '') || ' ' ||
      coalesce("finishPoint", '') || ' ' ||
      coalesce("shortDescription", '')
    ) gin_trgm_ops
  );
