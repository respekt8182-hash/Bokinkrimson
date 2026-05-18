"use client";

import {
  Compass,
  Car,
  Heart,
  House,
  Info,
  Landmark,
  Menu,
  MessageCircleMore,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { isDrawerLinkActive } from "@/components/layout/site-header-mobile-drawer-link-state";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/cn";
import {
  attractionsHubPath,
  excursionsHubPath,
  housingHubPath,
  toursHubPath,
  transfersHubPath,
} from "@/lib/seo/routes";

type SiteHeaderMobileDrawerProps = {
  accountHref: string;
  accountLabel: string;
  isAuthenticated: boolean;
};

type DrawerLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const primaryLinks: DrawerLink[] = [
  { href: housingHubPath, label: "Жильё", icon: House },
  { href: excursionsHubPath, label: "Экскурсии", icon: Compass },
  { href: attractionsHubPath, label: "Досуг", icon: Landmark },
  { href: transfersHubPath, label: "Трансферы", icon: Car },
  { href: toursHubPath, label: "Туры", icon: Compass },
  { href: "/about", label: "О сервисе", icon: Info, exact: true },
  { href: "/cooperation", label: "Сотрудничество", icon: MessageCircleMore, exact: true },
];

const utilityLinks: DrawerLink[] = [
  { href: "/favorites", label: "Избранное", icon: Heart, exact: true },
  {
    href: "/consent",
    label: "Согласие на обработку данных",
    icon: ShieldCheck,
    exact: true,
  },
];

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

export function SiteHeaderMobileDrawer({
  accountHref,
  accountLabel,
  isAuthenticated,
}: SiteHeaderMobileDrawerProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const portalHost = typeof document === "undefined" ? null : document.body;

  useBodyScrollLock(isOpen);

  const accountLinks = useMemo<DrawerLink[]>(
    () => [
      {
        href: accountHref,
        label: accountLabel,
        icon: isAuthenticated ? ShieldCheck : UserRound,
        exact: accountHref === "/auth/login",
      },
    ],
    [accountHref, accountLabel, isAuthenticated],
  );

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const drawer = drawerRef.current;
    if (!drawer) {
      return;
    }

    const focusables = getFocusableElements(drawer);
    focusables[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
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

      const elements = getFocusableElements(drawerRef.current);
      if (elements.length === 0) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !drawerRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const triggerElement = triggerRef.current;

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [isOpen, closeDrawer]);

  function onDrawerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
    }
  }

  function renderLink(link: DrawerLink) {
    const active = isDrawerLinkActive({
      pathname,
      searchParams,
      href: link.href,
      exact: link.exact,
    });

    return (
      <Link
        key={link.href}
        href={link.href}
        prefetch={false}
        onClick={closeDrawer}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition",
          active
            ? "bg-[linear-gradient(135deg,rgba(15,118,110,0.14),rgba(14,116,144,0.1))] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
            : "text-olive/78 hover:bg-sand/70 hover:text-olive",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            active
              ? "bg-white/84 text-primary shadow-[0_10px_24px_rgba(15,118,110,0.12)]"
              : "bg-white/78 text-olive/58",
          )}
        >
          <AppIcon icon={link.icon} className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">{link.label}</span>
      </Link>
    );
  }

  const drawer = (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        aria-label="Закрыть меню"
        onClick={closeDrawer}
        className="absolute inset-0 bg-[rgba(43,31,25,0.56)] backdrop-blur-[2px]"
      />

      <div className="absolute inset-y-0 right-0 w-[min(88vw,360px)] max-w-[360px]">
        <aside
          id="site-mobile-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Навигация по сайту"
          onKeyDown={onDrawerKeyDown}
          className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-l-[30px] border-l border-white/40 bg-[#f6f2eb]/98 shadow-[0_24px_70px_rgba(43,31,25,0.28)] backdrop-blur-xl"
        >
          <div className="border-b border-olive/10 px-4 pb-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.2rem))]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-olive/38">
                  Навигация
                </p>
                <p className="mt-2 text-lg font-semibold text-olive">Крым Вокруг</p>
                <p className="mt-1 text-sm text-olive/64">Жильё у моря и экскурсии по Крыму</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="icon-button-soft inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
                aria-label="Закрыть меню"
              >
                <AppIcon icon={X} className="h-4 w-4 text-[color:var(--icon-nav)]" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+1rem))] pt-4">
            <div>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-olive/38">
                Разделы
              </p>
              <nav className="mt-2 space-y-1.5">{primaryLinks.map(renderLink)}</nav>
            </div>

            <div className="mt-5">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-olive/38">
                Аккаунт
              </p>
              <nav className="mt-2 space-y-1.5">
                {accountLinks.map(renderLink)}
                {utilityLinks.map(renderLink)}
              </nav>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Открыть меню"
        aria-expanded={isOpen}
        aria-controls="site-mobile-drawer"
        onClick={() => setIsOpen(true)}
        className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px] focus-visible:outline-none"
      >
        <AppIcon icon={Menu} className="h-5 w-5 text-[color:var(--icon-nav)]" />
      </button>

      {isOpen && portalHost ? createPortal(drawer, portalHost) : null}
    </div>
  );
}
