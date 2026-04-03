// Standalone admin authentication — not tied to any database user.
// Credentials come from ADMIN_LOGIN + ADMIN_PASSWORD env vars.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "boking_admin_session";
const ADMIN_SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

type AdminSession = {
  isAdmin: true;
  login: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short.");
  }
  return new TextEncoder().encode(secret + "_admin");
}

function getAdminCredentials() {
  const login = process.env.ADMIN_LOGIN;
  const password = process.env.ADMIN_PASSWORD;
  if (!login || !password) {
    throw new Error("ADMIN_LOGIN and ADMIN_PASSWORD env vars are required.");
  }
  return { login, password };
}

export function validateAdminCredentials(login: string, password: string): boolean {
  const creds = getAdminCredentials();
  return login === creds.login && password === creds.password;
}

export async function createAdminSessionToken(login: string): Promise<string> {
  return new SignJWT({ isAdmin: true, login } satisfies AdminSession)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION}s`)
    .sign(getJwtSecret());
}

export async function verifyAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.isAdmin !== true || typeof payload.login !== "string") {
      return null;
    }
    return { isAdmin: true, login: payload.login };
  } catch {
    return null;
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_DURATION,
  };
}
