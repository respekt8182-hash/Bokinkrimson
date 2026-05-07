import { describe, expect, it } from "vitest";
import {
  calculateDiscountedPlacementPrice,
  getPlacementAdditionalOptionsPrice,
  placementTariffs,
} from "@/lib/placement-pricing";

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
});
