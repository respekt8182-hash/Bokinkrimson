import { describe, expect, it } from "vitest";
import {
  calculateDistanceKm,
  isWithinRadiusKm,
  roundDistanceKm,
} from "@/lib/catalog-radius";
import {
  getStaticAttractionById,
  getStaticAttractionByIdentifier,
  getStaticAttractionCatalog,
  getStaticAttractions,
} from "@/lib/static-attractions";

describe("catalog radius helpers", () => {
  it("checks distance against the selected map radius", () => {
    expect(isWithinRadiusKm(4.999, 5)).toBe(true);
    expect(isWithinRadiusKm(5.001, 5)).toBe(false);
    expect(isWithinRadiusKm(null, 5)).toBe(false);
  });

  it("calculates and rounds straight-line catalog distance", () => {
    const distance = calculateDistanceKm(
      { latitude: 44.4952, longitude: 34.1663 },
      { latitude: 44.43066, longitude: 34.12847 },
    );

    expect(distance).not.toBeNull();
    expect(roundDistanceKm(distance)).toBeGreaterThan(7);
    expect(roundDistanceKm(distance)).toBeLessThan(9);
  });
});

describe("static attraction catalog radius filtering", () => {
  it("does not keep location text matches outside the selected radius", async () => {
    const narrow = await getStaticAttractionCatalog({
      location: "yalta",
      radiusKm: 5,
      pageSize: 5000,
      allowLargePageSize: true,
    });
    const wide = await getStaticAttractionCatalog({
      location: "yalta",
      radiusKm: 100,
      pageSize: 5000,
      allowLargePageSize: true,
    });

    expect(narrow.filters.centerLat).not.toBeNull();
    expect(wide.entries.some((entry) => entry.distanceKm !== null && entry.distanceKm > 5)).toBe(
      true,
    );
    expect(
      narrow.entries.every((entry) => entry.distanceKm !== null && entry.distanceKm <= 5),
    ).toBe(true);
  });

  it("treats placeholder-only attractions as hidden everywhere", async () => {
    const placeholderId = "attraction_new_kostel_uspeniya_bogoroditsy_kerch";
    const hiddenItem = await getStaticAttractionById(placeholderId);
    const publicItems = await getStaticAttractions();
    const publicByIdentifier = await getStaticAttractionByIdentifier(placeholderId);

    expect(hiddenItem).not.toBeNull();
    expect(hiddenItem?.status).toBe("HIDDEN");
    expect(hiddenItem?.isPublishedVisible).toBe(false);
    expect(publicItems.some((item) => item.id === placeholderId)).toBe(false);
    expect(publicByIdentifier).toBeNull();
  });
});
