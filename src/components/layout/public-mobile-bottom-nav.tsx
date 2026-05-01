"use client";

import { Heart, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import {
  isPublicMobileBottomNavForceHidden,
  PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_EVENT,
  PUBLIC_MOBILE_BOTTOM_NAV_PROGRESS_EVENT,
  type PublicMobileBottomNavProgressDetail,
} from "@/lib/public-mobile-nav-visibility";

type PublicMobileBottomNavProps = {
  accountHref: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const MOBILE_CHROME_TOP_RESET = 72;
const MOBILE_CHROME_SCROLL_RANGE = 140;
const MOBILE_CHROME_NAV_TRAVEL = 130;
const MOBILE_CHROME_MAP_TRAVEL = 78;

function getPathSegments(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

export function isPublicDetailRoute(pathname: string) {
  const segments = getPathSegments(pathname);

  if (segments[0] === "crimea" && segments[1] === "excursions" && segments.length >= 4) {
    return true;
  }

  if (segments[0] === "crimea" && segments.length >= 3) {
    return true;
  }

  if (segments[0] === "transfers" && segments.length >= 2) {
    return true;
  }

  if (segments[0] === "attractions" && segments.length >= 2) {
    return true;
  }

  return false;
}

export function shouldShowPublicMobileBottomNav(pathname: string) {
  return (
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/dashboard") &&
    !isPublicDetailRoute(pathname)
  );
}

export function PublicMobileBottomNav({ accountHref }: PublicMobileBottomNavProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const visibilityKey = `${pathname}?${searchKey}`;
  const [chromeState, setChromeState] = useState({
    key: visibilityKey,
    progress: 0,
  });
  const [forceHidden, setForceHidden] = useState(false);

  const showNav = shouldShowPublicMobileBottomNav(pathname);
  const hideOnScroll = showNav;
  const chromeProgress = chromeState.key === visibilityKey ? chromeState.progress : 0;
  const chromeProgressRef = useRef(chromeProgress);

  useEffect(() => {
    const syncForceHidden = () => {
      setForceHidden(isPublicMobileBottomNavForceHidden());
    };

    syncForceHidden();
    window.addEventListener(PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_EVENT, syncForceHidden);

    return () => {
      window.removeEventListener(PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_EVENT, syncForceHidden);
    };
  }, [visibilityKey]);

  useEffect(() => {
    chromeProgressRef.current = chromeProgress;
    document.documentElement.style.setProperty(
      "--public-mobile-chrome-progress",
      chromeProgress.toFixed(3),
    );
    document.documentElement.style.setProperty(
      "--public-mobile-map-offset",
      `${Math.round(chromeProgress * MOBILE_CHROME_MAP_TRAVEL)}px`,
    );
  }, [chromeProgress]);

  useEffect(() => {
    if (!hideOnScroll) {
      return;
    }

    const root = document.documentElement;

    function handleExternalProgress(event: Event) {
      const progress = (event as CustomEvent<PublicMobileBottomNavProgressDetail>).detail
        ?.progress;

      if (typeof progress !== "number" || !Number.isFinite(progress)) {
        return;
      }

      const nextProgress = Math.max(0, Math.min(1, Math.round(progress * 1000) / 1000));
      chromeProgressRef.current = nextProgress;
      root.style.setProperty("--public-mobile-chrome-progress", nextProgress.toFixed(3));
      root.style.setProperty(
        "--public-mobile-map-offset",
        `${Math.round(nextProgress * MOBILE_CHROME_MAP_TRAVEL)}px`,
      );

      setChromeState((previous) => {
        if (
          previous.key === visibilityKey &&
          Math.abs(previous.progress - nextProgress) < 0.004
        ) {
          return previous;
        }

        return { key: visibilityKey, progress: nextProgress };
      });
    }

    window.addEventListener(PUBLIC_MOBILE_BOTTOM_NAV_PROGRESS_EVENT, handleExternalProgress);

    return () => {
      window.removeEventListener(PUBLIC_MOBILE_BOTTOM_NAV_PROGRESS_EVENT, handleExternalProgress);
    };
  }, [hideOnScroll, visibilityKey]);

  useEffect(() => {
    const root = document.documentElement;

    function commitProgress(nextProgress: number, shouldUpdateState = false) {
      const progress = Math.max(0, Math.min(1, Math.round(nextProgress * 1000) / 1000));
      chromeProgressRef.current = progress;
      root.style.setProperty("--public-mobile-chrome-progress", progress.toFixed(3));
      root.style.setProperty(
        "--public-mobile-map-offset",
        `${Math.round(progress * MOBILE_CHROME_MAP_TRAVEL)}px`,
      );
      if (!shouldUpdateState) {
        return;
      }

      setChromeState((previous) => {
        if (previous.key === visibilityKey && Math.abs(previous.progress - progress) < 0.004) {
          return previous;
        }

        return { key: visibilityKey, progress };
      });
    }

    if (!hideOnScroll) {
      commitProgress(0);
      return;
    }

    let previousY = window.scrollY;
    let ticking = false;
    commitProgress(window.scrollY < MOBILE_CHROME_TOP_RESET ? 0 : chromeProgressRef.current);

    function handleScroll() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - previousY;
        const nextProgress =
          currentY < MOBILE_CHROME_TOP_RESET
            ? 0
            : chromeProgressRef.current + delta / MOBILE_CHROME_SCROLL_RANGE;

        commitProgress(nextProgress, true);

        previousY = currentY;
        ticking = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hideOnScroll, visibilityKey]);

  if (!showNav) {
    return null;
  }

  const navProgress = forceHidden ? 1 : chromeProgress;
  const navStyle = {
    transform: `translate3d(0, ${navProgress * MOBILE_CHROME_NAV_TRAVEL}%, 0)`,
    opacity: forceHidden ? 0 : Math.max(0, 1 - chromeProgress * 1.12),
    pointerEvents: forceHidden || chromeProgress > 0.92 ? "none" : undefined,
  } satisfies CSSProperties;

  const items: NavItem[] = [
    {
      href: "/",
      label: "Поиск",
      icon: Search,
      isActive: (currentPathname) => currentPathname === "/",
    },
    {
      href: "/favorites",
      label: "Избранное",
      icon: Heart,
      isActive: (currentPathname) => currentPathname.startsWith("/favorites"),
    },
    {
      href: accountHref,
      label: "Профиль",
      icon: UserRound,
      isActive: (currentPathname) =>
        currentPathname.startsWith("/dashboard") ||
        currentPathname.startsWith("/auth") ||
        currentPathname.startsWith("/admin"),
    },
  ];

  return (
    <nav
      aria-label="Быстрая навигация"
      className={cn(
        "fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[430px] rounded-[28px] border border-white/80 bg-white/88 px-2 py-2 shadow-[0_18px_46px_rgba(58,43,35,0.18)] backdrop-blur-xl transition-[transform,opacity] duration-300 ease-out will-change-transform lg:hidden",
      )}
      style={navStyle}
    >
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => {
          const active = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-[22px] px-2 text-[11px] font-semibold transition active:scale-[0.97]",
                active
                  ? "bg-[linear-gradient(135deg,rgba(15,118,110,0.14),rgba(242,196,77,0.18))] text-olive shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]"
                  : "text-olive/62 hover:bg-cream/70 hover:text-olive",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-2xl",
                  active ? "icon-surface" : "icon-surface-muted",
                )}
              >
                <AppIcon icon={item.icon} className="h-[17px] w-[17px]" />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
