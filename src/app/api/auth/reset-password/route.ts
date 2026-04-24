import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { hashSecurityToken } from "@/lib/security-emails";
import { getRequestIp } from "@/lib/security";
import { z } from "zod";

const resetPasswordLimiter = createRateLimiter({
  id: "auth-reset-password",
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  try {
    const limit = await resetPasswordLimiter.limit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const payload = await request.json();
    const parsed = resetPasswordSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Проверьте корректность данных" }, { status: 400 });
    }

    const tokenHash = hashSecurityToken(parsed.data.token);
    const now = new Date();

    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Ссылка для сброса недействительна или уже истекла" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          sessionVersion: {
            increment: 1,
          },
        },
      });

      await tx.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: {
            not: resetToken.id,
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

    if (isDatabaseSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error:
            "Сброс пароля временно недоступен: база данных еще не обновлена до последней миграции.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Не удалось сбросить пароль" }, { status: 500 });
  }
}
