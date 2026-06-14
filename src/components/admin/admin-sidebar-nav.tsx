// Deprecated compatibility wrapper. The canonical admin navigation lives in
// src/lib/admin-navigation.ts and is rendered by AdminShell.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigationGroups } from "@/lib/admin-navigation";
import type { AdminModerationSnapshot } from "@/lib/admin-notifications";
import { cn } from "@/lib/cn";

type AdminSidebarItem = {
  href: string;
  label: string;
};

type AdminSidebarNavProps = {
  menu?: AdminSidebarItem[];
  moderationSnapshot?: AdminModerationSnapshot;
};

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/moderation") {
    return (
      pathname === "/admin/moderation" ||
      (pathname.startsWith("/admin/moderation/") &&
        !pathname.startsWith("/admin/moderation/excursions"))
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarNav(_props: AdminSidebarNavProps) {
  void _props;
  const pathname = usePathname() ?? "";
  const items = adminNavigationGroups.flatMap((group) => group.items);

  return (
    <nav className="mt-4 space-y-1">
      {items.map((item) => {
        const active = isActive(item.href, pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-[var(--admin-primary-soft)] font-semibold text-[var(--admin-primary)]"
                : "text-[var(--admin-muted)] hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]",
            )}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
