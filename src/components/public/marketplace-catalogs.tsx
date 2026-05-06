import {
  ArrowRight,
  BriefcaseBusiness,
  Car,
  Clock3,
  ImageIcon,
  Landmark,
  MapPin,
  Phone,
  Route,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { ExcursionPhotoGallery } from "@/components/excursions/excursion-photo-gallery";
import type { SeoBreadcrumbItem } from "@/components/seo/seo-breadcrumbs";
import type { FavoriteEntityType } from "@/lib/favorite-entities";
import { CatalogNearbyContinuationNote } from "@/components/public/catalog-nearby-continuation-note";
import { MarketplaceFilterBar } from "@/components/public/marketplace-filter-bar";
import { MarketplaceCatalogMap } from "@/components/public/marketplace-catalog-map";
import { FirstListingPromo } from "@/components/public/first-listing-promo";
import {
  PropertyContactsPanel,
  type PropertyContactsPanelText,
} from "@/components/contacts/property-contacts-panel";
import { StaticMapPreview } from "@/components/maps/static-map-preview";
import { TransferLeadForm } from "@/components/transfers/transfer-lead-form";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ContactBrandMark, type ContactBrand } from "@/components/ui/contact-brand-mark";
import { ContactWebsiteMark } from "@/components/ui/contact-website-mark";
import { cn } from "@/lib/cn";
import {
  formatPublicContactName,
  formatPublicPersonName,
  getPublicPersonInitial,
} from "@/lib/public-display-name";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { normalizeWebsiteUrl } from "@/lib/website-favicon";
import type {
  PublicAttractionCatalogItem,
  PublicAttractionCatalogResult,
  PublicMarketplaceLocationSuggestion,
  PublicTransferCatalogItem,
  PublicTransferCatalogResult,
} from "@/lib/public-marketplace";

type CatalogParams = Record<string, string | null | undefined>;

type AttractionCatalogProps = {
  result: PublicAttractionCatalogResult;
  mapItems?: PublicAttractionCatalogItem[];
  categories: string[];
  locationSuggestions: PublicMarketplaceLocationSuggestion[];
};

type TransferCatalogProps = {
  result: PublicTransferCatalogResult;
  mapItems?: PublicTransferCatalogItem[];
  transferTypes: string[];
  locationSuggestions: PublicMarketplaceLocationSuggestion[];
};

type TransferFleet = PublicTransferCatalogItem["fleet"];
type TransferFleetItemView = TransferFleet[number];

type MobileMessengerLink = {
  key: string;
  href: string;
  label: string;
  brand: ContactBrand | "website";
};

type OwnerAvatarProps = {
  src: string | null | undefined;
  alt: string;
  initials: string;
  className: string;
  fallbackClassName?: string;
};

function OwnerAvatar({
  src,
  alt,
  initials,
  className,
  fallbackClassName = "text-sm font-semibold text-olive/60",
}: OwnerAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-olive/10",
        className,
      )}
    >
      <AvatarImage src={src} alt={alt} className="h-full w-full object-cover">
        <span className={cn("flex h-full w-full items-center justify-center", fallbackClassName)}>
          {initials || "?"}
        </span>
      </AvatarImage>
    </span>
  );
}

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function compactText(value: string | null | undefined, limit = 170): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trim()}…`;
}

function formatDistance(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return `~${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;
}

function formatPrice(value: number | null, unit: string | null): string {
  if (value === null) {
    return "Цена по запросу";
  }

  return `от ${rubFormatter.format(Math.round(value))} ₽${unit ? ` ${unit}` : ""}`;
}

function formatFleetPrice(value: number | null, unit: string | null): string {
  if (value === null) {
    return "Цена по запросу";
  }

  return `от ${rubFormatter.format(Math.round(value))} ₽${unit ? ` ${unit}` : ""}`;
}

function formatFleetPriceAmount(value: number | null): string {
  if (value === null) {
    return "Цена по запросу";
  }

  return `от ${rubFormatter.format(Math.round(value))} ₽`;
}

function formatPlural(value: number, one: string, few: string, many: string): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;

  if (abs >= 11 && abs <= 14) {
    return many;
  }
  if (last === 1) {
    return one;
  }
  if (last >= 2 && last <= 4) {
    return few;
  }

  return many;
}

function formatPhoneLabel(phone: string | null | undefined): string | null {
  const value = phone?.trim() ?? "";
  if (!value) {
    return null;
  }

  if (/[()\s-]/.test(value)) {
    return value;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    const prefix = digits.startsWith("8") ? "8" : "+7";
    const rest = digits.slice(1);
    return `${prefix} ${rest.slice(0, 3)} ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`;
  }

  return value.startsWith("+") ? `+${digits}` : digits;
}

function getVehicleDisplayText(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!text) {
    return null;
  }

  if (/^\d{5,}$/.test(text)) {
    return null;
  }

  return text;
}

function uniqueTruthy(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim().replace(/\s+/g, " ");
    if (!normalized || seen.has(normalized.toLowerCase())) {
      continue;
    }

    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }

  return result;
}

function getFleetCapacityValues(
  fleet: TransferFleet,
  key: "seats" | "luggage",
  fallback: number | null,
): number[] {
  const values = fleet
    .map((item) => item[key])
    .filter((value): value is number => typeof value === "number" && value > 0);

  if (values.length === 0 && fallback !== null && fallback > 0) {
    return [fallback];
  }

  return values;
}

function formatPassengerCapacityLabel(
  fleet: TransferFleet,
  fallback: number | null,
): string | null {
  const values = getFleetCapacityValues(fleet, "seats", fallback);
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min !== max) {
    return `${min}-${max} ${formatPlural(max, "пассажир", "пассажира", "пассажиров")}`;
  }

  if (fleet.length > 1) {
    return `до ${max} ${formatPlural(max, "пассажира", "пассажиров", "пассажиров")}`;
  }

  return `${max} ${formatPlural(max, "пассажир", "пассажира", "пассажиров")}`;
}

function formatLuggagePlaces(value: number): string {
  return `${value} ${formatPlural(value, "багажное место", "багажных места", "багажных мест")}`;
}

function formatLuggageCapacityLabel(fleet: TransferFleet, fallback: number | null): string | null {
  const values = getFleetCapacityValues(fleet, "luggage", fallback);
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min !== max) {
    return `${min}-${max} багажных мест`;
  }

  if (fleet.length > 1) {
    return `до ${max} ${formatPlural(max, "багажного места", "багажных мест", "багажных мест")}`;
  }

  return formatLuggagePlaces(max);
}

function formatFleetItemLuggageLabel(item: TransferFleetItemView): string | null {
  const places = item.luggage ? formatLuggagePlaces(item.luggage) : null;
  const note = item.luggageNote?.trim() ?? "";

  if (places && note) {
    return `${places}; ${note}`;
  }

  return places ?? (note || null);
}

function getFleetItemVehicleSummary(item: TransferFleetItemView): string | null {
  const model = getVehicleDisplayText(item.vehicleModel);
  const parts = uniqueTruthy([item.transportKind, item.vehicleClass, model]);
  return parts.length > 0 ? parts.join(" • ") : null;
}

function formatTransferVehicleOverview(
  item: PublicTransferCatalogItem,
  fleetCountLabel: string,
): string | null {
  if (item.fleet.length > 1) {
    const hints = uniqueTruthy(
      item.fleet.map(
        (fleetItem) =>
          fleetItem.transportKind ||
          fleetItem.vehicleClass ||
          getVehicleDisplayText(fleetItem.vehicleModel) ||
          fleetItem.title,
      ),
    );
    const preview = hints.slice(0, 2).join(", ");
    const suffix = hints.length > 2 ? ` +${hints.length - 2}` : "";
    return preview ? `${fleetCountLabel}: ${preview}${suffix}` : fleetCountLabel;
  }

  const primary = item.fleet[0] ?? null;
  return (
    getVehicleDisplayText(item.vehicleModel) ??
    (primary ? getFleetItemVehicleSummary(primary) : null) ??
    item.vehicleClass ??
    null
  );
}

function formatReviewsLabel(value: number): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs > 10 && abs < 20) {
    return `${value} отзывов`;
  }
  if (mod > 1 && mod < 5) {
    return `${value} отзыва`;
  }
  if (mod === 1) {
    return `${value} отзыв`;
  }

  return `${value} отзывов`;
}

function telHref(phone: string | null): string | null {
  const normalized = phone?.replace(/[^\d+]/g, "") ?? "";
  return normalized ? `tel:${normalized}` : null;
}

function buildMobileMessengerLinks(params: {
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
}): MobileMessengerLink[] {
  const preparedWebsiteUrl = params.websiteUrl?.trim()
    ? normalizeWebsiteUrl(params.websiteUrl)
    : null;
  const preparedWhatsappUrl = normalizeWhatsappUrl(params.whatsappUrl);
  const preparedTelegramUrl = normalizeTelegramProfileUrl(params.telegramUrl);
  const preparedVkUrl = normalizeVkProfileUrl(params.vkUrl);
  const preparedMaxUrl = normalizeMaxProfileUrl(params.maxUrl);
  const preparedOkUrl = normalizeOkProfileUrl(params.okUrl);

  return [
    preparedWebsiteUrl
      ? {
          key: "website",
          href: preparedWebsiteUrl,
          label: "Сайт",
          brand: "website" as const,
        }
      : null,
    preparedWhatsappUrl
      ? {
          key: "whatsapp",
          href: preparedWhatsappUrl,
          label: "WhatsApp",
          brand: "whatsapp" as const,
        }
      : null,
    preparedTelegramUrl
      ? {
          key: "telegram",
          href: preparedTelegramUrl,
          label: "Telegram",
          brand: "telegram" as const,
        }
      : null,
    preparedVkUrl
      ? {
          key: "vk",
          href: preparedVkUrl,
          label: "VK",
          brand: "vk" as const,
        }
      : null,
    preparedMaxUrl
      ? {
          key: "max",
          href: preparedMaxUrl,
          label: "Max",
          brand: "max" as const,
        }
      : null,
    preparedOkUrl
      ? {
          key: "ok",
          href: preparedOkUrl,
          label: "OK",
          brand: "ok" as const,
        }
      : null,
  ].filter((item): item is MobileMessengerLink => item !== null);
}

function getMobileMessengerChipClasses(brand: ContactBrand | "website"): string {
  if (brand === "website") {
    return "border-primary/18 bg-primary/10 text-primary shadow-[0_8px_18px_rgba(15,118,110,0.14)]";
  }

  if (brand === "whatsapp") {
    return "border-[#25D366]/22 bg-[#25D366]/10 shadow-[0_8px_18px_rgba(37,211,102,0.16)]";
  }

  if (brand === "telegram") {
    return "border-[#2AABEE]/22 bg-[#2AABEE]/10 shadow-[0_8px_18px_rgba(42,171,238,0.16)]";
  }

  if (brand === "vk") {
    return "border-[#0077FF]/20 bg-[#0077FF]/9 shadow-[0_8px_18px_rgba(0,119,255,0.14)]";
  }

  if (brand === "max") {
    return "border-[#FF7A1A]/22 bg-[#FF7A1A]/10 shadow-[0_8px_18px_rgba(255,122,26,0.15)]";
  }

  return "border-[#EE8208]/22 bg-[#EE8208]/10 shadow-[0_8px_18px_rgba(238,130,8,0.15)]";
}

function getGalleryImages(photoUrls: string[], coverImageUrl: string | null): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const url of [coverImageUrl, ...photoUrls]) {
    const normalized = url?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

function buildCatalogPath(basePath: string, params: CatalogParams): string {
  return buildCanonicalPath(
    basePath,
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, String(value)]),
    [
      "q",
      "location",
      "category",
      "transferType",
      "radiusKm",
      "minPrice",
      "maxPrice",
      "sort",
      "page",
    ],
  );
}

function CatalogShell({
  eyebrow,
  title,
  description,
  total,
  hideHeader = false,
  children,
}: {
  breadcrumbs: SeoBreadcrumbItem[];
  eyebrow: string;
  title: string;
  description: string;
  total: number;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main>
      {hideHeader ? null : (
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6 md:pt-8">
          <p className="sr-only">{eyebrow}</p>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold leading-tight text-olive">{title}</h1>
              <p className="mt-0.5 max-w-3xl text-sm leading-6 text-olive/60">{description}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-olive/70 md:border-l md:border-olive/10 md:pl-4">
              {total} {formatPlural(total, "вариант", "варианта", "вариантов")}
            </p>
          </div>
        </div>
      )}

      <div className={cn("mx-auto w-full max-w-[1680px] px-4 pb-28 md:px-6 md:pb-8")}>
        {children}
      </div>
    </main>
  );
}

function Pagination({
  basePath,
  page,
  totalPages,
  params,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  params: CatalogParams;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Пагинация">
      {previousPage ? (
        <Link
          href={buildCatalogPath(basePath, { ...params, page: String(previousPage) })}
          className="rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive transition hover:border-primary/24 hover:text-primary"
        >
          Назад
        </Link>
      ) : null}
      <span className="rounded-xl bg-white/82 px-4 py-2 text-sm font-semibold text-olive/60 ring-1 ring-olive/10">
        {page}/{totalPages}
      </span>
      {nextPage ? (
        <Link
          href={buildCatalogPath(basePath, { ...params, page: String(nextPage) })}
          className="rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive transition hover:border-primary/24 hover:text-primary"
        >
          Далее
        </Link>
      ) : null}
    </nav>
  );
}

function EmptyState({
  title,
  description,
  resetHref,
}: {
  title: string;
  description: string;
  resetHref: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-olive/24 bg-white/92 p-8 text-center">
      <p className="text-base font-semibold text-olive">{title}</p>
      <p className="mt-2 text-sm leading-6 text-olive/58">{description}</p>
      <Link
        href={resetHref}
        className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
      >
        Сбросить фильтры
      </Link>
    </section>
  );
}

function TransferEmptyCatalogContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-8 text-center">
        <p className="text-sm text-olive/60">По вашим параметрам трансферы не найдены.</p>
        <p className="mt-1 text-xs text-olive/45">
          Попробуйте изменить локацию, увеличить радиус или снять часть фильтров.
        </p>
        <Link
          href="/transfers"
          className="mt-4 inline-flex rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Сбросить все фильтры
        </Link>
      </div>
      <FirstListingPromo kind="transfers" />
    </div>
  );
}

function ImageBox({
  src,
  alt,
  fallback,
  favoriteItemId,
  favoriteEntityType,
  eager = false,
}: {
  src: string | null;
  alt: string;
  fallback: string;
  favoriteItemId: string;
  favoriteEntityType: FavoriteEntityType;
  eager?: boolean;
}) {
  return (
    <div className="card-img-wrap relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-sand sm:aspect-[3/2] md:aspect-[4/3] md:w-[240px] md:rounded-l-xl md:rounded-r-none lg:w-[280px]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="card-img h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full min-h-[170px] flex-col items-center justify-center gap-2 text-sm text-olive/45">
          <AppIcon icon={ImageIcon} className="h-6 w-6" />
          {fallback}
        </div>
      )}
      <div className="pointer-events-auto absolute right-2 top-2 z-30 p-1 sm:right-2.5 sm:top-2.5">
        <FavoriteToggleButton
          itemId={favoriteItemId}
          entityType={favoriteEntityType}
          initialIsFavorite={false}
          variant="icon"
        />
      </div>
    </div>
  );
}

function SummaryPill({ icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-foam px-2 py-1 text-[11px] font-semibold text-accent">
      {icon ? <AppIcon icon={icon} className="h-3.5 w-3.5 text-olive/40" /> : null}
      {children}
    </span>
  );
}

function DetailsGallery({
  title,
  photoUrls,
  coverImageUrl,
  fallback,
}: {
  title: string;
  photoUrls: string[];
  coverImageUrl: string | null;
  fallback: string;
}) {
  const images = getGalleryImages(photoUrls, coverImageUrl);

  if (images.length === 0) {
    return (
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/94 shadow-[0_20px_60px_rgba(58,43,35,0.08)]">
        <div className="flex min-h-[280px] items-center justify-center bg-cream text-sm font-semibold text-olive/45 md:min-h-[520px]">
          {fallback}
        </div>
      </div>
    );
  }

  return <ExcursionPhotoGallery photoUrls={images} title={title} />;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.08)] sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
      />
      <h2 className="font-heading text-xl font-semibold text-olive">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AttractionJumpNav({ items }: { items: Array<{ href: string; label: string }> }) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav
      className="-mx-1 w-auto max-w-full overflow-x-auto rounded-2xl border border-olive/10 bg-white/94 px-1.5 shadow-[0_10px_26px_rgba(58,43,35,0.06)] backdrop-blur-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-2"
      aria-label="Навигация по разделам"
    >
      <div className="flex min-w-max snap-x snap-mandatory items-center gap-1.5 pb-1">
        {items.map((entry) => (
          <a
            key={entry.href}
            href={entry.href}
            className="snap-start whitespace-nowrap rounded-xl px-3 py-3 text-sm font-medium text-olive/62 transition hover:bg-cream hover:text-olive"
          >
            {entry.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function AttractionCard({
  item,
  eagerImage = false,
}: {
  item: PublicAttractionCatalogItem;
  eagerImage?: boolean;
}) {
  const description = compactText(item.shortDescription ?? item.description, 180);
  const distance = formatDistance(item.distanceKm);
  const tags = item.tags.slice(0, 3);
  const locationLine = [item.locationName, item.address].filter(Boolean).join(", ") || "Крым";

  return (
    <article
      data-catalog-map-item-id={item.id}
      className="result-card group relative overflow-hidden rounded-2xl border border-olive/[0.07] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]"
    >
      <Link
        href={item.path}
        aria-label={`Открыть ${item.title}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-20 flex flex-col md:flex-row">
        <ImageBox
          src={item.coverImageUrl}
          alt={item.title}
          fallback="Фото места"
          favoriteItemId={item.id}
          favoriteEntityType="attraction"
          eager={eagerImage}
        />

        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 md:flex-row md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                Досуг
              </span>
              {item.category ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-olive/40">
                  {item.category}
                </span>
              ) : null}
            </div>

            <h2 className="line-clamp-2 text-[16px] font-bold leading-snug tracking-tight text-olive [overflow-wrap:anywhere] sm:text-[18px]">
              {item.title}
            </h2>

            <p className="flex items-start gap-1.5 text-[13px] leading-snug text-olive/50">
              <AppIcon icon={MapPin} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive/30" />
              <span className="line-clamp-2 [overflow-wrap:anywhere]">{locationLine}</span>
            </p>

            <div className="flex max-h-[70px] flex-wrap gap-1.5 overflow-hidden">
              {item.districtName ? (
                <SummaryPill icon={Landmark}>{item.districtName}</SummaryPill>
              ) : null}
              {distance ? <SummaryPill icon={Route}>{distance}</SummaryPill> : null}
              <SummaryPill icon={Clock3}>Свободный день</SummaryPill>
            </div>

            {description ? (
              <p className="text-sm leading-6 text-olive/62 md:hidden">{description}</p>
            ) : null}

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 md:hidden">
                {tags.map((tag) => (
                  <span
                    key={`${item.id}-tag-${tag}`}
                    className="inline-flex items-center gap-1 rounded-md bg-sand/50 px-2 py-0.5 text-[11px] font-medium text-olive/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-olive/[0.06] pt-3 md:hidden">
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold leading-tight tracking-tight text-olive">
                  Карточка места
                </p>
                <p className="mt-0.5 text-[11px] text-olive/40">Маршрут, фото и карта</p>
              </div>
              <Link
                href={item.path}
                className="pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end justify-between border-l border-olive/[0.06] pl-4 md:flex md:w-[190px] lg:w-[210px]">
            <div className="text-right">
              <p className="text-[12px] font-semibold text-olive">Самостоятельно</p>
            </div>

            <div className="mt-auto text-right">
              <Link
                href={item.path}
                className="pointer-events-auto mt-2.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TransferCard({
  item,
  eagerImage = false,
}: {
  item: PublicTransferCatalogItem;
  eagerImage?: boolean;
}) {
  const description = compactText(item.shortDescription ?? item.description, 170);
  const distance = formatDistance(item.distanceKm);
  const fleetCountLabel =
    item.fleet.length > 0
      ? `${item.fleet.length} ${formatPlural(item.fleet.length, "вариант", "варианта", "вариантов")}`
      : "Транспорт уточняется";
  const vehicleOverview = formatTransferVehicleOverview(item, fleetCountLabel);
  const passengerCapacityLabel = formatPassengerCapacityLabel(item.fleet, item.seats);
  const luggageCapacityLabel = formatLuggageCapacityLabel(item.fleet, item.luggage);
  const ownerName = formatPublicPersonName(item.owner, "Водитель");
  const ownerInitials = getPublicPersonInitial(item.owner);
  const contactName = formatPublicContactName(item.contacts.contactName, ownerName);
  const hasReviews = item.reviewsCount > 0 && item.avgRating > 0;
  const priceLabel = formatPrice(item.priceFrom, item.priceUnitLabel);

  return (
    <article
      data-catalog-map-item-id={item.id}
      className="result-card group relative overflow-hidden rounded-2xl border border-olive/[0.07] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]"
    >
      <Link
        href={item.path}
        aria-label={`Открыть ${item.title}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-20 flex flex-col md:flex-row">
        <ImageBox
          src={item.coverImageUrl}
          alt={item.title}
          fallback="Фото автомобиля"
          favoriteItemId={item.id}
          favoriteEntityType="transfer"
          eager={eagerImage}
        />

        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 md:flex-row md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                Трансфер
              </span>
              {item.transferType ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-olive/40">
                  {item.transferType}
                </span>
              ) : null}
            </div>

            <h2 className="line-clamp-2 text-[16px] font-bold leading-snug tracking-tight text-olive [overflow-wrap:anywhere] sm:text-[18px]">
              {item.title}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-cream/78 py-1 pl-1 pr-2.5 text-xs font-semibold text-olive/70 ring-1 ring-olive/8">
                <OwnerAvatar
                  src={item.owner.avatarUrl}
                  alt={contactName}
                  initials={ownerInitials}
                  className="h-8 w-8"
                  fallbackClassName="text-[11px] text-olive/60"
                />
                {contactName}
              </span>
              <span className="rounded-lg border border-dashed border-olive/18 px-2.5 py-1.5 text-xs font-semibold text-olive/42 md:hidden">
                {hasReviews
                  ? `${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
                  : "Новый водитель на площадке"}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {item.locationName ? (
                <SummaryPill icon={MapPin}>{item.locationName}</SummaryPill>
              ) : null}
              {vehicleOverview ? <SummaryPill icon={Car}>{vehicleOverview}</SummaryPill> : null}
              {passengerCapacityLabel ? (
                <SummaryPill icon={Users}>{passengerCapacityLabel}</SummaryPill>
              ) : null}
              {luggageCapacityLabel ? (
                <SummaryPill icon={BriefcaseBusiness}>{luggageCapacityLabel}</SummaryPill>
              ) : null}
              {distance ? <SummaryPill icon={Route}>{distance}</SummaryPill> : null}
            </div>

            {description ? (
              <p className="text-sm leading-6 text-olive/62 md:hidden">{description}</p>
            ) : null}

            {item.serviceTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 md:hidden">
                {item.serviceTags.slice(0, 4).map((tag) => (
                  <span
                    key={`${item.id}-${tag}`}
                    className="inline-flex items-center gap-1 rounded-md bg-sand/50 px-2 py-0.5 text-[11px] font-medium text-olive/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-olive/[0.06] pt-3 md:hidden">
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold leading-tight tracking-tight text-olive">
                  {priceLabel}
                </p>
                <p className="mt-0.5 text-[11px] text-olive/40">
                  {item.routeExamples ? compactText(item.routeExamples, 56) : "Контакты в карточке"}
                </p>
              </div>
              <Link
                href={item.path}
                className="pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end justify-between border-l border-olive/[0.06] pl-4 md:flex md:w-[190px] lg:w-[210px]">
            <div className="text-right">
              {hasReviews ? (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[12px] font-semibold text-olive">Отлично</span>
                    <p className="text-[11px] text-olive/40">
                      {formatReviewsLabel(item.reviewsCount)}
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[14px] font-bold text-white">
                    {item.avgRating.toFixed(1)}
                  </span>
                </div>
              ) : (
                <p className="text-[12px] font-semibold text-olive">Новый водитель</p>
              )}
            </div>

            <div className="mt-auto text-right">
              <p className="text-[18px] font-extrabold leading-tight tracking-tight text-olive">
                {priceLabel}
              </p>
              <div className="mt-2.5 flex flex-col gap-2">
                <Link
                  href={item.path}
                  className="pointer-events-auto inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md active:scale-[0.97]"
                >
                  Подробнее
                  <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function AttractionCatalog({
  result,
  mapItems,
  categories,
  locationSuggestions,
}: AttractionCatalogProps) {
  const params: CatalogParams = {
    q: result.filters.query,
    location: result.filters.locationName,
    category: result.filters.category,
    radiusKm: String(result.filters.radiusKm),
    sort: result.filters.sort === "relevance" ? "" : result.filters.sort,
  };
  const pagination = (
    <Pagination
      basePath="/attractions"
      page={result.page}
      totalPages={result.totalPages}
      params={params}
    />
  );

  return (
    <CatalogShell
      breadcrumbs={[
        { name: "Главная", path: "/" },
        { name: "Досуг в Крыму", path: "/attractions" },
      ]}
      eyebrow="Каталог"
      title="Досуг в Крыму"
      description="Ищите места для прогулок, самостоятельных остановок и отдыха по названию, городу или радиусу рядом с выбранной локацией."
      total={result.total}
      hideHeader
    >
      <MarketplaceFilterBar
        key={[
          result.filters.query ?? "",
          result.filters.locationName ?? "",
          result.filters.category ?? "",
          result.filters.radiusKm,
          result.filters.sort,
        ].join("|")}
        kind="attractions"
        filters={result.filters}
        total={result.total}
        categories={categories}
        locationSuggestions={locationSuggestions}
      />

      {result.items.length === 0 ? (
        <EmptyState
          title="Досуг не найден"
          description="Попробуйте другой город, увеличьте радиус или очистите поиск."
          resetHref="/attractions"
        />
      ) : (
        <MarketplaceCatalogMap
          kind="attractions"
          items={mapItems ?? result.items}
          filters={result.filters}
          mapTitle="Карта мест"
        >
          <section className="min-w-0 lg:w-full" id="catalog-results">
            <div className="space-y-4">
              {result.items.map((item, index) => (
                <AttractionCard key={item.id} item={item} eagerImage={index < 2} />
              ))}
            </div>
            {pagination}
          </section>
        </MarketplaceCatalogMap>
      )}
    </CatalogShell>
  );
}

export function TransferCatalog({
  result,
  mapItems,
  transferTypes,
  locationSuggestions,
}: TransferCatalogProps) {
  const params: CatalogParams = {
    q: result.filters.query,
    location: result.filters.locationName,
    transferType: result.filters.transferType,
    radiusKm: String(result.filters.radiusKm),
    minPrice: result.filters.minPrice ? String(result.filters.minPrice) : "",
    maxPrice: result.filters.maxPrice ? String(result.filters.maxPrice) : "",
    sort: result.filters.sort === "relevance" ? "" : result.filters.sort,
  };
  const pagination = (
    <Pagination
      basePath="/transfers"
      page={result.page}
      totalPages={result.totalPages}
      params={params}
    />
  );

  return (
    <CatalogShell
      breadcrumbs={[
        { name: "Главная", path: "/" },
        { name: "Трансферы по Крыму", path: "/transfers" },
      ]}
      eyebrow="Каталог"
      title="Трансферы по Крыму"
      description="Выбирайте водителя по городу, маршруту, типу трансфера, автомобилю и цене."
      total={result.total}
      hideHeader
    >
      <MarketplaceFilterBar
        key={[
          result.filters.query ?? "",
          result.filters.locationName ?? "",
          result.filters.transferType ?? "",
          result.filters.radiusKm,
          result.filters.minPrice ?? "",
          result.filters.maxPrice ?? "",
          result.filters.sort,
        ].join("|")}
        kind="transfers"
        filters={result.filters}
        total={result.total}
        transferTypes={transferTypes}
        locationSuggestions={locationSuggestions}
      />

      <MarketplaceCatalogMap
        kind="transfers"
        items={mapItems ?? result.items}
        filters={result.filters}
        mapTitle="Карта трансферов"
      >
        <section className="min-w-0 flex-1 lg:w-full" id="catalog-results">
          {result.items.length === 0 ? (
            <TransferEmptyCatalogContent />
          ) : (
            <div className="space-y-4">
              {result.items.map((item, index) => {
                const showNearbyNote =
                  item.searchMatchKind === "nearby" &&
                  (index === 0 || result.items[index - 1]?.searchMatchKind !== "nearby");

                return (
                  <Fragment key={item.id}>
                    {showNearbyNote ? (
                      <CatalogNearbyContinuationNote
                        locationName={result.filters.locationName}
                        radiusKm={result.filters.nearbyRadiusKm}
                      />
                    ) : null}
                    <TransferCard item={item} eagerImage={index < 2} />
                  </Fragment>
                );
              })}
            </div>
          )}
          {pagination}
        </section>
      </MarketplaceCatalogMap>
    </CatalogShell>
  );
}

export function AttractionDetails({ item }: { item: PublicAttractionCatalogItem }) {
  const distance = formatDistance(item.distanceKm);
  const attractionLocationPath = item.locationName
    ? buildCatalogPath("/attractions", { location: item.locationName })
    : "/attractions";
  const breadcrumbItems = [
    { name: "Главная", path: "/" },
    { name: "Досуг", path: "/attractions" },
    ...(item.locationName ? [{ name: item.locationName, path: attractionLocationPath }] : []),
    { name: item.title, path: item.path },
  ];
  const sectionLinks = [
    { href: "#overview", label: "Обзор" },
    ...(item.sections.length > 0 ? [{ href: "#details", label: "Подробно" }] : []),
    ...(item.latitude !== null && item.longitude !== null
      ? [{ href: "#map-panel", label: "Карта" }]
      : []),
    ...(item.nearby.length > 0 ? [{ href: "#nearby-places", label: "Рядом" }] : []),
    ...(item.faq.length > 0 ? [{ href: "#faq", label: "FAQ" }] : []),
    { href: "#nearby-housing", label: "Жильё рядом" },
    { href: "#nearby-excursions", label: "Экскурсии рядом" },
  ];
  const heroBadges = [
    item.category ?? "Досуг",
    item.locationName,
    item.districtName,
    distance,
  ].filter((value): value is string => Boolean(value));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      <nav
        aria-label="Хлебные крошки"
        className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol className="flex min-w-max items-center gap-2 text-sm">
          {breadcrumbItems.map((breadcrumb, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return [
              <li key={`${breadcrumb.path}-${index}`}>
                {isLast ? (
                  <span
                    className="inline-flex max-w-[min(72vw,26rem)] items-center truncate rounded-full bg-gradient-to-r from-cream via-white to-primary/8 px-3.5 py-1.5 font-semibold text-olive ring-1 ring-olive/10"
                    title={breadcrumb.name}
                  >
                    {breadcrumb.name}
                  </span>
                ) : (
                  <Link
                    href={breadcrumb.path}
                    className="inline-flex items-center rounded-full border border-olive/12 bg-white/92 px-3 py-1.5 text-olive/72 shadow-[0_10px_24px_rgba(58,43,35,0.05)] transition hover:border-primary/18 hover:bg-cream hover:text-olive"
                  >
                    {breadcrumb.name}
                  </Link>
                )}
              </li>,
              !isLast ? (
                <li
                  key={`${breadcrumb.path}-${index}-separator`}
                  aria-hidden="true"
                  className="text-base leading-none text-olive/24"
                >
                  ›
                </li>
              ) : null,
            ];
          })}
        </ol>
      </nav>

      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-3xl">
          <ExcursionPhotoGallery
            photoUrls={item.photoUrls}
            title={item.title}
            desktopVariant="object-card"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden bg-gradient-to-t from-midnight/78 via-midnight/36 to-transparent px-6 pb-6 pt-28 md:block">
            <div className="pointer-events-auto flex items-end justify-between gap-6">
              <div className="max-w-[min(44rem,62%)]">
                <div className="flex flex-wrap gap-2">
                  {heroBadges.slice(0, 4).map((badge) => (
                    <span
                      key={`attraction-hero-${badge}`}
                      className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-olive shadow-[0_12px_24px_rgba(15,23,42,0.16)] backdrop-blur"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-white drop-shadow md:text-5xl">
                  {item.h1}
                </h1>
                {item.shortDescription ? (
                  <p className="mt-3 max-w-3xl text-lg leading-7 text-white/88 drop-shadow">
                    {item.shortDescription}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0">
                <FavoriteToggleButton
                  itemId={item.id}
                  entityType="attraction"
                  initialIsFavorite={false}
                />
              </div>
            </div>
          </div>
        </section>

        <AttractionJumpNav items={sectionLinks} />

        <section
          id="overview"
          className="scroll-mt-[132px] rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.08)] sm:p-6 md:scroll-mt-[152px]"
        >
          <div className="flex flex-wrap gap-2">
            <SummaryPill>Досуг</SummaryPill>
            {item.category ? <SummaryPill>{item.category}</SummaryPill> : null}
            {item.locationName ? (
              <SummaryPill icon={MapPin}>{item.locationName}</SummaryPill>
            ) : null}
            {distance ? <SummaryPill icon={Route}>{distance}</SummaryPill> : null}
          </div>

          <h1 className="mt-4 text-3xl font-semibold leading-tight text-olive md:hidden">
            {item.h1}
          </h1>

          {item.shortDescription ? (
            <p className="mt-3 text-lg leading-7 text-olive/68 md:hidden">
              {item.shortDescription}
            </p>
          ) : null}

          <div className="mt-4 md:hidden">
            <FavoriteToggleButton
              itemId={item.id}
              entityType="attraction"
              initialIsFavorite={false}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {item.locationName ? (
              <InfoTile icon={MapPin} label="Город" value={item.locationName} />
            ) : null}
            {item.districtName ? (
              <InfoTile icon={Route} label="Район" value={item.districtName} />
            ) : null}
            {item.address ? <InfoTile icon={MapPin} label="Ориентир" value={item.address} /> : null}
            {item.category ? (
              <InfoTile icon={Route} label="Категория" value={item.category} />
            ) : null}
          </div>

          {item.description ? (
            <div className="mt-5 rounded-[24px] bg-cream/72 p-5 whitespace-pre-line text-sm leading-7 text-olive/72 md:text-base">
              {item.description}
            </div>
          ) : null}

          {item.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={`${item.id}-detail-tag-${tag}`}
                  className="rounded-full border border-primary/18 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {item.facts.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {item.facts.map((fact) => (
              <div
                key={`${item.id}-fact-${fact.label}`}
                className="rounded-[24px] border border-olive/10 bg-white p-4 shadow-[0_12px_30px_rgba(58,43,35,0.05)]"
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                  <AppIcon icon={Star} className="h-4 w-4" />
                  {fact.label}
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-olive">{fact.value}</p>
              </div>
            ))}
          </section>
        ) : null}

        {item.sections.length > 0 ? (
          <section id="details" className="scroll-mt-[132px] space-y-4 md:scroll-mt-[152px]">
            {item.sections.map((section) => (
              <DetailSection key={`${item.id}-section-${section.title}`} title={section.title}>
                <div className="space-y-3 text-sm leading-7 text-olive/72 md:text-base">
                  {section.body.map((paragraph, index) => (
                    <p key={`${section.title}-p-${index}`}>{paragraph}</p>
                  ))}
                  {section.list && section.list.length > 0 ? (
                    <ul className="grid gap-2 pt-1 sm:grid-cols-2">
                      {section.list.map((entry) => (
                        <li
                          key={`${section.title}-list-${entry}`}
                          className="rounded-2xl bg-cream/72 px-4 py-3 text-sm font-semibold text-olive"
                        >
                          {entry}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </DetailSection>
            ))}
          </section>
        ) : null}

        {item.latitude !== null && item.longitude !== null ? (
          <section id="map-panel" className="scroll-mt-[132px] md:scroll-mt-[152px]">
            <DetailSection title="Ориентир на карте">
              <StaticMapPreview
                latitude={item.latitude}
                longitude={item.longitude}
                label={item.address ?? item.locationName ?? item.title}
              />
            </DetailSection>
          </section>
        ) : null}

        {item.nearby.length > 0 ? (
          <DetailSection title="Что посмотреть рядом">
            <div
              id="nearby-places"
              className="-mt-4 grid scroll-mt-[132px] gap-2 pt-4 sm:grid-cols-2 md:scroll-mt-[152px]"
            >
              {item.nearby.map((place) => (
                <Link
                  key={`${item.id}-nearby-${place}`}
                  href={buildCatalogPath("/attractions", { q: place })}
                  className="inline-flex items-center justify-between rounded-2xl border border-olive/10 bg-cream/68 px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:bg-primary/5 hover:text-primary"
                >
                  {place}
                  <AppIcon icon={ArrowRight} className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </DetailSection>
        ) : null}

        {item.faq.length > 0 ? (
          <section id="faq" className="scroll-mt-[132px] md:scroll-mt-[152px]">
            <DetailSection title="FAQ">
              <div className="space-y-2">
                {item.faq.map((faqItem) => (
                  <details
                    key={`${item.id}-faq-${faqItem.question}`}
                    className="group rounded-2xl border border-olive/10 bg-cream/60 px-4 py-3"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-olive marker:hidden">
                      {faqItem.question}
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-olive/68">{faqItem.answer}</p>
                  </details>
                ))}
              </div>
            </DetailSection>
          </section>
        ) : null}
      </div>
    </main>
  );
}

const transferContactPanelText = {
  emptyState: "Контакты водителя пока не добавлены.",
  primaryPhoneEyebrow: "Телефон водителя",
  primaryPhoneFallbackName: "Основной номер для связи",
  secondaryContactsEyebrow: "Мессенджеры и сайт",
  websiteLabel: "Сайт водителя",
  websiteCaptionFallback: "Открыть сайт водителя",
  whatsappCaption: "Открыть чат с водителем",
  telegramCaption: "Написать в Telegram",
  vkCaption: "Открыть страницу VK",
  maxCaption: "Открыть чат в Max",
  okCaption: "Открыть профиль в Одноклассниках",
} satisfies PropertyContactsPanelText;

export function TransferDetails({ item }: { item: PublicTransferCatalogItem }) {
  const phoneHref = telHref(item.contacts.phone);
  const ownerName = formatPublicPersonName(item.owner, "Водитель");
  const ownerInitials = getPublicPersonInitial(item.owner);
  const hasReviews = item.reviewsCount > 0 && item.avgRating > 0;
  const contactName = formatPublicContactName(item.contacts.contactName, ownerName);
  const priceLabel = formatPrice(item.priceFrom, item.priceUnitLabel);
  const fleetCountLabel =
    item.fleet.length > 0
      ? `${item.fleet.length} ${formatPlural(item.fleet.length, "вариант", "варианта", "вариантов")}`
      : "Варианты уточняются";
  const vehicleOverview = formatTransferVehicleOverview(item, fleetCountLabel);
  const passengerCapacityLabel = formatPassengerCapacityLabel(item.fleet, item.seats);
  const luggageCapacityLabel = formatLuggageCapacityLabel(item.fleet, item.luggage);
  const transferLocationPath = item.locationName
    ? buildCatalogPath("/transfers", { location: item.locationName })
    : "/transfers";
  const breadcrumbItems = [
    { name: "Главная", path: "/" },
    { name: "Трансферы", path: "/transfers" },
    ...(item.locationName ? [{ name: item.locationName, path: transferLocationPath }] : []),
    { name: item.title, path: item.path },
  ];
  const availableTransferTypes = Array.from(
    new Set(
      [item.transferType, ...item.serviceTags].filter((value): value is string => Boolean(value)),
    ),
  );
  const vehicleKinds = Array.from(
    new Set(
      item.fleet
        .flatMap((fleetItem) => [fleetItem.transportKind, fleetItem.vehicleClass])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const locationSummary = [item.locationName, item.districtName].filter(Boolean).join(" • ");
  const primaryPhoneLabel = formatPhoneLabel(item.contacts.phone);
  const extraPhones = item.contacts.phone2?.trim()
    ? [
        {
          phone: item.contacts.phone2.trim(),
          label: formatPhoneLabel(item.contacts.phone2) ?? item.contacts.phone2.trim(),
        },
      ]
    : [];
  const mobileMessengerLinks = buildMobileMessengerLinks({
    websiteUrl: item.contacts.websiteUrl,
    whatsappUrl: item.contacts.whatsappUrl,
    telegramUrl: item.contacts.telegramUrl,
    vkUrl: item.contacts.vkUrl,
    maxUrl: item.contacts.maxUrl,
    okUrl: item.contacts.okUrl,
  });
  const sectionLinks = [
    { href: "#transfer-options", label: item.fleet.length > 1 ? "Варианты" : "Автомобиль" },
    ...(availableTransferTypes.length > 0 ? [{ href: "#transfer-types", label: "Виды" }] : []),
    { href: "#description-panel", label: "Описание" },
    ...(item.serviceArea || item.routeExamples
      ? [{ href: "#routes-panel", label: "Маршруты" }]
      : []),
    ...(item.latitude !== null && item.longitude !== null
      ? [{ href: "#map-panel", label: "Карта" }]
      : []),
    { href: "#reviews", label: "Отзывы" },
  ];
  const heroBadges = [
    item.transferType ?? "Трансфер",
    item.locationName,
    vehicleOverview,
    hasReviews
      ? `${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
      : "Новый водитель",
  ].filter((value): value is string => Boolean(value));
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] md:px-6 md:py-8 lg:pb-8">
      <nav
        aria-label="Хлебные крошки"
        className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol className="flex min-w-max items-center gap-2 text-sm">
          {breadcrumbItems.map((breadcrumb, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return [
              <li key={`${breadcrumb.path}-${index}`}>
                {isLast ? (
                  <span
                    className="inline-flex max-w-[min(72vw,26rem)] items-center truncate rounded-full bg-gradient-to-r from-cream via-white to-primary/8 px-3.5 py-1.5 font-semibold text-olive ring-1 ring-olive/10"
                    title={breadcrumb.name}
                  >
                    {breadcrumb.name}
                  </span>
                ) : (
                  <Link
                    href={breadcrumb.path}
                    className="inline-flex items-center rounded-full border border-olive/12 bg-white/92 px-3 py-1.5 text-olive/72 shadow-[0_10px_24px_rgba(58,43,35,0.05)] transition hover:border-primary/18 hover:bg-cream hover:text-olive"
                  >
                    {breadcrumb.name}
                  </Link>
                )}
              </li>,
              !isLast ? (
                <li
                  key={`${breadcrumb.path}-${index}-separator`}
                  aria-hidden="true"
                  className="text-base leading-none text-olive/24"
                >
                  ›
                </li>
              ) : null,
            ];
          })}
        </ol>
      </nav>

      <section className="relative overflow-hidden rounded-3xl">
        <DetailsGallery
          title={item.title}
          photoUrls={item.photoUrls}
          coverImageUrl={item.coverImageUrl}
          fallback="Фото автомобиля"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden bg-gradient-to-t from-midnight/78 via-midnight/42 to-transparent px-6 pb-6 pt-28 md:block">
          <div className="pointer-events-auto flex items-end justify-between gap-6">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {heroBadges.map((badge, index) => (
                  <span
                    key={`${item.id}-hero-badge-${badge}`}
                    className={cn(
                      "rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-medium text-white/86 backdrop-blur-sm",
                      index === 0
                        ? "text-[11px] font-semibold uppercase tracking-[0.12em] text-white/92"
                        : "",
                    )}
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <h1 className="max-w-4xl text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-[2.4rem]">
                {item.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/82">
                {locationSummary ? (
                  <span className="inline-flex items-center gap-1.5">
                    <AppIcon icon={MapPin} className="h-4 w-4 text-white/70" />
                    <span>{locationSummary}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium text-white/92 backdrop-blur-sm">
                  <AppIcon icon={Car} className="h-4 w-4 text-sage" />
                  <span>{fleetCountLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium text-white/92 backdrop-blur-sm">
                  <AppIcon icon={Star} className="h-4 w-4 text-sage" />
                  <span>
                    {hasReviews
                      ? `${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
                      : "Отзывы появятся после первых поездок"}
                  </span>
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <FavoriteToggleButton
                itemId={item.id}
                entityType="transfer"
                initialIsFavorite={false}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-3 px-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {heroBadges.map((badge, index) => (
            <span
              key={`${item.id}-mobile-badge-${badge}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                index === 0
                  ? "border border-olive/10 bg-cream/70 text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/70"
                  : "bg-sage/18 text-olive/80",
              )}
            >
              {badge}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-bold leading-tight text-olive sm:text-3xl">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-olive/68">
          {locationSummary ? (
            <span className="inline-flex items-center gap-1.5">
              <AppIcon icon={MapPin} className="h-4 w-4 text-terra" />
              <span>{locationSummary}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/16 px-3 py-1 font-medium text-olive">
            <AppIcon icon={Car} className="h-4 w-4 text-terra" />
            <span>{fleetCountLabel}</span>
          </span>
        </div>
        <FavoriteToggleButton itemId={item.id} entityType="transfer" initialIsFavorite={false} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,368px)]">
        <div className="min-w-0 space-y-5">
          <nav
            className="-mx-1 max-w-full overflow-x-auto rounded-2xl border border-olive/10 bg-white/94 px-1.5 shadow-[0_10px_26px_rgba(58,43,35,0.06)] backdrop-blur-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-2"
            aria-label="Навигация по разделам"
          >
            <div className="flex min-w-max snap-x snap-mandatory items-center gap-1.5 pb-1">
              {sectionLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="snap-start whitespace-nowrap rounded-xl px-3 py-3 text-sm font-medium text-olive/62 transition hover:bg-cream hover:text-olive"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>

          <section
            id="description-panel"
            className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.06)] md:scroll-mt-[152px] md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/55">
                  Карточка трансфера
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-olive">О трансфере</h2>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-olive ring-1 ring-olive/10">
                {priceLabel}
              </span>
            </div>

            {item.shortDescription ? (
              <p className="mt-4 text-lg leading-7 text-olive/68">{item.shortDescription}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[24px] bg-cream/72 p-4">
              <OwnerAvatar
                src={item.owner.avatarUrl}
                alt={contactName}
                initials={ownerInitials}
                className="h-14 w-14"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-olive">{contactName}</p>
                <p className="mt-1 text-xs text-olive/56">
                  {hasReviews
                    ? `${formatReviewsLabel(item.reviewsCount)} уже есть на карточке`
                    : "Водитель принимает заявки напрямую по телефону и в мессенджерах"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {vehicleOverview ? (
                <InfoTile
                  icon={Car}
                  label={item.fleet.length > 1 ? "Транспорт" : "Автомобиль"}
                  value={vehicleOverview}
                />
              ) : null}
              {passengerCapacityLabel ? (
                <InfoTile icon={Users} label="Пассажиры" value={passengerCapacityLabel} />
              ) : null}
              {luggageCapacityLabel ? (
                <InfoTile icon={BriefcaseBusiness} label="Багаж" value={luggageCapacityLabel} />
              ) : null}
              {item.locationName ? (
                <InfoTile icon={MapPin} label="Город" value={item.locationName} />
              ) : null}
            </div>

            {availableTransferTypes.length > 0 ? (
              <div id="transfer-types" className="mt-5 scroll-mt-[132px] md:scroll-mt-[152px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                  Доступные виды трансфера
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {availableTransferTypes.map((tag) => (
                    <span
                      key={`${item.id}-detail-tag-${tag}`}
                      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {vehicleKinds.length > 0 ? (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                  Классы и типы транспорта
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {vehicleKinds.map((kind) => (
                    <span
                      key={`${item.id}-vehicle-kind-${kind}`}
                      className="rounded-full border border-olive/10 bg-cream px-3 py-1.5 text-xs font-semibold text-olive/72"
                    >
                      {kind}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {item.description ? (
              <div className="mt-5 rounded-[24px] bg-cream/72 p-5 whitespace-pre-line text-sm leading-7 text-olive/72 md:text-base">
                {item.description}
              </div>
            ) : null}
          </section>

          <section
            id="transfer-options"
            className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.06)] md:scroll-mt-[152px] md:p-6"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                  Автопарк и цены
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-olive">
                  {item.fleet.length > 1 ? "Доступные варианты" : "Доступный транспорт"}
                </h2>
              </div>
              <p className="text-sm font-semibold text-primary">{fleetCountLabel}</p>
            </div>

            {item.fleet.length > 0 ? (
              <div className="mt-5 space-y-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                {item.fleet.map((fleetItem, index) => {
                  const fleetVehicleModel = getVehicleDisplayText(fleetItem.vehicleModel);
                  const fleetVehicleSummary = getFleetItemVehicleSummary(fleetItem);
                  const fleetLuggageLabel = formatFleetItemLuggageLabel(fleetItem);
                  const fleetTitle =
                    fleetItem.title ||
                    fleetVehicleModel ||
                    fleetItem.transportKind ||
                    `Транспорт ${index + 1}`;
                  const fleetUnitLabel =
                    fleetItem.priceUnitLabel || item.priceUnitLabel || "/ поездка";
                  const fleetPriceLabel = formatFleetPrice(fleetItem.priceFrom, fleetUnitLabel);
                  const fleetLeadOption = [fleetTitle, fleetVehicleSummary]
                    .filter(
                      (value, valueIndex, values): value is string =>
                        Boolean(value) && values.indexOf(value) === valueIndex,
                    )
                    .join(" • ");

                  return (
                    <article
                      key={`${item.id}-fleet-${fleetItem.id}-${index}`}
                      className="group relative overflow-hidden rounded-[20px] border border-olive/10 bg-white p-3 shadow-[0_2px_12px_rgba(58,43,35,0.06)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(58,43,35,0.1)] md:p-4"
                    >
                      <div className="relative overflow-hidden rounded-[14px] bg-[#ebe5d8]">
                        <div className="relative aspect-[4/3] overflow-hidden bg-[#ebe5d8]">
                          {fleetItem.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={fleetItem.photoUrl}
                              alt={fleetTitle}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-olive/40">
                              <AppIcon icon={Car} className="h-9 w-9" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col pt-4">
                        <h3 className="text-base font-bold leading-snug text-olive md:text-[1.1rem]">
                          {fleetTitle}
                        </h3>
                        <div className="mt-2 space-y-1">
                          {fleetVehicleSummary ? (
                            <div className="flex items-center gap-2 text-[13px] text-olive/75">
                              <AppIcon icon={Car} className="h-4 w-4 shrink-0 text-olive/45" />
                              <span>{fleetVehicleSummary}</span>
                            </div>
                          ) : null}
                          {fleetItem.seats ? (
                            <div className="flex items-center gap-2 text-[13px] text-olive/75">
                              <AppIcon icon={Users} className="h-4 w-4 shrink-0 text-olive/45" />
                              <span>
                                {fleetItem.seats}{" "}
                                {formatPlural(fleetItem.seats, "место", "места", "мест")}
                              </span>
                            </div>
                          ) : null}
                          {fleetLuggageLabel ? (
                            <div className="flex items-center gap-2 text-[13px] text-olive/75">
                              <AppIcon
                                icon={BriefcaseBusiness}
                                className="h-4 w-4 shrink-0 text-olive/45"
                              />
                              <span>{fleetLuggageLabel}</span>
                            </div>
                          ) : null}
                        </div>
                        {fleetItem.description ? (
                          <p className="mt-3 text-sm leading-6 text-olive/68">
                            {fleetItem.description}
                          </p>
                        ) : null}
                        <div className="mt-4 flex shrink-0 flex-row items-center justify-between gap-3 border-t border-olive/8 pt-3">
                          <div className="min-w-0">
                            <p className="text-xl font-bold leading-none text-olive md:text-[1.35rem]">
                              {formatFleetPriceAmount(fleetItem.priceFrom)}
                            </p>
                            <p className="mt-1 text-[12px] text-olive/55">
                              {fleetItem.priceFrom === null
                                ? "стоимость уточняется"
                                : fleetUnitLabel}
                            </p>
                          </div>
                          <TransferLeadForm
                            transferTitle={item.title}
                            locationName={item.locationName}
                            priceLabel={fleetPriceLabel}
                            vehicleOptions={[fleetLeadOption || fleetTitle]}
                            triggerLabel="Заказать"
                            triggerClassName="h-10 rounded-xl bg-[#e8621a] px-4 text-[13px] text-white hover:bg-[#d45615]"
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-olive/18 bg-cream/60 p-5 text-sm leading-6 text-olive/62">
                Конкретный автомобиль и стоимость водитель уточнит при обращении.
              </div>
            )}
          </section>

          {item.serviceArea || item.routeExamples ? (
            <section
              id="routes-panel"
              className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.06)] md:scroll-mt-[152px] md:p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                Направления
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-olive">Зона работы и маршруты</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {item.serviceArea ? (
                  <div className="rounded-[24px] bg-cream/72 p-4 text-sm leading-6 text-olive/72">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                      Зона работы
                    </p>
                    <p className="mt-2 font-semibold text-olive">{item.serviceArea}</p>
                  </div>
                ) : null}
                {item.routeExamples ? (
                  <div className="rounded-[24px] bg-cream/72 p-4 text-sm leading-6 text-olive/72">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                      Примеры маршрутов
                    </p>
                    <p className="mt-2 font-semibold text-olive">{item.routeExamples}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {item.latitude !== null && item.longitude !== null ? (
            <section
              id="map-panel"
              className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.06)] md:scroll-mt-[152px] md:p-6"
            >
              <h2 className="text-2xl font-semibold text-olive">Ориентир на карте</h2>
              <div className="mt-4">
                <StaticMapPreview
                  latitude={item.latitude}
                  longitude={item.longitude}
                  label={item.serviceArea ?? item.locationName ?? item.title}
                />
              </div>
            </section>
          ) : null}
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
          <section className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.07)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/55">
              Карточка водителя
            </p>
            <p className="mt-3 text-sm text-olive/52">Стоимость</p>
            <p className="mt-1 text-3xl font-extrabold leading-tight text-olive">{priceLabel}</p>
            <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-cream/72 p-3">
              <OwnerAvatar
                src={item.owner.avatarUrl}
                alt={contactName}
                initials={ownerInitials}
                className="h-12 w-12"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-olive">{contactName}</p>
                <p className="mt-0.5 text-xs text-primary/80">
                  {hasReviews
                    ? `${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
                    : "На связи"}
                </p>
              </div>
            </div>

            <div className="mt-4" data-transfer-contacts-panel>
              <PropertyContactsPanel
                phone={item.contacts.phone}
                phoneLabel={primaryPhoneLabel}
                phoneName={contactName}
                extraPhones={extraPhones}
                websiteUrl={item.contacts.websiteUrl}
                whatsappUrl={item.contacts.whatsappUrl}
                telegramUrl={item.contacts.telegramUrl}
                vkUrl={item.contacts.vkUrl}
                maxUrl={item.contacts.maxUrl}
                okUrl={item.contacts.okUrl}
                text={transferContactPanelText}
                secondaryContactsCompact
              />
            </div>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-olive/15 bg-white/97 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shadow-[0_-4px_24px_rgba(15,118,110,0.12)] backdrop-blur-sm lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <OwnerAvatar
                src={item.owner.avatarUrl}
                alt={contactName}
                initials={ownerInitials}
                className="h-10 w-10 bg-cream text-olive/55"
                fallbackClassName="text-xs font-semibold"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-olive">{contactName}</p>
                <p className="mt-0.5 truncate text-[11px] text-primary/85">Водитель на связи</p>
              </div>
            </div>
            {mobileMessengerLinks.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {mobileMessengerLinks.map((channel) => (
                  <a
                    key={channel.key}
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={channel.label}
                    aria-label={channel.label}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition active:scale-[0.96]",
                      getMobileMessengerChipClasses(channel.brand),
                    )}
                  >
                    {channel.brand === "website" ? (
                      <ContactWebsiteMark
                        websiteUrl={channel.href}
                        className="h-4 w-4"
                        iconClassName="text-primary"
                      />
                    ) : (
                      <ContactBrandMark brand={channel.brand} bare className="h-4 w-4" />
                    )}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="shrink-0">
            {phoneHref ? (
              <a
                href={phoneHref}
                className="btn-primary inline-flex h-11 min-w-[112px] items-center justify-center gap-2 rounded-2xl px-3.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,118,110,0.24)] sm:h-12 sm:min-w-[122px] sm:px-4"
              >
                <AppIcon icon={Phone} className="h-4 w-4" />
                Позвонить
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoTile({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-olive/42">
        <AppIcon icon={icon} className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-olive">{value}</p>
    </div>
  );
}
