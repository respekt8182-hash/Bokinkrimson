// Owner dashboard layout: guards access (USER-only) and injects profile data into shell.
import { redirect } from "next/navigation";
import { DashboardAppShell } from "@/components/layout/dashboard-app-shell";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import { purgeExpiredPropertyDraftsForOwner } from "@/lib/properties";
import { getOptionalSessionUserProfile } from "@/lib/session-user-profile";

async function purgeDashboardDraftsSafely(ownerId: string): Promise<void> {
  const canUseFallback = process.env.NODE_ENV !== "production";
  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "dashboard-draft-cleanup",
      "Database is unavailable. Skipping owner draft cleanup.",
    );
    return;
  }

  try {
    await purgeExpiredPropertyDraftsForOwner(db, ownerId);
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "dashboard-draft-cleanup",
      "Database is unavailable or credentials are invalid. Skipping owner draft cleanup.",
    );
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard");
  }

  if (session.role === "ADMIN") {
    redirect("/admin");
  }

  await purgeDashboardDraftsSafely(session.id);

  const profile = await getOptionalSessionUserProfile(session.id);

  const firstName = profile?.firstName ?? session.firstName;
  const lastName = profile?.lastName ?? session.lastName;
  const avatarUrl = profile?.avatarUrl ?? null;
  const initials = (firstName.trim().slice(0, 1) || lastName.trim().slice(0, 1) || "?").toUpperCase();

  return (
    <DashboardAppShell
      user={{
        firstName,
        lastName,
        avatarUrl,
        initials,
      }}
    >
      {children}
    </DashboardAppShell>
  );
}
