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

export function RootShell({ children, header, footer }: RootShellProps) {
  const pathname = usePathname() ?? "";
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/admin");
  const showChatWidget = !isDashboardRoute && !isAdminRoute;

  return (
    <div className="flex min-h-screen flex-col">
      {isDashboardRoute ? null : header}
      <main className={cn("flex-1", isDashboardRoute ? "pb-0" : "pb-3")}>{children}</main>
      {isDashboardRoute ? null : footer}
      {showChatWidget && <DeferredSupportChatWidget />}
    </div>
  );
}
