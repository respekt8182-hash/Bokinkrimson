// Unit tests for property rules preset encoding, parsing, and display helpers.
import { describe, expect, it } from "vitest";
import {
  buildMealOptionsValue,
  buildParkingInfoValue,
  buildPrepaymentPolicyValue,
  parseMealOptionsValue,
  parseParkingInfoValue,
  parsePrepaymentPolicyValue,
} from "../../src/lib/property-rules";

describe("property rules presets", () => {
  it("encodes and decodes parking selections", () => {
    const encoded = buildParkingInfoValue(["on_site", "guarded", "free"]);
    expect(encoded).toBe("preset-multi:on_site|guarded|free");

    const parsed = parseParkingInfoValue(encoded);
    expect(parsed.selectedIds).toEqual(["on_site", "guarded", "free"]);
    expect(parsed.labels).toEqual(["На территории", "Охраняемая", "Бесплатная"]);
    expect(parsed.legacyText).toBeNull();
  });

  it("keeps legacy meal text readable", () => {
    const parsed = parseMealOptionsValue("Завтрак включён, обед по меню");
    expect(parsed.selectedIds).toEqual([]);
    expect(parsed.labels).toEqual([]);
    expect(parsed.legacyText).toBe("Завтрак включён, обед по меню");
  });

  it("builds and parses prepayment presets with clamped percent", () => {
    const encoded = buildPrepaymentPolicyValue("booking", 12);
    expect(encoded).toBe("preset-prepayment:booking|total|10");

    const parsed = parsePrepaymentPolicyValue("preset-prepayment:before_arrival|first_night|83");
    expect(parsed.timingId).toBe("before_arrival");
    expect(parsed.basisId).toBe("first_night");
    expect(parsed.percent).toBe(85);
    expect(parsed.displayValue).toBe("85% от стоимости первой ночи");
    expect(parsed.legacyText).toBeNull();
  });

  it("keeps old preset format compatible and defaults to total booking amount", () => {
    const parsed = parsePrepaymentPolicyValue("preset-prepayment:booking|50");
    expect(parsed.timingId).toBe("booking");
    expect(parsed.basisId).toBe("total");
    expect(parsed.percent).toBe(50);
    expect(parsed.displayValue).toBe("50% от общей стоимости бронирования");
  });

  it("returns legacy prepayment text unchanged", () => {
    const parsed = parsePrepaymentPolicyValue("50% при бронировании");
    expect(parsed.timingId).toBeNull();
    expect(parsed.displayValue).toBe("50% при бронировании");
    expect(parsed.legacyText).toBe("50% при бронировании");
  });

  it("encodes empty selections as null", () => {
    expect(buildParkingInfoValue([])).toBeNull();
    expect(buildMealOptionsValue([])).toBeNull();
    expect(buildPrepaymentPolicyValue(null, 30)).toBeNull();
  });
});
