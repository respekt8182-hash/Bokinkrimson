// Root application shell: hides public header/footer on dashboard routes and renders common page frame.
"use client";

import { usePathname } from "next/navigation";
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

  return ["/dashboard/profile", "/dashboard/chessboard", "/dashboard/objects", "/dashboard/excursions"].some(
    (prefix) => pathname.startsWith(prefix),
  );
}

export function RootShell({ children, header, footer }: RootShellProps) {
  const pathname = usePathname() ?? "";
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/admin");
  const showSiteChrome = !isDashboardRoute && !isAdminRoute;
  const showChatWidget = shouldShowSupportChat(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      {showSiteChrome ? header : null}
      <main className={cn("flex-1", showSiteChrome ? "pb-3" : "pb-0")}>{children}</main>
      {showSiteChrome ? footer : null}
      {showChatWidget && <DeferredSupportChatWidget />}
    </div>
  );
}
