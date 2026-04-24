// Shared owner-dashboard database fallback helper for local dev without PostgreSQL.
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";

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
  return loadDataWithDatabaseFallback(
    {
      contextId: context.contextId,
      unavailableMessage: `${context.pageLabel}: database is unavailable. ${context.fallbackDescription}`,
      fallbackEligibleMessage: `${context.pageLabel}: database is unavailable or credentials are invalid. ${context.fallbackDescription}`,
    },
    load,
    fallbackValue,
  );
}
