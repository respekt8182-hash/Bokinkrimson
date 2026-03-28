// UI component for admin sidebar nav in the admin module.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import type { AdminModerationSnapshot } from "@/lib/admin-notifications";

type AdminSidebarItem = {
  href: string;
  label: string;
};

type AdminSidebarNavProps = {
  menu: AdminSidebarItem[];
  moderationSnapshot: AdminModerationSnapshot;
};

const PROPERTY_SEEN_KEY = "boking_admin_property_moderation_seen_at";
const EXCURSION_SEEN_KEY = "boking_admin_excursion_moderation_seen_at";
const MESSAGE_SEEN_KEY = "boking_admin_messages_seen_at";

function readSeenValue(key: string): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeSeenValue(key: string, value: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, String(value));
}

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

export function AdminSidebarNav({ menu, moderationSnapshot }: AdminSidebarNavProps) {
  const pathname = usePathname();
  // Keep first client render equal to SSR markup; switch to localStorage snapshot after hydration.
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const propertySeenAt = isHydrated ? readSeenValue(PROPERTY_SEEN_KEY) : 0;
  const excursionSeenAt = isHydrated ? readSeenValue(EXCURSION_SEEN_KEY) : 0;
  const messageSeenAt = isHydrated ? readSeenValue(MESSAGE_SEEN_KEY) : 0;

  useEffect(() => {
    if (pathname.startsWith("/admin/moderation/excursions")) {
      const seen = Math.max(Date.now(), moderationSnapshot.excursions.latestPendingUpdatedAtMs ?? 0);
      writeSeenValue(EXCURSION_SEEN_KEY, seen);
      return;
    }

    if (pathname.startsWith("/admin/moderation")) {
      const seen = Math.max(Date.now(), moderationSnapshot.properties.latestPendingUpdatedAtMs ?? 0);
      writeSeenValue(PROPERTY_SEEN_KEY, seen);
      return;
    }

    if (pathname.startsWith("/admin/messages")) {
      const seen = Math.max(Date.now(), moderationSnapshot.messages.latestCreatedAtMs ?? 0);
      writeSeenValue(MESSAGE_SEEN_KEY, seen);
    }
  }, [
    pathname,
    moderationSnapshot.excursions.latestPendingUpdatedAtMs,
    moderationSnapshot.messages.latestCreatedAtMs,
    moderationSnapshot.properties.latestPendingUpdatedAtMs,
  ]);

  const unreadCounts = {
    propertyUnread:
      moderationSnapshot.properties.pendingCount > 0 &&
      (moderationSnapshot.properties.latestPendingUpdatedAtMs ?? 0) > propertySeenAt
        ? moderationSnapshot.properties.pendingCount
        : 0,
    excursionUnread:
      moderationSnapshot.excursions.pendingCount > 0 &&
      (moderationSnapshot.excursions.latestPendingUpdatedAtMs ?? 0) > excursionSeenAt
        ? moderationSnapshot.excursions.pendingCount
        : 0,
    messageUnread:
      moderationSnapshot.messages.totalCount > 0 &&
      (moderationSnapshot.messages.latestCreatedAtMs ?? 0) > messageSeenAt
        ? moderationSnapshot.messages.totalCount
        : 0,
  };

  return (
    <nav className="mt-4 space-y-1">
      {menu.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : item.href === "/admin/moderation"
              ? pathname === "/admin/moderation" ||
                (pathname.startsWith("/admin/moderation/") &&
                  !pathname.startsWith("/admin/moderation/excursions"))
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const unreadCount =
          item.href === "/admin/moderation"
            ? unreadCounts.propertyUnread
            : item.href === "/admin/moderation/excursions"
              ? unreadCounts.excursionUnread
              : item.href === "/admin/messages"
                ? unreadCounts.messageUnread
              : 0;
        const safeUnreadCount = isActive ? 0 : unreadCount;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              isActive ? "bg-sand/70 font-semibold text-olive" : "text-olive/80 hover:bg-sand/70"
            }`}
          >
            <span>{item.label}</span>
            {safeUnreadCount > 0 ? (
              <span className="rounded-full bg-terra px-2 py-0.5 text-xs font-semibold text-white">
                {safeUnreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
