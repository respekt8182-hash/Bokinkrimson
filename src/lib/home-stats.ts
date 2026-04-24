import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
} from "@/lib/public-visibility";

export type HomeStats = {
  publishedPropertiesCount: number | null;
  publishedExcursionsCount: number | null;
};

const getCachedHomeStats = unstable_cache(
  async (): Promise<HomeStats> => {
    const [publishedPropertiesCount, publishedExcursionsCount] = await Promise.all([
      db.property.count({
        where: buildPublishedPropertyVisibilityWhere(),
      }),
      db.excursion.count({
        where: buildPublishedExcursionVisibilityWhere(),
      }),
    ]);

    return {
      publishedPropertiesCount,
      publishedExcursionsCount,
    };
  },
  ["home-stats-v1"],
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
    };
  }
}
