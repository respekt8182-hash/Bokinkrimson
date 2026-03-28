// Auth-route helpers that return a controlled 503 response when the database is unavailable.
import { NextResponse } from "next/server";
import {
  isConfiguredDatabaseReachable,
  isDatabaseAuthenticationError,
  isDatabaseUnavailableError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

const AUTH_DATABASE_UNAVAILABLE_ERROR =
  "Сервис авторизации временно недоступен. Подключение к базе данных отсутствует.";

type AuthDatabaseResponseContext = {
  routeId: string;
  routeLabel: string;
};

export async function ensureAuthDatabaseAvailable(
  context: AuthDatabaseResponseContext,
): Promise<NextResponse | null> {
  if (await isConfiguredDatabaseReachable()) {
    return null;
  }

  logDatabaseFallbackOnce(
    context.routeId,
    `${context.routeLabel}: database is unavailable, returning 503 instead of Prisma failure.`,
  );

  return NextResponse.json({ error: AUTH_DATABASE_UNAVAILABLE_ERROR }, { status: 503 });
}

export function isAuthDatabaseUnavailable(error: unknown): boolean {
  return isDatabaseUnavailableError(error) || isDatabaseAuthenticationError(error);
}

export function getAuthDatabaseUnavailableMessage(): string {
  return AUTH_DATABASE_UNAVAILABLE_ERROR;
}
