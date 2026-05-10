"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Compass,
  Car,
  Clock3,
  CreditCard,
  FileText,
  Headset,
  House,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { AdminModerationSnapshot } from "@/lib/admin-notifications";
import { cn } from "@/lib/cn";

type Props = {
  moderationSnapshot: AdminModerationSnapshot;
  children: React.ReactNode;
};

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PROPERTY_SEEN_KEY = "boking_admin_property_moderation_seen_at";
const EXCURSION_SEEN_KEY = "boking_admin_excursion_moderation_seen_at";
const TRANSFER_SEEN_KEY = "boking_admin_transfer_moderation_seen_at";
const MESSAGE_SEEN_KEY = "boking_admin_messages_seen_at";
const MANAGER_PAY_SEEN_KEY = "boking_admin_manager_payments_seen_at";

const menu: MenuItem[] = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/moderation", label: "Модерация жилья", icon: ShieldCheck },
  { href: "/admin/moderation/excursions", label: "Модерация экскурсий", icon: Compass },
  { href: "/admin/objects", label: "Жильё и размещение", icon: House },
  { href: "/admin/attractions", label: "Достопримечательности", icon: Landmark },
  { href: "/admin/excursions", label: "Каталог экскурсий", icon: Compass },
  { href: "/admin/transfers", label: "Трансферы", icon: Car },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/payments", label: "Оплата", icon: CreditCard },
  { href: "/admin/renewals", label: "Продление", icon: Clock3 },
  { href: "/admin/applications", label: "Заявки", icon: FileText },
  { href: "/admin/messages", label: "Сообщения", icon: MessageSquareText },
  { href: "/admin/support-chat", label: "Чат поддержки", icon: Headset },
  { href: "/admin/password-resets", label: "Сброс паролей", icon: KeyRound },
];

function readSeenValue(key: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeSeenValue(key: string, value: number): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, String(value));
  }
}

function subscribeNoop() {
  return () => {};
}

function getTrue() {
  return true;
}

function getFalse() {
  return false;
}

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

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/moderation/excursions")) {
    return "Модерация экскурсий";
  }

  if (pathname.startsWith("/admin/moderation")) {
    return "Модерация жилья";
  }

  if (pathname.startsWith("/admin/statistics")) {
    return "Статистика";
  }

  if (pathname.startsWith("/admin/objects")) {
    return "Жильё и размещение";
  }

  if (pathname.startsWith("/admin/attractions")) {
    return "Достопримечательности";
  }

  if (pathname.startsWith("/admin/excursions")) {
    return "Каталог экскурсий";
  }

  if (pathname.startsWith("/admin/transfers")) {
    return "Трансферы";
  }

  if (pathname.startsWith("/admin/users")) {
    return "Пользователи";
  }

  if (pathname.startsWith("/admin/payments")) {
    return "Оплата";
  }

  if (pathname.startsWith("/admin/renewals")) {
    return "Продление";
  }

  if (pathname.startsWith("/admin/applications")) {
    return "Заявки";
  }

  if (pathname.startsWith("/admin/messages")) {
    return "Сообщения";
  }

  if (pathname.startsWith("/admin/support-chat")) {
    return "Чат поддержки";
  }

  if (pathname.startsWith("/admin/password-resets")) {
    return "Сброс паролей";
  }

  return "Обзор";
}

export function AdminShell({ moderationSnapshot, children }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isHydrated = useSyncExternalStore(subscribeNoop, getTrue, getFalse);
  const propertySeenAt = isHydrated ? readSeenValue(PROPERTY_SEEN_KEY) : 0;
  const excursionSeenAt = isHydrated ? readSeenValue(EXCURSION_SEEN_KEY) : 0;
  const transferSeenAt = isHydrated ? readSeenValue(TRANSFER_SEEN_KEY) : 0;
  const messageSeenAt = isHydrated ? readSeenValue(MESSAGE_SEEN_KEY) : 0;
  const managerPaySeenAt = isHydrated ? readSeenValue(MANAGER_PAY_SEEN_KEY) : 0;

  useEffect(() => {
    if (pathname.startsWith("/admin/moderation/excursions")) {
      const seen = Math.max(
        Date.now(),
        moderationSnapshot.excursions.latestPendingUpdatedAtMs ?? 0,
      );
      writeSeenValue(EXCURSION_SEEN_KEY, seen);
      return;
    }

    if (pathname.startsWith("/admin/moderation")) {
      const seen = Math.max(
        Date.now(),
        moderationSnapshot.properties.latestPendingUpdatedAtMs ?? 0,
      );
      writeSeenValue(PROPERTY_SEEN_KEY, seen);
      return;
    }

    if (pathname.startsWith("/admin/messages")) {
      const seen = Math.max(Date.now(), moderationSnapshot.messages.latestCreatedAtMs ?? 0);
      writeSeenValue(MESSAGE_SEEN_KEY, seen);
      return;
    }

    if (pathname.startsWith("/admin/transfers")) {
      const seen = Math.max(
        Date.now(),
        moderationSnapshot.transfers?.latestPendingUpdatedAtMs ?? 0,
      );
      writeSeenValue(TRANSFER_SEEN_KEY, seen);
      return;
    }

    if (pathname.startsWith("/admin/payments")) {
      const seen = Math.max(Date.now(), moderationSnapshot.managerPayments?.latestCreatedAtMs ?? 0);
      writeSeenValue(MANAGER_PAY_SEEN_KEY, seen);
    }
  }, [pathname, moderationSnapshot]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleHiddenStatisticsHotkey(event: KeyboardEvent) {
      if (!event.ctrlKey || !event.shiftKey || event.code !== "KeyS") {
        return;
      }

      event.preventDefault();
      setDrawerOpen(false);
      router.push("/admin/statistics");
    }

    window.addEventListener("keydown", handleHiddenStatisticsHotkey);
    return () => window.removeEventListener("keydown", handleHiddenStatisticsHotkey);
  }, [router]);

  const unreadCounts: Record<string, number> = {
    "/admin/moderation":
      moderationSnapshot.properties.pendingCount > 0 &&
      (moderationSnapshot.properties.latestPendingUpdatedAtMs ?? 0) > propertySeenAt
        ? moderationSnapshot.properties.pendingCount
        : 0,
    "/admin/moderation/excursions":
      moderationSnapshot.excursions.pendingCount > 0 &&
      (moderationSnapshot.excursions.latestPendingUpdatedAtMs ?? 0) > excursionSeenAt
        ? moderationSnapshot.excursions.pendingCount
        : 0,
    "/admin/messages":
      moderationSnapshot.messages.totalCount > 0 &&
      (moderationSnapshot.messages.latestCreatedAtMs ?? 0) > messageSeenAt
        ? moderationSnapshot.messages.totalCount
        : 0,
    "/admin/transfers":
      (moderationSnapshot.transfers?.pendingCount ?? 0) > 0 &&
      (moderationSnapshot.transfers?.latestPendingUpdatedAtMs ?? 0) > transferSeenAt
        ? moderationSnapshot.transfers.pendingCount
        : 0,
    "/admin/support-chat": moderationSnapshot.supportChat?.waitingCount ?? 0,
    "/admin/payments":
      (moderationSnapshot.managerPayments?.pendingCount ?? 0) > 0 &&
      (moderationSnapshot.managerPayments?.latestCreatedAtMs ?? 0) > managerPaySeenAt
        ? moderationSnapshot.managerPayments.pendingCount
        : 0,
  };

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  const sidebarContent = (
    <>
      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/70 bg-white/88 p-3 shadow-[0_18px_55px_rgba(58,43,35,0.08)] backdrop-blur-xl">
          <div className="mb-2 px-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/35">
              Разделы
            </p>
          </div>

          <nav className="space-y-1">
            {menu.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, pathname);
              const unread = !active ? (unreadCounts[item.href] ?? 0) : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-[linear-gradient(135deg,rgba(15,118,110,0.14),rgba(14,116,144,0.1))] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                      : "text-olive/76 hover:bg-sand/62 hover:text-olive",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      active
                        ? "bg-white/82 text-primary shadow-[0_10px_24px_rgba(15,118,110,0.12)]"
                        : "bg-sand/72 text-olive/55",
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {unread > 0 ? (
                    <span className="rounded-full bg-terra px-2 py-0.5 text-[11px] font-semibold text-white">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200/80 bg-red-50/92 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogOut className="h-4 w-4" />
        {loggingOut ? "Выходим..." : "Выйти"}
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.14),transparent_28%),radial-gradient(circle_at_100%_0%,rgba(14,116,144,0.12),transparent_24%),linear-gradient(180deg,#f7f4ef_0%,#f0ebe4_46%,#f7f6f3_100%)]">
      <div className="mx-auto flex w-full max-w-[1480px] gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <aside className="hidden w-[310px] shrink-0 md:block">
          <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col justify-between gap-4 overflow-y-auto">
            {sidebarContent}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[26px] border border-white/70 bg-white/86 px-4 py-3 shadow-[0_14px_38px_rgba(58,43,35,0.08)] backdrop-blur-xl md:hidden">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/55">
                Админ-панель
              </p>
              <p className="truncate text-sm font-semibold text-olive">{getPageTitle(pathname)}</p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/88 text-olive shadow-[0_12px_30px_rgba(58,43,35,0.08)]"
              aria-label="Открыть меню админ-панели"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {drawerOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="absolute inset-0 bg-midnight/45 backdrop-blur-sm"
                onClick={() => setDrawerOpen(false)}
              />
              <aside className="absolute inset-y-0 left-0 flex w-[86vw] max-w-sm flex-col justify-between gap-4 overflow-y-auto border-r border-white/35 bg-[#f6f2eb]/96 p-4 shadow-[0_24px_70px_rgba(43,31,25,0.28)] backdrop-blur-xl">
                <div className="flex justify-end">
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-olive shadow-[0_10px_24px_rgba(58,43,35,0.08)]"
                    aria-label="Закрыть меню"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
                {sidebarContent}
              </aside>
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
