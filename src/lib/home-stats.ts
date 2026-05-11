import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublicCatalogExcursionVisibilityWhere,
  buildPublicCatalogPropertyVisibilityWhere,
} from "@/lib/public-visibility";
import { getStaticAttractions } from "@/lib/static-attractions";

export type HomeStats = {
  publishedPropertiesCount: number | null;
  publishedExcursionsCount: number | null;
  publishedAttractionsCount: number;
};

const getCachedHomeStats = unstable_cache(
  async (): Promise<HomeStats> => {
    const [publishedPropertiesCount, publishedExcursionsCount, publishedAttractions] =
      await Promise.all([
      db.property.count({
        where: buildPublicCatalogPropertyVisibilityWhere(),
      }),
      db.excursion.count({
        where: buildPublicCatalogExcursionVisibilityWhere(),
      }),
      getStaticAttractions(),
    ]);

    return {
      publishedPropertiesCount,
      publishedExcursionsCount,
      publishedAttractionsCount: publishedAttractions.length,
    };
  },
  ["home-stats-v3"],
  { revalidate: 600 },
);

export async function getHomeStats(): Promise<HomeStats> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "home-stats",
      "Database is unavailable. Home page stats will use non-numeric fallback labels.",
    );

    return {
      publishedPropertiesCount: null,
      publishedExcursionsCount: null,
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
      publishedAttractionsCount: (await getStaticAttractions()).length,
    };
  }
}
