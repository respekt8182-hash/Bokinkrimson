// Domain/service module for admin auth.
// Uses standalone admin authentication (not tied to any database user).
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { normalizeAdminRole } from "@/lib/admin-rbac";

export async function getAdminSession() {
  const session = await verifyAdminSession();
  if (!session) return null;

  const displayName = session.displayName?.trim() || "Администратор";
  const [firstName = displayName, ...restName] = displayName.split(/\s+/);

  return {
    isAdmin: true as const,
    login: session.login,
    id: session.adminAccountId ?? `admin:${session.login}`,
    authProvider: session.authProvider,
    adminAccountId: session.adminAccountId,
    sessionVersion: session.sessionVersion,
    displayName,
    avatarUrl: session.avatarUrl,
    firstName,
    lastName: restName.join(" "),
    role: normalizeAdminRole(session.role),
    mustChangePassword: session.mustChangePassword,
  };
}
