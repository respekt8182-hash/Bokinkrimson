// Unit tests for nightly pricing calculations and period selection.
import { describe, expect, it } from "vitest";
import { calculateRoomStayPrice, dateRangesOverlap, parseIsoDate } from "../../src/lib/pricing";

describe("pricing helpers", () => {
  it("validates iso dates strictly", () => {
    expect(parseIsoDate("2026-02-28")).not.toBeNull();
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("26-02-28")).toBeNull();
  });

  it("detects date range overlap", () => {
    const aFrom = new Date("2026-07-01T00:00:00.000Z");
    const aTo = new Date("2026-07-10T00:00:00.000Z");
    const bFrom = new Date("2026-07-10T00:00:00.000Z");
    const bTo = new Date("2026-07-15T00:00:00.000Z");
    const cFrom = new Date("2026-07-11T00:00:00.000Z");
    const cTo = new Date("2026-07-20T00:00:00.000Z");

    expect(dateRangesOverlap(aFrom, aTo, bFrom, bTo)).toBe(true);
    expect(dateRangesOverlap(aFrom, aTo, cFrom, cTo)).toBe(false);
  });

  it("calculates stay total and detects missing dates", () => {
    const ok = calculateRoomStayPrice({
      prices: [
        { dateFrom: "2026-08-01", dateTo: "2026-08-03", price: 3000, currency: "RUB" },
        { dateFrom: "2026-08-04", dateTo: "2026-08-10", price: 3500, currency: "RUB" },
      ],
      checkIn: "2026-08-02",
      checkOut: "2026-08-05",
    });

    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.nights).toBe(3);
      expect(ok.total).toBe(9500);
    }

    const fail = calculateRoomStayPrice({
      prices: [{ dateFrom: "2026-08-01", dateTo: "2026-08-01", price: 3000, currency: "RUB" }],
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
    });

    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.missingDates).toContain("2026-08-02");
    }
  });
});
