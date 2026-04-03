// Shared owner-dashboard database fallback helper for local dev without PostgreSQL.
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

type DashboardPageDataContext = {
  contextId: string;
  pageLabel: string;
  fallbackDescription: string;
};

export async function loadDashboardPageData<T>(
  context: DashboardPageDataContext,
  load: () => Promise<T>,
  fallbackValue: T,
): Promise<T> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      context.contextId,
      `${context.pageLabel}: database is unavailable. ${context.fallbackDescription}`,
    );
    return fallbackValue;
  }

  try {
    return await load();
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      context.contextId,
      `${context.pageLabel}: database is unavailable or credentials are invalid. ${context.fallbackDescription}`,
    );
    return fallbackValue;
  }
}
