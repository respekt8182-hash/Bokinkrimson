import { Fragment } from "react";
import Link from "next/link";
import {
  Baby,
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  Clock3,
  Compass,
  FileText,
  Flag,
  Languages,
  MapPin,
  Route,
  Sparkles,
  Star,
  Users,
  X,
  UtensilsCrossed,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PropertyContactsPanel } from "@/components/contacts/property-contacts-panel";
import { ExcursionLeadForm } from "@/components/excursions/excursion-lead-form";
import { ExcursionMobileBar } from "@/components/excursions/excursion-mobile-bar";
import { ExcursionMapPreview } from "@/components/maps/excursion-map-preview";
import { PropertyReviewsSection } from "@/components/reviews/property-reviews-section";
import { ExcursionFaq } from "@/components/excursions/excursion-faq";
import { ExcursionTimeline } from "@/components/excursions/excursion-timeline";
import { ExcursionPhotoGallery } from "@/components/excursions/excursion-photo-gallery";
import { ExcursionViewTracker } from "@/components/public/excursion-view-tracker";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import {
  buildProgramRouteSummary,
  formatAvailabilitySummary,
  formatProgramDuration,
  formatProgramPrice,
  getOfferTypeLabel,
} from "@/lib/excursion-offers";
import { getPublicExcursionByIdentifier, getPublicExcursionCatalog } from "@/lib/public-excursions";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

type PublicExcursionPageProps = {
  params: Promise<{ location: string; slug: string }>;
};

export async function generateMetadata({ params }: PublicExcursionPageProps): Promise<Metadata> {
  const { location, slug } = await params;
  const item = await getPublicExcursionByIdentifier(slug, location);

  if (!item) {
    return {
      title: "Программа не найдена",
      robots: { index: false, follow: false },
    };
  }

  const title = `${item.title ?? getOfferTypeLabel(item.offerType)} — ${item.locationName ?? "Крым"}`;
  const description = (
    item.description?.trim() || `${getOfferTypeLabel(item.offerType)} в ${item.locationName ?? "Крыму"}`
  ).slice(0, 160);
  const images = item.photoUrls.slice(0, 4);

  return {
    title,
    description,
    alternates: { canonical: item.path },
    openGraph: { type: "article", title, description, url: item.path, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function splitLines(value: string | null): string[] {
  if (!value) return [];
  return value.split(/\r?\n|;/g).map((s) => s.trim()).filter((s) => s.length > 0);
}

function formatExcursionFormat(value: string | null): string {
  if (value === "GROUP") return "Групповая";
  if (value === "PRIVATE" || value === "INDIVIDUAL") return "Индивидуальная";
  if (value === "VIP") return "VIP";
  return "Не указан";
}

function formatLanguages(codes: string[]): string {
  if (codes.length === 0) return "";
  const map: Record<string, string> = {
    ru: "Русский",
    en: "English",
    de: "Deutsch",
    fr: "Français",
    tr: "Türkçe",
    zh: "中文",
    uk: "Українська",
    ar: "العربية",
  };
  return codes.map((c) => map[c.toLowerCase()] ?? c.toUpperCase()).join(", ");
}

function formatCancellationPolicy(type: string | null, text: string | null): string | null {
  switch (type) {
    case "FLEXIBLE":
      return "Гибкая — бесплатная отмена за 24 ч";
    case "MODERATE":
      return "Умеренная — бесплатная отмена за 48 ч";
    case "STRICT":
      return "Строгая — платёж не возвращается";
    case "CUSTOM":
      return text ?? "Уточняется у организатора";
    default:
      return text ?? null;
  }
}

const WIDE_INFO_LABELS = new Set(["Даты", "Старт", "Финиш", "Маршрут", "Точка встречи", "Отмена"]);

type ExcursionInfoItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export default async function PublicExcursionPage({ params }: PublicExcursionPageProps) {
  const { location, slug } = await params;
  const session = await getSession();
  const item = await getPublicExcursionByIdentifier(slug, location, session?.id ?? null);

  if (!item) notFound();

  const canonicalPath = item.path;
  const currentPath = `/crimea/excursions/${location}/${slug}`;
  if (canonicalPath !== currentPath) redirect(canonicalPath);

  const similarCatalog = await getPublicExcursionCatalog({
    locationId: item.locationId ?? undefined,
    category: item.categoryName ?? undefined,
    pageSize: 9,
    sort: "rating_desc",
  });
  const similarItems = similarCatalog.items.filter((e) => e.id !== item.id).slice(0, 6);

  const bulletHighlights = item.highlights.length > 0 ? item.highlights : splitLines(item.shortDescription);
  const descriptionText = item.fullDescription || item.description;
  const routeSummary = buildProgramRouteSummary({
    routePoints: item.routeLocations.map((location) => location.name),
    startPoint: item.startPoint,
    finishPoint: item.finishPoint,
    mainLocationName: item.mainLocationName,
    anchorLocationName: item.anchorCityName,
    locationName: item.locationName,
    maxPoints: 4,
  });
  const durationLabel = formatProgramDuration(item);
  const priceLabel = formatProgramPrice(item);
  const availabilityLabel = formatAvailabilitySummary({
    availabilityMode: item.availabilityMode,
    scheduleText: item.scheduleText,
    availabilityNote: item.availabilityNote,
  });

  const included = item.includedItems.length > 0 ? item.includedItems : splitLines(item.includedText);
  const notIncluded = item.excludedItems.length > 0 ? item.excludedItems : splitLines(item.notIncludedText);

  const mapOverlayAddress =
    item.address ??
    item.meetingPointText ??
    item.startPoint ??
    item.anchorCityName ??
    item.locationName ??
    "Крым";

  const cancellationLabel = formatCancellationPolicy(
    item.cancellationPolicyType,
    item.cancellationPolicy,
  );
  const difficultyLabel: string | null = null;

  const infoItems: ExcursionInfoItem[] = [
    {
      label: "Формат",
      value: formatExcursionFormat(item.format),
      icon: Users,
    },
    {
      label: "Длительность",
      value: durationLabel,
      icon: Clock3,
    },
    {
      label: "Маршрут",
      value: routeSummary,
      icon: MapPin,
    },
    {
      label: "Старт",
      value: item.startPoint ?? "Не указан",
      icon: Flag,
    },
    ...(item.finishPoint
      ? [
          {
            label: "Финиш",
            value: item.finishPoint,
            icon: Flag,
          },
        ]
      : []),
    {
      label: "Точка встречи",
      value: item.meetingPointText ?? "По согласованию",
      icon: MapPin,
    },
    {
      label: "Трансфер",
      value: item.transferDetails
        ? item.transferDetails
        : item.pickupAvailable
          ? "Доступен (по согласованию)"
          : "Не предусмотрен",
      icon: Car,
    },
    ...(availabilityLabel
      ? [
          {
            label: "Даты",
            value: availabilityLabel,
            icon: CalendarDays,
          },
        ]
      : []),
    ...(item.languageCodes.length > 0
      ? [
          {
            label: "Язык",
            value: formatLanguages(item.languageCodes),
            icon: Languages,
          },
        ]
      : []),
    ...(item.isKidFriendly !== null
      ? [
          {
            label: "Для детей",
            value: item.isKidFriendly ? "Подходит" : "Только для взрослых",
            icon: Baby,
          },
        ]
      : []),
    ...(difficultyLabel
      ? [
          {
            label: "Сложность",
            value: difficultyLabel,
            icon: SlidersHorizontal,
          },
        ]
      : []),
    ...(cancellationLabel
      ? [
          {
            label: "Отмена",
            value: cancellationLabel,
            icon: CircleAlert,
          },
        ]
      : []),
  ];

  const organizerName = [
    item.contacts.firstName ?? item.owner.firstName,
    item.contacts.lastName ?? item.owner.lastName,
  ].filter(Boolean).join(" ") || "Организатор";

  const telegramUrl = normalizeTelegramProfileUrl(item.contacts.telegramUrl);

  const hasProgram = (item.offerType === "TOUR" && item.itineraryDays.length > 0) ||
    item.timeline.length > 0 ||
    (item.routeLocations.length > 0 && item.timeline.length === 0);

  const hasAccommodation = item.accommodationProvided !== null ||
    item.accommodationType ||
    item.mealPlan ||
    item.accommodationComment;

  const hasMap = item.latitude !== null && item.longitude !== null;

  /* ─── Section nav items ─── */
  const sectionNavItems = [
    { href: "#program-section", label: "Программа", show: hasProgram },
    { href: "#description-section", label: "Описание", show: Boolean(descriptionText) },
    { href: "#included-section", label: "Включено", show: true },
    { href: "#info-section", label: "Информация", show: true },
    { href: "#accommodation-section", label: "Проживание", show: Boolean(hasAccommodation) },
    { href: "#map-section", label: "Карта", show: hasMap },
    { href: "#reviews", label: "Отзывы", show: true },
    { href: "#faq-section", label: "FAQ", show: item.faqItems.length > 0 },
  ].filter((n) => n.show);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 md:px-6 md:py-8 lg:pb-8">
      <ExcursionViewTracker excursionId={item.id} />

      {/* ── Breadcrumbs ── */}
      <nav aria-label="Хлебные крошки" className="mb-5 text-xs text-olive/45">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="transition-colors hover:text-primary">Главная</Link></li>
          <li aria-hidden="true" className="text-olive/20">›</li>
          <li><Link href="/crimea/excursions" className="transition-colors hover:text-primary">Экскурсии</Link></li>
          {item.locationName && (
            <>
              <li aria-hidden="true" className="text-olive/20">›</li>
              <li>
                <Link
                  href={`/search?direction=excursions&location=${encodeURIComponent(item.locationName)}`}
                  className="transition-colors hover:text-primary"
                >
                  {item.locationName}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" className="text-olive/20">›</li>
          <li className="line-clamp-1 font-medium text-olive/70">{item.title ?? "Экскурсия"}</li>
        </ol>
      </nav>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── HERO: Gallery with overlay ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="relative mb-6 overflow-hidden rounded-3xl">
        {item.photoUrls.length > 0 ? (
          <ExcursionPhotoGallery photoUrls={item.photoUrls} title={item.title ?? undefined} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-3xl bg-cream text-sm text-olive/40 ring-1 ring-olive/10">
            Фото программы пока не загружены
          </div>
        )}

        {/* Desktop overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden bg-gradient-to-t from-midnight/75 via-midnight/40 to-transparent px-6 pb-6 pt-28 md:block">
          <div className="pointer-events-auto">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
                <AppIcon icon={Compass} className="mr-1 inline h-3 w-3" />
                {getOfferTypeLabel(item.offerType)}
              </span>
              {item.subtypeLabel && (
                <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
                  {item.subtypeLabel}
                </span>
              )}
              {(item.anchorCityName ?? item.locationName) && (
                <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
                  <AppIcon icon={MapPin} className="mr-1 inline h-3 w-3" />
                  {item.anchorCityName ?? item.locationName}
                </span>
              )}
              {item.avgRating >= 4.8 && item.reviewsCount > 0 && (
                <span className="rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-bold text-amber-900 backdrop-blur-sm">
                  <AppIcon icon={Sparkles} className="mr-1 inline h-3 w-3" />
                  Хит сезона
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-[2.6rem] md:leading-[1.12]">
              {item.title ?? getOfferTypeLabel(item.offerType)}
            </h1>
            <p className="mt-2 text-sm font-medium text-white/70">{routeSummary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium text-white/90 backdrop-blur-sm">
                <AppIcon icon={Star} className="h-4 w-4 text-amber-300" filled />
                {item.avgRating.toFixed(1)} · {item.reviewsCount} отзывов
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm text-white/85 backdrop-blur-sm">
                <AppIcon icon={Clock3} className="h-4 w-4" />
                {durationLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3.5 py-1 text-sm font-bold text-white backdrop-blur-sm">
                {priceLabel}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile-only info strip ── */}
      <div className="mb-6 space-y-3 px-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            <AppIcon icon={Compass} className="h-3 w-3" />
            {getOfferTypeLabel(item.offerType)}
          </span>
          {item.subtypeLabel && (
            <span className="rounded-full border border-olive/12 bg-white px-3 py-1 text-[11px] font-semibold text-olive/65">
              {item.subtypeLabel}
            </span>
          )}
          {(item.anchorCityName ?? item.locationName) && (
            <span className="rounded-full border border-olive/12 bg-sand/80 px-3 py-1 text-[11px] font-semibold text-olive/60">
              {item.anchorCityName ?? item.locationName}
            </span>
          )}
          {item.districtName && (
            <span className="rounded-full border border-olive/10 bg-sand/50 px-3 py-1 text-[11px] font-medium text-olive/45">
              {item.districtName}
            </span>
          )}
          {item.avgRating >= 4.8 && item.reviewsCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200/70">
              <AppIcon icon={Sparkles} className="h-3 w-3" />
              Хит сезона
            </span>
          )}
        </div>

        <h1 className="font-heading text-2xl leading-tight text-olive sm:text-3xl">
          {item.title ?? getOfferTypeLabel(item.offerType)}
        </h1>
        <p className="text-sm font-medium text-olive/65">{routeSummary}</p>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gradient-to-r from-primary/11 to-primary/7 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/12"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm shadow-[0_2px_8px_rgba(58,43,35,0.07)] ring-1 ring-olive/8">
            <AppIcon icon={Star} className="h-4 w-4 text-amber-400" filled />
            <span className="font-bold text-olive">{item.avgRating.toFixed(1)}</span>
            <span className="text-olive/30">·</span>
            <span className="text-olive/55">{item.reviewsCount} отзывов</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm shadow-[0_2px_8px_rgba(58,43,35,0.07)] ring-1 ring-olive/8">
            <AppIcon icon={Clock3} className="h-4 w-4 text-terra/55" />
            <span className="font-semibold text-olive">{durationLabel}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm ring-1 ring-primary/15">
            <span className="font-bold text-primary">{priceLabel}</span>
          </div>
          {item.isKidFriendly && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
              <AppIcon icon={Baby} className="h-4 w-4" />
              Для детей
            </span>
          )}
        </div>
      </div>

      {/* Desktop tags (below hero) */}
      {item.tags.length > 0 && (
        <div className="mb-6 hidden flex-wrap gap-2 md:flex">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gradient-to-r from-primary/11 to-primary/7 px-3.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/12"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Videos */}
      {item.videoUrls.length > 0 && (
        <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {item.videoUrls.map((url, i) => (
            <div key={`${url}-${i}`} className="overflow-hidden rounded-2xl bg-midnight/5">
              <video src={url} controls preload="metadata" className="h-48 w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── TWO-COLUMN LAYOUT ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,368px)]">
        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* ── Sticky section navigation ── */}
          <nav
            className="sticky top-4 z-20 overflow-x-auto rounded-2xl border border-olive/10 bg-white/94 px-2 shadow-[0_10px_26px_rgba(58,43,35,0.06)] backdrop-blur-sm"
            aria-label="Навигация по разделам"
          >
            <div className="flex min-w-max items-center gap-1">
              {sectionNavItems.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap rounded-xl px-3 py-3 text-sm font-medium text-olive/62 transition hover:bg-cream hover:text-olive"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>

          {/* ── Logistics pill ── */}
          {(item.startPoint || item.finishPoint || availabilityLabel) && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-terra/15 bg-gradient-to-r from-terra/6 to-transparent px-5 py-4 text-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/12 text-terra">
                <AppIcon icon={Flag} className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-terra/65">Организационная сводка</p>
                <p className="font-medium text-olive">
                  {item.startPoint ? `Старт: ${item.startPoint}` : availabilityLabel}
                  {item.finishPoint ? ` · Финиш: ${item.finishPoint}` : ""}
                  {item.startPoint && availabilityLabel ? ` · ${availabilityLabel}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* ── Description ── */}
          {descriptionText && (
            <article className="excursion-card p-7" id="description-section">
              <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/14 to-primary/7">
                  <AppIcon icon={FileText} className="h-4 w-4 text-primary" />
                </span>
                О программе
              </h2>
              <p className="whitespace-pre-line text-sm leading-[1.9] text-olive/80 md:text-[0.9375rem] md:leading-8">
                {descriptionText}
              </p>
            </article>
          )}

          {/* ── Highlights ── */}
          {bulletHighlights.length > 0 && (
            <article className="excursion-card p-7">
              <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/14 to-primary/7">
                  <AppIcon icon={Sparkles} className="h-4 w-4 text-primary" />
                </span>
                Что вас ждёт
              </h2>
              <ul className="space-y-2.5">
                {bulletHighlights.map((point, i) => (
                  <li
                    key={`${point}-${i}`}
                    className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/7 to-primary/3 px-4 py-3.5 text-sm text-olive/80 ring-1 ring-primary/10"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/18 text-primary">
                      <AppIcon icon={Check} className="h-3 w-3" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          )}

          {/* Fallback */}
          {!descriptionText && bulletHighlights.length === 0 && (
            <article className="excursion-card p-7" id="description-section">
              <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/14 to-primary/7">
                  <AppIcon icon={FileText} className="h-4 w-4 text-primary" />
                </span>
                О программе
              </h2>
              <p className="text-sm italic leading-7 text-olive/45">Описание пока не добавлено организатором.</p>
            </article>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* ── PROGRAM / ITINERARY ── */}
          {/* ══════════════════════════════════════════════════════ */}
          {item.offerType === "TOUR" && item.itineraryDays.length > 0 ? (
            <article className="excursion-card p-7" id="program-section">
              <h2 className="mb-6 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-terra/15 to-terra/7">
                  <AppIcon icon={Route} className="h-4 w-4 text-terra" />
                </span>
                Программа по дням
              </h2>
              <div className="space-y-4">
                {item.itineraryDays.map((day) => (
                  <div key={day.day} className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        День {day.day}
                      </span>
                      <h3 className="text-lg font-semibold text-olive">{day.title}</h3>
                    </div>
                    {day.teaser ? <p className="mt-2 text-sm text-olive/65">{day.teaser}</p> : null}
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-olive/80">{day.description}</p>
                    {day.locations.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {day.locations.map((loc) => (
                          <span key={`${day.day}-${loc}`} className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-olive/75">
                            {loc}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ) : item.timeline.length > 0 ? (
            <article className="excursion-card p-7" id="program-section">
              <h2 className="mb-6 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-terra/15 to-terra/7">
                  <AppIcon icon={Route} className="h-4 w-4 text-terra" />
                </span>
                Программа маршрута
              </h2>
              <ExcursionTimeline steps={item.timeline} />
            </article>
          ) : null}

          {/* Route locations (no timeline) */}
          {item.routeLocations.length > 0 && item.timeline.length === 0 && (
            <article className="excursion-card p-7" id={hasProgram && !item.timeline.length ? "program-section" : undefined}>
              <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-terra/15 to-terra/7">
                  <AppIcon icon={MapPin} className="h-4 w-4 text-terra" />
                </span>
                Маршрут
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {item.routeLocations.map((loc, i) => (
                  <Fragment key={loc.id}>
                    {i > 0 && (
                      <AppIcon icon={ChevronRight} className="h-4 w-4 shrink-0 opacity-50" />
                    )}
                    <span className="rounded-full bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/12">
                      {loc.name}
                    </span>
                  </Fragment>
                ))}
              </div>
            </article>
          )}

          {/* ── Accommodation & Meals ── */}
          {hasAccommodation && (
            <article className="excursion-card p-7" id="accommodation-section">
              <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/14 to-primary/7">
                  <AppIcon icon={Building2} className="h-4 w-4 text-primary" />
                </span>
                Проживание и питание
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {item.accommodationProvided !== null && (
                  <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3.5 text-sm text-olive">
                    <AppIcon icon={Building2} className="h-4 w-4 shrink-0 text-primary/60" />
                    Проживание: {item.accommodationProvided ? "включено" : "не включено"}
                  </div>
                )}
                {item.accommodationType && (
                  <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3.5 text-sm text-olive">
                    <AppIcon icon={Building2} className="h-4 w-4 shrink-0 text-primary/60" />
                    Тип: {item.accommodationType}
                  </div>
                )}
                {item.mealPlan && (
                  <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3.5 text-sm text-olive">
                    <AppIcon icon={UtensilsCrossed} className="h-4 w-4 shrink-0 text-primary/60" />
                    Питание: {item.mealPlan}
                  </div>
                )}
                {item.accommodationFormat && (
                  <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3.5 text-sm text-olive">
                    <AppIcon icon={Users} className="h-4 w-4 shrink-0 text-primary/60" />
                    Размещение: {item.accommodationFormat}
                  </div>
                )}
              </div>
              {item.accommodationComment && (
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-olive/75">
                  {item.accommodationComment}
                </p>
              )}
            </article>
          )}

          {/* ── Included / Not included ── */}
          <article className="excursion-card p-7" id="included-section">
            <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50/50">
                <AppIcon icon={CircleCheckBig} className="h-4 w-4 text-emerald-600" />
              </span>
              Включено в стоимость
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-transparent p-5 ring-1 ring-emerald-100/70">
                <p className="mb-3.5 flex items-center gap-2 text-sm font-bold text-emerald-800">
                  <AppIcon icon={CircleCheckBig} className="h-4 w-4 text-emerald-500" />
                  Включено
                </p>
                {included.length > 0 ? (
                  <ul className="space-y-2.5">
                    {included.map((line, i) => (
                      <li key={`${line}-${i}`} className="flex items-start gap-2.5 text-sm text-olive/80">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <AppIcon icon={Check} className="h-3 w-3" />
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-olive/45">Уточняется организатором.</p>
                )}
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent p-5 ring-1 ring-amber-100/70">
                <p className="mb-3.5 flex items-center gap-2 text-sm font-bold text-amber-800">
                  <AppIcon icon={CircleX} className="h-4 w-4 text-amber-500" />
                  Не включено
                </p>
                {notIncluded.length > 0 ? (
                  <ul className="space-y-2.5">
                    {notIncluded.map((line, i) => (
                      <li key={`${line}-${i}`} className="flex items-start gap-2.5 text-sm text-olive/80">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <AppIcon icon={X} className="h-3 w-3" />
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-olive/45">Дополнительные расходы не указаны.</p>
                )}
              </div>
            </div>
          </article>

          {/* ── Extra Options ── */}
          {item.extraOptions.length > 0 && (
            <article className="excursion-card p-7">
              <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/14 to-primary/7">
                  <AppIcon icon={Sparkles} className="h-4 w-4 text-primary" />
                </span>
                Дополнительные активности и опции
              </h2>
              <div className="grid gap-3">
                {item.extraOptions.map((option, index) => (
                  <div key={`${option.title}-${index}`} className="rounded-2xl border border-olive/10 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-olive">{option.title}</h3>
                      <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-olive/70">
                        {option.included
                          ? "Включено"
                          : option.price !== null && option.price !== undefined
                            ? `+ ${formatMoney(option.price, item.currency)}`
                            : "Оплачивается отдельно"}
                      </span>
                    </div>
                    {option.description && (
                      <p className="mt-2 text-sm leading-7 text-olive/75">{option.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </article>
          )}


          {/* ── Important info — bento grid ── */}
          <article className="excursion-card p-7" id="info-section">
            <h2 className="mb-5 flex items-center gap-3 font-heading text-xl text-olive">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sand">
                <AppIcon icon={CircleAlert} className="h-4 w-4" />
              </span>
              Важная информация
            </h2>
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {infoItems.map(({ label, value, icon }) => (
                <div
                  key={label}
                  className={`rounded-xl border border-olive/7 bg-gradient-to-br from-cream/80 to-cream/40 px-4 py-3.5 transition-colors hover:bg-cream/90 ${
                    WIDE_INFO_LABELS.has(label) ? "sm:col-span-2" : ""
                  }`}
                >
                  <dt className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-olive/35">
                    <AppIcon icon={icon} className="h-4 w-4 opacity-65" />
                    {label}
                  </dt>
                  <dd className="text-sm font-medium leading-snug text-olive">{value}</dd>
                </div>
              ))}
            </dl>

          </article>

          {/* ── Map ── */}
          {hasMap && (
            <article className="excursion-card overflow-hidden" id="map-section">
              <div className="px-7 pb-4 pt-6">
                <h3 className="flex items-center gap-2.5 font-heading text-lg text-olive">
                  <AppIcon icon={MapPin} className="h-4 w-4 text-terra" />
                  {item.offerType === "TOUR" ? "Маршрут на карте" : "Место встречи на карте"}
                </h3>
                {(item.address ?? item.startPoint) && (
                  <p className="mt-1.5 text-sm text-olive/50">{item.address ?? item.startPoint}</p>
                )}
              </div>
              <ExcursionMapPreview
                latitude={item.latitude!}
                longitude={item.longitude!}
                addressLabel={mapOverlayAddress}
                className="h-72 w-full"
              />
            </article>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── RIGHT SIDEBAR ── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
          {/* Glow effect */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-6 rounded-[36px] bg-gradient-to-br from-primary/10 via-foam/40 to-transparent blur-3xl"
              aria-hidden="true"
            />

            {/* Price + Lead Form card */}
            <article className="glass-booking relative overflow-hidden rounded-3xl">
              {/* Price header */}
              <div className="relative overflow-hidden bg-gradient-to-br from-primary via-[#0d7a73] to-primary-hover px-6 py-6">
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/6" aria-hidden="true" />
                <div className="pointer-events-none absolute -right-2 bottom-0 h-14 w-14 rounded-full bg-white/5" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/55">Стоимость</p>
                <p className="mt-1.5 font-heading text-4xl font-bold text-white">
                  {priceLabel}
                </p>
                {item.priceTo !== null && item.priceFrom !== null && item.priceTo > item.priceFrom && (
                  <p className="mt-1 text-sm text-white/50">до {formatMoney(item.priceTo, item.currency)}</p>
                )}
                {durationLabel && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs text-white/80">
                    <AppIcon icon={Clock3} className="h-3.5 w-3.5" />
                    {durationLabel}
                  </p>
                )}
              </div>

              {/* Pricing tiers */}
              {item.pricingTiers.length > 0 && (
                <div className="mx-5 mt-4 overflow-hidden divide-y divide-olive/7 rounded-xl border border-olive/8 bg-white/60">
                  {item.pricingTiers.map((tier, i) => (
                    <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-olive/55">{tier.label}</span>
                      <span className="font-bold text-olive">{formatMoney(tier.price, item.currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Lead form */}
              <div className="p-5">
                <h3 className="mb-3.5 text-center text-sm font-semibold text-olive">
                  Оставить заявку
                </h3>
                <ExcursionLeadForm
                  excursionTitle={item.title ?? getOfferTypeLabel(item.offerType)}
                  priceLabel={priceLabel}
                  durationLabel={durationLabel}
                  locationName={item.locationName}
                  whatsappUrl={item.contacts.whatsappUrl}
                  telegramUrl={telegramUrl}
                  phone={item.contacts.phone}
                  organizerName={organizerName}
                />
              </div>
            </article>
          </div>

          {/* Organizer contacts card */}
          <article className="glass-booking overflow-hidden rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-bold text-primary ring-2 ring-primary/15 ring-offset-1 ring-offset-white/50">
                {(item.contacts.firstName ?? item.owner.firstName ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-olive">{organizerName}</h2>
                <p className="text-xs text-olive/40">Организатор</p>
              </div>
            </div>
            <p className="mb-3.5 text-xs text-olive/50">Свяжитесь напрямую в мессенджере или по телефону.</p>
            <PropertyContactsPanel
              phone={item.contacts.phone}
              websiteUrl={item.contacts.websiteUrl}
              email={item.contacts.email}
              whatsappUrl={item.contacts.whatsappUrl}
              telegramUrl={item.contacts.telegramUrl}
              vkUrl={item.contacts.vkUrl}
              maxUrl={item.contacts.maxUrl}
              okUrl={item.contacts.okUrl}
            />
            <p className="mt-3 text-center text-xs text-olive/38">Подтверждение и оплата уточняются у организатора</p>
          </article>
        </aside>
      </div>

      {/* ── Mobile organizer contacts (below content) ── */}
      <div className="mt-5 lg:hidden" id="organizer-contacts-mobile">
        <article className="glass-booking overflow-hidden rounded-3xl">
          {/* Price header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-[#0d7a73] to-primary-hover px-6 py-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/6" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/55">Стоимость</p>
            <p className="mt-1 font-heading text-3xl font-bold text-white">{priceLabel}</p>
            {item.priceTo !== null && item.priceFrom !== null && item.priceTo > item.priceFrom && (
              <p className="mt-1 text-sm text-white/50">до {formatMoney(item.priceTo, item.currency)}</p>
            )}
          </div>

          {/* Pricing tiers */}
          {item.pricingTiers.length > 0 && (
            <div className="mx-5 mt-4 overflow-hidden divide-y divide-olive/7 rounded-xl border border-olive/8 bg-white/60">
              {item.pricingTiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span className="text-olive/55">{tier.label}</span>
                  <span className="font-bold text-olive">{formatMoney(tier.price, item.currency)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="p-5">
            {/* Organizer */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-bold text-primary ring-2 ring-primary/15 ring-offset-1 ring-offset-white/50">
                {(item.contacts.firstName ?? item.owner.firstName ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-olive">{organizerName}</h2>
                <p className="text-xs text-olive/40">Организатор</p>
              </div>
            </div>
            <PropertyContactsPanel
              phone={item.contacts.phone}
              websiteUrl={item.contacts.websiteUrl}
              email={item.contacts.email}
              whatsappUrl={item.contacts.whatsappUrl}
              telegramUrl={item.contacts.telegramUrl}
              vkUrl={item.contacts.vkUrl}
              maxUrl={item.contacts.maxUrl}
              okUrl={item.contacts.okUrl}
            />
            <p className="mt-3 text-center text-xs text-olive/38">Подтверждение и оплата уточняются у организатора</p>
          </div>
        </article>
      </div>

      {/* ── Similar excursions ── */}
      {similarItems.length > 0 && (
        <section className="mt-6 rounded-[20px] bg-white p-6 shadow-[0_2px_16px_rgba(15,118,110,0.05),0_8px_32px_rgba(58,43,35,0.06)] md:p-7">
          <h2 className="mb-5 font-heading text-2xl text-olive">Похожие программы</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {similarItems.map((card) => (
              <Link
                key={card.id}
                href={card.path}
                className="group overflow-hidden rounded-2xl border border-olive/8 bg-cream/60 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_36px_rgba(15,118,110,0.14)]"
              >
                {card.coverImageUrl ? (
                  <div className="overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.coverImageUrl}
                      alt={card.title}
                      loading="lazy"
                      decoding="async"
                      className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center bg-sand/60 text-xs text-olive/30">Без фото</div>
                )}
                <div className="p-3.5">
                  <p className="line-clamp-2 text-sm font-semibold text-olive">{card.title}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-xs text-olive/50">{card.routeSummary}</p>
                    <p className="text-xs font-bold text-primary">
                      {formatProgramPrice(card)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {item.faqItems.length > 0 && (
        <section className="mt-6 rounded-[20px] bg-white p-6 shadow-[0_2px_16px_rgba(15,118,110,0.05),0_8px_32px_rgba(58,43,35,0.06)] md:p-7" id="faq-section">
          <h2 className="mb-5 font-heading text-2xl text-olive">Частые вопросы</h2>
          <ExcursionFaq items={item.faqItems} />
        </section>
      )}

      {/* ── Reviews ── */}
      <div className="mt-6" id="reviews">
        <PropertyReviewsSection
          submitUrl={`/api/public/excursions/${encodeURIComponent(item.slug)}/reviews`}
          loadMoreUrl={`/api/public/excursions/${encodeURIComponent(item.slug)}/reviews`}
          entityPath={item.path}
          entityLabel="экскурсии"
          avgRating={item.avgRating}
          reviewsCount={item.reviewsCount}
          initialReviews={item.reviews}
          initialHasMore={item.reviewsCount > item.reviews.length}
          isAuthenticated={Boolean(session)}
          currentUserId={session?.id ?? null}
          ownerUserId={item.owner.id}
        />
      </div>

      {/* ── Navigation ── */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/search?direction=excursions&location=${encodeURIComponent(item.locationName ?? "")}`}
          className="flex items-center gap-1.5 rounded-xl border border-olive/18 px-4 py-2 text-sm font-medium text-olive/60 transition-colors hover:border-olive/25 hover:bg-cream"
        >
          <AppIcon icon={ChevronLeft} className="h-4 w-4" />
          Назад в каталог
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-olive/18 px-4 py-2 text-sm font-medium text-olive/60 transition-colors hover:border-olive/25 hover:bg-cream"
        >
          На главную
        </Link>
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      <ExcursionMobileBar
        priceLabel={priceLabel}
        availabilityLabel={availabilityLabel}
        excursionTitle={item.title ?? getOfferTypeLabel(item.offerType)}
        durationLabel={durationLabel}
        locationName={item.locationName}
        whatsappUrl={item.contacts.whatsappUrl}
        telegramUrl={telegramUrl}
        phone={item.contacts.phone}
        organizerName={organizerName}
      />
    </div>
  );
}
