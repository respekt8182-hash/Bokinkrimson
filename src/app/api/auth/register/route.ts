// API route handler for /api/auth/register.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  getSessionCookieOptions,
  hashPassword,
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
import { registerSchema } from "@/lib/schemas";
import { getRequestIp } from "@/lib/security";

const registerLimiter = createInMemoryRateLimiter({
  id: "auth-register",
  windowMs: authRateLimit.register.windowMinutes * 60 * 1000,
  maxRequests: authRateLimit.register.maxRequestsPerWindow,
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const limit = registerLimiter.limit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: limit.retryAfterSeconds >= 60
          ? `Слишком много попыток регистрации. Повторите через ${Math.ceil(limit.retryAfterSeconds / 60)} мин.`
          : `Слишком много попыток регистрации. Повторите через ${limit.retryAfterSeconds} сек.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const payload = await request.json();
    const parsed = registerSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Проверьте корректность данных" }, { status: 400 });
    }

    const unavailableResponse = await ensureAuthDatabaseAvailable({
      routeId: "auth-register",
      routeLabel: "Registration",
    });
    if (unavailableResponse) {
      return unavailableResponse;
    }

    const phone = parsed.data.phone.replace(/\D/g, "");
    const existing = await db.user.findUnique({ where: { phone } });

    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким номером телефона уже существует" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await db.user.create({
      data: {
        phone,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        passwordHash,
      },
    });

    const sessionUser: SessionUser = {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ ok: true, user: sessionUser }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());

    return response;
  } catch (error) {
    if (isAuthDatabaseUnavailable(error)) {
      logger.warn(
        "Registration is temporarily unavailable because the database is down or credentials are invalid",
        { ip },
      );
      return NextResponse.json(
        { error: getAuthDatabaseUnavailableMessage() },
        { status: 503 },
      );
    }

    logger.error("Registration failed", {
      ip,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Не удалось зарегистрировать пользователя" },
      { status: 500 },
    );
  }
}
