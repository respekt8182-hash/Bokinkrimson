"use client";

import {
  BedDouble,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FileText,
  Heart,
  Info,
  LayoutGrid,
  Map,
  Rows3,
  ShieldCheck,
  Sparkles,
  SquareChartGantt,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/cn";
import { formatPublicPersonName } from "@/lib/public-display-name";

// Desktop sidebar:
// - global dashboard navigation
// - object context switcher (previous/next/select)
// - quick links to object sections
type SidebarPropertyItem = {
  id: string;
  name: string | null;
  statusLabel: string;
};

type DashboardSidebarProps = {
  firstName: string;
  avatarUrl: string | null;
  initials: string;
  properties: SidebarPropertyItem[];
};

type ObjectTabItem = {
  slug: string;
  label: string;
  shortLabel: string;
  icon: SidebarIconName;
};

type SidebarIconName =
  | "objects"
  | "plus"
  | "list"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "about"
  | "rules"
  | "documents"
  | "categories"
  | "rooms"
  | "amenities"
  | "chessboard"
  | "payment"
  | "excursions"
  | "transfers"
  | "favorites"
  | "profile";

type MainMenuItem = {
  href: string;
  label: string;
  icon: SidebarIconName;
};

// Keep the same sequence as object onboarding sections for predictable navigation.
const objectTabs: ObjectTabItem[] = [
  { slug: "about", label: "Об объекте", shortLabel: "Объект", icon: "about" },
  { slug: "rules", label: "Правила проживания", shortLabel: "Правила", icon: "rules" },
  {
    slug: "room-categories",
    label: "Номера",
    shortLabel: "Номера",
    icon: "rooms",
  },
  {
    slug: "amenities",
    label: "Удобства в номерах",
    shortLabel: "Удобства",
    icon: "amenities",
  },
  { slug: "chessboard", label: "Шахматка", shortLabel: "Шахматка", icon: "chessboard" },
  { slug: "payment", label: "Оплата", shortLabel: "Оплата", icon: "payment" },
];

const mainMenu: MainMenuItem[] = [
  { href: "/dashboard/chessboard", label: "Шахматка", icon: "chessboard" },
  { href: "/dashboard/excursions", label: "Экскурсии", icon: "excursions" },
  { href: "/dashboard/transfers", label: "Трансферы", icon: "transfers" },
  { href: "/dashboard/favorites", label: "Избранное", icon: "favorites" },
  { href: "/dashboard/profile", label: "Профиль", icon: "profile" },
];

function parseObjectContext(pathname: string): { objectId: string | null; sectionSlug: string } {
  // We parse object id/section from the URL to keep sidebar controls in sync with deep links.
  const match = pathname.match(/^\/dashboard\/objects\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (!match) {
    return { objectId: null, sectionSlug: "about" };
  }

  const sectionSlug = match[2] ?? "about";
  return { objectId: match[1], sectionSlug };
}

function SidebarIcon({ name, className }: { name: SidebarIconName; className?: string }) {
  const iconByName: Record<SidebarIconName, LucideIcon> = {
    objects: Building2,
    plus: CirclePlus,
    list: Rows3,
    chevronDown: ChevronDown,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    about: Info,
    rules: ShieldCheck,
    documents: FileText,
    categories: LayoutGrid,
    rooms: BedDouble,
    amenities: Sparkles,
    chessboard: SquareChartGantt,
    payment: WalletCards,
    excursions: Map,
    transfers: Car,
    favorites: Heart,
    profile: UserRound,
  };

  return <AppIcon icon={iconByName[name]} className={cn("h-4 w-4", className)} />;
}

function SidebarIconShell({
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
        compact ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-xl",
        active ? "icon-surface" : "icon-surface-muted",
      )}
    >
      {children}
    </span>
  );
}

export function DashboardSidebar({
  firstName,
  avatarUrl,
  initials,
  properties,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isObjectsMenuOpen, setIsObjectsMenuOpen] = useState(false);

  const safePathname = pathname ?? "";
  const objectContext = useMemo(() => parseObjectContext(safePathname), [safePathname]);
  const selectedProperty = properties.find((item) => item.id === objectContext.objectId) ?? null;
  const selectedPropertyIndex = selectedProperty
    ? properties.findIndex((item) => item.id === selectedProperty.id)
    : -1;
  const previousProperty = selectedPropertyIndex > 0 ? properties[selectedPropertyIndex - 1] : null;
  const nextProperty =
    selectedPropertyIndex >= 0 && selectedPropertyIndex < properties.length - 1
      ? properties[selectedPropertyIndex + 1]
      : null;
  // Legacy /rooms route should continue to open the room categories section.
  const objectSectionSlug = objectTabs.some((item) => item.slug === objectContext.sectionSlug)
    ? objectContext.sectionSlug
    : objectContext.sectionSlug === "rooms"
      ? "room-categories"
      : "about";
  // Object navigation is context-aware: switcher + prev/next keep user in the same section.
  const isObjectContextVisible = Boolean(selectedProperty);
  const isObjectsActive = safePathname.startsWith("/dashboard/objects");

  const displayName = formatPublicPersonName({ firstName }, "Пользователь");

  return (
    <aside className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10">
      <p className="text-xs uppercase tracking-wide text-olive/60">Личный кабинет</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 overflow-hidden rounded-full bg-cream ring-1 ring-olive/15">
          <AvatarImage
            src={avatarUrl}
            alt="Profile"
            className="h-full w-full object-cover"
          >
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-olive/75">
              {initials}
            </span>
          </AvatarImage>
        </span>
        <p className="text-sm font-semibold text-olive">{displayName}</p>
      </div>

      <nav className="mt-4 space-y-1.5">
        <div className="rounded-xl border border-olive/12 bg-white/80 p-1">
          <div
            className={cn(
              "flex items-center rounded-lg",
              isObjectsActive ? "bg-sand/70 text-olive" : "text-olive/85 hover:bg-sand/65",
            )}
          >
            <Link
              href="/dashboard/objects"
              onClick={() => setIsObjectsMenuOpen(false)}
              className="flex flex-1 items-center gap-2.5 px-3 py-2 text-sm font-medium"
            >
              <SidebarIconShell active={isObjectsActive}>
                <SidebarIcon name="objects" />
              </SidebarIconShell>
              Объекты
            </Link>
            <button
              type="button"
              onClick={() => setIsObjectsMenuOpen((current) => !current)}
              aria-label={
                isObjectsMenuOpen ? "Свернуть подменю объектов" : "Открыть подменю объектов"
              }
              className="icon-button-soft mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <SidebarIcon
                name="chevronDown"
                className={cn("transition-transform", isObjectsMenuOpen ? "rotate-180" : "")}
              />
            </button>
          </div>

          <div className={cn("mt-1 grid gap-1 px-1 pb-1", isObjectsMenuOpen ? "block" : "hidden")}>
            <Link
              href="/dashboard/objects?create=1"
              onClick={() => setIsObjectsMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-olive/85 hover:bg-sand/65"
            >
              <SidebarIconShell compact>
                <SidebarIcon name="plus" />
              </SidebarIconShell>
              Создать новый объект
            </Link>
            <Link
              href="/dashboard/objects"
              onClick={() => setIsObjectsMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-olive/85 hover:bg-sand/65"
            >
              <SidebarIconShell compact>
                <SidebarIcon name="list" />
              </SidebarIconShell>
              Перейти к существующим
            </Link>
          </div>
        </div>

        {mainMenu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-olive/85 hover:bg-sand/65",
              safePathname.startsWith(item.href)
                ? "bg-white/86 text-olive shadow-[0_10px_24px_rgba(15,118,110,0.08)]"
                : "",
            )}
          >
            <SidebarIconShell active={safePathname.startsWith(item.href)}>
              <SidebarIcon name={item.icon} />
            </SidebarIconShell>
            {item.label}
          </Link>
        ))}
      </nav>

      {isObjectContextVisible && selectedProperty ? (
        <div className="mt-5 border-t border-olive/10 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-olive/60">Объект</p>
            <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-semibold text-olive/70">
              {selectedPropertyIndex + 1}/{properties.length}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-olive">
            {selectedProperty.name ?? "Объект без названия"}
          </p>
          <p className="text-xs text-olive/60">{selectedProperty.statusLabel}</p>

          <div className="mt-3 grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!previousProperty) {
                  return;
                }
                router.push(`/dashboard/objects/${previousProperty.id}/${objectSectionSlug}`);
              }}
              disabled={!previousProperty}
              aria-label="Предыдущий объект"
              className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SidebarIcon name="chevronLeft" />
            </button>
            <select
              value={selectedProperty.id}
              onChange={(event) => {
                const nextObjectId = event.target.value;
                router.push(`/dashboard/objects/${nextObjectId}/${objectSectionSlug}`);
              }}
              className="w-full rounded-lg border border-olive/20 bg-white px-2.5 py-2 text-sm text-olive"
            >
              {properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name ?? "Объект без названия"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!nextProperty) {
                  return;
                }
                router.push(`/dashboard/objects/${nextProperty.id}/${objectSectionSlug}`);
              }}
              disabled={!nextProperty}
              aria-label="Следующий объект"
              className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SidebarIcon name="chevronRight" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Link
              href={`/dashboard/objects/${selectedProperty.id}/about`}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-semibold",
                safePathname.includes(`/dashboard/objects/${selectedProperty.id}/about`)
                  ? "border-olive/30 bg-white/86 text-olive shadow-[0_10px_20px_rgba(15,118,110,0.08)]"
                  : "border-olive/15 text-olive/75 hover:bg-sand/60",
              )}
            >
              <SidebarIconShell
                active={safePathname.includes(`/dashboard/objects/${selectedProperty.id}/about`)}
                compact
              >
                <SidebarIcon name="about" className="h-4 w-4" />
              </SidebarIconShell>
              Карточка
            </Link>
            <Link
              href={`/dashboard/objects/${selectedProperty.id}/chessboard`}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-semibold",
                safePathname.includes(`/dashboard/objects/${selectedProperty.id}/chessboard`)
                  ? "border-olive/30 bg-white/86 text-olive shadow-[0_10px_20px_rgba(15,118,110,0.08)]"
                  : "border-olive/15 text-olive/75 hover:bg-sand/60",
              )}
            >
              <SidebarIconShell
                active={safePathname.includes(
                  `/dashboard/objects/${selectedProperty.id}/chessboard`,
                )}
                compact
              >
                <SidebarIcon name="chessboard" className="h-4 w-4" />
              </SidebarIconShell>
              Шахматка
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {objectTabs.map((tab) => {
              const href = `/dashboard/objects/${selectedProperty.id}/${tab.slug}`;
              const isActive = safePathname === href || safePathname.startsWith(`${href}/`);

              return (
                <Link
                  key={tab.slug}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-medium transition",
                    isActive
                      ? "border-olive/30 bg-white/86 text-olive shadow-[0_10px_20px_rgba(15,118,110,0.08)]"
                      : "border-olive/15 text-olive/75 hover:bg-sand/60",
                  )}
                  title={tab.label}
                >
                  <SidebarIconShell active={isActive} compact>
                    <SidebarIcon name={tab.icon} className="h-4 w-4 shrink-0" />
                  </SidebarIconShell>
                  <span className="truncate">{tab.shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
