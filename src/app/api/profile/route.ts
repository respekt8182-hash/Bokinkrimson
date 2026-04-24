import { NextResponse } from "next/server";
import {
  buildSessionUser,
  comparePasswords,
  createSessionToken,
  getSession,
  getSessionCookieOptions,
  hashPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { buildUserPasswordUpdateData } from "@/lib/passwords";
import { isDatabaseSchemaMissingError, logDatabaseFallbackOnce } from "@/lib/prisma-errors";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { changePasswordSchema, updateProfileSchema } from "@/lib/schemas";
import { getRequestIp } from "@/lib/security";
import { buildUserPhoneLookupCandidates, normalizeUserPhone } from "@/lib/user-phone";

const passwordChangeLimiter = createRateLimiter({
  id: "profile-password-change",
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
});

function serializeProfile(user: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function getCurrentUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const user = await getCurrentUser(session.id);

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    item: serializeProfile(user),
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Проверьте корректность данных профиля",
      },
      { status: 400 },
    );
  }

  const existing = await getCurrentUser(session.id);
  if (!existing) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const requestedPhone = normalizeUserPhone(parsed.data.phone);

  const phoneOwner = await db.user.findFirst({
    where: {
      id: { not: existing.id },
      phone: {
        in: buildUserPhoneLookupCandidates(parsed.data.phone),
      },
    },
    select: { id: true },
  });

  if (phoneOwner) {
    return NextResponse.json({ error: "Такой телефон уже используется" }, { status: 409 });
  }

  const updated = await db.user.update({
    where: { id: existing.id },
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      phone: requestedPhone,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const sessionUser = await buildSessionUser(updated.id);
  const response = NextResponse.json({
    item: serializeProfile(updated),
    message: "Профиль сохранён.",
  });

  if (sessionUser) {
    const token = await createSessionToken(sessionUser);
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  }

  return response;
}

export async function PUT(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await passwordChangeLimiter.limit(`${session.id}:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }

    const parsed = changePasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Проверьте корректность пароля" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const isCurrentPasswordValid = await comparePasswords(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: "Текущий пароль указан неверно" }, { status: 400 });
    }

    const now = new Date();
    const passwordHash = await hashPassword(parsed.data.newPassword);
    const passwordUpdateData = await buildUserPasswordUpdateData(passwordHash, now);

    await db.user.update({
      where: { id: session.id },
      data: passwordUpdateData,
    });

    try {
      await db.passwordResetToken.deleteMany({
        where: {
          userId: session.id,
          usedAt: null,
        },
      });
    } catch (error) {
      if (isDatabaseSchemaMissingError(error)) {
        logDatabaseFallbackOnce(
          "profile-password-token-cleanup-compat",
          "Profile password change skipped PasswordResetToken cleanup because the reset-token table is missing. Apply the latest Prisma migration when DB owner access is available.",
        );
      } else {
        logger.warn("Profile password change could not clear outstanding reset tokens", {
          userId: session.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    const sessionUser = await buildSessionUser(session.id);
    const response = NextResponse.json({ ok: true });

    if (sessionUser) {
      const token = await createSessionToken(sessionUser);
      response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    }

    return response;
  } catch (error) {
    if (
      error instanceof RateLimitConfigurationError ||
      error instanceof RateLimitBackendUnavailableError
    ) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

    return NextResponse.json({ error: "Не удалось изменить пароль" }, { status: 500 });
  }
}
