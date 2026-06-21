import { describe, expect, it } from "vitest";
import { getBoundingBoxForRadiusKm, getMinNightPriceForDate } from "@/lib/nearby-public";

describe("nearby public bounding boxes", () => {
  it("builds a tight box around a normal point", () => {
    const box = getBoundingBoxForRadiusKm({
      latitude: 44.5,
      longitude: 34.1,
      radiusKm: 10,
    });

    expect(box).not.toBeNull();
    expect(box!.minLat).toBeLessThan(44.5);
    expect(box!.maxLat).toBeGreaterThan(44.5);
    expect(box!.minLng).toBeLessThan(34.1);
    expect(box!.maxLng).toBeGreaterThan(34.1);
    expect(box!.crossesAntimeridian).toBe(false);
    expect(box!.coversAllLongitudes).toBe(false);
  });

  it("marks boxes crossing the antimeridian", () => {
    const box = getBoundingBoxForRadiusKm({
      latitude: 0,
      longitude: 179.9,
      radiusKm: 50,
    });

    expect(box).not.toBeNull();
    expect(box!.crossesAntimeridian).toBe(true);
  });

  it("keeps very small radius boxes valid", () => {
    const box = getBoundingBoxForRadiusKm({
      latitude: 44.5,
      longitude: 34.1,
      radiusKm: 0.001,
    });

    expect(box).not.toBeNull();
    expect(box!.minLat).toBeLessThanOrEqual(44.5);
    expect(box!.maxLat).toBeGreaterThanOrEqual(44.5);
  });

  it("covers all longitudes near a pole or with a very large radius", () => {
    const box = getBoundingBoxForRadiusKm({
      latitude: 89.9,
      longitude: 34.1,
      radiusKm: 100,
    });

    expect(box).not.toBeNull();
    expect(box!.coversAllLongitudes).toBe(true);
    expect(box!.minLng).toBe(-180);
    expect(box!.maxLng).toBe(180);
  });
});

describe("getMinNightPriceForDate", () => {
  it("returns the lowest price among all rooms for the requested day", () => {
    const result = getMinNightPriceForDate(
      [
        {
          prices: [
            { dateFrom: "2026-06-01", dateTo: "2026-06-30", price: 4200, currency: "RUB" },
          ],
        },
        {
          prices: [
            { dateFrom: "2026-06-20", dateTo: "2026-06-20", price: 3100, currency: "RUB" },
            { dateFrom: "2026-07-01", dateTo: "2026-07-31", price: 1800, currency: "RUB" },
          ],
        },
      ],
      "2026-06-20",
    );

    expect(result).toEqual({ minNightPrice: 3100, currency: "RUB" });
  });

  it("does not show expired or future prices as current", () => {
    const result = getMinNightPriceForDate(
      [
        {
          prices: [
            { dateFrom: "2026-05-01", dateTo: "2026-05-31", price: 1000, currency: "RUB" },
            { dateFrom: "2026-07-01", dateTo: "2026-07-31", price: 1500, currency: "RUB" },
          ],
        },
      ],
      "2026-06-20",
    );

    expect(result).toEqual({ minNightPrice: null, currency: null });
  });
});
