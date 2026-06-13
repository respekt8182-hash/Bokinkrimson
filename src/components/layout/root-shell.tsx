// Root application shell: hides public header/footer on dashboard routes and renders common page frame.
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { shouldShowPublicMobileBottomNav } from "@/components/layout/public-mobile-bottom-nav";
import { cn } from "@/lib/cn";
import { DeferredSupportChatWidget } from "@/components/support-chat/deferred-support-chat-widget";

type RootShellProps = {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
};

function shouldShowSupportChat(pathname: string) {
  if (pathname === "/dashboard") {
    return true;
  }

  return [
    "/dashboard/profile",
    "/dashboard/chessboard",
    "/dashboard/objects",
    "/dashboard/excursions",
  ].some((prefix) => pathname.startsWith(prefix));
}

function isPublicCatalogRoute(pathname: string, direction: string | null) {
  if (
    pathname === "/rent" ||
    pathname === "/attractions" ||
    pathname === "/transfers" ||
    pathname === "/excursions" ||
    pathname === "/tours"
  ) {
    return true;
  }

  if (pathname === "/search") {
    return direction !== null;
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "crimea" && segments[1] !== "excursions";
}

export function RootShell({ children, header, footer }: RootShellProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/admin");
  const showSiteChrome = !isDashboardRoute && !isAdminRoute;
  const showChatWidget = shouldShowSupportChat(pathname);
  const showPublicMobileBottomNav = showSiteChrome && shouldShowPublicMobileBottomNav(pathname);
  const useStaticSiteHeader =
    showSiteChrome && isPublicCatalogRoute(pathname, searchParams.get("direction"));

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        useStaticSiteHeader && "public-catalog-static-header housing-catalog-static-header",
      )}
    >
      {showSiteChrome ? header : null}
      <main
        className={cn(
          "flex-1",
          showPublicMobileBottomNav
            ? "pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] lg:pb-3"
            : showSiteChrome
              ? "pb-3"
              : "pb-0",
        )}
      >
        {children}
      </main>
      {showSiteChrome ? footer : null}
      {showChatWidget && <DeferredSupportChatWidget />}
    </div>
  );
}
