// Session helper that loads the current user profile with a safe fallback during local DB outages.
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

export type SessionUserProfile = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export async function getOptionalSessionUserProfile(
  userId: string,
): Promise<SessionUserProfile | null> {
  const canUseFallback = process.env.NODE_ENV !== "production";
  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "session-user-profile",
      "Database is unavailable. Using session user fallback.",
    );
    return null;
  }

  try {
    return await db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "session-user-profile",
      "Database is unavailable or credentials are invalid. Using session user fallback.",
    );
    return null;
  }
}
