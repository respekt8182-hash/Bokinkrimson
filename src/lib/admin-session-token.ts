import { SignJWT, jwtVerify } from "jose";
import {
  getAdminJwtSecretValue,
  getAdminLoginValue,
  getAdminPasswordHashFingerprint,
} from "@/lib/security-config";
import { normalizeAdminRole, type AdminRoleValue } from "@/lib/admin-rbac";

export const ADMIN_COOKIE_NAME = "boking_admin_session";
const ADMIN_SESSION_DURATION = 60 * 60 * 12;

export type AdminSession = {
  isAdmin: true;
  login: string;
  sessionVersion: number;
  authProvider: "env" | "database";
  adminAccountId: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: AdminRoleValue;
  mustChangePassword: boolean;
};

type AdminTokenPayload = AdminSession & {
  pwdv: string;
};

export type CreateAdminSessionTokenInput = {
  login: string;
  sessionVersion: number;
  authProvider?: "env" | "database";
  adminAccountId?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
  role?: AdminRoleValue | string;
  mustChangePassword?: boolean;
};

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(getAdminJwtSecretValue());
}

export function getAdminAuthConfigurationError(): string | null {
  try {
    getAdminJwtSecretValue();
  } catch {
    return "Админ-вход не настроен: задайте ADMIN_JWT_SECRET длиной минимум 16 символов.";
  }

  try {
    getAdminLoginValue();
  } catch {
    return "Админ-вход не настроен: задайте ADMIN_LOGIN.";
  }

  try {
    getAdminPasswordHashFingerprint();
  } catch {
    return "Админ-вход не настроен: задайте ADMIN_PASSWORD_HASH.";
  }

  return null;
}

export async function createAdminSessionToken(
  input: string | CreateAdminSessionTokenInput,
  legacySessionVersion = 0,
): Promise<string> {
  const sessionInput =
    typeof input === "string"
      ? {
          login: input,
          sessionVersion: legacySessionVersion,
          authProvider: "env" as const,
          adminAccountId: null,
          displayName: "Администратор",
          avatarUrl: null,
          role: "SUPER_ADMIN" as const,
          mustChangePassword: false,
        }
      : {
          login: input.login,
          sessionVersion: input.sessionVersion,
          authProvider: input.authProvider ?? "env",
          adminAccountId: input.adminAccountId ?? null,
          displayName: input.displayName?.trim() || "Администратор",
          avatarUrl: input.avatarUrl ?? null,
          role: normalizeAdminRole(input.role),
          mustChangePassword: input.mustChangePassword ?? false,
        };
  const pwdv =
    sessionInput.authProvider === "database" ? "admin-account" : getAdminPasswordHashFingerprint();

  return new SignJWT({
    isAdmin: true,
    login: sessionInput.login,
    sessionVersion: sessionInput.sessionVersion,
    authProvider: sessionInput.authProvider,
    adminAccountId: sessionInput.adminAccountId,
    displayName: sessionInput.displayName,
    avatarUrl: sessionInput.avatarUrl,
    role: sessionInput.role,
    mustChangePassword: sessionInput.mustChangePassword,
    pwdv,
  } satisfies AdminTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION}s`)
    .sign(getJwtSecret());
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const authProvider = payload.authProvider === "database" ? "database" : "env";

    if (payload.sub !== "admin" || payload.isAdmin !== true) {
      return null;
    }

    if (typeof payload.login !== "string" || typeof payload.sessionVersion !== "number") {
      return null;
    }

    if (authProvider === "database") {
      if (
        typeof payload.adminAccountId !== "string" ||
        payload.adminAccountId.length === 0 ||
        payload.pwdv !== "admin-account"
      ) {
        return null;
      }

      return {
        isAdmin: true,
        login: payload.login,
        sessionVersion: payload.sessionVersion,
        authProvider,
        adminAccountId: payload.adminAccountId,
        displayName:
          typeof payload.displayName === "string" && payload.displayName.trim()
            ? payload.displayName
            : "Администратор",
        avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
        role: normalizeAdminRole(payload.role),
        mustChangePassword: payload.mustChangePassword === true,
      };
    }

    if (
      payload.login !== getAdminLoginValue() ||
      payload.pwdv !== getAdminPasswordHashFingerprint()
    ) {
      return null;
    }

    return {
      isAdmin: true,
      login: payload.login,
      sessionVersion: payload.sessionVersion,
      authProvider: "env",
      adminAccountId: null,
      displayName: "Администратор",
      avatarUrl: null,
      role: "SUPER_ADMIN",
      mustChangePassword: false,
    };
  } catch {
    return null;
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_DURATION,
  };
}
