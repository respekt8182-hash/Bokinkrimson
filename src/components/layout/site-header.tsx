// UI component for site header in the layout module.
import { Heart, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { SiteHeaderUserMenu } from "@/components/layout/site-header-user-menu";
import { getSession } from "@/lib/auth";
import { getOptionalSessionUserProfile } from "@/lib/session-user-profile";

export async function SiteHeader() {
  const session = await getSession();
  const profile = session ? await getOptionalSessionUserProfile(session.id) : null;

  const firstName = profile?.firstName ?? session?.firstName ?? "";
  const lastName = profile?.lastName ?? session?.lastName ?? "";
  const initials = (
    firstName.trim().slice(0, 1) ||
    lastName.trim().slice(0, 1) ||
    "?"
  ).toUpperCase();

  return (
    // Must stay above search filters (z-30) so profile dropdown is never hidden behind page content.
    <header className="sticky top-0 z-50 border-b border-olive/10 bg-cream/92 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-1 py-1">
          <Image
            src="/favicon.svg"
            alt="Логотип Крым вокруг"
            width={56}
            height={56}
            priority
            className="h-12 w-12 md:h-14 md:w-14"
          />
          <div className="leading-tight">
            <p className="font-heading text-xl tracking-wide text-olive sm:text-2xl md:text-3xl">
              Крым вокруг
            </p>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-olive/65 md:block">
              жильё у моря и экскурсии
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-1.5 whitespace-nowrap">
          {session ? (
            <SiteHeaderUserMenu
              user={{
                firstName,
                lastName,
                role: session.role,
                avatarUrl: profile?.avatarUrl ?? null,
                initials,
              }}
            />
          ) : (
            <>
              <Link
                href="/favorites"
                aria-label="Избранное"
                title="Избранное"
                className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px]"
              >
                <AppIcon icon={Heart} className="h-5 w-5 text-[color:var(--icon-highlight)]" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-white/70 bg-white/76 px-3.5 text-sm font-semibold text-olive/90 shadow-[0_10px_26px_rgba(15,118,110,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] transition hover:border-primary/16 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <span className="icon-surface-muted inline-flex h-8 w-8 items-center justify-center rounded-xl">
                  <AppIcon icon={UserRound} className="h-4 w-4 text-[color:var(--icon-identity)]" />
                </span>
                Вход
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
