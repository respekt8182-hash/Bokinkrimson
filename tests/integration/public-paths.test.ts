// Integration tests for public catalog APIs and route accessibility.
import { describe, expect, it } from "vitest";
import { buildPublicExcursionPath, buildExcursionSlug } from "../../src/lib/public-excursions";
import {
  buildPropertySlug,
  buildPublicPropertyPath,
  extractPropertyId,
  slugify,
} from "../../src/lib/public-properties";

describe("public seo paths", () => {
  it("builds transliterated property slug", () => {
    const slug = buildPropertySlug("Отель Ромашка", "cabc123xyz9");
    expect(slug).toContain("otel-romashka");
    expect(slug).toContain("cabc123xyz9");
  });

  it("extracts id from slug and raw id", () => {
    const id = "cabc123xyz9";
    expect(extractPropertyId(`hotel-${id}`)).toBe(id);
    expect(extractPropertyId(id)).toBe(id);
  });

  it("builds public property and excursion path", () => {
    const propertyPath = buildPublicPropertyPath({
      id: "cabc123xyz9",
      locationId: "yalta",
      name: "Море",
    });
    const excursionPath = buildPublicExcursionPath({
      id: "cabc123xyz8",
      locationId: "sudak",
      title: "Горы",
    });

    expect(propertyPath).toMatch(/^\/crimea\/yalta\//);
    expect(excursionPath).toMatch(/^\/crimea\/excursions\/sudak\//);
  });

  it("prefers anchor slug in excursion path when present", () => {
    const excursionPath = buildPublicExcursionPath({
      id: "cabc123xyzz",
      locationId: "crimea",
      title: "Винный тур",
      anchorLocationSlug: "evpatoria",
    });

    expect(excursionPath).toMatch(/^\/crimea\/excursions\/evpatoria\//);
  });

  it("slugify falls back to latin-safe text", () => {
    expect(slugify("Ялта 2026 !!!")).toBe("yalta-2026");
    expect(buildExcursionSlug(null, "cabc123xyza")).toBe("ekskursiya-cabc123xyza");
  });
});
