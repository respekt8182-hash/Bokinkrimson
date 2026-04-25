import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCredentials } from "@/lib/admin-password-auth";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminAuthConfigurationError,
  getAdminCookieOptions,
} from "@/lib/admin-session-token";
import { createFailedLoginLockout } from "@/lib/login-lockout";
import { getRequestIp } from "@/lib/security";
import { getAdminLoginValue } from "@/lib/security-config";
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

    if (!(await validateAdminCredentials(login, password))) {
      const lockout = adminLoginLockout.recordFailure(ip);
      if (lockout.locked) {
        return createAdminLoginLockoutResponse(lockout.retryAfterSeconds);
      }

      return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
    }

    let sessionVersion = 0;

    try {
      const sessionState = await db.adminSessionState.upsert({
        where: {
          login: getAdminLoginValue(),
        },
        update: {},
        create: {
          login: getAdminLoginValue(),
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

    const token = await createAdminSessionToken(login, sessionVersion);
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

  await db.adminSessionState
    .upsert({
      where: {
        login: getAdminLoginValue(),
      },
      update: {
        sessionVersion: {
          increment: 1,
        },
      },
      create: {
        login: getAdminLoginValue(),
        sessionVersion: 1,
      },
    })
    .catch(() => null);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
  return response;
}
