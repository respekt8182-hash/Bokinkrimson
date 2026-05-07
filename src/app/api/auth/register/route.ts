import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildSessionUser,
  createUserAccount,
  createSessionToken,
  getSessionCookieOptions,
  hashPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  ensureAuthDatabaseAvailable,
  getAuthDatabaseUnavailableMessage,
  isAuthDatabaseUnavailable,
} from "@/lib/auth-route-db";
import { authRateLimit } from "@/lib/constants";
import { logger } from "@/lib/logger";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas/auth";
import { getRequestIp } from "@/lib/security";
import { markUserLogin } from "@/lib/user-activity";
import { buildUserPhoneLookupCandidates, normalizeUserPhone } from "@/lib/user-phone";

const registerLimiter = createRateLimiter({
  id: "auth-register",
  windowMs: authRateLimit.register.windowMinutes * 60 * 1000,
  maxRequests: authRateLimit.register.maxRequestsPerWindow,
});

const DUPLICATE_PHONE_ERROR =
  "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0441 \u0442\u0430\u043a\u0438\u043c \u043d\u043e\u043c\u0435\u0440\u043e\u043c \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442";

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  try {
    const limit = await registerLimiter.limit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            limit.retryAfterSeconds >= 60
              ? `Слишком много попыток регистрации. Повторите через ${Math.ceil(
                  limit.retryAfterSeconds / 60,
                )} мин.`
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

    const phone = normalizeUserPhone(parsed.data.phone);
    const existing = await db.user.findFirst({
      where: {
        phone: {
          in: buildUserPhoneLookupCandidates(parsed.data.phone),
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким номером уже существует" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const createdUser = await createUserAccount({
      phone,
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      passwordHash,
    });

    if (!createdUser.created || !createdUser.userId) {
      return NextResponse.json(
        { error: DUPLICATE_PHONE_ERROR },
        { status: 409 },
      );
    }

    const sessionUser = await buildSessionUser(createdUser.userId);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Не удалось зарегистрировать пользователя" },
        { status: 500 },
      );
    }

    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ ok: true, user: sessionUser }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    await markUserLogin(sessionUser.id);

    return response;
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

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
