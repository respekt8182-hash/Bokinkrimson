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

  if (session.authProvider === "database") {
    const account = await db.adminAccount
      .findUnique({
        where: {
          id: session.adminAccountId ?? "",
        },
        select: {
          id: true,
          login: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          status: true,
          sessionVersion: true,
          mustChangePassword: true,
        },
      })
      .catch(() => null);

    if (
      !account ||
      account.status !== "ACTIVE" ||
      account.sessionVersion !== session.sessionVersion
    ) {
      return null;
    }

    return {
      ...session,
      login: account.login,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      role: account.role,
      mustChangePassword: account.mustChangePassword,
    };
  }

  const sessionState = await db.adminSessionState
    .findUnique({
      where: {
        login: session.login,
      },
      select: {
        sessionVersion: true,
      },
    })
    .catch(() => null);

  if (sessionState && sessionState.sessionVersion !== session.sessionVersion) {
    return null;
  }

  return session;
}
