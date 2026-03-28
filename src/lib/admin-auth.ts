// Domain/service module for admin auth.
import { getSession } from "@/lib/auth";

export async function getAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return null;
  }

  return session;
}
