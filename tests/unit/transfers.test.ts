import { describe, expect, it } from "vitest";
import { TransferStatus } from "@prisma/client";
import { calculateTransferPublicationFeeRub } from "@/lib/site-tariffs";
import {
  buildTransferWorkflowStatusWhere,
  deriveTransferSummaryFromFleet,
  getTransferStatusLabel,
  getTransferWorkflowStatus,
  isTransferReadyForModeration,
  normalizeTransferFleet,
} from "@/lib/transfers";

describe("transfer fleet normalization", () => {
  it("keeps luggage notes and derives max capacity across several vehicles", () => {
    const fleet = normalizeTransferFleet([
      {
        id: "sedan",
        vehicleModel: "Sedan",
        seats: 3,
        luggage: 2,
        luggageNote: "2 чемодана + ручная кладь",
        priceFrom: 1800,
        priceUnitLabel: "/ поездка",
      },
      {
        id: "van",
        vehicleModel: "Van",
        seats: 7,
        luggage: 5,
        priceFrom: 2600,
        priceUnitLabel: "/ авто",
      },
    ]);

    const summary = deriveTransferSummaryFromFleet({ fleet });

    expect(fleet[0]?.luggageNote).toBe("2 чемодана + ручная кладь");
    expect(summary.seats).toBe(7);
    expect(summary.luggage).toBe(5);
    expect(summary.priceFrom).toBe(1800);
    expect(summary.vehicleModel).toBe("Sedan");
  });

  it("recognizes complete transfer drafts as ready for moderation", () => {
    expect(
      isTransferReadyForModeration({
        title: "Airport transfer",
        description: "Comfortable route across Crimea",
        transferType: "Airport transfer",
        locationName: "Yalta",
        contactName: "Ivan Petrov",
        phone: "+79990000000",
        fleet: [
          {
            vehicleModel: "Hyundai Solaris",
            seats: 3,
            priceFrom: 2500,
            photoUrl: "/uploads/transfer.webp",
          },
        ],
      }),
    ).toBe(true);
  });

  it("keeps several photos for one vehicle and derives transfer gallery from them", () => {
    const fleet = normalizeTransferFleet([
      {
        id: "minivan",
        vehicleModel: "Hyundai Staria",
        priceFrom: 3200,
        photoUrls: [
          " /uploads/transfer-front.webp ",
          "/uploads/transfer-front.webp",
          "/uploads/transfer-salon.webp",
          "/uploads/transfer-trunk.webp",
        ],
      },
    ]);

    const summary = deriveTransferSummaryFromFleet({ fleet });

    expect(fleet[0]?.photoUrl).toBe("/uploads/transfer-front.webp");
    expect(fleet[0]?.photoUrls).toEqual([
      "/uploads/transfer-front.webp",
      "/uploads/transfer-salon.webp",
      "/uploads/transfer-trunk.webp",
    ]);
    expect(summary.photoUrls).toEqual([
      "/uploads/transfer-front.webp",
      "/uploads/transfer-salon.webp",
      "/uploads/transfer-trunk.webp",
    ]);
  });

  it("calculates transfer placement fee from fleet size", () => {
    expect(calculateTransferPublicationFeeRub(1)).toBe(1900);
    expect(calculateTransferPublicationFeeRub(3)).toBe(2900);
  });

  it("uses pending edit status as transfer workflow status for published cards", () => {
    expect(
      getTransferWorkflowStatus(TransferStatus.PUBLISHED, TransferStatus.PENDING_MODERATION),
    ).toBe(TransferStatus.PENDING_MODERATION);
    expect(
      getTransferStatusLabel(TransferStatus.PUBLISHED, TransferStatus.PENDING_MODERATION),
    ).toBe("Изменения на модерации");
  });

  it("builds workflow filters that include published transfer edits", () => {
    expect(buildTransferWorkflowStatusWhere(TransferStatus.PENDING_MODERATION)).toEqual({
      OR: [
        { status: TransferStatus.PENDING_MODERATION },
        {
          status: TransferStatus.PUBLISHED,
          pendingEditStatus: TransferStatus.PENDING_MODERATION,
        },
      ],
    });
  });
});
