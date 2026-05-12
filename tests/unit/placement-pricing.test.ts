import { describe, expect, it } from "vitest";
import {
  calculateDiscountedPlacementPrice,
  getPlacementPrice,
  getPlacementAdditionalOptionsPrice,
  placementTariffs,
} from "@/lib/placement-pricing";
import {
  getPostLaunchTrialValidUntil,
  isPostLaunchTrialEligible,
} from "@/lib/placement-promo";

describe("placement pricing", () => {
  it("rounds discounted yearly service prices down to nearest 10 rubles", () => {
    expect(calculateDiscountedPlacementPrice(placementTariffs.excursion.yearPrice, 20)).toBe(1190);
    expect(calculateDiscountedPlacementPrice(placementTariffs.excursion.yearPrice, 10)).toBe(1340);
    expect(calculateDiscountedPlacementPrice(placementTariffs.tour.yearPrice, 20)).toBe(1430);
    expect(calculateDiscountedPlacementPrice(placementTariffs.tour.yearPrice, 10)).toBe(1610);
    expect(calculateDiscountedPlacementPrice(placementTariffs.object.yearPrice, 20)).toBe(3600);
    expect(calculateDiscountedPlacementPrice(placementTariffs.object.yearPrice, 10)).toBe(4050);
  });

  it("keeps transfer additional cars outside the discountable base price", () => {
    expect(
      getPlacementAdditionalOptionsPrice({
        category: "transfer",
        additionalOptions: { additionalCars: 2 },
      }),
    ).toBe(980);
  });

  it("applies the 20 percent yearly renewal discount only to launch-period participants", async () => {
    const renewal = await getPlacementPrice({
      category: "excursion",
      period: "year",
      now: new Date("2026-07-01T09:00:00.000Z"),
      hasLaunchDemoPlacementInCategory: true,
      hasPriorPaidYearPlacementInCategory: false,
    });
    const newListingAfterLaunch = await getPlacementPrice({
      category: "excursion",
      period: "year",
      now: new Date("2026-07-01T09:00:00.000Z"),
      hasLaunchDemoPlacementInCategory: false,
      hasPriorPaidYearPlacementInCategory: false,
    });

    expect(renewal.discountPercent).toBe(20);
    expect(renewal.finalPrice).toBe(1190);
    expect(newListingAfterLaunch.discountPercent).toBe(0);
    expect(newListingAfterLaunch.finalPrice).toBe(placementTariffs.excursion.yearPrice);
  });

  it("grants a one-month post-launch trial only to new listings without successful placement", () => {
    const now = new Date("2026-07-10T09:00:00.000Z");

    expect(
      isPostLaunchTrialEligible({
        listingCreatedAt: new Date("2026-07-01T09:00:00.000Z"),
        now,
        hasSuccessfulPlacement: false,
      }),
    ).toBe(true);
    expect(
      isPostLaunchTrialEligible({
        listingCreatedAt: new Date("2026-06-01T09:00:00.000Z"),
        now,
        hasSuccessfulPlacement: false,
      }),
    ).toBe(false);
    expect(
      isPostLaunchTrialEligible({
        listingCreatedAt: new Date("2026-07-01T09:00:00.000Z"),
        now,
        hasSuccessfulPlacement: true,
      }),
    ).toBe(false);
    expect(getPostLaunchTrialValidUntil(now).toISOString()).toBe("2026-08-10T09:00:00.000Z");
  });
});
