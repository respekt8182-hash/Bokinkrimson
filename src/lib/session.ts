import { SignJWT, jwtVerify } from "jose";
import { getJwtSecretValue } from "@/lib/security-config";

// Cookie-based stateless session shared by API routes and route protection.
export const SESSION_COOKIE_NAME = "boking_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: "USER" | "ADMIN";
  sessionVersion: number;
  avatarUrl?: string | null;
};

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(getJwtSecretValue());
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    sessionVersion: user.sessionVersion,
    avatarUrl: user.avatarUrl ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.phone !== "string" ||
      typeof payload.firstName !== "string" ||
      typeof payload.lastName !== "string" ||
      (payload.role !== "USER" && payload.role !== "ADMIN") ||
      typeof payload.sessionVersion !== "number" ||
      !(
        payload.avatarUrl === undefined ||
        payload.avatarUrl === null ||
        typeof payload.avatarUrl === "string"
      )
    ) {
      return null;
    }

    return {
      id: payload.sub,
      phone: payload.phone,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      sessionVersion: payload.sessionVersion,
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
    };
  } catch {
    return null;
  }
}
