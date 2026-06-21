import { unstable_cache } from "next/cache";
import { ExcursionOfferType } from "@prisma/client";
import { canUseDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublicCatalogExcursionVisibilityWhere,
  buildPublicCatalogPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";
import { getStaticAttractions } from "@/lib/static-attractions";

export type HomeStats = {
  publishedPropertiesCount: number | null;
  publishedExcursionsCount: number | null;
  publishedToursCount: number | null;
  publishedTransfersCount: number | null;
  publishedAttractionsCount: number;
};

const getCachedHomeStats = unstable_cache(
  async (): Promise<HomeStats> => {
    const [
      publishedPropertiesCount,
      publishedExcursionsCount,
      publishedToursCount,
      publishedTransfersCount,
      publishedAttractions,
    ] = await Promise.all([
      db.property.count({
        where: buildPublicCatalogPropertyVisibilityWhere(),
      }),
      db.excursion.count({
        where: {
          AND: [
            buildPublicCatalogExcursionVisibilityWhere(),
            { offerType: ExcursionOfferType.EXCURSION },
          ],
        },
      }),
      db.excursion.count({
        where: {
          AND: [
            buildPublicCatalogExcursionVisibilityWhere(),
            { offerType: ExcursionOfferType.TOUR },
          ],
        },
      }),
      db.transfer.count({
        where: buildPublishedTransferVisibilityWhere(),
      }),
      getStaticAttractions(),
    ]);

    return {
      publishedPropertiesCount,
      publishedExcursionsCount,
      publishedToursCount,
      publishedTransfersCount,
      publishedAttractionsCount: publishedAttractions.length,
    };
  },
  ["home-stats-v4"],
  { revalidate: 600 },
);

export async function getHomeStats(): Promise<HomeStats> {
  const canUseFallback = canUseDatabaseFallback();

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "home-stats",
      "Database is unavailable. Home page stats will use non-numeric fallback labels.",
    );

    return {
      publishedPropertiesCount: null,
      publishedExcursionsCount: null,
      publishedToursCount: null,
      publishedTransfersCount: null,
      publishedAttractionsCount: (await getStaticAttractions()).length,
    };
  }

  try {
    return await getCachedHomeStats();
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "home-stats",
      "Database is unavailable or credentials are invalid. Home page stats will use non-numeric fallback labels.",
    );

    return {
      publishedPropertiesCount: null,
      publishedExcursionsCount: null,
      publishedToursCount: null,
      publishedTransfersCount: null,
      publishedAttractionsCount: (await getStaticAttractions()).length,
    };
  }
}
