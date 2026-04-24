import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  type AdminSession,
  verifyAdminSessionToken,
} from "@/lib/admin-session-token";
import { db } from "@/lib/db";

export { ADMIN_COOKIE_NAME } from "@/lib/admin-session-token";
export type { AdminSession } from "@/lib/admin-session-token";

export async function verifyAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifyAdminSessionToken(token);
  if (!session) {
    return null;
  }

  const sessionState = await db.adminSessionState.findUnique({
    where: {
      login: session.login,
    },
    select: {
      sessionVersion: true,
    },
  }).catch(() => null);

  if (sessionState && sessionState.sessionVersion !== session.sessionVersion) {
    return null;
  }

  return session;
}
