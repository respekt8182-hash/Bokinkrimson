import { NextResponse } from "next/server";
import {
  buildSessionUser,
  comparePasswords,
  createSessionToken,
  getSessionCookieOptions,
  getSession,
  hashPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import {
  createSecurityToken,
  hashSecurityToken,
  sendSecurityEmail,
} from "@/lib/security-emails";
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
const USER_EMAIL_CHANGE_COLUMNS = [
  "pendingEmail",
  "emailChangeTokenHash",
  "emailChangeTokenExpiresAt",
  "emailChangeRequestedAt",
  "emailVerifiedAt",
] as const;
const USER_PASSWORD_SECURITY_COLUMNS = ["passwordChangedAt", "sessionVersion"] as const;

function serializeProfile(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  pendingEmail: string | null;
  emailChangeTokenExpiresAt: Date | null;
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
    email: user.email,
    pendingEmail: user.pendingEmail,
    pendingEmailExpiresAt: user.emailChangeTokenExpiresAt?.toISOString() ?? null,
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
      email: true,
      pendingEmail: true,
      emailChangeTokenExpiresAt: true,
      phone: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
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
    return NextResponse.json({ error: "Проверьте корректность данных профиля" }, { status: 400 });
  }

  const existing = await getCurrentUser(session.id);
  if (!existing) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const requestedPhone = parsed.data.phone?.trim()
    ? normalizeUserPhone(parsed.data.phone)
    : existing.phone;
  const requestedEmail = parsed.data.email?.trim().toLowerCase() || null;
  const shouldStartEmailVerification =
    requestedEmail !== null &&
    requestedEmail.length > 0 &&
    requestedEmail !== (existing.email?.trim().toLowerCase() ?? null);

  if (parsed.data.phone?.trim()) {
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
      return NextResponse.json(
        { error: "Такой телефон уже используется" },
        { status: 409 },
      );
    }
  }

  if (
    shouldStartEmailVerification &&
    !(await areDatabaseColumnsAvailable("User", USER_EMAIL_CHANGE_COLUMNS))
  ) {
    return NextResponse.json(
      {
        error:
          "Смена email временно недоступна: база данных еще не обновлена до последней миграции.",
      },
      { status: 503 },
    );
  }

  if (shouldStartEmailVerification) {
    const emailOwner = await db.user.findFirst({
      where: {
        id: { not: existing.id },
        email: requestedEmail,
      },
      select: { id: true },
    });

    if (emailOwner) {
      return NextResponse.json(
        { error: "Такой email уже используется" },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  const emailToken = shouldStartEmailVerification ? createSecurityToken() : null;
  const emailTokenHash = emailToken ? hashSecurityToken(emailToken) : null;
  const emailTokenExpiresAt = emailToken ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null;

  const updated = await db.user.update({
    where: { id: existing.id },
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      phone: requestedPhone,
      ...(shouldStartEmailVerification
        ? {
            pendingEmail: requestedEmail,
            emailChangeTokenHash: emailTokenHash,
            emailChangeTokenExpiresAt: emailTokenExpiresAt,
            emailChangeRequestedAt: now,
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      pendingEmail: true,
      emailChangeTokenExpiresAt: true,
      phone: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (shouldStartEmailVerification && requestedEmail && emailToken && emailTokenExpiresAt) {
    const verificationUrl = new URL("/api/profile/email/verify", request.url);
    verificationUrl.searchParams.set("token", emailToken);

    await sendSecurityEmail({
      to: requestedEmail,
      subject: "Подтвердите смену email",
      text: [
        "Мы получили запрос на смену email для вашей учетной записи.",
        `Подтвердите новый адрес по ссылке: ${verificationUrl.toString()}`,
        `Ссылка действует до ${emailTokenExpiresAt.toISOString()}.`,
        "Если это были не вы, просто проигнорируйте письмо.",
      ].join("\n\n"),
    });
  }

  const sessionUser = await buildSessionUser(updated.id);
  const response = NextResponse.json({
    item: serializeProfile(updated),
    emailVerificationRequired: shouldStartEmailVerification,
    message: shouldStartEmailVerification
      ? "Новый email сохранён как ожидающий подтверждения. Подтвердите адрес по ссылке из письма."
      : "Профиль сохранён.",
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
        { error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.` },
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

    if (!(await areDatabaseColumnsAvailable("User", USER_PASSWORD_SECURITY_COLUMNS))) {
      return NextResponse.json(
        {
          error:
            "Смена пароля временно недоступна: база данных еще не обновлена до последней миграции.",
        },
        { status: 503 },
      );
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

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          sessionVersion: {
            increment: 1,
          },
        },
      });

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: session.id,
          usedAt: null,
        },
      });
    });

    const sessionUser = await buildSessionUser(session.id);
    const response = NextResponse.json({ ok: true });

    if (sessionUser) {
      const token = await createSessionToken(sessionUser);
      response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    }

    return response;
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

    return NextResponse.json({ error: "Не удалось изменить пароль" }, { status: 500 });
  }
}
