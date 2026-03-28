// API route handler for /api/auth/login.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  comparePasswords,
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth";
import {
  ensureAuthDatabaseAvailable,
  getAuthDatabaseUnavailableMessage,
  isAuthDatabaseUnavailable,
} from "@/lib/auth-route-db";
import { authRateLimit } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { createInMemoryRateLimiter } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { getRequestIp } from "@/lib/security";

const loginLimiter = createInMemoryRateLimiter({
  id: "auth-login",
  windowMs: authRateLimit.login.windowMinutes * 60 * 1000,
  maxRequests: authRateLimit.login.maxRequestsPerWindow,
});

function createLoginRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: `Слишком много попыток входа. Повторите через ${retryAfterSeconds} сек.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function consumeFailedLoginAttempt(ip: string): NextResponse | null {
  const limit = loginLimiter.limit(ip);
  if (limit.allowed) {
    return null;
  }

  return createLoginRateLimitResponse(limit.retryAfterSeconds);
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  try {
    const payload = await request.json();
    const parsed = loginSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Проверьте корректность данных" }, { status: 400 });
    }

    const unavailableResponse = await ensureAuthDatabaseAvailable({
      routeId: "auth-login",
      routeLabel: "Login",
    });
    if (unavailableResponse) {
      return unavailableResponse;
    }

    const phone = parsed.data.phone.replace(/\D/g, "");
    const user = await db.user.findUnique({ where: { phone } });

    if (!user) {
      const rateLimitResponse = consumeFailedLoginAttempt(ip);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      return NextResponse.json({ error: "Неверный телефон или пароль" }, { status: 401 });
    }

    const isPasswordValid = await comparePasswords(parsed.data.password, user.passwordHash);

    if (!isPasswordValid) {
      const rateLimitResponse = consumeFailedLoginAttempt(ip);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      return NextResponse.json({ error: "Неверный телефон или пароль" }, { status: 401 });
    }

    const sessionUser: SessionUser = {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ ok: true, user: sessionUser });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());

    return response;
  } catch (error) {
    if (isAuthDatabaseUnavailable(error)) {
      logger.warn(
        "Login is temporarily unavailable because the database is down or credentials are invalid",
        { ip },
      );
      return NextResponse.json(
        { error: getAuthDatabaseUnavailableMessage() },
        { status: 503 },
      );
    }

    logger.error("Login failed", { ip, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Не удалось выполнить вход" }, { status: 500 });
  }
}
