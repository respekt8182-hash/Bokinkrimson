// Unit tests for payment status transitions and edge cases.
import { PaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getPlacementCoverageState,
  getTariffByRoomCount,
  getTariffQuote,
  mapYookassaStatus,
  resolvePaymentStatusTransition,
} from "../../src/lib/payments";

describe("payments domain", () => {
  it("maps YooKassa statuses", () => {
    expect(mapYookassaStatus("pending")).toBe(PaymentStatus.PENDING);
    expect(mapYookassaStatus("waiting_for_capture")).toBe(PaymentStatus.PENDING);
    expect(mapYookassaStatus("succeeded")).toBe(PaymentStatus.SUCCEEDED);
    expect(mapYookassaStatus("canceled")).toBe(PaymentStatus.CANCELED);
  });

  it("keeps terminal success status", () => {
    expect(
      resolvePaymentStatusTransition(PaymentStatus.SUCCEEDED, PaymentStatus.CANCELED),
    ).toBe(PaymentStatus.SUCCEEDED);
  });

  it("selects tariff by room count", () => {
    expect(getTariffByRoomCount(2, null).code).toBe("MULTI_ROOM_SMALL");
    expect(getTariffByRoomCount(6, null).code).toBe("MULTI_ROOM_SMALL");
    expect(getTariffByRoomCount(7, null).code).toBe("MULTI_ROOM_MEDIUM");
    expect(getTariffByRoomCount(16, null).code).toBe("MULTI_ROOM_MEDIUM");
    expect(getTariffByRoomCount(17, null).code).toBe("MULTI_ROOM_LARGE");
    expect(getTariffByRoomCount(25, null).code).toBe("MULTI_ROOM_LARGE");
    expect(getTariffByRoomCount(26, null).code).toBe("MULTI_ROOM_XL");
    expect(getTariffByRoomCount(100, null).code).toBe("MULTI_ROOM_XL");
    expect(getTariffByRoomCount(1, "apartment").code).toBe("UNIT_SINGLE");
  });

  it("calculates only the tariff difference for an active placement after room increase", () => {
    const placement = getPlacementCoverageState({
      payments: [
        {
          amount: 3990,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-03-01T09:00:00.000Z"),
          createdAt: new Date("2026-03-01T09:00:00.000Z"),
          placementValidUntil: new Date("2027-03-01T09:00:00.000Z"),
        },
      ],
      quote: getTariffQuote({
        roomCount: 2,
        propertyType: null,
      }),
      now: new Date("2026-03-10T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(true);
    expect(placement.coveredAmount).toBe(3990);
    expect(placement.coveredRoomCount).toBe(1);
    expect(placement.requiredPaymentAmount).toBe(1000);
    expect(placement.fullyCovered).toBe(false);
  });

  it("treats successful top-up payments in the same placement cycle as cumulative coverage", () => {
    const placement = getPlacementCoverageState({
      payments: [
        {
          amount: 3990,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-03-01T09:00:00.000Z"),
          createdAt: new Date("2026-03-01T09:00:00.000Z"),
          placementValidUntil: new Date("2027-03-01T09:00:00.000Z"),
        },
        {
          amount: 1000,
          roomCount: 2,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-03-05T09:00:00.000Z"),
          createdAt: new Date("2026-03-05T09:00:00.000Z"),
          placementValidUntil: new Date("2027-03-01T09:00:00.000Z"),
        },
      ],
      quote: getTariffQuote({
        roomCount: 2,
        propertyType: null,
      }),
      now: new Date("2026-03-10T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(true);
    expect(placement.coveredAmount).toBe(4990);
    expect(placement.coveredRoomCount).toBe(2);
    expect(placement.requiredPaymentAmount).toBe(0);
    expect(placement.fullyCovered).toBe(true);
  });
});
