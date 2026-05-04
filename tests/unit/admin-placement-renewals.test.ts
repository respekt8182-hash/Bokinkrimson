import { describe, expect, it } from "vitest";
import {
  getLatestPlacementPayment,
  getPlacementRenewalTiming,
  parsePlacementRenewalLookaheadDays,
} from "../../src/lib/admin-placement-renewals";

describe("admin placement renewals", () => {
  it("uses only supported renewal lookahead periods", () => {
    expect(parsePlacementRenewalLookaheadDays("7")).toBe(7);
    expect(parsePlacementRenewalLookaheadDays("30")).toBe(30);
    expect(parsePlacementRenewalLookaheadDays("120")).toBe(30);
    expect(parsePlacementRenewalLookaheadDays(undefined)).toBe(30);
  });

  it("detects placements ending inside the selected window", () => {
    const now = new Date("2026-05-04T10:00:00.000Z");

    expect(
      getPlacementRenewalTiming({
        validUntil: new Date("2026-06-03T09:59:59.000Z"),
        now,
        lookaheadDays: 30,
      }),
    ).toEqual({ daysLeft: 30, inWindow: true });

    expect(
      getPlacementRenewalTiming({
        validUntil: new Date("2026-06-04T10:00:01.000Z"),
        now,
        lookaheadDays: 30,
      }).inWindow,
    ).toBe(false);
  });

  it("chooses the payment with the latest resolved placement end date", () => {
    const latest = getLatestPlacementPayment([
      {
        paidAt: new Date("2026-03-01T10:00:00.000Z"),
        createdAt: new Date("2026-03-01T09:50:00.000Z"),
        placementValidUntil: new Date("2027-03-01T10:00:00.000Z"),
      },
      {
        paidAt: new Date("2026-04-01T10:00:00.000Z"),
        createdAt: new Date("2026-04-01T09:50:00.000Z"),
        placementValidUntil: new Date("2027-04-01T10:00:00.000Z"),
      },
    ]);

    expect(latest?.validUntil.toISOString()).toBe("2027-04-01T10:00:00.000Z");
  });

  it("falls back to paidAt plus the default placement year", () => {
    const latest = getLatestPlacementPayment([
      {
        paidAt: new Date("2026-05-01T10:00:00.000Z"),
        createdAt: new Date("2026-05-01T09:50:00.000Z"),
        placementValidUntil: null,
      },
    ]);

    expect(latest?.validUntil.toISOString()).toBe("2027-05-01T10:00:00.000Z");
  });
});
