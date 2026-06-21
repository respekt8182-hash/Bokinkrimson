import { describe, expect, it } from "vitest";
import {
  ATTRACTION_CATEGORIES,
  getAttractionCategory,
  getAttractionCategoryLabel,
  isAttractionInCategory,
} from "@/lib/attraction-categories";

describe("attraction categories", () => {
  it("exposes the eight public categories", () => {
    expect(ATTRACTION_CATEGORIES.map((category) => category.label)).toEqual([
      "Море и пляжи",
      "Природа и маршруты",
      "История и археология",
      "Дворцы и архитектура",
      "Музеи и культура",
      "Храмы и религия",
      "Парки и городские прогулки",
      "Развлечения и семья",
    ]);
  });

  it.each([
    ["Пляжи и купание", "Море и пляжи"],
    ["Море, бухты, мысы и маяки", "Море и пляжи"],
    ["Горы, скалы и пещеры", "Природа и маршруты"],
    ["Водопады, озёра и водоёмы", "Природа и маршруты"],
    ["Смотровые и маршруты", "Природа и маршруты"],
    ["Заповедники, урочища и природные парки", "Природа и маршруты"],
    ["История, археология и военные объекты", "История и археология"],
    ["Дворцы, дачи и архитектура", "Дворцы и архитектура"],
    ["Музеи, культура и памятники", "Музеи и культура"],
    ["Винодельни, гастро и производства", "Музеи и культура"],
    ["Храмы, монастыри и религия", "Храмы и религия"],
    ["Городские прогулки, парки и инфраструктура", "Парки и городские прогулки"],
    ["Развлечения и семейный отдых", "Развлечения и семья"],
  ])("maps %s to %s", (source, expected) => {
    expect(getAttractionCategoryLabel(source)).toBe(expected);
  });

  it("matches legacy and public category names in one filter group", () => {
    expect(isAttractionInCategory("Водопады, озёра и водоёмы", "Природа и маршруты")).toBe(true);
    expect(isAttractionInCategory("Пляжи и купание", "Природа и маршруты")).toBe(false);
  });

  it("classifies descriptive variants without creating a ninth public category", () => {
    expect(getAttractionCategory("Маяки и виды")?.id).toBe("beach");
    expect(getAttractionCategory("Пещерные города")?.id).toBe("history");
  });
});
