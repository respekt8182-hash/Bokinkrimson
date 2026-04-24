import { SignJWT, jwtVerify } from "jose";
import {
  getAdminJwtSecretValue,
  getAdminLoginValue,
  getAdminPasswordHashFingerprint,
} from "@/lib/security-config";

export const ADMIN_COOKIE_NAME = "boking_admin_session";
const ADMIN_SESSION_DURATION = 60 * 60 * 12;

export type AdminSession = {
  isAdmin: true;
  login: string;
  sessionVersion: number;
};

type AdminTokenPayload = AdminSession & {
  pwdv: string;
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
  login: string,
  sessionVersion = 0,
): Promise<string> {
  return new SignJWT({
    isAdmin: true,
    login,
    sessionVersion,
    pwdv: getAdminPasswordHashFingerprint(),
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

    if (
      payload.sub !== "admin" ||
      payload.isAdmin !== true ||
      typeof payload.login !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      payload.login !== getAdminLoginValue() ||
      payload.pwdv !== getAdminPasswordHashFingerprint()
    ) {
      return null;
    }

    return {
      isAdmin: true,
      login: payload.login,
      sessionVersion: payload.sessionVersion,
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
