// Domain/service module for admin auth.
// Uses standalone admin authentication (not tied to any database user).
import { verifyAdminSession } from "@/lib/admin-standalone-auth";

export async function getAdminSession() {
  const session = await verifyAdminSession();
  if (!session) return null;

  // Return a shape compatible with existing API routes that read admin.id etc.
  return {
    isAdmin: true as const,
    login: session.login,
    // Provide a stable identifier for audit logs.
    id: `admin:${session.login}`,
    firstName: "Администратор",
    lastName: "",
    role: "ADMIN" as const,
  };
}
