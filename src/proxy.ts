import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/csrf";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const ADMIN_COOKIE_NAME = "boking_admin_session";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isProtectedUiRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
}

function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
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

// Security proxy:
// - applies security headers
// - blocks cross-origin mutating API requests (basic CSRF guard)
// - protects /dashboard and /admin routes by session token
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");

  if (isApiRoute(pathname)) {
    if (
      mutatingMethods.has(request.method.toUpperCase()) &&
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
              error: "Администраторский аккаунт изолирован от owner/guest API. Используйте /api/admin/*",
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

  // Admin routes use standalone admin auth (separate cookie).
  if (isAdminRoute) {
    const isAdminLogin = pathname === "/admin/login";
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

    if (isAdminLogin) {
      // If already authenticated, redirect to admin home.
      if (adminToken) {
        return applySecurityHeaders(NextResponse.redirect(new URL("/admin", request.url)));
      }
      return applySecurityHeaders(NextResponse.next());
    }

    // All other admin pages require the admin cookie.
    if (!adminToken) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/admin/login", request.url)));
    }

    return applySecurityHeaders(NextResponse.next());
  }

  // Dashboard routes use regular user session.
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
    response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return applySecurityHeaders(response);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/:path*"],
};
