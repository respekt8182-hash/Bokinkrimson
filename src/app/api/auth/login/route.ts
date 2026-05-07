// API route handler for /api/auth/login.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildSessionUser,
  comparePasswords,
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  ensureAuthDatabaseAvailable,
  getAuthDatabaseUnavailableMessage,
  isAuthDatabaseUnavailable,
} from "@/lib/auth-route-db";
import { authRateLimit } from "@/lib/constants";
import { createFailedLoginLockout } from "@/lib/login-lockout";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/lib/schemas/auth";
import { getRequestIp } from "@/lib/security";
import { markUserLogin } from "@/lib/user-activity";
import { buildUserPhoneLookupCandidates } from "@/lib/user-phone";

const failedLoginLockout = createFailedLoginLockout({
  id: "auth-login-failed",
  lockoutMs: authRateLimit.login.windowMinutes * 60 * 1000,
  maxFailedAttempts: authRateLimit.login.maxRequestsPerWindow,
});

const unknownUserMessage = "Возможно, такой пользователь не существует. Зарегистрируйте аккаунт.";

function createLoginLockoutResponse(retryAfterSeconds: number) {
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

function recordFailedLoginAttempt(ip: string): NextResponse | null {
  const lockout = failedLoginLockout.recordFailure(ip);
  if (!lockout.locked) {
    return null;
  }

  return createLoginLockoutResponse(lockout.retryAfterSeconds);
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);

  try {
    const payload = await request.json();
    const parsed = loginSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Проверьте корректность данных" }, { status: 400 });
    }

    const activeLockout = failedLoginLockout.check(ip);
    if (activeLockout.locked) {
      return createLoginLockoutResponse(activeLockout.retryAfterSeconds);
    }

    const unavailableResponse = await ensureAuthDatabaseAvailable({
      routeId: "auth-login",
      routeLabel: "Login",
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
    });

    if (!user || user.deletedAt) {
      const lockoutResponse = recordFailedLoginAttempt(ip);
      if (lockoutResponse) {
        return lockoutResponse;
      }

      return NextResponse.json({ error: unknownUserMessage }, { status: 401 });
    }

    const isPasswordValid = await comparePasswords(parsed.data.password, user.passwordHash);

    if (!isPasswordValid) {
      const lockoutResponse = recordFailedLoginAttempt(ip);
      if (lockoutResponse) {
        return lockoutResponse;
      }

      return NextResponse.json({ error: "Неверный телефон или пароль" }, { status: 401 });
    }

    const sessionUser = await buildSessionUser(user.id);
    if (!sessionUser) {
      const lockoutResponse = recordFailedLoginAttempt(ip);
      if (lockoutResponse) {
        return lockoutResponse;
      }

      return NextResponse.json({ error: "Неверный телефон или пароль" }, { status: 401 });
    }

    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ ok: true, user: sessionUser });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    await markUserLogin(user.id);
    failedLoginLockout.reset(ip);

    return response;
  } catch (error) {
    if (isAuthDatabaseUnavailable(error)) {
      logger.warn(
        "Login is temporarily unavailable because the database is down or credentials are invalid",
        { ip },
      );
      return NextResponse.json({ error: getAuthDatabaseUnavailableMessage() }, { status: 503 });
    }

    logger.error("Login failed", { ip, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Не удалось выполнить вход" }, { status: 500 });
  }
}
