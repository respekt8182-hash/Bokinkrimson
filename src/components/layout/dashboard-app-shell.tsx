"use client";

import {
  Globe2,
  House,
  LayoutGrid,
  LogOut,
  Menu,
  MessagesSquare,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

// Global owner-dashboard shell:
// - top desktop nav
// - mobile drawer navigation
// - shared profile/menu framing
type DashboardUser = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  initials: string;
};

type DashboardAppShellProps = {
  user: DashboardUser;
  children: React.ReactNode;
};

type TopNavItemKey = "home" | "chessboard" | "reviews" | "payments";
type DrawerItemKey = TopNavItemKey | "profile";

type NavItem = {
  key: TopNavItemKey;
  label: string;
  href: string;
  icon: IconName;
};

type DrawerItem = {
  key: DrawerItemKey;
  label: string;
  href: string;
  icon: IconName;
};

type IconName =
  | "menu"
  | "home"
  | "chessboard"
  | "reviews"
  | "payments"
  | "profile"
  | "site"
  | "logout"
  | "close";

const topNavItems: NavItem[] = [
  { key: "home", label: "Главная", href: "/dashboard", icon: "home" },
  { key: "chessboard", label: "Шахматка", href: "/dashboard/chessboard", icon: "chessboard" },
  { key: "reviews", label: "Отзывы", href: "/dashboard/reviews", icon: "reviews" },
  { key: "payments", label: "Оплата", href: "/dashboard/payments", icon: "payments" },
];

const drawerItems: DrawerItem[] = [
  { key: "home", label: "Главная", href: "/dashboard", icon: "home" },
  { key: "chessboard", label: "Шахматка", href: "/dashboard/chessboard", icon: "chessboard" },
  { key: "reviews", label: "Отзывы", href: "/dashboard/reviews", icon: "reviews" },
  { key: "payments", label: "Оплата", href: "/dashboard/payments", icon: "payments" },
  { key: "profile", label: "Настройки профиля", href: "/dashboard/profile", icon: "profile" },
];

// Object pages are mapped back to top-level "home" tab, while feature pages keep dedicated tabs.
function resolveActiveMenuKey(pathname: string): DrawerItemKey | null {
  if (pathname.startsWith("/dashboard/chessboard") || pathname.endsWith("/chessboard")) {
    return "chessboard";
  }

  if (pathname.startsWith("/dashboard/payments") || pathname.endsWith("/payment")) {
    return "payments";
  }

  if (pathname.startsWith("/dashboard/reviews")) {
    return "reviews";
  }

  if (pathname.startsWith("/dashboard/profile")) {
    return "profile";
  }

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/objects") ||
    pathname.startsWith("/dashboard/excursions") ||
    pathname.startsWith("/dashboard/transfers")
  ) {
    return "home";
  }

  return null;
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const iconByName: Record<IconName, LucideIcon> = {
    menu: Menu,
    home: House,
    chessboard: LayoutGrid,
    reviews: MessagesSquare,
    payments: WalletCards,
    profile: UserRound,
    site: Globe2,
    logout: LogOut,
    close: X,
  };

  return <AppIcon icon={iconByName[name]} className={cn("h-5 w-5", className)} />;
}

function IconShell({
  children,
  active = false,
  compact = false,
}: {
  children: React.ReactNode;
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        compact ? "h-8 w-8 rounded-xl" : "h-9 w-9 rounded-[14px]",
        active ? "icon-surface" : "icon-surface-muted",
      )}
    >
      {children}
    </span>
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

export function DashboardAppShell({ user, children }: DashboardAppShellProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const burgerButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeKey = useMemo(() => resolveActiveMenuKey(pathname), [pathname]);
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Пользователь";

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  function openDrawer() {
    setIsDrawerOpen(true);
  }

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function onOverlayClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    closeDrawer();
  }

  function onDrawerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
    }
  }

  useEffect(() => {
    closeDrawer();
  }, [pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleDesktopChange = ({ matches }: { matches: boolean }) => {
      if (matches) {
        setIsDrawerOpen(false);
      }
    };
    const listener = (event: MediaQueryListEvent) => handleDesktopChange(event);

    handleDesktopChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  // Keep focus trapped inside drawer and return focus back to the burger button when closing.
  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    const drawer = drawerRef.current;
    if (!drawer) {
      return;
    }

    const focusables = getFocusableElements(drawer);
    focusables[0]?.focus();

    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (!drawerRef.current) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentFocusables = getFocusableElements(drawerRef.current);
      if (currentFocusables.length === 0) {
        return;
      }

      const firstElement = currentFocusables[0];
      const lastElement = currentFocusables[currentFocusables.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement || !drawerRef.current.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleGlobalKeyDown);
    const returnFocusElement = burgerButtonRef.current;

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleGlobalKeyDown);
      returnFocusElement?.focus();
    };
  }, [isDrawerOpen]);

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-olive/10 bg-cream/92 text-olive backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-3 px-3 md:px-6">
          <button
            ref={burgerButtonRef}
            type="button"
            aria-label="Открыть меню личного кабинета"
            aria-expanded={isDrawerOpen}
            aria-controls="dashboard-drawer"
            onClick={() => {
              if (isDrawerOpen) {
                closeDrawer();
              } else {
                openDrawer();
              }
            }}
            className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px] focus-visible:outline-none lg:hidden"
          >
            <Icon name="menu" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-3 min-w-0 lg:flex-none">
            <Image
              src="/favicon.svg"
              alt="Логотип Крым вокруг"
              width={44}
              height={44}
              priority
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate font-heading text-lg tracking-wide text-olive md:text-xl">
                Крым вокруг
              </p>
              <p className="truncate text-[11px] uppercase tracking-[0.16em] text-olive/60">
                Личный кабинет
              </p>
            </div>
          </Link>

          <nav className="ml-auto hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:ml-6">
            {topNavItems.map((item) => {
              const isActive = activeKey === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-white/82 text-olive shadow-[0_12px_26px_rgba(15,118,110,0.08)]"
                      : "text-olive/80 hover:bg-white/72",
                  )}
                >
                  <IconShell active={isActive} compact>
                    <Icon name={item.icon} className="h-4 w-4" />
                  </IconShell>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/"
              aria-label="На сайт"
              title="На сайт"
              className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-white/70 bg-white/76 px-2.5 text-sm font-medium text-olive/85 shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] transition hover:border-primary/16 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <IconShell compact>
                <Icon name="site" className="h-4 w-4" />
              </IconShell>
              <span className="hidden xl:inline">На сайт</span>
            </Link>

            <Link
              href="/dashboard/profile"
              aria-label="Настройки профиля"
              title="Настройки профиля"
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-[15px] border px-1.5 pr-3 text-sm font-medium shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                activeKey === "profile"
                  ? "border-white/80 bg-white/86 text-olive"
                  : "border-white/70 bg-white/76 text-olive/85 hover:border-primary/16 hover:bg-white/90",
              )}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(180deg,rgba(242,196,77,0.36),rgba(255,245,214,0.92))] ring-1 ring-white/75 shadow-[0_6px_16px_rgba(15,118,110,0.08)]">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt="Аватар пользователя"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-olive/80">
                    {user.initials || "?"}
                  </span>
                )}
              </span>
              <span className="hidden max-w-[170px] truncate xl:block">{displayName}</span>
            </Link>

            <button
              type="button"
              onClick={() => void onLogout()}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Выход..." : "Выход"}
              title={isLoggingOut ? "Выход..." : "Выход"}
              className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-red-100 bg-white/76 px-2.5 text-sm font-medium text-red-700 shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] transition hover:bg-red-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 ring-1 ring-red-100">
                <Icon name="logout" className="h-4 w-4" />
              </span>
              <span className="hidden xl:inline">{isLoggingOut ? "Выход..." : "Выход"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pt-16">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
          <section className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5">
            {children}
          </section>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[70] lg:hidden",
          isDrawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={onOverlayClick}
          className={cn(
            "absolute inset-0 bg-midnight/55 transition-opacity",
            isDrawerOpen ? "opacity-100" : "opacity-0",
          )}
        />

        <aside
          id="dashboard-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Меню личного кабинета"
          onKeyDown={onDrawerKeyDown}
          className={cn(
            "absolute left-0 top-0 h-full w-[88vw] max-w-[340px] overflow-y-auto bg-white shadow-2xl transition-transform",
            isDrawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-olive/10 px-4 py-3">
            <p className="text-sm font-semibold text-olive">Меню</p>
            <button
              type="button"
              onClick={closeDrawer}
              className="icon-button-soft inline-flex h-10 w-10 items-center justify-center rounded-[14px]"
              aria-label="Закрыть меню"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="border-b border-olive/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 overflow-hidden rounded-full bg-cream ring-1 ring-olive/20">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt="Аватар пользователя"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-olive/75">
                    {user.initials}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-olive">{displayName}</p>
                <p className="text-xs text-olive/65">Личный кабинет</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 px-3 py-3">
            {drawerItems.map((item) => {
              const isActive = activeKey === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={closeDrawer}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-white/86 text-olive shadow-[0_10px_24px_rgba(15,118,110,0.08)]"
                      : "text-olive/85 hover:bg-white/70",
                  )}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <IconShell active={isActive} compact>
                      <Icon name={item.icon} className="h-4 w-4" />
                    </IconShell>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 border-t border-olive/10 px-3 py-3">
            <Link
              href="/"
              onClick={closeDrawer}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-olive/85 transition hover:bg-white/70"
            >
              <IconShell compact>
                <Icon name="site" className="h-4 w-4" />
              </IconShell>
              На сайт
            </Link>

            <button
              type="button"
              onClick={() => void onLogout()}
              disabled={isLoggingOut}
              className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconShell compact>
                <Icon name="logout" className="h-4 w-4" />
              </IconShell>
              {isLoggingOut ? "Выход..." : "Выход"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
