// Integration tests for public catalog APIs and route accessibility.
import { describe, expect, it } from "vitest";
import { buildPublicExcursionPath, buildExcursionSlug } from "../../src/lib/public-excursions";
import { buildPublicTransferPath, buildTransferPublicSlug } from "../../src/lib/public-marketplace";
import {
  buildPropertySlug,
  buildPublicPropertyPath,
  extractPropertyId,
  slugify,
} from "../../src/lib/public-properties";
import { stripSearchParamsFromPath } from "../../src/lib/seo/url-normalize";

describe("public seo paths", () => {
  it("builds transliterated property slug", () => {
    const slug = buildPropertySlug("Отель Ромашка", "cabc123xyz9");
    expect(slug).toBe("otel-romashka");
    expect(slug).not.toContain("cabc123xyz9");
  });

  it("extracts id from slug and raw id", () => {
    const id = "cabc123xyz9";
    expect(extractPropertyId(`hotel-${id}`)).toBe(id);
    expect(extractPropertyId(id)).toBe(id);
  });

  it("extracts seeded demo ids from slug and raw id", () => {
    expect(extractPropertyId("sanatoriy-lazurnyy-bereg-demo_property_11")).toBe(
      "demo_property_11",
    );
    expect(extractPropertyId("demo_property_11")).toBe("demo_property_11");
    expect(extractPropertyId("vecherniy-tur-demo_excursion_03")).toBe("demo_excursion_03");
    expect(extractPropertyId("azovskiy-semeynyy-otdyh-v-schelkino-demo_tour_11")).toBe(
      "demo_tour_11",
    );
  });

  it("extracts prefixed live ids from slug and raw id", () => {
    const propertyId = "property_c9b47c9f85ae456f911e58d371048c1c";
    const excursionId = "excursion_a9b47c9f85ae456f911e58d371048c1c";

    expect(extractPropertyId(`123-${propertyId}`)).toBe(propertyId);
    expect(extractPropertyId(propertyId)).toBe(propertyId);
    expect(extractPropertyId(`morskaya-progulka-${excursionId}`)).toBe(excursionId);
    expect(extractPropertyId(excursionId)).toBe(excursionId);
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
    expect(propertyPath).not.toContain("?");
    expect(excursionPath).not.toContain("?");
    expect(propertyPath).not.toContain("cabc123xyz9");
    expect(excursionPath).not.toContain("cabc123xyz8");
  });

  it("builds public transfer path without technical id", () => {
    const transferPath = buildPublicTransferPath({
      id: "cmohb63e50001exmkyx1lx59l",
      title: "Такси по городу Ялта седан",
    });

    expect(buildTransferPublicSlug("Такси по городу Ялта седан")).toBe(
      "taksi-po-gorodu-yalta-sedan",
    );
    expect(transferPath).toBe("/transfers/taksi-po-gorodu-yalta-sedan");
    expect(transferPath).not.toContain("cmohb63e50001exmkyx1lx59l");
  });

  it("strips volatile search params from public detail links", () => {
    expect(
      stripSearchParamsFromPath(
        "/crimea/feodosiya/apartamenty-demo_property_16?guests=2&checkIn=2026-05-03",
      ),
    ).toBe("/crimea/feodosiya/apartamenty-demo_property_16");
    expect(
      stripSearchParamsFromPath(
        "/crimea/excursions/yalta/tur-demo_tour_01?dateFrom=2026-05-03&guests=2#program",
      ),
    ).toBe("/crimea/excursions/yalta/tur-demo_tour_01#program");
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
    expect(buildExcursionSlug(null, "cabc123xyza")).toBe("ekskursiya");
  });
});
