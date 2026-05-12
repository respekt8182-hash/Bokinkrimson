import {
  getObjectPlacementTariffOptions,
  type ObjectPlacementTariffType,
} from "@/lib/object-placement-tariffs";
import { getTariffQuote, type TariffQuote } from "@/lib/payments";
import { applyPlacementFreePeriodToPricing } from "@/lib/placement-promo";
import { getPlacementPrice } from "@/lib/placement-pricing";
import type { PlacementPriceResult } from "@/lib/placement-tariffs";

export async function getPersonalTariffQuote(input: {
  userId: string;
  roomCount: number;
  propertyType: string | null;
  tariffType?: string | null;
  now?: Date;
  freeTrialUntil?: Date | null;
}): Promise<TariffQuote> {
  const now = input.now ?? new Date();
  const options = getObjectPlacementTariffOptions(now);
  const placementPricesByTariffTypeEntries = await Promise.all(
    options.map(async (option) => {
      const period = option.type === "yearly" ? "year" : option.type;
      const pricing = await getPlacementPrice({
        userId: input.userId,
        category: "object",
        period,
        basePrice: option.amountRub,
        now,
      });
      return [
        option.type,
        input.freeTrialUntil
          ? applyPlacementFreePeriodToPricing(pricing, { validUntil: input.freeTrialUntil })
          : pricing,
      ] as const;
    }),
  );

  return getTariffQuote({
    ...input,
    now,
    placementPricesByTariffType: Object.fromEntries(placementPricesByTariffTypeEntries) as Partial<
      Record<ObjectPlacementTariffType, PlacementPriceResult>
    >,
  });
}
