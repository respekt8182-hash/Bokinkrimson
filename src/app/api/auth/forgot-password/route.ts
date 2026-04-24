import { PasswordResetRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  ensureAuthDatabaseAvailable,
  getAuthDatabaseUnavailableMessage,
  isAuthDatabaseUnavailable,
} from "@/lib/auth-route-db";
import { authRateLimit } from "@/lib/constants";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { getRequestIp } from "@/lib/security";
import { buildUserPhoneLookupCandidates } from "@/lib/user-phone";

const forgotPasswordLimiter = createRateLimiter({
  id: "auth-forgot-password",
  windowMs: authRateLimit.forgotPassword.windowMinutes * 60 * 1000,
  maxRequests: authRateLimit.forgotPassword.maxRequestsPerWindow,
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  try {
    const limit = await forgotPasswordLimiter.limit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Слишком много запросов на восстановление. Повторите через ${limit.retryAfterSeconds} сек.`,
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
    const parsed = forgotPasswordSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Проверьте номер телефона" }, { status: 400 });
    }

    const unavailableResponse = await ensureAuthDatabaseAvailable({
      routeId: "auth-forgot-password",
      routeLabel: "Forgot password",
    });
    if (unavailableResponse) {
      return unavailableResponse;
    }

    const user = await db.user.findFirst({
      where: {
        phone: {
          in: buildUserPhoneLookupCandidates(parsed.data.phone),
        },
      },
      select: {
        id: true,
        phone: true,
      },
    });

    if (user) {
      const existingPendingRequest = await db.passwordResetRequest.findFirst({
        where: {
          userId: user.id,
          status: PasswordResetRequestStatus.PENDING,
        },
        select: { id: true },
      });

      if (!existingPendingRequest) {
        await db.passwordResetRequest.create({
          data: {
            phone: user.phone,
            userId: user.id,
          },
        });
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

    if (isAuthDatabaseUnavailable(error)) {
      logger.warn(
        "Forgot password is temporarily unavailable because the database is down or credentials are invalid",
        { ip },
      );
      return NextResponse.json(
        { error: getAuthDatabaseUnavailableMessage() },
        { status: 503 },
      );
    }

    logger.error("Forgot password request failed", {
      ip,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Не удалось обработать запрос" }, { status: 500 });
  }
}
