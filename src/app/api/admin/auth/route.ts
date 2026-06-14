import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateAdminCredentials } from "@/lib/admin-password-auth";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminAuthConfigurationError,
  getAdminCookieOptions,
} from "@/lib/admin-session-token";
import { createFailedLoginLockout } from "@/lib/login-lockout";
import { getRequestIp } from "@/lib/security";
import { getAdminSession } from "@/lib/admin-auth";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";

const adminLoginLockout = createFailedLoginLockout({
  id: "admin-login-failed",
  lockoutMs: 2 * 60 * 1000,
  maxFailedAttempts: 5,
});

function createAdminLoginLockoutResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: `Слишком много попыток входа. Подождите ${retryAfterSeconds} сек. и попробуйте снова.`,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export async function POST(request: Request) {
  const configurationError = getAdminAuthConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const ip = getRequestIp(request);

  try {
    const activeLockout = adminLoginLockout.check(ip);
    if (activeLockout.locked) {
      return createAdminLoginLockoutResponse(activeLockout.retryAfterSeconds);
    }

    const body = (await request.json()) as { login?: string; password?: string };
    const login = body.login?.trim() ?? "";
    const password = body.password ?? "";

    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль." }, { status: 400 });
    }

    const credentials = await authenticateAdminCredentials(login, password);

    if (!credentials) {
      const lockout = adminLoginLockout.recordFailure(ip);
      if (lockout.locked) {
        return createAdminLoginLockoutResponse(lockout.retryAfterSeconds);
      }

      return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
    }

    let sessionVersion = 0;

    if (credentials.authProvider === "database") {
      const updatedAccount = await db.adminAccount
        .update({
          where: {
            id: credentials.adminAccountId,
          },
          data: {
            lastLoginAt: new Date(),
          },
          select: {
            sessionVersion: true,
          },
        })
        .catch(() => null);
      sessionVersion = updatedAccount?.sessionVersion ?? credentials.sessionVersion;
    } else {
      try {
        const sessionState = await db.adminSessionState.upsert({
          where: {
            login: credentials.login,
          },
          update: {},
          create: {
            login: credentials.login,
          },
          select: {
            sessionVersion: true,
          },
        });
        sessionVersion = sessionState.sessionVersion;
      } catch (error) {
        if (!isDatabaseSchemaMissingError(error)) {
          throw error;
        }
      }
    }

    const token = await createAdminSessionToken({
      ...credentials,
      sessionVersion,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
    adminLoginLockout.reset(ip);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Не удалось выполнить вход. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (admin.authProvider === "database" && admin.adminAccountId) {
    await db.adminAccount
      .update({
        where: {
          id: admin.adminAccountId,
        },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
      })
      .catch(() => null);
  } else {
    await db.adminSessionState
      .upsert({
        where: {
          login: admin.login,
        },
        update: {
          sessionVersion: {
            increment: 1,
          },
        },
        create: {
          login: admin.login,
          sessionVersion: 1,
        },
      })
      .catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
  return response;
}
