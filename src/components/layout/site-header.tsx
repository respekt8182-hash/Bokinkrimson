import { Heart, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PublicMobileBottomNav } from "@/components/layout/public-mobile-bottom-nav";
import {
  SiteHeaderBackButton,
  SiteHeaderShareButton,
} from "@/components/layout/site-header-context-actions";
import { SiteHeaderMobileDrawer } from "@/components/layout/site-header-mobile-drawer";
import { SiteHeaderUserMenu } from "@/components/layout/site-header-user-menu";
import { UserActivityTracker } from "@/components/auth/user-activity-tracker";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import {
  attractionsHubPath,
  excursionsHubPath,
  housingHubPath,
  toursHubPath,
  transfersHubPath,
} from "@/lib/seo/routes";

export async function SiteHeader() {
  const session = await getSession();
  const firstName = session?.firstName ?? "";
  const initials = (firstName.trim().slice(0, 1) || "?").toUpperCase();
  const accountHref = session
    ? session.role === "ADMIN"
      ? "/admin"
      : "/dashboard"
    : "/auth/login";
  const accountLabel = session
    ? session.role === "ADMIN"
      ? "Админ-панель"
      : "Личный кабинет"
    : "Войти";

  return (
    <>
      {session?.role === "USER" ? <UserActivityTracker /> : null}
      <header className="sticky top-0 z-50 border-b border-olive/10 bg-cream/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-6 md:py-4">
          <SiteHeaderBackButton />
          <Link
            href="/"
            prefetch={false}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 lg:flex-none"
          >
            <Image
              src="/favicon.svg"
              alt="Логотип Крым Вокруг"
              width={56}
              height={56}
              priority
              className="h-12 w-12 md:h-14 md:w-14"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-heading text-lg tracking-wide text-olive sm:text-2xl md:text-3xl">
                Крым Вокруг
              </p>
              <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-olive/65 md:block">
                Жильё у моря и экскурсии
              </p>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            <Link
              href={housingHubPath}
              prefetch={false}
              className="rounded-xl px-3 py-2 text-sm font-medium text-olive/80 transition hover:bg-white hover:text-olive"
            >
              Жильё
            </Link>
            <Link
              href={excursionsHubPath}
              prefetch={false}
              className="rounded-xl px-3 py-2 text-sm font-medium text-olive/80 transition hover:bg-white hover:text-olive"
            >
              Экскурсии
            </Link>
            <Link
              href={attractionsHubPath}
              prefetch={false}
              className="rounded-xl px-3 py-2 text-sm font-medium text-olive/80 transition hover:bg-white hover:text-olive"
            >
              Досуг
            </Link>
            <Link
              href={transfersHubPath}
              prefetch={false}
              className="rounded-xl px-3 py-2 text-sm font-medium text-olive/80 transition hover:bg-white hover:text-olive"
            >
              Трансферы
            </Link>
            <Link
              href={toursHubPath}
              prefetch={false}
              className="rounded-xl px-3 py-2 text-sm font-medium text-olive/80 transition hover:bg-white hover:text-olive"
            >
              Туры
            </Link>
            <Link
              href="/about"
              prefetch={false}
              className="rounded-xl px-3 py-2 text-sm font-medium text-olive/80 transition hover:bg-white hover:text-olive"
            >
              О сервисе
            </Link>
          </nav>

          <nav className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap lg:flex">
            {session ? (
              <SiteHeaderUserMenu
                user={{
                  firstName,
                  role: session.role,
                  avatarUrl: session.avatarUrl ?? null,
                  initials,
                }}
              />
            ) : (
              <>
                <Link
                  href="/favorites"
                  prefetch={false}
                  aria-label="Избранное"
                  title="Избранное"
                  className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px]"
                >
                  <AppIcon icon={Heart} className="h-5 w-5 text-[color:var(--icon-highlight)]" />
                </Link>
                <Link
                  href="/auth/login"
                  prefetch={false}
                  aria-label="Вход"
                  title="Вход"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[15px] border border-white/70 bg-white/76 text-sm font-semibold text-olive/90 shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] transition hover:border-primary/16 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:hidden"
                >
                  <span className="icon-surface-muted inline-flex h-8 w-8 items-center justify-center rounded-xl">
                    <AppIcon
                      icon={UserRound}
                      className="h-4 w-4 text-[color:var(--icon-identity)]"
                    />
                  </span>
                </Link>
                <Link
                  href="/auth/login"
                  prefetch={false}
                  className="hidden h-11 items-center gap-2 rounded-[15px] border border-white/70 bg-white/76 px-3.5 text-sm font-semibold text-olive/90 shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] transition hover:border-primary/16 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:inline-flex"
                >
                  <span className="icon-surface-muted inline-flex h-8 w-8 items-center justify-center rounded-xl">
                    <AppIcon
                      icon={UserRound}
                      className="h-4 w-4 text-[color:var(--icon-identity)]"
                    />
                  </span>
                  Вход
                </Link>
              </>
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
            <SiteHeaderShareButton />
            <SiteHeaderMobileDrawer
              accountHref={accountHref}
              accountLabel={accountLabel}
              isAuthenticated={Boolean(session)}
            />
          </div>
        </div>
      </header>
      <PublicMobileBottomNav accountHref={accountHref} />
    </>
  );
}
