// Domain/service module for auth.
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { logDatabaseFallbackOnce } from "@/lib/prisma-errors";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  type SessionUser,
  verifySessionToken,
} from "@/lib/session";

export { SESSION_COOKIE_NAME, createSessionToken, getSessionCookieOptions, verifySessionToken };
export type { SessionUser };

const USER_SECURITY_COMPAT_COLUMNS = [
  "pendingEmail",
  "emailChangeTokenHash",
  "emailChangeTokenExpiresAt",
  "emailChangeRequestedAt",
  "emailVerifiedAt",
  "passwordChangedAt",
  "sessionVersion",
  "deletedAt",
  "deletionExpiresAt",
] as const;

type CreateUserAccountInput = {
  firstName: string;
  lastName: string;
  passwordHash: string;
  phone: string;
};

type CreateUserAccountResult = {
  created: boolean;
  userId: string | null;
};

const getCachedSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  // Signature/expiry/shape validation is centralized in verifySessionToken.
  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        sessionVersion: true,
        avatarUrl: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.sessionVersion !== session.sessionVersion) {
      return null;
    }

    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      sessionVersion: user.sessionVersion,
      avatarUrl: user.avatarUrl,
    };
  } catch {
    return session;
  }
});

export async function getSession(): Promise<SessionUser | null> {
  return getCachedSession();
}

export async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      sessionVersion: true,
      avatarUrl: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    return null;
  }

  return {
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    sessionVersion: user.sessionVersion,
    avatarUrl: user.avatarUrl,
  };
}

export async function createUserAccount(
  input: CreateUserAccountInput,
): Promise<CreateUserAccountResult> {
  const isCurrentUserSchemaAvailable = await areDatabaseColumnsAvailable(
    "User",
    USER_SECURITY_COMPAT_COLUMNS,
  );

  if (isCurrentUserSchemaAvailable) {
    const user = await db.user.create({
      data: {
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: input.passwordHash,
      },
      select: {
        id: true,
      },
    });

    return {
      created: true,
      userId: user.id,
    };
  }

  logDatabaseFallbackOnce(
    "auth-user-create-compat",
    "User registration is using a legacy insert compatibility path because the database schema is missing security columns. Apply the latest Prisma migration when DB owner access is available.",
  );

  const now = new Date();
  const userId = `user_${randomUUID().replace(/-/g, "")}`;
  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "User" (
      "id",
      "phone",
      "firstName",
      "lastName",
      "passwordHash",
      "role",
      "createdAt",
      "updatedAt",
      "chat_consent_given"
    )
    VALUES (
      ${userId},
      ${input.phone},
      ${input.firstName},
      ${input.lastName},
      ${input.passwordHash},
      'USER'::"UserRole",
      ${now},
      ${now},
      false
    )
    ON CONFLICT ("phone") DO NOTHING
    RETURNING "id"
  `);

  return {
    created: rows.length > 0,
    userId: rows[0]?.id ?? null,
  };
}

export async function incrementUserSessionVersion(userId: string): Promise<number> {
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      sessionVersion: {
        increment: 1,
      },
    },
    select: {
      sessionVersion: true,
    },
  });

  return updated.sessionVersion;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
