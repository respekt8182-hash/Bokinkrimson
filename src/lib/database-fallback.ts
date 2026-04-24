// Shared database fallback helper for development and local work without PostgreSQL.
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

type DatabaseFallbackContext = {
  contextId: string;
  unavailableMessage: string;
  fallbackEligibleMessage?: string;
};

type FallbackValue<T> = T | (() => T);

function resolveFallbackValue<T>(fallbackValue: FallbackValue<T>): T {
  return typeof fallbackValue === "function" ? (fallbackValue as () => T)() : fallbackValue;
}

export async function loadDataWithDatabaseFallback<T>(
  context: DatabaseFallbackContext,
  load: () => Promise<T>,
  fallbackValue: FallbackValue<T>,
): Promise<T> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(context.contextId, context.unavailableMessage);
    return resolveFallbackValue(fallbackValue);
  }

  try {
    return await load();
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      context.contextId,
      context.fallbackEligibleMessage ?? context.unavailableMessage,
    );
    return resolveFallbackValue(fallbackValue);
  }
}
