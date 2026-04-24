// Domain/service module for passwords.
import type { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { areDatabaseColumnsAvailable } from "@/lib/db";
import { logDatabaseFallbackOnce } from "@/lib/prisma-errors";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%";
const ALL = `${UPPER}${LOWER}${DIGITS}${SPECIAL}`;
const USER_PASSWORD_SECURITY_COLUMNS = ["passwordChangedAt", "sessionVersion"] as const;

function pick(pool: string): string {
  return pool[randomInt(0, pool.length)] ?? "";
}

function shuffle(value: string): string {
  const chars = value.split("");
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars.join("");
}

export function generateTemporaryPassword(length = 10): string {
  const targetLength = Math.max(8, length);
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  const remainder = Array.from({ length: targetLength - required.length }, () => pick(ALL));
  return shuffle([...required, ...remainder].join(""));
}

export async function buildUserPasswordUpdateData(
  passwordHash: string,
  changedAt = new Date(),
): Promise<Prisma.UserUpdateInput> {
  const canTrackPasswordSecurity = await areDatabaseColumnsAvailable(
    "User",
    USER_PASSWORD_SECURITY_COLUMNS,
  );

  if (!canTrackPasswordSecurity) {
    logDatabaseFallbackOnce(
      "password-update-compat",
      "Password updates are running in compatibility mode without session invalidation because the database schema is missing passwordChangedAt/sessionVersion. Apply the latest Prisma migration when DB owner access is available.",
    );

    return { passwordHash };
  }

  return {
    passwordHash,
    passwordChangedAt: changedAt,
    sessionVersion: {
      increment: 1,
    },
  };
}
