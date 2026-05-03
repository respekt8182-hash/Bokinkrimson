INSERT INTO "ExcursionLocation" (
  "id", "slug", "name", "normalizedName", "kind", "districtId", "latitude", "longitude", "aliases", "isMajor", "createdAt", "updatedAt"
) VALUES
(
  'loc_koktebel',
  'koktebel',
  'Коктебель',
  'коктебель',
  'town',
  'district_east',
  44.9613,
  35.2466,
  ARRAY['коктебель', 'пгт коктебель', 'поселок коктебель', 'посёлок коктебель', 'планерское']::TEXT[],
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
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
