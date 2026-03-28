// Unit tests for shared search/map contract parsers.
import { describe, expect, it } from "vitest";
import {
  isPointInsideBounds,
  parseBoundsParam,
  parseIntParam,
  pickFirstListValue,
} from "../../src/lib/search-contracts";

describe("search contracts helpers", () => {
  it("parses valid bounds string", () => {
    const bounds = parseBoundsParam("44.9,33.8,45.2,34.3");
    expect(bounds).toEqual({
      south: 44.9,
      west: 33.8,
      north: 45.2,
      east: 34.3,
    });
  });

  it("rejects invalid bounds string", () => {
    expect(parseBoundsParam("45,34,44,33")).toBeNull();
    expect(parseBoundsParam("invalid")).toBeNull();
  });

  it("checks point inclusion by bounds", () => {
    const bounds = parseBoundsParam("44.9,33.8,45.2,34.3");
    expect(isPointInsideBounds(45.0, 34.0, bounds)).toBe(true);
    expect(isPointInsideBounds(46.0, 34.0, bounds)).toBe(false);
    expect(isPointInsideBounds(null, 34.0, bounds)).toBe(false);
  });

  it("clamps integer params by range", () => {
    expect(parseIntParam("0", 12, { min: 1, max: 24 })).toBe(1);
    expect(parseIntParam("500", 12, { min: 1, max: 24 })).toBe(24);
    expect(parseIntParam("abc", 12, { min: 1, max: 24 })).toBe(12);
  });

  it("extracts first value from comma-separated lists", () => {
    expect(pickFirstListValue("hotel,guest_house")).toBe("hotel");
    expect(pickFirstListValue("   ")).toBeUndefined();
  });
});
