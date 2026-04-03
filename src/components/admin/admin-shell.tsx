// Admin panel shell with responsive sidebar (desktop) and drawer (mobile).
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useSyncExternalStore } from "react";
import {
  ChevronRight,
  Compass,
  CreditCard,
  FileText,
  Headset,
  House,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { AdminModerationSnapshot } from "@/lib/admin-notifications";

type Props = {
  login: string;
  moderationSnapshot: AdminModerationSnapshot;
  children: React.ReactNode;
};

const PROPERTY_SEEN_KEY = "boking_admin_property_moderation_seen_at";
const EXCURSION_SEEN_KEY = "boking_admin_excursion_moderation_seen_at";
const MESSAGE_SEEN_KEY = "boking_admin_messages_seen_at";
const MANAGER_PAY_SEEN_KEY = "boking_admin_manager_payments_seen_at";

const menu = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/moderation", label: "Модерация жилья", icon: ShieldCheck },
  { href: "/admin/moderation/excursions", label: "Модерация экскурсий", icon: Compass },
  { href: "/admin/excursions", label: "Экскурсии", icon: Compass },
  { href: "/admin/objects", label: "Объекты", icon: House },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/payments", label: "Оплата (менеджер)", icon: CreditCard },
  { href: "/admin/applications", label: "Заявки", icon: FileText },
  { href: "/admin/messages", label: "Сообщения", icon: MessageSquareText },
  { href: "/admin/support-chat", label: "Чат поддержки", icon: Headset },
  { href: "/admin/password-resets", label: "Сбросы паролей", icon: KeyRound },
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

export function AdminShell({ login, moderationSnapshot, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isHydrated = useSyncExternalStore(subscribeNoop, getTrue, getFalse);
  const propertySeenAt = isHydrated ? readSeenValue(PROPERTY_SEEN_KEY) : 0;
  const excursionSeenAt = isHydrated ? readSeenValue(EXCURSION_SEEN_KEY) : 0;
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
    if (pathname.startsWith("/admin/payments")) {
      const seen = Math.max(Date.now(), moderationSnapshot.managerPayments?.latestCreatedAtMs ?? 0);
      writeSeenValue(MANAGER_PAY_SEEN_KEY, seen);
    }
  }, [pathname, moderationSnapshot]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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
    "/admin/support-chat": moderationSnapshot.supportChat?.waitingCount ?? 0,
    "/admin/payments":
      (moderationSnapshot.managerPayments?.pendingCount ?? 0) > 0 &&
      (moderationSnapshot.managerPayments?.latestCreatedAtMs ?? 0) > managerPaySeenAt
        ? moderationSnapshot.managerPayments.pendingCount
        : 0,
  };

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  const sidebarContent = (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3 rounded-xl bg-primary/8 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Админ-панель
            </p>
            <p className="truncate text-xs text-olive/55">{login}</p>
          </div>
        </div>
      </div>

      <nav className="space-y-0.5">
        {menu.map((item) => {
          const active = isActive(item.href, pathname);
          const unread = !active ? (unreadCounts[item.href] ?? 0) : 0;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-olive/75 hover:bg-sand/70 hover:text-olive"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {unread > 0 && (
                <span className="rounded-full bg-terra px-2 py-0.5 text-xs font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-olive/10 pt-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-olive/35">
          Быстрые действия
        </p>
        <Link
          href="/admin/objects/new"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-olive/75 hover:bg-sand/70 hover:text-olive"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Создать объект</span>
        </Link>
        <Link
          href="/admin/excursions/new"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-olive/75 hover:bg-sand/70 hover:text-olive"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Создать экскурсию</span>
        </Link>
      </div>

      <div className="mt-auto pt-4">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600/80 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{loggingOut ? "Выход..." : "Выйти"}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-olive/10 bg-white/92 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-olive">Админ-панель</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-olive hover:bg-sand/70"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white p-4 shadow-2xl">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-olive hover:bg-sand/70"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden w-[250px] shrink-0 md:flex md:flex-col">
            <div className="sticky top-6 flex flex-col rounded-2xl border border-olive/8 bg-white/94 p-4 shadow-sm">
              {sidebarContent}
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            <div className="rounded-2xl border border-olive/8 bg-white/94 p-4 shadow-sm md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
