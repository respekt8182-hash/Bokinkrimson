// Unit tests for payment status transitions and edge cases.
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildTransferPaymentPayload,
  getPlacementCoverageState,
  getTariffByRoomCount,
  getTariffQuote,
  getTransferPaymentPayload,
  getTransferPaymentReference,
  getTransferPaymentTariffCode,
  getTransferPlacementCoverageState,
  mapYookassaStatus,
  resolvePaymentStatusTransition,
  serializePayment,
} from "../../src/lib/payments";

describe("payments domain", () => {
  it("maps YooKassa statuses", () => {
    expect(mapYookassaStatus("pending")).toBe(PaymentStatus.PENDING);
    expect(mapYookassaStatus("waiting_for_capture")).toBe(PaymentStatus.PENDING);
    expect(mapYookassaStatus("succeeded")).toBe(PaymentStatus.SUCCEEDED);
    expect(mapYookassaStatus("canceled")).toBe(PaymentStatus.CANCELED);
  });

  it("keeps terminal success status", () => {
    expect(resolvePaymentStatusTransition(PaymentStatus.SUCCEEDED, PaymentStatus.CANCELED)).toBe(
      PaymentStatus.SUCCEEDED,
    );
  });

  it("stores transfer payment context in provider payload for legacy schemas", () => {
    const payload = buildTransferPaymentPayload({
      transferId: "transfer-1",
      transferTitle: "Airport transfer",
    });

    expect(getTransferPaymentTariffCode("transfer-1")).toBe("transfer_standard:transfer-1");
    expect(getTransferPaymentPayload(payload)).toEqual({
      entityType: "transfer",
      transferId: "transfer-1",
      transferTitle: "Airport transfer",
    });
  });

  it("stores transfer top-up context in provider payload", () => {
    const payload = buildTransferPaymentPayload({
      transferId: "transfer-1",
      transferTitle: "Airport transfer",
      paymentReason: "fleet_topup",
      vehicleCount: 2,
      totalAmountRub: 2400,
      coveredAmountRub: 1900,
      requiredAmountRub: 500,
    });

    expect(getTransferPaymentPayload(payload)).toEqual({
      entityType: "transfer",
      transferId: "transfer-1",
      transferTitle: "Airport transfer",
      paymentReason: "fleet_topup",
      vehicleCount: 2,
      totalAmountRub: 2400,
      coveredAmountRub: 1900,
      requiredAmountRub: 500,
    });
  });

  it("serializes transfer context from provider payload when transferId is unavailable", () => {
    const serialized = serializePayment({
      id: "payment-1",
      propertyId: null,
      excursionId: null,
      transferId: null,
      ownerId: "owner-1",
      amount: new Prisma.Decimal(1490),
      tariffCode: "transfer_standard:transfer-1",
      roomCount: 0,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.MANAGER,
      providerPaymentId: null,
      confirmationUrl: null,
      createdAt: new Date("2026-04-27T10:00:00.000Z"),
      updatedAt: new Date("2026-04-27T10:00:00.000Z"),
      paidAt: null,
      canceledAt: null,
      placementValidUntil: null,
      providerPayload: buildTransferPaymentPayload({
        transferId: "transfer-1",
        transferTitle: "Airport transfer",
      }) as never,
    });

    expect(serialized.transferId).toBe("transfer-1");
    expect(serialized.transferName).toBe("Airport transfer");
  });

  it("restores legacy transfer payment context from the tariff code", () => {
    const reference = getTransferPaymentReference({
      transferId: null,
      tariffCode: "transfer_standard:transfer-1",
      providerPayload: null,
    });

    expect(reference).toEqual({
      transferId: "transfer-1",
      transferTitle: null,
    });
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

  it("calculates only transfer fleet top-up for an active paid cycle", () => {
    const placement = getTransferPlacementCoverageState({
      payments: [
        {
          amount: 1900,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-04-01T09:00:00.000Z"),
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          placementValidUntil: new Date("2027-04-01T09:00:00.000Z"),
        },
      ],
      publicationFeeRub: 2400,
      now: new Date("2026-04-10T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(true);
    expect(placement.coveredAmount).toBe(1900);
    expect(placement.coveredVehicleCount).toBe(1);
    expect(placement.requiredPaymentAmount).toBe(500);
    expect(placement.fullyCovered).toBe(false);
  });

  it("treats transfer top-up payments in the same cycle as cumulative coverage", () => {
    const placement = getTransferPlacementCoverageState({
      payments: [
        {
          amount: 1900,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-04-01T09:00:00.000Z"),
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          placementValidUntil: new Date("2027-04-01T09:00:00.000Z"),
        },
        {
          amount: 500,
          roomCount: 2,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-04-05T09:00:00.000Z"),
          createdAt: new Date("2026-04-05T09:00:00.000Z"),
          placementValidUntil: new Date("2027-04-01T09:00:00.000Z"),
        },
      ],
      publicationFeeRub: 2400,
      now: new Date("2026-04-10T09:00:00.000Z"),
    });

    expect(placement.coveredAmount).toBe(2400);
    expect(placement.coveredVehicleCount).toBe(2);
    expect(placement.requiredPaymentAmount).toBe(0);
    expect(placement.fullyCovered).toBe(true);
  });
});
