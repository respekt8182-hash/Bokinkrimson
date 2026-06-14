"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Compass,
  CreditCard,
  ExternalLink,
  FileText,
  Headset,
  House,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { companyConfig } from "@/config/company";
import {
  adminNavigationGroups,
  adminQuickActions,
  getAdminNavigationItems,
  type AdminIconName,
} from "@/lib/admin-navigation";
import { adminRoleLabels, canAccessAdminPath, hasAdminPermission } from "@/lib/admin-rbac";
import type { AdminModerationSnapshot } from "@/lib/admin-notifications";
import type { AdminSession } from "@/lib/admin-session-token";
import { cn } from "@/lib/cn";

type Props = {
  moderationSnapshot: AdminModerationSnapshot;
  currentAdmin: AdminSession;
  children: React.ReactNode;
};

type NotificationCategory = {
  id: string;
  label: string;
  description: string;
  href: string;
  count: number;
  latestAtMs: number | null;
  latestAt: string | null;
  severity: "neutral" | "warning" | "info" | "danger";
};

type NotificationsPayload = {
  generatedAt: string | null;
  generatedAtMs: number;
  totalCount: number;
  categories: NotificationCategory[];
};

type SearchRecord = {
  href: string;
  label: string;
  group: string;
  icon: AdminIconName;
  keywords: string[];
};

const AdminShellContext = createContext<AdminSession | null>(null);

export function useCurrentAdmin(): AdminSession | null {
  return useContext(AdminShellContext);
}

const SIDEBAR_COLLAPSED_KEY = "boking_admin_sidebar_collapsed";
const PROPERTY_SEEN_KEY = "boking_admin_property_moderation_seen_at";
const EXCURSION_SEEN_KEY = "boking_admin_excursion_moderation_seen_at";
const TRANSFER_SEEN_KEY = "boking_admin_transfer_moderation_seen_at";
const MESSAGE_SEEN_KEY = "boking_admin_messages_seen_at";
const MANAGER_PAY_SEEN_KEY = "boking_admin_manager_payments_seen_at";
const REVIEW_SEEN_KEY = "boking_admin_reviews_seen_at";
const SUPPORT_CHAT_SEEN_KEY = "boking_admin_support_chat_seen_at";

const notificationSeenKeys: Record<string, string> = {
  properties: PROPERTY_SEEN_KEY,
  excursions: EXCURSION_SEEN_KEY,
  transfers: TRANSFER_SEEN_KEY,
  messages: MESSAGE_SEEN_KEY,
  "support-chat": SUPPORT_CHAT_SEEN_KEY,
  reviews: REVIEW_SEEN_KEY,
  payments: MANAGER_PAY_SEEN_KEY,
};

const iconMap: Record<AdminIconName, LucideIcon> = {
  applications: FileText,
  attractions: Landmark,
  dashboard: LayoutDashboard,
  excursions: Compass,
  finance: CreditCard,
  help: CircleHelp,
  messages: MessageSquareText,
  moderation: ShieldCheck,
  objects: House,
  passwords: KeyRound,
  phone: Phone,
  profile: UserRound,
  site: ExternalLink,
  support: Headset,
  transfers: Car,
  users: Users,
};

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

function isActive(href: string, pathname: string): boolean {
  const baseHref = href.split("?")[0] ?? href;
  if (baseHref === "/admin") return pathname === "/admin";
  if (baseHref === "/admin/moderation") {
    return (
      pathname === "/admin/moderation" ||
      (pathname.startsWith("/admin/moderation/") &&
        !pathname.startsWith("/admin/moderation/excursions"))
    );
  }

  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function getPageTitle(pathname: string): string {
  const item = getAdminNavigationItems()
    .sort((a, b) => b.href.length - a.href.length)
    .find((entry) => isActive(entry.href, pathname));

  if (pathname.startsWith("/admin/profile")) return "Профиль администратора";
  if (pathname.startsWith("/admin/help")) return "Помощь";
  if (pathname.startsWith("/admin/statistics")) return "Статистика";
  return item?.label ?? "Обзор";
}

function getBrandInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return initials || "AD";
}

function formatNotificationTime(value: string | null): string {
  if (!value) return "Нет новых событий";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Недавно";
  }
}

function filterNotificationsForRole(
  payload: NotificationsPayload,
  role: AdminSession["role"],
): NotificationsPayload {
  const categories = payload.categories.filter((category) =>
    canAccessAdminPath(role, category.href),
  );

  return {
    ...payload,
    totalCount: categories.reduce((sum, category) => sum + category.count, 0),
    categories,
  };
}

function buildNotificationsFromSnapshot(
  snapshot: AdminModerationSnapshot,
  role: AdminSession["role"],
): NotificationsPayload {
  const categories: NotificationCategory[] = [
    {
      id: "properties",
      label: "Жильё на модерации",
      description: "Новые или изменённые карточки жилья ждут проверки.",
      href: "/admin/moderation",
      count: snapshot.properties.pendingCount,
      latestAtMs: snapshot.properties.latestPendingUpdatedAtMs,
      latestAt: snapshot.properties.latestPendingUpdatedAtMs
        ? new Date(snapshot.properties.latestPendingUpdatedAtMs).toISOString()
        : null,
      severity: "warning",
    },
    {
      id: "excursions",
      label: "Экскурсии на модерации",
      description: "Экскурсии и туры ожидают решения модератора.",
      href: "/admin/moderation/excursions",
      count: snapshot.excursions.pendingCount,
      latestAtMs: snapshot.excursions.latestPendingUpdatedAtMs,
      latestAt: snapshot.excursions.latestPendingUpdatedAtMs
        ? new Date(snapshot.excursions.latestPendingUpdatedAtMs).toISOString()
        : null,
      severity: "info",
    },
    {
      id: "transfers",
      label: "Трансферы",
      description: "Карточки трансферов ожидают проверки.",
      href: "/admin/transfers?status=PENDING_MODERATION",
      count: snapshot.transfers.pendingCount,
      latestAtMs: snapshot.transfers.latestPendingUpdatedAtMs,
      latestAt: snapshot.transfers.latestPendingUpdatedAtMs
        ? new Date(snapshot.transfers.latestPendingUpdatedAtMs).toISOString()
        : null,
      severity: "info",
    },
    {
      id: "messages",
      label: "Сообщения",
      description: "Владельцы оставили сообщения для администрации.",
      href: "/admin/messages",
      count: snapshot.messages.totalCount,
      latestAtMs: snapshot.messages.latestCreatedAtMs,
      latestAt: snapshot.messages.latestCreatedAtMs
        ? new Date(snapshot.messages.latestCreatedAtMs).toISOString()
        : null,
      severity: "neutral",
    },
    {
      id: "support-chat",
      label: "Чат поддержки",
      description: "Диалоги, где последним писал пользователь.",
      href: "/admin/support-chat",
      count: snapshot.supportChat.waitingCount,
      latestAtMs: snapshot.supportChat.latestCreatedAtMs ?? null,
      latestAt: snapshot.supportChat.latestCreatedAtMs
        ? new Date(snapshot.supportChat.latestCreatedAtMs).toISOString()
        : null,
      severity: "warning",
    },
    {
      id: "reviews",
      label: "Отзывы",
      description: "Импортированные отзывы ждут модерации.",
      href: "/admin/reviews",
      count: snapshot.reviews.pendingCount,
      latestAtMs: snapshot.reviews.latestCreatedAtMs,
      latestAt: snapshot.reviews.latestCreatedAtMs
        ? new Date(snapshot.reviews.latestCreatedAtMs).toISOString()
        : null,
      severity: "info",
    },
    {
      id: "payments",
      label: "Оплаты менеджером",
      description: "Оплаты в статусе ожидания требуют подтверждения.",
      href: "/admin/payments",
      count: snapshot.managerPayments.pendingCount,
      latestAtMs: snapshot.managerPayments.latestCreatedAtMs,
      latestAt: snapshot.managerPayments.latestCreatedAtMs
        ? new Date(snapshot.managerPayments.latestCreatedAtMs).toISOString()
        : null,
      severity: "danger",
    },
  ];

  return filterNotificationsForRole(
    {
      generatedAt: null,
      generatedAtMs: 0,
      totalCount: categories.reduce((sum, category) => sum + category.count, 0),
      categories,
    },
    role,
  );
}

function getBadgeHref(href: string): string {
  if (href.startsWith("/admin/transfers")) return "/admin/transfers";
  return href.split("?")[0] ?? href;
}

export function AdminShell({ moderationSnapshot, currentAdmin, children }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [seenRevision, setSeenRevision] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationsPayload>(() =>
    buildNotificationsFromSnapshot(moderationSnapshot, currentAdmin.role),
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");

  const roleLabel = adminRoleLabels[currentAdmin.role] ?? "Администратор";
  const brandName = companyConfig.brandName;
  const brandLogoPath = companyConfig.logoPath;
  const publicSiteHref = companyConfig.baseUrl || "/";

  const visibleNavigationGroups = useMemo(
    () =>
      adminNavigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            hasAdminPermission(currentAdmin.role, item.permission),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [currentAdmin.role],
  );

  const visibleQuickActions = useMemo(
    () =>
      adminQuickActions.filter((item) => hasAdminPermission(currentAdmin.role, item.permission)),
    [currentAdmin.role],
  );

  const searchRecords = useMemo<SearchRecord[]>(() => {
    const navigationRecords = visibleNavigationGroups.flatMap((group) =>
      group.items.map((item) => ({
        href: item.href,
        label: item.label,
        group: group.label,
        icon: item.icon,
        keywords: item.keywords,
      })),
    );
    const quickRecords = visibleQuickActions.map((item) => ({
      href: item.href,
      label: item.label,
      group: "Быстрые действия",
      icon: item.icon,
      keywords: item.keywords,
    }));
    const utilityRecords: SearchRecord[] = [
      {
        href: "/admin/profile",
        label: "Профиль администратора",
        group: "Аккаунт",
        icon: "profile",
        keywords: ["profile", "account", "me", "профиль", "аватар", "пароль"],
      },
      {
        href: "/admin/help",
        label: "Помощь",
        group: "Аккаунт",
        icon: "help",
        keywords: ["help", "support", "docs", "помощь", "инструкция"],
      },
    ];

    return [...navigationRecords, ...quickRecords, ...utilityRecords];
  }, [visibleNavigationGroups, visibleQuickActions]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearchQuery
    ? searchRecords
        .filter((item) => {
          const haystack = [item.label, item.group, ...item.keywords].join(" ").toLowerCase();
          return haystack.includes(normalizedSearchQuery);
        })
        .slice(0, 8)
    : [];

  useEffect(() => {
    setIsHydrated(true);
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    if (isHydrated) {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    }
  }, [isHydrated, sidebarCollapsed]);

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleGlobalHotkeys(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }

      if (event.ctrlKey && event.shiftKey && event.code === "KeyS") {
        event.preventDefault();
        setDrawerOpen(false);
        router.push("/admin/statistics");
      }
    }

    window.addEventListener("keydown", handleGlobalHotkeys);
    return () => window.removeEventListener("keydown", handleGlobalHotkeys);
  }, [router]);

  async function refreshNotifications(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setNotificationsLoading(true);
    }
    setNotificationsError("");

    try {
      const response = await fetch("/api/admin/notifications", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("notifications_failed");
      }

      const payload = (await response.json()) as NotificationsPayload;
      setNotifications(filterNotificationsForRole(payload, currentAdmin.role));
    } catch {
      setNotificationsError("Не удалось обновить уведомления.");
    } finally {
      if (!options.silent) {
        setNotificationsLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshNotifications({ silent: true });
    const intervalId = window.setInterval(() => {
      void refreshNotifications({ silent: true });
    }, 45_000);

    function handleFocus() {
      void refreshNotifications({ silent: true });
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    const matchingCategory = notifications.categories.find((category) =>
      isActive(getBadgeHref(category.href), pathname),
    );

    if (matchingCategory) {
      const key = notificationSeenKeys[matchingCategory.id];
      if (key) {
        writeSeenValue(key, Math.max(Date.now(), matchingCategory.latestAtMs ?? 0));
        setSeenRevision((value) => value + 1);
      }
    }
  }, [pathname, notifications.categories]);

  const unreadCounts = useMemo(() => {
    void seenRevision;
    const counts: Record<string, number> = {};

    for (const category of notifications.categories) {
      const key = notificationSeenKeys[category.id];
      const seenAt = isHydrated && key ? readSeenValue(key) : 0;
      const latestAt = category.latestAtMs ?? 0;
      const unread = category.count > 0 && latestAt > seenAt ? category.count : 0;
      const href = getBadgeHref(category.href);
      counts[href] = Math.max(counts[href] ?? 0, unread);
    }

    return counts;
  }, [isHydrated, notifications.categories, seenRevision]);

  const unreadTotal = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  function markNotificationsSeen() {
    const now = Date.now();

    for (const category of notifications.categories) {
      const key = notificationSeenKeys[category.id];
      if (key) {
        writeSeenValue(key, Math.max(now, category.latestAtMs ?? 0));
      }
    }

    setSeenRevision((value) => value + 1);
  }

  function openSearchResult(href: string) {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  }

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

  const sidebarContent = (compact = false) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-[var(--admin-border)] px-4">
        <Link
          href="/admin"
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-xl text-[var(--admin-text)] outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--admin-ring)]",
            compact ? "justify-center" : "",
          )}
          aria-label={brandName}
          title={compact ? brandName : undefined}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-[var(--admin-primary-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogoPath} alt="" className="h-full w-full object-cover" />
          </span>
          {!compact ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{brandName}</span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visibleNavigationGroups.map((group) => (
          <div key={group.label}>
            {!compact ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-faint)]">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = iconMap[item.icon];
                const active = isActive(item.href, pathname);
                const unread = !active ? (unreadCounts[getBadgeHref(item.href)] ?? 0) : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={compact ? item.label : undefined}
                    className={cn(
                      "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--admin-ring)]",
                      active
                        ? "bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
                        : "text-[var(--admin-muted)] hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]",
                      compact ? "justify-center px-2" : "",
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!compact ? (
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    ) : null}
                    {!compact && unread > 0 ? (
                      <span className="rounded-full bg-[var(--admin-danger-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--admin-danger)]">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-[var(--admin-border)] p-3">
        <Link
          href="/admin/profile"
          title={compact ? "Профиль администратора" : undefined}
          className={cn(
            "flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-xs)] transition hover:text-[var(--admin-text)]",
            compact ? "px-2" : "",
          )}
        >
          <UserRound className="h-4 w-4" />
          {!compact ? "Профиль" : null}
        </Link>
        <a
          href={publicSiteHref}
          target="_blank"
          rel="noreferrer"
          title={compact ? "Открыть сайт" : undefined}
          className={cn(
            "flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--admin-primary-border)] bg-[var(--admin-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--admin-primary)] transition hover:bg-[#dff2ef]",
            compact ? "px-2" : "",
          )}
        >
          <ExternalLink className="h-4 w-4" />
          {!compact ? "Открыть сайт" : null}
        </a>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title={compact ? "Выйти" : undefined}
          className={cn(
            "flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--admin-danger-border)] bg-[var(--admin-danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--admin-danger)] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70",
            compact ? "px-2" : "",
          )}
        >
          <LogOut className="h-4 w-4" />
          {!compact ? (loggingOut ? "Выходим..." : "Выйти") : null}
        </button>
      </div>
    </div>
  );

  return (
    <AdminShellContext.Provider value={currentAdmin}>
      <div className="admin-shell min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] lg:flex",
          sidebarCollapsed ? "w-[88px]" : "w-[264px]",
        )}
      >
        {sidebarContent(sidebarCollapsed)}
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[padding] lg:pl-[264px]",
          sidebarCollapsed && "lg:pl-[88px]",
        )}
      >
        <header className="sticky top-0 z-30 border-b border-[var(--admin-border)] bg-[rgba(248,247,244,0.92)] backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-[var(--admin-muted)] shadow-[var(--admin-shadow-xs)] transition hover:text-[var(--admin-text)] lg:hidden"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-[var(--admin-muted)] shadow-[var(--admin-shadow-xs)] transition hover:text-[var(--admin-text)] lg:flex"
              aria-label={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4.5 w-4.5" />
              ) : (
                <ChevronLeft className="h-4.5 w-4.5" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="relative hidden max-w-[560px] lg:block">
                <div className="flex items-center rounded-xl border border-[var(--admin-border)] bg-white px-3 shadow-[var(--admin-shadow-xs)] focus-within:ring-4 focus-within:ring-[var(--admin-ring)]">
                  <Search className="h-4.5 w-4.5 shrink-0 text-[var(--admin-faint)]" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && searchResults[0]) {
                        event.preventDefault();
                        openSearchResult(searchResults[0].href);
                      }

                      if (event.key === "Escape") {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }
                    }}
                    aria-label="Поиск по разделам админки"
                    placeholder="Поиск: объекты, экскурсии, оплаты, админы..."
                    className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-faint)]"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      className="rounded-lg p-1 text-[var(--admin-faint)] transition hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]"
                      aria-label="Очистить поиск"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-muted-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--admin-muted)]">
                      Ctrl+K
                    </span>
                  )}
                </div>

                {searchOpen && searchQuery ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-white p-2 shadow-[var(--admin-shadow-lg)]">
                    {searchResults.length > 0 ? (
                      searchResults.map((item) => {
                        const Icon = iconMap[item.icon];
                        return (
                          <button
                            key={`${item.group}:${item.href}:${item.label}`}
                            type="button"
                            onClick={() => openSearchResult(item.href)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--admin-primary-soft)]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-muted-surface)] text-[var(--admin-primary)]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[var(--admin-text)]">
                                {item.label}
                              </span>
                              <span className="block truncate text-[12px] text-[var(--admin-muted)]">
                                {item.group}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-sm text-[var(--admin-muted)]">
                        Ничего не найдено. Попробуйте другой запрос.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="lg:hidden">
                <p className="truncate text-sm font-semibold text-[var(--admin-text)]">
                  {getPageTitle(pathname)}
                </p>
                <p className="truncate text-[12px] text-[var(--admin-muted)]">{brandName}</p>
              </div>
            </div>

            {visibleQuickActions.length > 0 ? (
              <details className="group relative hidden sm:block">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,127,115,0.18)] transition hover:bg-[var(--admin-primary-hover)]">
                  <Plus className="h-4 w-4" />
                  Быстрое действие
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-white p-2 shadow-[var(--admin-shadow-lg)]">
                  {visibleQuickActions.map((item) => {
                    const Icon = iconMap[item.icon];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--admin-muted)] transition hover:bg-[var(--admin-primary-soft)] hover:text-[var(--admin-primary)]"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((value) => !value)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-[var(--admin-muted)] shadow-[var(--admin-shadow-xs)] transition hover:text-[var(--admin-text)]"
                aria-label="Уведомления"
              >
                <MessageSquareText className="h-4.5 w-4.5" />
                {unreadTotal > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--admin-danger)] px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-white shadow-[var(--admin-shadow-lg)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-text)]">Уведомления</p>
                      <p className="text-[12px] text-[var(--admin-muted)]">
                        {unreadTotal > 0 ? `Новых событий: ${unreadTotal}` : "Новых событий нет"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void refreshNotifications()}
                        className="rounded-lg p-2 text-[var(--admin-muted)] transition hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]"
                        aria-label="Обновить уведомления"
                        disabled={notificationsLoading}
                      >
                        <RefreshCw
                          className={cn("h-4 w-4", notificationsLoading && "animate-spin")}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={markNotificationsSeen}
                        className="rounded-lg p-2 text-[var(--admin-muted)] transition hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]"
                        aria-label="Отметить как просмотрено"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {notificationsError ? (
                    <div className="flex items-start gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-danger-soft)] px-4 py-3 text-sm text-[var(--admin-danger)]">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      {notificationsError}
                    </div>
                  ) : null}

                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {notifications.categories.some((item) => item.count > 0) ? (
                      notifications.categories.map((item) => {
                        const unread = unreadCounts[getBadgeHref(item.href)] ?? 0;
                        const tone =
                          item.severity === "danger"
                            ? "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]"
                            : item.severity === "warning"
                              ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
                              : item.severity === "info"
                                ? "bg-[var(--admin-info-soft)] text-[var(--admin-info)]"
                                : "bg-[var(--admin-muted-surface)] text-[var(--admin-muted)]";

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-[var(--admin-muted-surface)]"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                                tone,
                              )}
                            >
                              {item.count}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold text-[var(--admin-text)]">
                                  {item.label}
                                </span>
                                {unread > 0 ? (
                                  <span className="shrink-0 rounded-full bg-[var(--admin-danger)] px-2 py-0.5 text-[10px] font-bold text-white">
                                    new
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block text-[12px] leading-5 text-[var(--admin-muted)]">
                                {item.description}
                              </span>
                              <span className="mt-1 block text-[11px] text-[var(--admin-faint)]">
                                {formatNotificationTime(item.latestAt)}
                              </span>
                            </span>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <MessageSquareText className="mx-auto h-7 w-7 text-[var(--admin-faint)]" />
                        <p className="mt-3 text-sm font-semibold text-[var(--admin-text)]">
                          Всё спокойно
                        </p>
                        <p className="mt-1 text-sm text-[var(--admin-muted)]">
                          Новых очередей и сообщений сейчас нет.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <Link
              href="/admin/help"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-[var(--admin-muted)] shadow-[var(--admin-shadow-xs)] transition hover:text-[var(--admin-text)] sm:flex"
              aria-label="Помощь"
            >
              <CircleHelp className="h-4.5 w-4.5" />
            </Link>

            <details className="group relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white px-2 shadow-[var(--admin-shadow-xs)]">
                <span className="flex h-7 w-7 overflow-hidden rounded-lg bg-[var(--admin-primary-soft)] text-[12px] font-bold text-[var(--admin-primary)]">
                  {currentAdmin.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentAdmin.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      {getBrandInitials(currentAdmin.displayName)}
                    </span>
                  )}
                </span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-[150px] truncate text-[13px] font-semibold">
                    {currentAdmin.displayName}
                  </span>
                  <span className="block text-[11px] text-[var(--admin-muted)]">{roleLabel}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-[var(--admin-faint)] transition group-open:rotate-180 sm:block" />
              </summary>
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-white p-2 shadow-[var(--admin-shadow-lg)]">
                <Link
                  href="/admin/profile"
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--admin-muted)] transition hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]"
                >
                  Профиль администратора
                </Link>
                {hasAdminPermission(currentAdmin.role, "admins:manage") ? (
                  <Link
                    href="/admin/admins"
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--admin-muted)] transition hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]"
                  >
                    Администраторы и роли
                  </Link>
                ) : null}
                <Link
                  href="/admin/help"
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--admin-muted)] transition hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]"
                >
                  Помощь
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--admin-danger)] transition hover:bg-[var(--admin-danger-soft)] disabled:opacity-70"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Выходим..." : "Выйти"}
                </button>
              </div>
            </details>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/28 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col overflow-hidden border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] shadow-[var(--admin-shadow-lg)]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-[var(--admin-muted)]"
              aria-label="Закрыть меню"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            {sidebarContent(false)}
          </aside>
        </div>
      ) : null}
      </div>
    </AdminShellContext.Provider>
  );
}
