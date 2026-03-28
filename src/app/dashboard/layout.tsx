// Owner dashboard layout: guards access (USER-only) and injects profile data into shell.
import { redirect } from "next/navigation";
import { DashboardAppShell } from "@/components/layout/dashboard-app-shell";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { purgeExpiredPropertyDraftsForOwner } from "@/lib/properties";
import { getOptionalSessionUserProfile } from "@/lib/session-user-profile";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard");
  }

  if (session.role === "ADMIN") {
    redirect("/admin");
  }

  await purgeExpiredPropertyDraftsForOwner(db, session.id);

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
