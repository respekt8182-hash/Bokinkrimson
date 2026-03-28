// Domain/service module for auth.
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  type SessionUser,
  verifySessionToken,
} from "@/lib/session";

export { SESSION_COOKIE_NAME, createSessionToken, getSessionCookieOptions, verifySessionToken };
export type { SessionUser };

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  // Signature/expiry/shape validation is centralized in verifySessionToken.
  return verifySessionToken(token);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
