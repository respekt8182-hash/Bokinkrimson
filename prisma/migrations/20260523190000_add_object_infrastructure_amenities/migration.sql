INSERT INTO "Amenity" ("id", "name", "category", "isActive", "updatedAt") VALUES
  ('shared_kitchen', 'Общая кухня', 'Питание', true, NOW()),
  ('playground', 'Детская площадка', 'Инфраструктура', true, NOW()),
  ('pool', 'Бассейн', 'Инфраструктура', true, NOW()),
  ('transfer', 'Трансфер', 'Транспорт', true, NOW())
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "isActive" = true,
  "updatedAt" = NOW();

INSERT INTO "RoomFeature" ("id", "name", "category", "isActive", "updatedAt") VALUES
  ('shared_kitchen', 'Общая кухня', 'Инфраструктура объекта', true, NOW()),
  ('playground', 'Детская площадка', 'Инфраструктура объекта', true, NOW()),
  ('pool', 'Бассейн', 'Инфраструктура объекта', true, NOW()),
  ('transfer', 'Трансфер', 'Инфраструктура объекта', true, NOW())
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "isActive" = true,
  "updatedAt" = NOW();
