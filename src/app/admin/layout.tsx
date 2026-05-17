// Layout wrapper for /admin route segment.
// Middleware already handles redirecting unauthenticated users to /admin/login.
// This layout verifies the session and renders the admin shell.
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { getAdminModerationSnapshot } from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyAdminSession();

  // Login page is a child of /admin but needs no shell.
  // If there's no session, render children directly (login page).
  if (!session) {
    return <>{children}</>;
  }

  const moderationSnapshot = await getAdminModerationSnapshot();

  return (
    <AdminShell moderationSnapshot={moderationSnapshot}>
      {children}
    </AdminShell>
  );
}
