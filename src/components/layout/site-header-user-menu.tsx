"use client";

import { ChevronDown, Heart, House } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type SiteHeaderUserMenuProps = {
  user: {
    firstName: string;
    lastName: string;
    role: "USER" | "ADMIN";
    avatarUrl: string | null;
    initials: string;
  };
};

export function SiteHeaderUserMenu({ user }: SiteHeaderUserMenuProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeMenuTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userMenuTransitionMs = 200;

  const dashboardHref = user.role === "ADMIN" ? "/admin" : "/dashboard";
  // Keep menu compact and role-specific: admin gets single entrypoint, owner gets workspace links.
  const menuItems =
    user.role === "ADMIN"
      ? [{ href: "/admin", label: "Админ-панель" }]
      : [
          { href: "/dashboard", label: "Мои объявления" },
          { href: "/dashboard/chessboard", label: "Шахматка" },
          { href: "/dashboard/profile", label: "Настройки профиля" },
        ];

  const clearCloseMenuTimer = useCallback(() => {
    if (closeMenuTimerRef.current === null) {
      return;
    }

    window.clearTimeout(closeMenuTimerRef.current);
    closeMenuTimerRef.current = null;
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    clearCloseMenuTimer();
    closeMenuTimerRef.current = window.setTimeout(() => {
      setIsMenuMounted(false);
      closeMenuTimerRef.current = null;
    }, userMenuTransitionMs);
  }, [clearCloseMenuTimer]);

  const openMenu = useCallback(() => {
    clearCloseMenuTimer();
    setIsMenuMounted(true);
    setIsOpen(true);
  }, [clearCloseMenuTimer]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [closeMenu]);

  useEffect(
    () => () => {
      clearCloseMenuTimer();
    },
    [clearCloseMenuTimer],
  );

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
      closeMenu();
    }
  }

  return (
    <div ref={containerRef} className="flex items-center gap-1.5">
      <Link
        href="/favorites"
        aria-label="Избранное"
        title="Избранное"
        className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px]"
      >
        <AppIcon icon={Heart} className="h-5 w-5 text-[color:var(--icon-highlight)]" />
      </Link>

      <Link
        href={dashboardHref}
        aria-label="Мои объекты"
        title="Мои объекты"
        className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px]"
      >
        <AppIcon icon={House} className="h-5 w-5 text-[color:var(--icon-stay)]" />
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              closeMenu();
              return;
            }

            openMenu();
          }}
          aria-label="Меню пользователя"
          aria-expanded={isOpen}
          className="inline-flex h-11 items-center gap-1.5 rounded-[15px] border border-white/70 bg-white/76 px-1.5 text-olive/85 shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-primary/16 hover:bg-white/90 hover:text-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(180deg,rgba(242,196,77,0.36),rgba(255,245,214,0.92))] ring-1 ring-white/75 shadow-[0_6px_16px_rgba(15,118,110,0.08)]">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="Профиль" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-olive/80">{user.initials || "?"}</span>
            )}
          </span>
          <AppIcon
            icon={ChevronDown}
            className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")}
          />
        </button>

        {isMenuMounted ? (
          <div
            className={cn(
              "absolute right-0 z-40 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-olive/15 bg-white shadow-xl origin-top-right transition-all duration-200 ease-out",
              isOpen
                ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
                : "pointer-events-none -translate-y-2 scale-95 opacity-0",
            )}
          >
            <div className="border-b border-olive/10 px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-olive">
                {[user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Пользователь"}
              </p>
            </div>

            <div className="p-1.5">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex rounded-lg px-3 py-2 text-sm text-olive/88 transition hover:bg-cream"
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => void onLogout()}
                disabled={isLoggingOut}
                className="mt-1 flex w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isLoggingOut ? "Выход..." : "Выйти"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
