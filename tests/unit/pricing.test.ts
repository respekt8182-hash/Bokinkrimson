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

  it("multiplies per-person prices by guests and nights", () => {
    const result = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-08-01",
          dateTo: "2026-08-03",
          price: 1200,
          priceType: "PER_PERSON",
          currency: "RUB",
        },
      ],
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      guests: 3,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.priceType).toBe("PER_PERSON");
      expect(result.unitTotal).toBe(2400);
      expect(result.total).toBe(7200);
      expect(result.breakdown[0]?.totalPrice).toBe(3600);
    }

    const longerStay = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-08-01",
          dateTo: "2026-08-10",
          price: 1200,
          priceType: "PER_PERSON",
          currency: "RUB",
        },
      ],
      checkIn: "2026-08-01",
      checkOut: "2026-08-06",
      guests: 3,
    });

    expect(longerStay.ok).toBe(true);
    if (longerStay.ok) {
      expect(longerStay.nights).toBe(5);
      expect(longerStay.total).toBe(18000);
    }
  });

  it("keeps the selected-guest total correct for one-person nightly examples", () => {
    const result = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          price: 500,
          priceType: "PER_PERSON",
          currency: "RUB",
        },
      ],
      checkIn: "2026-09-10",
      checkOut: "2026-09-13",
      guests: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nights).toBe(3);
      expect(result.unitTotal).toBe(1500);
      expect(result.total).toBe(3000);
      expect(result.breakdown.map((item) => item.totalPrice)).toEqual([1000, 1000, 1000]);
    }
  });

  it("rejects stays shorter than the period minimum nights", () => {
    const tooShort = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          price: 5000,
          minNights: 3,
          currency: "RUB",
        },
      ],
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guests: 2,
    });

    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) {
      expect(tooShort.minNights).toBe(3);
      expect(tooShort.message).toContain("от 3");
    }

    const longEnough = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          price: 5000,
          minNights: 3,
          currency: "RUB",
        },
      ],
      checkIn: "2026-09-10",
      checkOut: "2026-09-13",
      guests: 2,
    });

    expect(longEnough.ok).toBe(true);
  });

  it("adds extra bed prices to per-room stays above the included guests", () => {
    const result = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          price: 5000,
          priceType: "PER_ROOM",
          extraBedPrice: 800,
          currency: "RUB",
        },
      ],
      checkIn: "2026-09-10",
      checkOut: "2026-09-13",
      guests: 3,
      includedGuests: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nights).toBe(3);
      expect(result.total).toBe(17400);
      expect(result.unitTotal).toBe(17400);
      expect(result.breakdown[0]).toMatchObject({
        extraGuests: 1,
        extraBedPrice: 800,
        extraTotal: 800,
        totalPrice: 5800,
      });
    }
  });

  it("uses the extra bed price for per-person stays above the included guests", () => {
    const result = calculateRoomStayPrice({
      prices: [
        {
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          price: 1000,
          priceType: "PER_PERSON",
          extraBedPrice: 600,
          currency: "RUB",
        },
      ],
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guests: 3,
      includedGuests: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nights).toBe(2);
      expect(result.total).toBe(5200);
      expect(result.unitTotal).toBe(2000);
      expect(result.breakdown[0]).toMatchObject({
        extraGuests: 1,
        extraBedPrice: 600,
        extraTotal: 600,
        totalPrice: 2600,
      });
    }
  });
});
