import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session-token";
import { isSameOrigin } from "@/lib/csrf";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { assertRuntimeSecurityConfiguration } from "@/lib/security-config";
import { buildDateRangeParam } from "@/lib/seo/url-normalize";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const adminMutationLimiter = createRateLimiter({
  id: "proxy-admin-mutations",
  windowMs: 15 * 60 * 1000,
  maxRequests: 120,
});
const authMutationLimiter = createRateLimiter({
  id: "proxy-auth-mutations",
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
});
const uploadLimiter = createRateLimiter({
  id: "proxy-upload-mutations",
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
});

const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function clearAdminCookie(response: NextResponse): NextResponse {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isProtectedUiRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
}

function shouldNormalizeCatalogDateUrl(pathname: string): boolean {
  if (pathname === "/rent") {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "crimea";
}

function requiresStrictSecurityConfiguration(pathname: string, method: string): boolean {
  if (isProtectedUiRoute(pathname)) {
    return true;
  }

  if (!isApiRoute(pathname)) {
    return false;
  }

  if (mutatingMethods.has(method)) {
    return true;
  }

  if (pathname.startsWith("/api/admin/") || pathname.startsWith("/api/auth/")) {
    return true;
  }

  return isOwnerSpaceApiPath(pathname);
}

function isCsrfExemptApiPath(pathname: string): boolean {
  return pathname === "/api/payments/yookassa/webhook";
}

function isOwnerSpaceApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/admin/")) {
    return false;
  }

  if (pathname.startsWith("/api/auth/")) {
    return false;
  }

  if (
    pathname.startsWith("/api/properties") ||
    pathname.startsWith("/api/excursions") ||
    pathname.startsWith("/api/applications") ||
    pathname.startsWith("/api/payments")
  ) {
    return true;
  }

  const isPublicPropertyMutation =
    /^\/api\/public\/properties\/[^/]+\/(applications|reviews)$/.test(pathname);
  const isPublicExcursionMutation =
    /^\/api\/public\/excursions\/[^/]+\/(applications|reviews)$/.test(pathname);

  return isPublicPropertyMutation || isPublicExcursionMutation;
}

function isSensitiveAuthPath(pathname: string): boolean {
  return /^\/api\/auth\/(login|register|forgot-password|reset-password)$/.test(pathname);
}

function isUploadPath(pathname: string): boolean {
  return (
    /\/documents(?:\/[^/]+)?$/.test(pathname) ||
    /\/media$/.test(pathname) ||
    /\/photos$/.test(pathname) ||
    pathname === "/api/profile/avatar" ||
    pathname === "/api/support-chat/upload"
  );
}

async function enforceProxyRateLimit(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse | null> {
  if (!mutatingMethods.has(request.method.toUpperCase())) {
    return null;
  }

  const ip = getRequestIp(request);
  const key = `${pathname}:${ip}`;

  try {
    if (pathname.startsWith("/api/admin/")) {
      const limit = await adminMutationLimiter.limit(key);
      if (!limit.allowed) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.` },
            {
              status: 429,
              headers: {
                "Retry-After": String(limit.retryAfterSeconds),
              },
            },
          ),
        );
      }
    }

    if (isSensitiveAuthPath(pathname)) {
      const limit = await authMutationLimiter.limit(key);
      if (!limit.allowed) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.` },
            {
              status: 429,
              headers: {
                "Retry-After": String(limit.retryAfterSeconds),
              },
            },
          ),
        );
      }
    }

    if (isUploadPath(pathname)) {
      const limit = await uploadLimiter.limit(key);
      if (!limit.allowed) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: `Too many upload attempts. Retry in ${limit.retryAfterSeconds} seconds.` },
            {
              status: 429,
              headers: {
                "Retry-After": String(limit.retryAfterSeconds),
              },
            },
          ),
        );
      }
    }

    return null;
  } catch (error) {
    if (
      error instanceof RateLimitConfigurationError ||
      error instanceof RateLimitBackendUnavailableError
    ) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 }),
      );
    }

    throw error;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const requestMethod = request.method.toUpperCase();

  if (requestMethod === "GET" && shouldNormalizeCatalogDateUrl(pathname)) {
    const checkIn = request.nextUrl.searchParams.get("checkIn") ?? "";
    const checkOut = request.nextUrl.searchParams.get("checkOut") ?? "";
    const dates = buildDateRangeParam(checkIn, checkOut);

    if (dates) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.searchParams.delete("checkIn");
      redirectUrl.searchParams.delete("checkOut");
      redirectUrl.searchParams.set("dates", dates);

      return applySecurityHeaders(NextResponse.redirect(redirectUrl, 308));
    }
  }

  try {
    assertRuntimeSecurityConfiguration();
  } catch {
    if (requiresStrictSecurityConfiguration(pathname, requestMethod)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Security configuration is invalid" }, { status: 503 }),
      );
    }
  }

  if (isApiRoute(pathname)) {
    const rateLimitResponse = await enforceProxyRateLimit(request, pathname);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (
      mutatingMethods.has(requestMethod) &&
      !isCsrfExemptApiPath(pathname) &&
      !isSameOrigin(request)
    ) {
      return applySecurityHeaders(
        NextResponse.json({ error: "CSRF check failed: invalid origin" }, { status: 403 }),
      );
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const session = await verifySessionToken(token);
      if (session?.role === "ADMIN" && isOwnerSpaceApiPath(pathname)) {
        return applySecurityHeaders(
          NextResponse.json(
            {
              error:
                "Administrator sessions are isolated from owner and guest APIs. Use /api/admin/* instead.",
            },
            { status: 403 },
          ),
        );
      }
    }

    return applySecurityHeaders(NextResponse.next());
  }

  if (!isProtectedUiRoute(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (isAdminRoute) {
    const isAdminLogin = pathname === "/admin/login";
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const adminSession = adminToken ? await verifyAdminSessionToken(adminToken) : null;

    if (isAdminLogin) {
      if (adminSession) {
        return applySecurityHeaders(NextResponse.redirect(new URL("/admin", request.url)));
      }

      const response = NextResponse.next();
      if (adminToken) {
        clearAdminCookie(response);
      }
      return applySecurityHeaders(response);
    }

    if (!adminSession) {
      const response = NextResponse.redirect(new URL("/admin/login", request.url));
      if (adminToken) {
        clearAdminCookie(response);
      }
      return applySecurityHeaders(response);
    }

    return applySecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  const session = await verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);

    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return applySecurityHeaders(response);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/:path*", "/rent", "/crimea/:path*"],
};
