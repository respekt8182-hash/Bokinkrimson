import { describe, expect, it } from "vitest";
import {
  deriveTransferSummaryFromFleet,
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
});
