import { describe, expect, it } from "vitest";
import {
  calculateDistanceKm,
  isWithinRadiusKm,
  roundDistanceKm,
} from "@/lib/catalog-radius";
import { getStaticAttractionCatalog } from "@/lib/static-attractions";

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
});
