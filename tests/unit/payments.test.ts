// Unit tests for payment status transitions and edge cases.
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildPostLaunchTrialPaymentPayload,
  buildTransferPaymentPayload,
  getPlacementCoverageState,
  getProgramPlacementValidUntil,
  getSeasonPlacementValidUntil,
  getTariffQuote,
  getTransferPaymentPayload,
  getTransferPaymentReference,
  getTransferPaymentTariffCode,
  getTransferPlacementCoverageState,
  resolvePaymentStatusTransition,
  serializePayment,
  setPaymentAdminRevenueIncluded,
  shouldCountPaymentInAdminRevenue,
} from "../../src/lib/payments";

describe("payments domain", () => {
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

  it("stores manager revenue accounting flag without losing payment payload context", () => {
    const payload = buildTransferPaymentPayload({
      transferId: "transfer-1",
      transferTitle: "Airport transfer",
    });

    const excludedPayload = setPaymentAdminRevenueIncluded(payload, false);

    expect(shouldCountPaymentInAdminRevenue(payload)).toBe(true);
    expect(shouldCountPaymentInAdminRevenue(excludedPayload)).toBe(false);
    expect(getTransferPaymentPayload(excludedPayload)).toEqual({
      entityType: "transfer",
      transferId: "transfer-1",
      transferTitle: "Airport transfer",
    });
  });

  it("selects object placement tariff by period, not room count", () => {
    const januaryQuote = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      now: new Date("2026-01-10T09:00:00.000Z"),
    });
    const seasonQuote = getTariffQuote({
      roomCount: 30,
      propertyType: "hotel",
      now: new Date("2026-07-10T09:00:00.000Z"),
    });
    const yearlyQuote = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      tariffType: "yearly",
      now: new Date("2026-07-10T09:00:00.000Z"),
    });

    expect(januaryQuote.tariff.code).toBe("object_season");
    expect(januaryQuote.originalAmount).toBe(4600);
    expect(seasonQuote.tariff.code).toBe("object_season");
    expect(seasonQuote.originalAmount).toBe(3000);
    expect(yearlyQuote.tariff.code).toBe("object_yearly");
    expect(yearlyQuote.originalAmount).toBe(5000);
    expect(yearlyQuote.monthlyLabel).toBe("около 417 ₽ в месяц");
  });

  it("uses offseason object placement after the season ends and keeps yearly fixed", () => {
    const quote = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      now: new Date("2026-11-10T09:00:00.000Z"),
    });
    const requestedSeasonAfterSeasonEnd = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      tariffType: "season",
      now: new Date("2026-12-10T09:00:00.000Z"),
    });
    const januaryOffseason = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      tariffType: "offseason",
      now: new Date("2027-01-10T09:00:00.000Z"),
    });
    const aprilOffseason = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      tariffType: "offseason",
      now: new Date("2027-04-10T09:00:00.000Z"),
    });
    const yearlyQuote = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      tariffType: "yearly",
      now: new Date("2027-01-10T09:00:00.000Z"),
    });

    expect(quote.tariff.code).toBe("object_offseason");
    expect(quote.originalAmount).toBe(2800);
    expect(requestedSeasonAfterSeasonEnd.tariff.code).toBe("object_offseason");
    expect(januaryOffseason.originalAmount).toBe(1860);
    expect(aprilOffseason.originalAmount).toBe(460);
    expect(yearlyQuote.tariff.code).toBe("object_yearly");
    expect(yearlyQuote.originalAmount).toBe(5000);
  });

  it("uses October 31 as the paid-until date for season payments", () => {
    const seasonUntil = getSeasonPlacementValidUntil(new Date("2026-05-23T09:00:00.000Z"));
    const nextSeasonUntil = getProgramPlacementValidUntil(
      "season",
      new Date("2026-12-10T09:00:00.000Z"),
    );

    expect(seasonUntil.getFullYear()).toBe(2026);
    expect(seasonUntil.getMonth()).toBe(9);
    expect(seasonUntil.getDate()).toBe(31);
    expect(seasonUntil.getHours()).toBe(23);
    expect(seasonUntil.getMinutes()).toBe(59);
    expect(nextSeasonUntil.getFullYear()).toBe(2027);
    expect(nextSeasonUntil.getMonth()).toBe(9);
    expect(nextSeasonUntil.getDate()).toBe(31);
  });

  it("keeps the selected object tariff price when the launch promo is disabled", () => {
    const quote = getTariffQuote({
      roomCount: 1,
      propertyType: "apartment",
      now: new Date("2026-05-10T09:00:00.000Z"),
    });

    expect(quote.originalAmount).toBe(3400);
    expect(quote.amount).toBe(3400);
    expect(quote.promo).toBeNull();
  });

  it("keeps active object placement covered after room increase", () => {
    const placement = getPlacementCoverageState({
      payments: [
        {
          amount: 3000,
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
        now: new Date("2026-07-01T09:00:00.000Z"),
      }),
      now: new Date("2026-03-10T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(true);
    expect(placement.coveredAmount).toBe(3000);
    expect(placement.coveredRoomCount).toBe(1);
    expect(placement.requiredPaymentAmount).toBe(0);
    expect(placement.fullyCovered).toBe(true);
  });

  it("does not require object top-up payments for additional rooms", () => {
    const placement = getPlacementCoverageState({
      payments: [
        {
          amount: 3000,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-03-01T09:00:00.000Z"),
          createdAt: new Date("2026-03-01T09:00:00.000Z"),
          placementValidUntil: new Date("2027-03-01T09:00:00.000Z"),
        },
        {
          amount: 0,
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
        now: new Date("2026-07-01T09:00:00.000Z"),
      }),
      now: new Date("2026-03-10T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(true);
    expect(placement.coveredAmount).toBe(3000);
    expect(placement.coveredRoomCount).toBe(2);
    expect(placement.requiredPaymentAmount).toBe(0);
    expect(placement.fullyCovered).toBe(true);
  });

  it("treats post-launch trial placement as free coverage until its end date", () => {
    const trialPayload = buildPostLaunchTrialPaymentPayload({
      originalAmountRub: 3400,
      now: new Date("2026-05-10T09:00:00.000Z"),
      validUntil: new Date("2027-05-10T09:00:00.000Z"),
    });

    const placement = getPlacementCoverageState({
      payments: [
        {
          amount: 0,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-05-10T09:00:00.000Z"),
          createdAt: new Date("2026-05-10T09:00:00.000Z"),
          placementValidUntil: new Date("2027-05-10T09:00:00.000Z"),
          providerPayload: trialPayload as never,
        },
      ],
      quote: getTariffQuote({
        roomCount: 1,
        propertyType: "apartment",
        now: new Date("2026-06-10T09:00:00.000Z"),
      }),
      now: new Date("2026-06-10T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(true);
    expect(placement.paidUntil).toBe("2027-05-10T09:00:00.000Z");
    expect(placement.coveredAmount).toBe(0);
    expect(placement.coveredOriginalAmount).toBe(3400);
    expect(placement.requiredPaymentAmount).toBe(0);
    expect(placement.fullyCovered).toBe(true);
  });

  it("requires paid renewal after free demo placement expires", () => {
    const trialPayload = buildPostLaunchTrialPaymentPayload({
      originalAmountRub: 3400,
      now: new Date("2026-05-10T09:00:00.000Z"),
      validUntil: new Date("2027-05-10T09:00:00.000Z"),
    });

    const placement = getPlacementCoverageState({
      payments: [
        {
          amount: 0,
          roomCount: 1,
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date("2026-05-10T09:00:00.000Z"),
          createdAt: new Date("2026-05-10T09:00:00.000Z"),
          placementValidUntil: new Date("2027-05-10T09:00:00.000Z"),
          providerPayload: trialPayload as never,
        },
      ],
      quote: getTariffQuote({
        roomCount: 1,
        propertyType: "apartment",
        now: new Date("2027-05-11T09:00:00.000Z"),
      }),
      now: new Date("2027-05-11T09:00:00.000Z"),
    });

    expect(placement.hasActivePlacement).toBe(false);
    expect(placement.requiredPaymentAmount).toBe(3400);
    expect(placement.fullyCovered).toBe(false);
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
