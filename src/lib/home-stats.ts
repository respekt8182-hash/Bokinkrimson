import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

export type HomeStats = {
  publishedPropertiesCount: number | null;
  publishedExcursionsCount: number | null;
};

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
    const [publishedPropertiesCount, publishedExcursionsCount] = await Promise.all([
      db.property.count({
        where: {
          status: PropertyStatus.PUBLISHED,
          ownerDeletedAt: null,
        },
      }),
      db.excursion.count({
        where: {
          status: ExcursionStatus.PUBLISHED,
        },
      }),
    ]);

    return {
      publishedPropertiesCount,
      publishedExcursionsCount,
    };
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
