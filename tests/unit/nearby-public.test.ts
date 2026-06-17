import { describe, expect, it } from "vitest";
import { getBoundingBoxForRadiusKm } from "../../src/lib/nearby-public";

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
