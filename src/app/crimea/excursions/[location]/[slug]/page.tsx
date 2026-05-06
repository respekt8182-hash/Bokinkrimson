import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  Clock3,
  Compass,
  FileText,
  Languages,
  MapPin,
  Route,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionSessionStatus,
} from "@prisma/client";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { ExcursionSidebarActions } from "@/components/excursions/excursion-sidebar-actions";
import { ExcursionMobileBar } from "@/components/excursions/excursion-mobile-bar";
import { ExcursionFaq } from "@/components/excursions/excursion-faq";
import { InlinePhotoGallery } from "@/components/excursions/inline-photo-gallery";
import { ExcursionPhotoGallery } from "@/components/excursions/excursion-photo-gallery";
import { ExcursionPriceDisplay } from "@/components/excursions/excursion-price-display";
import { ExcursionTimeline } from "@/components/excursions/excursion-timeline";
import { StaticMapPreview } from "@/components/maps/static-map-preview";
import { NearbyPropertiesSection } from "@/components/public/nearby-properties-section";
import { ExcursionViewTracker } from "@/components/public/excursion-view-tracker";
import { PropertyReviewsSection } from "@/components/reviews/property-reviews-section";
import { JsonLd } from "@/components/seo/JsonLd";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import {
  buildProgramRouteSummary,
  formatProgramPrice,
  getOfferTypeLabel,
} from "@/lib/excursion-offers";
import { getFavoriteEntityTypeFromOfferType } from "@/lib/favorite-entities";
import {
  DEFAULT_NEARBY_RADIUS_KM,
  getNearbyExcursions,
  getNearbyProperties,
} from "@/lib/nearby-public";
import {
  getOwnerPreviewExcursionByIdentifier,
  getPublicExcursionByIdentifier,
} from "@/lib/public-excursions";
import { getPublicFirstName } from "@/lib/public-display-name";
import { buildSeoDescription, buildWebPageMetadata } from "@/lib/seo/metadata";
import {
  buildExcursionsHubPath,
  buildExcursionsLocationPath,
  buildHousingHubPath,
  buildHousingLocationPath,
  buildToursHubPath,
  excursionsHubPath,
  toursHubPath,
} from "@/lib/seo/routes";
import {
  buildBreadcrumbListStructuredData,
  buildFaqStructuredData,
  buildExcursionStructuredData,
} from "@/lib/seo/structured-data";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  formatItineraryItemIndexLabel,
  getExcursionSectionPhotoUrls,
  getItineraryDayPhotoUrls,
  getItineraryItemNoun,
  getItineraryProgramTitle,
  getTimelineStepPhotoUrls,
  resolveItineraryItemLabel,
} from "@/types/excursions";

type PublicExcursionPageProps = {
  params: Promise<{ location: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SectionNavItem = {
  href: string;
  label: string;
  show: boolean;
};

type BookingActionState = {
  label: string;
  title: string;
  hint: string;
  disabled: boolean;
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

function PublicBreadcrumbs({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const navClassName = [
    className,
    "-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav aria-label="Хлебные крошки" className={navClassName}>
      <ol className="flex min-w-max items-center gap-2 text-sm">
        {items.map((breadcrumb, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={`${breadcrumb.path}-${index}`}>
              <li>
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
              </li>
              {!isLast ? (
                <li aria-hidden="true" className="text-base leading-none text-olive/24">
                  ›
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function pickSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

type WeekdayId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const weekdayOrder: WeekdayId[] = [1, 2, 3, 4, 5, 6, 0];

const weekdayShortLabels: Record<WeekdayId, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

function formatMoney(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);

  if (currency === "RUB") {
    return `${formatted} ₽`;
  }

  return `${formatted} ${currency}`;
}

function splitLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|;/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitParagraphs(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n\s*\r?\n/g)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function rotateList<T>(values: T[], offset = 0): T[] {
  if (values.length <= 1) {
    return values;
  }

  const safeOffset = ((offset % values.length) + values.length) % values.length;
  if (safeOffset === 0) {
    return values;
  }

  return [...values.slice(safeOffset), ...values.slice(0, safeOffset)];
}

function buildSectionPhotoSet(
  primary: Array<string | null | undefined>,
  fallback: Array<string | null | undefined>,
  offset = 0,
  max = 3,
): string[] {
  const combined = uniqueStrings([...primary, ...fallback]);
  if (combined.length === 0) {
    return [];
  }

  return rotateList(combined, offset).slice(0, max);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength).trim();
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice = lastSpace >= Math.floor(maxLength * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${safeSlice.trim()}…`;
}

function buildHeroTeaser(values: Array<string | null | undefined>, maxLength = 220): string | null {
  const firstParagraph = uniqueStrings(values.flatMap((value) => splitParagraphs(value))).find(
    Boolean,
  );
  if (!firstParagraph) {
    return null;
  }

  const sentences = firstParagraph
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return truncateText(firstParagraph, maxLength);
  }

  let summary = "";
  for (const sentence of sentences) {
    const next = [summary, sentence].filter(Boolean).join(" ").trim();
    if (next.length > maxLength && summary) {
      break;
    }
    summary = next;
    if (summary.length >= Math.floor(maxLength * 0.7)) {
      break;
    }
  }

  return truncateText(summary || firstParagraph, maxLength);
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} ${many}`;
  }
  if (mod10 === 1) {
    return `${count} ${one}`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
}

function formatDurationLabel(input: {
  offerType: string;
  durationMinutes?: number | null;
  durationDays?: number | null;
  durationNights?: number | null;
}): string {
  if (input.offerType === "TOUR") {
    const days = input.durationDays ?? 0;
    const nights = input.durationNights ?? 0;

    if (days > 0 && nights > 0) {
      return `${pluralize(days, "день", "дня", "дней")} / ${pluralize(
        nights,
        "ночь",
        "ночи",
        "ночей",
      )}`;
    }
    if (days > 0) {
      return pluralize(days, "день", "дня", "дней");
    }
    if (nights > 0) {
      return pluralize(nights, "ночь", "ночи", "ночей");
    }
  }

  const minutes = input.durationMinutes ?? 0;
  if (minutes <= 0) {
    return "Длительность уточняется";
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours === 0) {
    return `${restMinutes} мин`;
  }
  if (restMinutes === 0) {
    return `${hours} ч`;
  }
  return `${hours} ч ${restMinutes} мин`;
}

function formatExcursionFormat(value: string | null): string | null {
  switch (value) {
    case "GROUP":
      return "Групповой";
    case "PRIVATE":
    case "INDIVIDUAL":
      return "Индивидуальный";
    case "VIP":
      return "VIP";
    default:
      return null;
  }
}

function formatDifficulty(value: ExcursionDifficulty | null): string | null {
  switch (value) {
    case ExcursionDifficulty.EASY:
      return "Лёгкий";
    case ExcursionDifficulty.MEDIUM:
      return "Средний";
    case ExcursionDifficulty.HARD:
      return "Активный";
    default:
      return null;
  }
}

function formatLanguages(codes: string[]): string {
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

  return codes.map((code) => map[code.toLowerCase()] ?? code.toUpperCase()).join(", ");
}

function formatCancellationPolicy(type: string | null, text: string | null): string | null {
  switch (type) {
    case "FLEXIBLE":
      return "Бесплатная отмена за 24 часа до старта";
    case "MODERATE":
      return "Бесплатная отмена за 48 часов до старта";
    case "STRICT":
      return "Строгие условия отмены, оплату уточняйте у организатора";
    case "CUSTOM":
      return text ?? "Условия отмены уточняются у организатора";
    default:
      return text ?? null;
  }
}

function formatMealPlan(value: string | null): string | null {
  switch (value) {
    case "NONE":
      return "Питание не включено";
    case "BREAKFAST":
      return "Завтраки включены";
    case "HALF_BOARD":
      return "Завтрак и ужин";
    case "FULL_BOARD":
      return "Полный пансион";
    case "ALL_INCLUSIVE":
      return "Всё включено";
    case "CUSTOM":
      return "Питание по программе";
    default:
      return value;
  }
}

function formatAccommodationType(value: string | null): string | null {
  switch (value) {
    case "HOTEL":
      return "Отель";
    case "GUESTHOUSE":
      return "Гостевой дом";
    case "HOSTEL":
      return "Хостел";
    case "CAMPING":
      return "Кемпинг";
    case "APARTMENT":
      return "Апартаменты";
    case "VILLA":
      return "Вилла";
    case "MIXED":
      return "Размещение по программе";
    default:
      return value;
  }
}

function formatRoomType(value: string): string {
  switch (value) {
    case "SINGLE":
      return "Одноместное";
    case "DOUBLE":
      return "Double";
    case "TWIN":
      return "Twin";
    case "TRIPLE":
      return "Трёхместное";
    case "SHARED":
      return "Общее размещение";
    case "CAMPING":
      return "Палатка";
    default:
      return value;
  }
}

function formatTransportMode(value: string): string {
  switch (value) {
    case "WALKING":
      return "Пешком";
    case "BUS":
      return "Автобус";
    case "MINIVAN":
      return "Минивэн";
    case "CAR":
      return "Автомобиль";
    case "JEEP":
      return "Джип";
    case "ATV":
      return "Квадроцикл";
    case "BOAT":
      return "Катер";
    case "TRAIN":
      return "Поезд";
    case "FLIGHT":
      return "Перелёт";
    case "MIXED":
      return "Смешанный транспорт";
    default:
      return value;
  }
}

function formatDepartureMode(value: string | null): string | null {
  switch (value) {
    case "FIXED_DATES":
      return "Фиксированные заезды";
    case "ON_REQUEST":
      return "Старт по запросу";
    case "DAILY":
      return "Ежедневно";
    case "SEASONAL":
      return "Сезонный график";
    case "PRIVATE_ONLY":
      return "Только под индивидуальный запрос";
    default:
      return null;
  }
}

function formatGroupSizeLabel(min: number | null, max: number | null): string | null {
  if (min && max) {
    if (min === max) {
      return `${min} чел.`;
    }
    return `${min}–${max} чел.`;
  }
  if (max) {
    return `до ${max} чел.`;
  }
  if (min) {
    return `от ${min} чел.`;
  }
  return null;
}

function formatAgeLabel(ageLimit: number | null, isKidFriendly: boolean | null): string | null {
  if (ageLimit !== null && ageLimit !== undefined) {
    return `От ${ageLimit} лет`;
  }
  if (isKidFriendly === true) {
    return "Можно с детьми";
  }
  if (isKidFriendly === false) {
    return "Только для взрослых";
  }
  return null;
}

function formatBookingNotice(hours: number | null): string | null {
  if (hours === null || hours === undefined) {
    return null;
  }
  if (hours < 24) {
    return `Бронирование минимум за ${hours} ч до старта`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (restHours === 0) {
    return `Бронирование минимум за ${pluralize(days, "день", "дня", "дней")}`;
  }
  return `Бронирование минимум за ${pluralize(days, "день", "дня", "дней")} и ${restHours} ч`;
}

function formatSessionStatus(status: ExcursionSessionStatus): string {
  switch (status) {
    case ExcursionSessionStatus.AVAILABLE:
      return "Есть места";
    case ExcursionSessionStatus.SOLD_OUT:
      return "Мест нет";
    case ExcursionSessionStatus.CANCELED:
      return "Заезд отменён";
    default:
      return status;
  }
}

function formatShortDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatSessionDateRange(startAt: string, endAt: string | null): string {
  const start = new Date(startAt);
  if (!endAt) {
    return formatShortDate(start);
  }

  const end = new Date(endAt);
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return formatShortDate(start);
  }

  return `${formatShortDate(start)} — ${formatShortDate(end)}`;
}

function formatIsoDayMonth(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatScheduleWeekdays(days: number[]): string {
  const normalized = weekdayOrder.filter((day) => days.includes(day));

  if (normalized.length === 7) {
    return "Ежедневно";
  }
  if (normalized.length === 5 && normalized.every((day, index) => day === weekdayOrder[index])) {
    return "По будням";
  }
  if (normalized.length === 2 && normalized[0] === 6 && normalized[1] === 0) {
    return "По выходным";
  }
  if (normalized.length === 0) {
    return "По договорённости";
  }

  return normalized.map((day) => weekdayShortLabels[day]).join(", ");
}

function formatScheduleRuleSummary(
  rule: {
    dateFrom: string | null;
    dateTo: string | null;
    weekdays: number[];
    timeStarts: string[];
    durationMinutes: number | null;
    capacityDefault: number | null;
    priceOverride: number | null;
  },
  input: {
    currency: string;
    priceUnitLabel: string | null;
    primaryDurationMinutes?: number | null;
  },
): { label: string; note: string | null } {
  const dayLabel = formatScheduleWeekdays(rule.weekdays);
  const timesLabel = rule.timeStarts.length > 0 ? `в ${rule.timeStarts.join(", ")}` : "";
  const label = [dayLabel, timesLabel].filter(Boolean).join(" ").trim();

  const noteParts: string[] = [];
  if (rule.dateFrom || rule.dateTo) {
    if (rule.dateFrom && rule.dateTo) {
      noteParts.push(`${formatIsoDayMonth(rule.dateFrom)} — ${formatIsoDayMonth(rule.dateTo)}`);
    } else if (rule.dateFrom) {
      noteParts.push(`с ${formatIsoDayMonth(rule.dateFrom)}`);
    } else if (rule.dateTo) {
      noteParts.push(`до ${formatIsoDayMonth(rule.dateTo)}`);
    }
  }
  if (rule.durationMinutes && !input.primaryDurationMinutes) {
    noteParts.push(
      formatDurationLabel({
        offerType: "EXCURSION",
        durationMinutes: rule.durationMinutes,
      }),
    );
  }
  if (rule.capacityDefault) {
    noteParts.push(`до ${rule.capacityDefault} чел.`);
  }
  if (rule.priceOverride !== null && rule.priceOverride !== undefined) {
    const unitSuffix = input.priceUnitLabel ? ` / ${input.priceUnitLabel}` : "";
    noteParts.push(`от ${formatMoney(rule.priceOverride, input.currency)}${unitSuffix}`);
  }

  return {
    label: label || "По расписанию",
    note: noteParts.length > 0 ? noteParts.join(" · ") : null,
  };
}

function buildScheduleExceptionSummary(
  exceptions: Array<{
    date: string;
    isClosed: boolean;
    overrideTimeStarts: string[];
    overridePrice: number | null;
    notes: string | null;
  }>,
  input: { currency: string; priceUnitLabel: string | null },
): string[] {
  const summaries: string[] = [];
  const closedDates = exceptions
    .filter((entry) => entry.isClosed)
    .slice(0, 3)
    .map((entry) => formatIsoDayMonth(entry.date));

  if (closedDates.length > 0) {
    summaries.push(`Исключения в расписании: ${closedDates.join(", ")}`);
  }

  const adjustedDates = exceptions
    .filter(
      (entry) =>
        !entry.isClosed &&
        (entry.overrideTimeStarts.length > 0 ||
          entry.overridePrice !== null ||
          Boolean(entry.notes?.trim())),
    )
    .slice(0, 2)
    .map((entry) => {
      const parts = [formatIsoDayMonth(entry.date)];
      if (entry.overrideTimeStarts.length > 0) {
        parts.push(entry.overrideTimeStarts.join(", "));
      }
      if (entry.overridePrice !== null && entry.overridePrice !== undefined) {
        const unitSuffix = input.priceUnitLabel ? ` / ${input.priceUnitLabel}` : "";
        parts.push(`от ${formatMoney(entry.overridePrice, input.currency)}${unitSuffix}`);
      }
      if (entry.notes?.trim()) {
        parts.push(entry.notes.trim());
      }
      return parts.join(" · ");
    });

  if (adjustedDates.length > 0) {
    summaries.push(`Отдельные даты: ${adjustedDates.join("; ")}`);
  }

  return summaries;
}

function getAvailabilityBadgeLabel(input: {
  availabilityMode: ExcursionAvailabilityMode;
  sessionsCount: number;
  departureMode: string | null;
}): string {
  const departureLabel = formatDepartureMode(input.departureMode);
  if (departureLabel) {
    return departureLabel;
  }
  if (input.availabilityMode === ExcursionAvailabilityMode.ON_REQUEST) {
    return "По запросу";
  }
  if (input.availabilityMode === ExcursionAvailabilityMode.DATED || input.sessionsCount > 0) {
    return "Фиксированные даты";
  }
  return "По расписанию";
}

function getBookingActionState(input: {
  receiveRequests: boolean;
  availabilityMode: ExcursionAvailabilityMode;
  availableSessionsCount: number;
  upcomingSessionsCount: number;
}): BookingActionState {
  if (!input.receiveRequests) {
    return {
      label: "Набор закрыт",
      title: "Новые заявки временно не принимаются",
      hint: "Организатор временно закрыл набор на этот тур.",
      disabled: true,
    };
  }

  if (input.availabilityMode === ExcursionAvailabilityMode.ON_REQUEST) {
    return {
      label: "Оставить заявку",
      title: "Подобрать даты под вас",
      hint: "Организатор согласует дату, программу и детали поездки вручную.",
      disabled: false,
    };
  }

  if (input.availableSessionsCount > 0) {
    return {
      label: "Запросить место",
      title: "Выбрать ближайший заезд",
      hint: "Ниже есть ближайшие старты. Отправьте запрос организатору и уточните детали.",
      disabled: false,
    };
  }

  if (input.upcomingSessionsCount > 0) {
    return {
      label: "Узнать о новых датах",
      title: "Ближайшие заезды уже заняты",
      hint: "Можно запросить следующую свободную дату или лист ожидания.",
      disabled: false,
    };
  }

  return {
    label: "Уточнить даты",
    title: "Расписание подтверждается организатором",
    hint: "Напишите организатору, чтобы подтвердить удобную дату и наличие мест.",
    disabled: false,
  };
}

function getExcursionBookingActionState(input: {
  receiveRequests: boolean;
  availabilityMode: ExcursionAvailabilityMode;
  availableSessionsCount: number;
  upcomingSessionsCount: number;
}): BookingActionState {
  if (!input.receiveRequests) {
    return {
      label: "Набор закрыт",
      title: "Новые заявки временно не принимаются",
      hint: "Организатор временно закрыл бронирование этой экскурсии.",
      disabled: true,
    };
  }

  if (input.availabilityMode === ExcursionAvailabilityMode.ON_REQUEST) {
    return {
      label: "Оставить заявку",
      title: "Подобрать дату под вас",
      hint: "Организатор согласует удобную дату, формат участия и детали встречи вручную.",
      disabled: false,
    };
  }

  if (input.availableSessionsCount > 0) {
    return {
      label: "Запросить место",
      title: "Ближайшие даты уже доступны",
      hint: "Выберите подходящий слот и отправьте запрос организатору на подтверждение.",
      disabled: false,
    };
  }

  if (input.upcomingSessionsCount > 0) {
    return {
      label: "Узнать о следующей дате",
      title: "Ближайшие слоты уже заняты",
      hint: "Можно запросить следующую свободную дату или уточнить лист ожидания.",
      disabled: false,
    };
  }

  return {
    label: "Уточнить даты",
    title: "Расписание подтверждается организатором",
    hint: "Напишите организатору, чтобы уточнить ближайшие старты и наличие мест.",
    disabled: false,
  };
}

function buildSessionPriceLabel(input: {
  priceOverride: number | null;
  currency: string;
  fallbackPriceLabel: string;
  priceUnitLabel: string | null;
}): string {
  if (input.priceOverride === null || input.priceOverride === undefined) {
    return input.fallbackPriceLabel;
  }

  const unit = input.priceUnitLabel?.trim();
  if (!unit) {
    return `от ${formatMoney(input.priceOverride, input.currency)}`;
  }

  return `от ${formatMoney(input.priceOverride, input.currency)} / ${unit}`;
}

function SectionCard(props: { id?: string; icon: LucideIcon; title: string; children: ReactNode }) {
  const { id, icon, title, children } = props;

  return (
    <article className="excursion-card relative overflow-hidden p-6 md:p-7" id={id}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
      />
      <div className="mb-6 flex items-center gap-3.5">
        <span className="icon-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <AppIcon icon={icon} className="h-[18px] w-[18px] text-primary" />
        </span>
        <h2 className="font-heading text-lg leading-tight text-olive md:text-[1.3rem]">{title}</h2>
      </div>
      {children}
    </article>
  );
}

function SectionJumpNav({ items }: { items: SectionNavItem[] }) {
  const visibleItems = items.filter((entry) => entry.show);

  if (visibleItems.length <= 1) {
    return null;
  }

  return (
    <nav
      className="rounded-[1.6rem] border border-olive/10 bg-white/92 p-2 shadow-[0_14px_34px_-24px_rgba(58,43,35,0.6)] backdrop-blur-sm"
      aria-label="\u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f \u043f\u043e \u0440\u0430\u0437\u0434\u0435\u043b\u0430\u043c"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleItems.map((entry) => (
          <a
            key={entry.href}
            href={entry.href}
            className="rounded-xl px-3 py-2 text-sm font-medium text-olive/62 transition hover:bg-cream hover:text-olive"
          >
            {entry.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function SectionPhotoGallery(props: { label?: string; photoUrls: string[]; className?: string }) {
  const { label, photoUrls, className } = props;

  if (photoUrls.length === 0) {
    return null;
  }

  return (
    <aside
      className={joinClassNames(
        "rounded-[1.75rem] border border-olive/10 bg-white/95 p-4 shadow-[0_18px_38px_-30px_rgba(58,43,35,0.5)]",
        className,
      )}
    >
      {label ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-olive/42">
          {label}
        </p>
      ) : null}

      <InlinePhotoGallery photoUrls={photoUrls} title={label ?? "Фотографии"} />
    </aside>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: PublicExcursionPageProps): Promise<Metadata> {
  const { location, slug } = await params;
  const query = searchParams ? await searchParams : {};
  const previewRequested = pickSearchParam(query.preview) === "1";
  const session = previewRequested ? await getSession() : null;
  const previewItem =
    previewRequested && session
      ? await getOwnerPreviewExcursionByIdentifier(slug, session.id, location)
      : null;
  const item = previewItem ?? (await getPublicExcursionByIdentifier(slug, location));
  if (!item) {
    notFound();
  }

  if (!item) {
    return {
      title: "Тур не найден",
      robots: { index: false, follow: false },
    };
  }

  const title = `${item.title ?? getOfferTypeLabel(item.offerType)} — ${item.locationName ?? "Крым"}`;
  const metadataDescription = buildSeoDescription({
    preferred: [item.shortDescription, item.description],
    fallbackParts: [
      `${getOfferTypeLabel(item.offerType)} в ${item.locationName ?? "Крыму"}`,
      item.anchorCityName ? `Отправление из ${item.anchorCityName}` : null,
      item.districtName ? `Маршрут проходит по району ${item.districtName}` : null,
      item.priceFrom !== null ? `Цена от ${formatMoney(item.priceFrom, item.currency)}` : null,
      item.reviewsCount > 0
        ? `${pluralize(item.reviewsCount, "отзыв", "отзыва", "отзывов")} путешественников`
        : null,
      "Программа, фото, условия участия и прямой контакт с организатором",
    ],
  });
  const images = item.photoUrls.slice(0, 4);
  return buildWebPageMetadata({
    title,
    description: metadataDescription,
    path: item.path,
    images,
    robots: previewRequested ? { index: false, follow: false } : undefined,
  });
}

export default async function PublicExcursionPage({
  params,
  searchParams,
}: PublicExcursionPageProps) {
  const { location, slug } = await params;
  const query = searchParams ? await searchParams : {};
  const previewRequested = pickSearchParam(query.preview) === "1";
  const session = await getSession();
  const previewItem =
    previewRequested && session
      ? await getOwnerPreviewExcursionByIdentifier(slug, session.id, location, session.id)
      : null;
  const item =
    previewItem ?? (await getPublicExcursionByIdentifier(slug, location, session?.id ?? null));
  const isPreview = previewItem !== null;

  if (!item) {
    notFound();
  }

  const canonicalPath = item.path;
  const currentPath = `/crimea/excursions/${location}/${slug}`;
  if (canonicalPath !== currentPath) {
    if (isPreview) {
      redirect(`${canonicalPath}?preview=1`);
    }
    permanentRedirect(canonicalPath);
  }

  const nearbyProperties = await getNearbyProperties({
    latitude: item.latitude,
    longitude: item.longitude,
    radiusKm: DEFAULT_NEARBY_RADIUS_KM,
    limit: 4,
    randomize: true,
  });
  const similarItems = await getNearbyExcursions({
    latitude: item.latitude,
    longitude: item.longitude,
    excludeId: item.id,
    radiusKm: DEFAULT_NEARBY_RADIUS_KM * 2,
    limit: 6,
  });

  const durationLabel = formatDurationLabel({
    offerType: item.offerType,
    durationMinutes: item.durationMinutes,
    durationDays: item.durationDays,
    durationNights: item.durationNights,
  });
  const priceLabel = formatProgramPrice(item);
  const routeSummary = buildProgramRouteSummary({
    routePoints: item.routeLocations.map((entry) => entry.name),
    startPoint: item.startPoint,
    finishPoint: item.finishPoint,
    mainLocationName: item.mainLocationName,
    anchorLocationName: item.anchorCityName,
    locationName: item.locationName,
    maxPoints: 4,
  });
  const availabilityLabel = item.availabilitySummary;
  const cancellationLabel = formatCancellationPolicy(
    item.cancellationPolicyType,
    item.cancellationPolicy,
  );
  const overviewLead = buildHeroTeaser([
    item.shortDescription?.trim() ?? null,
    item.fullDescription?.trim() ?? null,
    item.description?.trim() ?? null,
  ]);
  const descriptionText =
    item.fullDescription?.trim() ||
    item.description?.trim() ||
    (overviewLead && overviewLead.length > 180 ? overviewLead : null);
  const bodyDescriptionText =
    uniqueStrings([
      item.fullDescription?.trim() ?? null,
      item.description?.trim() ?? null,
      item.shortDescription?.trim() ?? null,
    ]).find((entry) => entry !== overviewLead) ?? null;
  const bodyDescriptionPreview = bodyDescriptionText
    ? truncateText(bodyDescriptionText.replace(/\s+/g, " ").trim(), 420)
    : null;
  const explicitHighlights = uniqueStrings(item.highlights)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0 && item.length <= 120);
  const bulletHighlights = explicitHighlights.slice(0, 5);
  const included =
    item.includedItems.length > 0 ? item.includedItems : splitLines(item.includedText);
  const excluded =
    item.excludedItems.length > 0 ? item.excludedItems : splitLines(item.notIncludedText);
  const scheduleNote = formatBookingNotice(item.minBookingNoticeHours);
  const hasPublishedReviews = item.reviewsCount > 0 && item.avgRating > 0;
  const formatLabel = formatExcursionFormat(item.format);
  const difficultyLabel = formatDifficulty(item.difficulty);
  const groupSizeLabel = formatGroupSizeLabel(item.groupSizeMin, item.groupSizeMax);
  const ageLabel = formatAgeLabel(item.ageLimit, item.isKidFriendly);
  const mealPlanLabel = formatMealPlan(item.mealPlan);
  const accommodationTypeLabel = formatAccommodationType(item.accommodationType);
  const departureModeLabel = formatDepartureMode(item.departureMode);
  const roomTypeLabels = item.roomTypes.map(formatRoomType);
  const transportModeLabels = item.transportModes.map(formatTransportMode);
  const itineraryMealHighlights = uniqueStrings(
    item.itineraryDays.flatMap((day) => [
      ...(day.mealsIncluded ?? []),
      ...(day.meals ? [day.meals] : []),
    ]),
  );
  const itineraryItemLabel = resolveItineraryItemLabel(item.itineraryDays[0]?.itemLabel);

  const upcomingSessions = item.sessions;
  const availableSessions = upcomingSessions.filter(
    (entry) => entry.status === ExcursionSessionStatus.AVAILABLE,
  );
  const nextAvailableSession = availableSessions[0] ?? null;
  const bookingAction = getBookingActionState({
    receiveRequests: item.receiveRequests,
    availabilityMode: item.availabilityMode,
    availableSessionsCount: availableSessions.length,
    upcomingSessionsCount: upcomingSessions.length,
  });
  const excursionBookingAction = getExcursionBookingActionState({
    receiveRequests: item.receiveRequests,
    availabilityMode: item.availabilityMode,
    availableSessionsCount: availableSessions.length,
    upcomingSessionsCount: upcomingSessions.length,
  });

  const hasAccommodationDetails =
    item.accommodationProvided === true ||
    Boolean(item.accommodationNights && item.accommodationNights > 0) ||
    Boolean(item.accommodationType) ||
    Boolean(item.accommodationFormat) ||
    Boolean(item.accommodationComment) ||
    Boolean(item.accommodationStars) ||
    item.roomTypes.length > 0 ||
    item.singleSupplementAvailable !== null;
  const hasMeals =
    Boolean(mealPlanLabel && mealPlanLabel !== "Питание не включено") ||
    Boolean(item.mealDetails) ||
    itineraryMealHighlights.length > 0;
  const hasAvailabilitySection =
    availabilityLabel.length > 0 ||
    upcomingSessions.length > 0 ||
    Boolean(item.availabilityNote) ||
    Boolean(item.scheduleText) ||
    scheduleNote !== null;
  const hasProgram =
    (item.offerType === "TOUR" && item.itineraryDays.length > 0) ||
    item.timeline.length > 0 ||
    item.routeLocations.length > 0 ||
    Boolean(item.routeDescription);
  const hasLogistics =
    Boolean(item.startPoint) ||
    Boolean(item.finishPoint) ||
    Boolean(item.meetingPointText) ||
    item.pickupLocations.length > 0 ||
    item.routeLocations.length > 0 ||
    Boolean(item.transferDetails) ||
    Boolean(item.arrivalInfo) ||
    Boolean(item.departureInfo) ||
    Boolean(item.routeDescription);
  const hasRequirements =
    Boolean(difficultyLabel) ||
    Boolean(ageLabel) ||
    item.physicalRequirements.length > 0 ||
    item.whatToBring.length > 0 ||
    item.documentsRequired.length > 0 ||
    item.equipmentProvided.length > 0 ||
    item.insuranceIncluded !== null ||
    Boolean(item.insuranceComment) ||
    Boolean(item.safetyInfo) ||
    Boolean(item.routeConditions) ||
    item.hasGuideLicense;
  const whatsappUrl = normalizeWhatsappUrl(item.contacts.whatsappUrl);
  const telegramUrl = normalizeTelegramProfileUrl(item.contacts.telegramUrl);
  const vkUrl = normalizeVkProfileUrl(item.contacts.vkUrl);
  const maxUrl = normalizeMaxProfileUrl(item.contacts.maxUrl);
  const okUrl = normalizeOkProfileUrl(item.contacts.okUrl);
  const directContactActions = Boolean(
    item.contacts.phone ||
    item.contacts.phone2 ||
    whatsappUrl ||
    telegramUrl ||
    vkUrl ||
    maxUrl ||
    okUrl,
  );
  const organizerName =
    getPublicFirstName(item.contacts.firstName ?? item.owner.firstName) ?? "Организатор";
  const effectiveBookingAction = item.offerType === "TOUR" ? bookingAction : excursionBookingAction;
  const showLeadForm = !effectiveBookingAction.disabled && directContactActions;
  const leadRequestActionLabel = "Отправить запрос";
  const meetingSummary =
    item.meetingPointText ??
    item.startPoint ??
    item.address ??
    "Точную точку встречи организатор пришлёт после подтверждения";
  const meetingSummaryNote = item.pickupAvailable
    ? item.pickupLocations.length > 0
      ? `Точки сбора: ${item.pickupLocations
          .slice(0, 3)
          .map((entry) => entry.name)
          .join(", ")}`
      : item.transferDetails?.trim() || "Трансфер или сбор согласуются отдельно"
    : item.finishPoint
      ? `Финиш: ${item.finishPoint}`
      : null;
  const formatSummary =
    [formatLabel, groupSizeLabel].filter(Boolean).join(" · ") || "Формат участия уточняется";
  const scheduleSummaryValue = nextAvailableSession
    ? `Ближайшая дата: ${formatSessionDateRange(
        nextAvailableSession.startAt,
        nextAvailableSession.endAt,
      )}`
    : availabilityLabel;
  const regularScheduleItems = item.scheduleRules.map((rule) =>
    formatScheduleRuleSummary(rule, {
      currency: item.currency,
      priceUnitLabel: item.priceUnitLabel,
      primaryDurationMinutes: item.durationMinutes,
    }),
  );
  const scheduleExceptionNotes = buildScheduleExceptionSummary(item.scheduleExceptions, {
    currency: item.currency,
    priceUnitLabel: item.priceUnitLabel,
  });
  const hasMeaningfulRouteSummary =
    item.routeLocations.length > 0 ||
    Boolean(item.routeDescription?.trim()) ||
    Boolean(item.finishPoint?.trim() && item.finishPoint !== item.startPoint);
  const mapLatitude = item.meetingPointLat ?? item.latitude;
  const mapLongitude = item.meetingPointLng ?? item.longitude;
  const hasMap = mapLatitude !== null && mapLongitude !== null;
  const mapOverlayAddress =
    item.meetingPointText ??
    item.address ??
    item.startPoint ??
    item.anchorCityName ??
    item.locationName ??
    "Крым";
  const ratingLine = hasPublishedReviews
    ? `${item.avgRating.toFixed(1)} · ${pluralize(item.reviewsCount, "отзыв", "отзыва", "отзывов")}`
    : "Пока без отзывов";

  const heroBadges = [
    { label: getOfferTypeLabel(item.offerType), icon: Compass, tone: "solid" as const },
    ...(item.subtypeLabel
      ? [{ label: item.subtypeLabel, icon: Sparkles, tone: "soft" as const }]
      : []),
    {
      label: getAvailabilityBadgeLabel({
        availabilityMode: item.availabilityMode,
        sessionsCount: upcomingSessions.length,
        departureMode: item.departureMode,
      }),
      icon: CalendarDays,
      tone: "soft" as const,
    },
    ...(hasAccommodationDetails
      ? [{ label: "С проживанием", icon: Building2, tone: "soft" as const }]
      : []),
    ...(hasMeals
      ? [{ label: "Питание включено", icon: UtensilsCrossed, tone: "soft" as const }]
      : []),
    ...(item.instantConfirmation
      ? [{ label: "Быстрое подтверждение", icon: CircleCheckBig, tone: "trust" as const }]
      : []),
    ...(item.hasGuideLicense
      ? [{ label: "Лицензированный гид", icon: CircleCheckBig, tone: "trust" as const }]
      : []),
  ];

  const audienceSummary = uniqueStrings([difficultyLabel, ageLabel]).join(" · ") || null;
  const tourHeroSummaryFacts: Array<{ icon: LucideIcon; value: string }> = [
    {
      icon: Clock3,
      value: durationLabel,
    },
    {
      icon: Users,
      value: formatSummary,
    },
    ...(item.languageCodes.length > 0
      ? [
          {
            icon: Languages,
            value: formatLanguages(item.languageCodes),
          },
        ]
      : []),
    ...(item.startPoint || item.meetingPointText || item.pickupAvailable
      ? [
          {
            icon: MapPin,
            value: item.startPoint ?? item.meetingPointText ?? "По согласованию",
          },
        ]
      : []),
    ...(audienceSummary
      ? [
          {
            icon: SlidersHorizontal,
            value: audienceSummary,
          },
        ]
      : []),
  ];

  const galleryPhotoUrls = uniqueStrings(item.photoUrls);
  const itineraryPhotoUrls = uniqueStrings(
    item.itineraryDays.flatMap((day) => getItineraryDayPhotoUrls(day)),
  );
  const timelinePhotoUrls = uniqueStrings(
    item.timeline.flatMap((step) => getTimelineStepPhotoUrls(step)),
  );
  const programSpecificPhotoUrls =
    item.offerType === "TOUR" ? itineraryPhotoUrls : timelinePhotoUrls;
  const datesPhotoUrls =
    getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "dates").length > 0
      ? getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "dates")
      : buildSectionPhotoSet(programSpecificPhotoUrls, galleryPhotoUrls, 0);
  const programFallbackPhotoUrls =
    getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "program").length > 0
      ? getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "program")
      : programSpecificPhotoUrls.length === 0
        ? buildSectionPhotoSet(galleryPhotoUrls, [], 2)
        : [];
  const logisticsPhotoUrls =
    getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "logistics").length > 0
      ? getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "logistics")
      : buildSectionPhotoSet(galleryPhotoUrls, programSpecificPhotoUrls, 2);
  const accommodationPhotoUrls =
    getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "accommodation").length > 0
      ? getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "accommodation")
      : buildSectionPhotoSet(itineraryPhotoUrls, galleryPhotoUrls, 0);
  const includedPhotoUrls =
    getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "included").length > 0
      ? getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "included")
      : buildSectionPhotoSet(galleryPhotoUrls, programSpecificPhotoUrls, 1);
  const requirementsPhotoUrls =
    getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "requirements").length > 0
      ? getExcursionSectionPhotoUrls(item.sectionPhotoGroups, "requirements")
      : buildSectionPhotoSet(galleryPhotoUrls, programSpecificPhotoUrls, 3);
  const overviewNavLabel = item.offerType === "TOUR" ? "О туре" : "Об экскурсии";
  const hasOverviewSection = Boolean(
    overviewLead || descriptionText || bodyDescriptionText || hasMeaningfulRouteSummary,
  );

  const sectionNavItems: SectionNavItem[] = [
    {
      href: "#overview-section",
      label: overviewNavLabel,
      show: hasOverviewSection || bulletHighlights.length > 0,
    },
    { href: "#dates-section", label: "Даты", show: hasAvailabilitySection },
    { href: "#program-section", label: "Программа", show: hasProgram },
    { href: "#logistics-section", label: "Логистика", show: hasLogistics || hasMap },
    {
      href: "#accommodation-section",
      label: "Проживание",
      show: hasAccommodationDetails || hasMeals,
    },
    { href: "#included-section", label: "Что включено", show: true },
    { href: "#requirements-section", label: "Требования", show: hasRequirements },
    { href: "#reviews", label: "Отзывы", show: true },
    { href: "#faq-section", label: "FAQ", show: item.faqItems.length > 0 },
  ];

  const listingHubHref = item.offerType === "TOUR" ? toursHubPath : excursionsHubPath;
  const catalogHref =
    item.offerType === "TOUR"
      ? item.locationName
        ? buildToursHubPath({ location: item.locationName })
        : listingHubHref
      : item.locationId
        ? buildExcursionsLocationPath(item.locationId)
        : item.locationName
          ? buildExcursionsHubPath({ location: item.locationName })
          : listingHubHref;
  const housingCatalogHref = item.locationId
    ? buildHousingLocationPath(item.locationId)
    : item.locationName
      ? buildHousingHubPath({ location: item.locationName })
      : buildHousingHubPath();
  const favoriteEntityType = getFavoriteEntityTypeFromOfferType(item.offerType);
  const listingHubLabel = item.offerType === "TOUR" ? "Туры по Крыму" : "Экскурсии по Крыму";
  const breadcrumbItems = [
    { name: "Главная", path: "/" },
    { name: listingHubLabel, path: listingHubHref },
    ...(item.locationName ? [{ name: item.locationName, path: catalogHref }] : []),
    { name: item.title ?? getOfferTypeLabel(item.offerType), path: item.path },
  ];
  const faqStructuredData = !isPreview ? buildFaqStructuredData(item.faqItems) : null;

  if (item.offerType !== "TOUR") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-36 md:px-6 md:py-8 lg:pb-8">
        {!isPreview ? <JsonLd data={buildBreadcrumbListStructuredData(breadcrumbItems)} /> : null}
        {!isPreview ? <JsonLd data={buildExcursionStructuredData(item)} /> : null}
        {faqStructuredData ? <JsonLd data={faqStructuredData} /> : null}
        {!isPreview ? <ExcursionViewTracker excursionId={item.id} /> : null}

        {isPreview ? (
          <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-3 text-sm text-olive shadow-sm">
            <p className="font-semibold text-primary">Предпросмотр карточки</p>
            <p className="mt-1 text-olive/72">
              Сейчас открыта owner-only версия страницы. Её видите только вы, пока программа не
              опубликована.
            </p>
          </section>
        ) : null}

        <PublicBreadcrumbs items={breadcrumbItems} className="mb-5" />

        <div className="space-y-5">
          <section className="space-y-5">
            <div className="relative">
              {item.photoUrls.length > 0 ? (
                <ExcursionPhotoGallery photoUrls={item.photoUrls} title={item.title ?? undefined} />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-2xl bg-cream/70 text-sm text-olive/40 border border-olive/8">
                  Фотографии экскурсии появятся здесь после загрузки
                </div>
              )}
              <div className="absolute right-4 top-4 z-20 hidden md:bottom-5 md:right-5 md:top-auto md:block">
                <FavoriteToggleButton
                  itemId={item.id}
                  entityType={favoriteEntityType}
                  initialIsFavorite={false}
                />
              </div>
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,368px)]">
            <div className="min-w-0 space-y-6">
              <section className="space-y-3.5">
                <h1 className="font-heading text-2xl leading-tight text-olive md:text-[2rem] md:leading-[1.12]">
                  {item.title ?? getOfferTypeLabel(item.offerType)}
                </h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-olive/58">
                  <span className="inline-flex items-center gap-1.5">
                    <AppIcon icon={MapPin} className="h-3.5 w-3.5 text-olive/35" />
                    {[item.anchorCityName ?? item.locationName, item.districtName]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  {hasPublishedReviews ? (
                    <span className="inline-flex items-center gap-1.5">
                      <AppIcon icon={Star} className="h-3.5 w-3.5 text-amber-400" filled />
                      <span className="font-semibold text-olive/68">{ratingLine}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-olive/45">
                      <AppIcon icon={Sparkles} className="h-3.5 w-3.5 text-primary/60" />
                      Новая экскурсия
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between md:hidden">
                  <FavoriteToggleButton
                    itemId={item.id}
                    entityType={favoriteEntityType}
                    initialIsFavorite={false}
                  />
                </div>

                <p className="max-w-3xl text-[15px] leading-7 text-olive/68">
                  {overviewLead ?? routeSummary ?? "Подробное описание пока не добавлено."}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {item.subtypeLabel ? (
                    <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                      {item.subtypeLabel}
                    </span>
                  ) : null}
                  {item.categoryName ? (
                    <span className="rounded-full border border-olive/8 bg-cream/60 px-3 py-1 text-xs font-medium text-olive/60">
                      {item.categoryName}
                    </span>
                  ) : null}
                  {item.pickupAvailable ? (
                    <span className="rounded-full border border-terra/12 bg-terra/6 px-3 py-1 text-xs font-medium text-terra">
                      Есть трансфер
                    </span>
                  ) : null}
                  {item.instantConfirmation ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Мгновенное подтверждение
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-olive/8 bg-white px-5 py-3.5 text-sm text-olive/72">
                  <span className="inline-flex items-center gap-1.5">
                    <AppIcon icon={Clock3} className="h-4 w-4 text-primary/55" />
                    <span className="font-medium text-olive">{durationLabel}</span>
                  </span>
                  <span className="hidden text-olive/18 sm:inline" aria-hidden="true">
                    &middot;
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <AppIcon icon={Users} className="h-4 w-4 text-primary/55" />
                    <span className="font-medium text-olive">{formatSummary}</span>
                  </span>
                  {item.languageCodes.length > 0 ? (
                    <>
                      <span className="hidden text-olive/18 sm:inline" aria-hidden="true">
                        &middot;
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <AppIcon icon={Languages} className="h-4 w-4 text-primary/55" />
                        <span className="font-medium text-olive">
                          {formatLanguages(item.languageCodes)}
                        </span>
                      </span>
                    </>
                  ) : null}
                  <span className="hidden text-olive/18 sm:inline" aria-hidden="true">
                    &middot;
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <AppIcon icon={MapPin} className="h-4 w-4 text-primary/55" />
                    <span className="font-medium text-olive">
                      {item.startPoint ?? item.meetingPointText ?? "По согласованию"}
                    </span>
                  </span>
                </div>
              </section>

              <SectionJumpNav items={sectionNavItems} />

              <SectionCard id="overview-section" icon={FileText} title="Об экскурсии">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
                  <div className="space-y-4">
                    {bodyDescriptionText ? (
                      bodyDescriptionPreview &&
                      bodyDescriptionPreview !== bodyDescriptionText.replace(/\s+/g, " ").trim() ? (
                        <div className="space-y-3">
                          <p className="text-sm leading-8 text-olive/78">
                            {bodyDescriptionPreview}
                          </p>
                          <details className="group rounded-2xl border border-olive/10 bg-white">
                            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-olive">
                              Читать полное описание
                              <AppIcon
                                icon={ChevronDown}
                                className="h-4 w-4 text-olive/45 transition group-open:rotate-180"
                              />
                            </summary>
                            <div className="border-t border-olive/8 px-4 py-4">
                              <p className="whitespace-pre-line text-sm leading-8 text-olive/78">
                                {bodyDescriptionText}
                              </p>
                            </div>
                          </details>
                        </div>
                      ) : (
                        <p className="whitespace-pre-line text-sm leading-8 text-olive/78">
                          {bodyDescriptionText}
                        </p>
                      )
                    ) : (
                      <p className="text-sm leading-8 text-olive/62">
                        Подробное описание пока не добавлено.
                      </p>
                    )}

                    {hasMeaningfulRouteSummary && routeSummary ? (
                      <div className="rounded-2xl border border-terra/15 bg-gradient-to-r from-terra/6 to-transparent px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-terra/70">
                          Маршрут
                        </p>
                        <p className="mt-2 text-sm font-medium text-olive">{routeSummary}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    {bulletHighlights.length > 0 ? (
                      <div>
                        <p className="mb-3 text-sm font-semibold text-olive">Ключевые пункты</p>
                        <ul className="space-y-2.5">
                          {bulletHighlights.slice(0, 5).map((point, index) => (
                            <li
                              key={`${point}-${index}`}
                              className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/7 to-primary/3 px-4 py-3.5 text-sm text-olive/80 ring-1 ring-primary/10"
                            >
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/18 text-primary">
                                <AppIcon icon={Check} className="h-3 w-3" />
                              </span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {item.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-olive/10 bg-white px-3 py-1 text-xs font-medium text-olive/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {item.videoUrls.length > 0 ? (
                  <details
                    className="mt-5 rounded-2xl border border-olive/10 bg-white"
                    open={item.videoUrls.length === 1}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-olive">
                      Смотреть видео экскурсии
                      <AppIcon icon={ChevronDown} className="h-4 w-4 text-olive/45" />
                    </summary>
                    <div className="grid gap-3 border-t border-olive/8 px-4 py-4 sm:grid-cols-2">
                      {item.videoUrls.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="overflow-hidden rounded-2xl bg-midnight/5"
                        >
                          <video
                            src={url}
                            controls
                            preload="metadata"
                            className="h-52 w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </SectionCard>

              {hasProgram ? (
                <SectionCard id="program-section" icon={Route} title="Программа экскурсии">
                  {item.routeDescription ? (
                    <p className="mb-4 text-sm leading-7 text-olive/68">{item.routeDescription}</p>
                  ) : null}

                  {programFallbackPhotoUrls.length > 0 ? (
                    <SectionPhotoGallery
                      label="Фото маршрута"
                      photoUrls={programFallbackPhotoUrls}
                      className="mb-4"
                    />
                  ) : null}

                  {item.timeline.length > 0 ? (
                    <ExcursionTimeline steps={item.timeline} />
                  ) : item.routeLocations.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {item.routeLocations.map((locationEntry, index) => (
                        <Fragment key={`${locationEntry.id}-${locationEntry.sortOrder}`}>
                          {index > 0 ? (
                            <AppIcon
                              icon={ChevronRight}
                              className="h-4 w-4 shrink-0 text-olive/35"
                            />
                          ) : null}
                          <span className="rounded-full bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/12">
                            {locationEntry.name}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}

              {hasLogistics || hasMap ? (
                <SectionCard id="logistics-section" icon={MapPin} title="Место встречи и маршрут">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                        Точка встречи
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-olive">
                        {meetingSummary}
                      </p>
                      {meetingSummaryNote ? (
                        <p className="mt-2 text-sm leading-6 text-olive/60">{meetingSummaryNote}</p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                        Старт и финиш
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-olive">
                        {item.startPoint ?? "Старт уточняется после подтверждения"}
                      </p>
                      {item.finishPoint ? (
                        <p className="mt-2 text-sm leading-6 text-olive/60">
                          Финиш: {item.finishPoint}
                        </p>
                      ) : null}
                    </div>

                    {item.transferDetails || item.pickupAvailable || item.address ? (
                      <div className="rounded-2xl border border-olive/10 bg-white px-4 py-4 lg:col-span-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                          Логистика
                        </p>
                        <div className="mt-2 space-y-2 text-sm leading-7 text-olive/72">
                          {item.transferDetails ? <p>{item.transferDetails}</p> : null}
                          {item.pickupAvailable && item.pickupLocations.length > 0 ? (
                            <p>
                              Точки сбора:{" "}
                              {item.pickupLocations.map((entry) => entry.name).join(", ")}
                            </p>
                          ) : null}
                          {item.address ? <p>Адрес ориентира: {item.address}</p> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {logisticsPhotoUrls.length > 0 ? (
                    <SectionPhotoGallery
                      label="Фото места встречи и маршрута"
                      photoUrls={logisticsPhotoUrls}
                      className="mt-4"
                    />
                  ) : null}

                  {item.routeLocations.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-olive/10 bg-white px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                        Маршрут
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.routeLocations.map((locationEntry, index) => (
                          <Fragment key={`${locationEntry.id}-${locationEntry.sortOrder}-route`}>
                            {index > 0 ? (
                              <AppIcon
                                icon={ChevronRight}
                                className="h-4 w-4 shrink-0 text-olive/35"
                              />
                            ) : null}
                            <span className="rounded-full bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/12">
                              {locationEntry.name}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {hasMap ? (
                    <StaticMapPreview
                      latitude={mapLatitude!}
                      longitude={mapLongitude!}
                      label={mapOverlayAddress}
                      className="mt-4"
                    />
                  ) : null}
                </SectionCard>
              ) : null}

              {hasAvailabilitySection ? (
                <SectionCard id="dates-section" icon={CalendarDays} title="Даты и бронирование">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-olive/10 bg-gradient-to-r from-cream/80 to-white px-5 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/38">
                          Доступность
                        </p>
                        <p className="mt-2 text-base font-semibold text-olive">
                          {availabilityLabel}
                        </p>
                        {item.availabilityNote ? (
                          <p className="mt-1 text-sm leading-6 text-olive/60">
                            {item.availabilityNote}
                          </p>
                        ) : null}
                        {item.scheduleText && item.scheduleText !== availabilityLabel ? (
                          <p className="mt-1 text-sm leading-6 text-olive/60">
                            {item.scheduleText}
                          </p>
                        ) : null}
                      </div>

                      {upcomingSessions.length > 0 ? (
                        <div className="grid gap-3">
                          {upcomingSessions.slice(0, 5).map((entry) => (
                            <div
                              key={entry.id}
                              className={
                                entry.status === ExcursionSessionStatus.AVAILABLE
                                  ? "rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-white px-4 py-4"
                                  : "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-4"
                              }
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold text-olive">
                                    {formatSessionDateRange(entry.startAt, entry.endAt)}
                                  </p>
                                  <p className="mt-1 text-sm text-olive/58">
                                    {buildSessionPriceLabel({
                                      priceOverride: entry.priceOverride,
                                      currency: item.currency,
                                      fallbackPriceLabel: priceLabel,
                                      priceUnitLabel: item.priceUnitLabel,
                                    })}
                                  </p>
                                </div>
                                <span
                                  className={
                                    entry.status === ExcursionSessionStatus.AVAILABLE
                                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80"
                                      : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/80"
                                  }
                                >
                                  {formatSessionStatus(entry.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-olive/10 bg-white px-5 py-5">
                          <p className="text-sm leading-7 text-olive/72">
                            {effectiveBookingAction.hint}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <SectionPhotoGallery label="Фото расписания" photoUrls={datesPhotoUrls} />

                      {regularScheduleItems.length > 0 ? (
                        <div className="rounded-2xl border border-olive/10 bg-white px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                            Регулярное расписание
                          </p>
                          <div className="mt-3 space-y-3">
                            {regularScheduleItems.map((entry, index) => (
                              <div
                                key={`${entry.label}-${index}`}
                                className="rounded-xl bg-cream/55 px-3 py-3"
                              >
                                <p className="text-sm font-semibold text-olive">{entry.label}</p>
                                {entry.note ? (
                                  <p className="mt-1 text-xs leading-5 text-olive/58">
                                    {entry.note}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {hasAccommodationDetails || hasMeals ? (
                <SectionCard
                  id="accommodation-section"
                  icon={Building2}
                  title="Проживание и питание"
                >
                  <div
                    className={`grid gap-4 ${hasAccommodationDetails && hasMeals ? "xl:grid-cols-2" : ""}`}
                  >
                    {hasAccommodationDetails ? (
                      <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                        <div className="flex items-center gap-2">
                          <AppIcon icon={Building2} className="h-4 w-4 text-primary" />
                          <h3 className="text-base font-semibold text-olive">Проживание</h3>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-olive/74">
                          <p>
                            {item.accommodationProvided === false
                              ? "Проживание не входит в стоимость."
                              : item.accommodationProvided === true
                                ? "Проживание входит в стоимость."
                                : "Условия проживания уточняются у организатора."}
                          </p>
                          {item.accommodationNights ? (
                            <p>
                              {pluralize(
                                item.accommodationNights,
                                "ночь проживания",
                                "ночи проживания",
                                "ночей проживания",
                              )}
                            </p>
                          ) : null}
                          {accommodationTypeLabel ? (
                            <p>Тип размещения: {accommodationTypeLabel}</p>
                          ) : null}
                          {item.accommodationFormat ? (
                            <p>Формат размещения: {item.accommodationFormat}</p>
                          ) : null}
                          {item.accommodationStars ? (
                            <p>Категория: {item.accommodationStars}</p>
                          ) : null}
                          {roomTypeLabels.length > 0 ? (
                            <p>Доступные комнаты: {roomTypeLabels.join(", ")}</p>
                          ) : null}
                          {item.singleSupplementAvailable ? (
                            <p>
                              Есть одноместное размещение
                              {item.singleSupplementPrice
                                ? ` (+ ${formatMoney(item.singleSupplementPrice, item.currency)})`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                        {item.accommodationComment ? (
                          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-olive/72 ring-1 ring-olive/8">
                            {item.accommodationComment}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {hasMeals ? (
                      <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                        <div className="flex items-center gap-2">
                          <AppIcon icon={UtensilsCrossed} className="h-4 w-4 text-primary" />
                          <h3 className="text-base font-semibold text-olive">Питание</h3>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-olive/74">
                          {mealPlanLabel ? <p>{mealPlanLabel}</p> : null}
                          {item.mealDetails ? <p>{item.mealDetails}</p> : null}
                          {itineraryMealHighlights.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {itineraryMealHighlights.map((meal) => (
                                <span
                                  key={meal}
                                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80"
                                >
                                  {meal}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {accommodationPhotoUrls.length > 0 ? (
                    <SectionPhotoGallery
                      label={hasAccommodationDetails ? "Фото проживания" : "Фото условий и питания"}
                      photoUrls={accommodationPhotoUrls}
                      className="mt-4"
                    />
                  ) : null}
                </SectionCard>
              ) : null}

              <SectionCard
                id="included-section"
                icon={CircleCheckBig}
                title="Что включено в стоимость"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-transparent p-5 ring-1 ring-emerald-100/70">
                    <p className="mb-3.5 flex items-center gap-2 text-sm font-bold text-emerald-800">
                      <AppIcon icon={CircleCheckBig} className="h-4 w-4 text-emerald-500" />
                      Включено
                    </p>
                    {included.length > 0 ? (
                      <ul className="space-y-2.5">
                        {included.map((line, index) => (
                          <li
                            key={`${line}-${index}`}
                            className="flex items-start gap-2.5 text-sm text-olive/80"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <AppIcon icon={Check} className="h-3 w-3" />
                            </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-olive/45">
                        Список включённых услуг организатор пока не заполнил.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent p-5 ring-1 ring-amber-100/70">
                    <p className="mb-3.5 flex items-center gap-2 text-sm font-bold text-amber-800">
                      <AppIcon icon={CircleX} className="h-4 w-4 text-amber-500" />
                      Не включено
                    </p>
                    {excluded.length > 0 ? (
                      <ul className="space-y-2.5">
                        {excluded.map((line, index) => (
                          <li
                            key={`${line}-${index}`}
                            className="flex items-start gap-2.5 text-sm text-olive/80"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                              <AppIcon icon={CircleAlert} className="h-3 w-3" />
                            </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-olive/45">
                        Дополнительные расходы не указаны.
                      </p>
                    )}
                  </div>
                </div>

                {item.extraOptions.length > 0 ||
                item.pricingTiers.length > 0 ||
                cancellationLabel ? (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {item.extraOptions.length > 0 ? (
                      <details
                        className="rounded-2xl border border-olive/10 bg-white"
                        open={item.extraOptions.length <= 2}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-olive">
                          Дополнительные опции
                          <AppIcon icon={ChevronDown} className="h-4 w-4 text-olive/45" />
                        </summary>
                        <div className="grid gap-3 border-t border-olive/8 px-4 py-4">
                          {item.extraOptions.map((option, index) => (
                            <div
                              key={`${option.title}-${index}`}
                              className="rounded-2xl bg-cream/50 px-4 py-4 ring-1 ring-olive/8"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-olive">
                                  {option.title}
                                </h3>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-olive/65 ring-1 ring-olive/10">
                                  {option.included
                                    ? "Уже включено"
                                    : option.price !== null && option.price !== undefined
                                      ? `+ ${formatMoney(option.price, item.currency)}`
                                      : "Оплачивается отдельно"}
                                </span>
                              </div>
                              {option.description ? (
                                <p className="mt-2 text-sm leading-7 text-olive/72">
                                  {option.description}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="space-y-4">
                      {item.pricingTiers.length > 0 ? (
                        <div className="rounded-2xl border border-olive/10 bg-white px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                            Тарифы
                          </p>
                          <div className="mt-3 space-y-2">
                            {item.pricingTiers.map((tier, index) => (
                              <div
                                key={`${tier.label}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-xl bg-cream/55 px-3 py-3 text-sm"
                              >
                                <span className="text-olive/68">{tier.label}</span>
                                <span className="font-semibold text-olive">
                                  {formatMoney(tier.price, item.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {scheduleNote ? (
                        <div className="rounded-2xl border border-olive/10 bg-sand/55 px-4 py-4 text-sm text-olive/72">
                          {scheduleNote}
                        </div>
                      ) : null}

                      {scheduleExceptionNotes.length > 0 ? (
                        <div className="rounded-2xl border border-olive/10 bg-white px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                            Важные уточнения
                          </p>
                          <div className="mt-3 space-y-2 text-sm leading-6 text-olive/68">
                            {scheduleExceptionNotes.map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {cancellationLabel ? (
                        <div className="rounded-2xl border border-olive/10 bg-white px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                            Отмена и изменения
                          </p>
                          <p className="mt-2 text-sm text-olive/72">{cancellationLabel}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {includedPhotoUrls.length > 0 ? (
                  <SectionPhotoGallery
                    label="Фото услуг и деталей"
                    photoUrls={includedPhotoUrls}
                    className="mt-4"
                  />
                ) : null}
              </SectionCard>

              {hasRequirements ? (
                <SectionCard
                  id="requirements-section"
                  icon={CircleAlert}
                  title="Требования и подготовка"
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                      <h3 className="text-base font-semibold text-olive">Кому подойдёт</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {difficultyLabel ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-olive/70 ring-1 ring-olive/10">
                            Сложность: {difficultyLabel}
                          </span>
                        ) : null}
                        {ageLabel ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-olive/70 ring-1 ring-olive/10">
                            {ageLabel}
                          </span>
                        ) : null}
                        {item.isKidFriendly === true ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                            Можно с детьми
                          </span>
                        ) : null}
                        {item.hasGuideLicense ? (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/12">
                            Лицензированный гид
                          </span>
                        ) : null}
                      </div>

                      {item.physicalRequirements.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-olive">Физическая нагрузка</p>
                          <ul className="mt-3 space-y-2 text-sm text-olive/72">
                            {item.physicalRequirements.map((line) => (
                              <li key={line} className="flex items-start gap-2.5">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terra" />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                      <h3 className="text-base font-semibold text-olive">Что взять с собой</h3>
                      {item.whatToBring.length > 0 ? (
                        <ul className="mt-4 space-y-2 text-sm text-olive/72">
                          {item.whatToBring.map((line) => (
                            <li key={line} className="flex items-start gap-2.5">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-4 text-sm leading-7 text-olive/58">
                          Специальный список вещей не указан. Если сомневаетесь, уточните детали у
                          организатора перед выездом.
                        </p>
                      )}
                    </div>
                  </div>

                  {item.documentsRequired.length > 0 ||
                  item.equipmentProvided.length > 0 ||
                  item.safetyInfo ||
                  item.routeConditions ||
                  item.insuranceComment ? (
                    <div className="mt-4 rounded-2xl border border-olive/10 bg-white px-5 py-4 text-sm leading-7 text-olive/68">
                      {item.documentsRequired.length > 0 ? (
                        <p>Документы: {item.documentsRequired.join(", ")}</p>
                      ) : null}
                      {item.equipmentProvided.length > 0 ? (
                        <p>Что выдаёт организатор: {item.equipmentProvided.join(", ")}</p>
                      ) : null}
                      {item.safetyInfo ? <p>{item.safetyInfo}</p> : null}
                      {item.routeConditions ? <p>{item.routeConditions}</p> : null}
                      {item.insuranceComment ? <p>{item.insuranceComment}</p> : null}
                    </div>
                  ) : null}

                  {requirementsPhotoUrls.length > 0 ? (
                    <SectionPhotoGallery
                      label="Фото подготовки и требований"
                      photoUrls={requirementsPhotoUrls}
                      className="mt-4"
                    />
                  ) : null}
                </SectionCard>
              ) : null}
            </div>

            <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start">
              <div className="lg:w-full lg:max-w-[368px]">
                <div className="space-y-4">
                  <article className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,243,236,0.92))] shadow-[0_28px_72px_rgba(58,43,35,0.14)] ring-1 ring-olive/8">
                    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,#0f766e_0%,#0d7069_48%,#125d76_100%)] px-5 pb-5 pt-4 text-center">
                      <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)]" />
                      <div className="absolute -left-6 bottom-3 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
                      <div className="absolute -right-8 top-2 h-24 w-24 rounded-full bg-white/14 blur-2xl" />
                      <ExcursionPriceDisplay
                        priceLabel={priceLabel}
                        tone="dark"
                        align="center"
                        className="mt-2"
                      />
                      <p className="mx-auto mt-3 max-w-[286px] rounded-full border border-white/14 bg-white/10 px-4 py-1.5 text-[13px] leading-5 text-white/84 shadow-[0_14px_28px_rgba(8,39,41,0.16)] backdrop-blur-sm">
                        {scheduleSummaryValue}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-[12px] leading-none text-white/88 shadow-[0_12px_26px_rgba(8,39,41,0.14)] backdrop-blur-sm">
                          <AppIcon icon={Clock3} className="h-3.5 w-3.5 shrink-0" />
                          {durationLabel}
                        </span>
                        {item.instantConfirmation ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/85 bg-white px-3 py-1.5 text-[12px] font-semibold leading-none text-primary shadow-[0_12px_26px_rgba(8,39,41,0.14)]">
                            <AppIcon icon={CircleCheckBig} className="h-3.5 w-3.5 shrink-0" />
                            Мгновенное подтверждение
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 space-y-3.5 px-4 pb-4">
                      <ExcursionSidebarActions
                        actionLabel={leadRequestActionLabel}
                        actionDisabled={!showLeadForm}
                        offerType={item.offerType}
                        excursionTitle={item.title ?? getOfferTypeLabel(item.offerType)}
                        priceLabel={priceLabel}
                        durationLabel={durationLabel}
                        locationName={item.locationName}
                        phone={item.contacts.phone}
                        phone2={item.contacts.phone2}
                        websiteUrl={item.contacts.websiteUrl}
                        whatsappUrl={whatsappUrl}
                        telegramUrl={telegramUrl}
                        vkUrl={vkUrl}
                        maxUrl={maxUrl}
                        okUrl={okUrl}
                        organizerName={organizerName}
                        organizerAvatarUrl={item.owner.avatarUrl}
                        isInstantConfirmation={item.instantConfirmation}
                      />

                      {cancellationLabel ? (
                        <p className="rounded-[22px] border border-olive/10 bg-sand/45 px-4 py-3 text-xs leading-5 text-olive/56">
                          {cancellationLabel}
                        </p>
                      ) : null}
                    </div>
                  </article>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {hasPublishedReviews ? (
          <div className="mt-6" id="reviews">
            <PropertyReviewsSection
              submitUrl={`/api/public/excursions/${encodeURIComponent(item.id)}/reviews`}
              loadMoreUrl={`/api/public/excursions/${encodeURIComponent(item.id)}/reviews`}
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
        ) : null}

        {item.faqItems.length > 0 ? (
          <section className="mt-6 excursion-card p-6" id="faq-section">
            <h2 className="mb-5 font-heading text-2xl text-olive">Частые вопросы</h2>
            <ExcursionFaq items={item.faqItems} />
          </section>
        ) : null}

        <NearbyPropertiesSection
          items={nearbyProperties}
          searchHref={housingCatalogHref}
          radiusKm={DEFAULT_NEARBY_RADIUS_KM}
          className="mt-6 excursion-card p-6"
          titleClassName="mb-0 font-heading text-2xl"
        />

        {similarItems.length > 0 ? (
          <section className="mt-6 excursion-card p-6">
            <h2 className="mb-5 font-heading text-2xl text-olive">Похожие экскурсии</h2>
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
                    <div className="flex h-40 items-center justify-center bg-sand/60 text-xs text-olive/30">
                      Без фото
                    </div>
                  )}
                  <div className="p-3.5">
                    <p className="line-clamp-2 text-sm font-semibold text-olive">{card.title}</p>
                    <p className="mt-1.5 text-xs text-olive/50">{card.routeSummary}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-olive/50">{card.availabilitySummary}</p>
                      <p className="text-xs font-bold text-primary">{formatProgramPrice(card)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={catalogHref}
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

        <ExcursionMobileBar
          priceLabel={priceLabel}
          availabilityLabel={scheduleSummaryValue}
          actionLabel={leadRequestActionLabel}
          actionDisabled={!showLeadForm}
          offerType={item.offerType}
          excursionTitle={item.title ?? getOfferTypeLabel(item.offerType)}
          durationLabel={durationLabel}
          locationName={item.locationName}
          websiteUrl={item.contacts.websiteUrl}
          whatsappUrl={whatsappUrl}
          telegramUrl={telegramUrl}
          vkUrl={vkUrl}
          maxUrl={maxUrl}
          okUrl={okUrl}
          phone={item.contacts.phone}
          organizerName={organizerName}
          organizerAvatarUrl={item.owner.avatarUrl}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-36 md:px-6 md:py-8 lg:pb-8">
      {!isPreview ? <JsonLd data={buildBreadcrumbListStructuredData(breadcrumbItems)} /> : null}
      {!isPreview ? <JsonLd data={buildExcursionStructuredData(item)} /> : null}
      {faqStructuredData ? <JsonLd data={faqStructuredData} /> : null}
      {!isPreview ? <ExcursionViewTracker excursionId={item.id} /> : null}

      {isPreview ? (
        <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-3 text-sm text-olive shadow-sm">
          <p className="font-semibold text-primary">Предпросмотр карточки</p>
          <p className="mt-1 text-olive/72">
            Сейчас открыта owner-only версия страницы. Её видите только вы, пока программа не
            опубликована.
          </p>
        </section>
      ) : null}

      <PublicBreadcrumbs items={breadcrumbItems} className="mb-5" />

      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[30px]">
          {item.photoUrls.length > 0 ? (
            <ExcursionPhotoGallery photoUrls={item.photoUrls} title={item.title ?? undefined} />
          ) : (
            <div className="flex h-72 items-center justify-center rounded-[30px] bg-gradient-to-br from-cream to-sand/70 text-sm text-olive/45 ring-1 ring-olive/10">
              Фотографии тура появятся здесь после загрузки
            </div>
          )}

          <div className="absolute right-4 top-4 z-20 hidden md:bottom-5 md:right-5 md:top-auto md:block">
            <FavoriteToggleButton
              itemId={item.id}
              entityType={favoriteEntityType}
              initialIsFavorite={false}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden bg-gradient-to-t from-midnight/85 via-midnight/38 to-transparent px-6 pb-6 pt-28 md:block">
            <div className="pointer-events-auto">
              <div className="flex flex-wrap items-center gap-2">
                {heroBadges.slice(0, 6).map((badge) => (
                  <span
                    key={badge.label}
                    className={
                      badge.tone === "solid"
                        ? "rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm"
                        : badge.tone === "trust"
                          ? "rounded-full bg-emerald-400/92 px-3 py-1 text-[11px] font-bold text-emerald-950 backdrop-blur-sm"
                          : "rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-medium text-white/86 backdrop-blur-sm"
                    }
                  >
                    <AppIcon icon={badge.icon} className="mr-1 inline h-3 w-3" />
                    {badge.label}
                  </span>
                ))}
              </div>

              <h1 className="mt-3 text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-[2.65rem] md:leading-[1.08]">
                {item.title ?? getOfferTypeLabel(item.offerType)}
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-medium text-white/76">{routeSummary}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {hasPublishedReviews ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur-sm">
                    <AppIcon icon={Star} className="h-4 w-4 text-amber-300" filled />
                    {ratingLine}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm text-white/80 backdrop-blur-sm">
                    <AppIcon icon={CircleAlert} className="h-4 w-4" />
                    Новая программа без отзывов
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm text-white/90 backdrop-blur-sm">
                  <AppIcon icon={Clock3} className="h-4 w-4" />
                  {durationLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm text-white/90 backdrop-blur-sm">
                  <AppIcon icon={CalendarDays} className="h-4 w-4" />
                  {nextAvailableSession
                    ? `Ближайший старт ${formatShortDate(nextAvailableSession.startAt)}`
                    : availabilityLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3.5 py-1 text-sm font-bold text-white backdrop-blur-sm">
                  {priceLabel}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-3 md:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {heroBadges.slice(0, 6).map((badge) => (
              <span
                key={badge.label}
                className={
                  badge.tone === "solid"
                    ? "inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
                    : badge.tone === "trust"
                      ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80"
                      : "inline-flex items-center gap-1 rounded-full border border-olive/12 bg-white px-3 py-1 text-[11px] font-semibold text-olive/62"
                }
              >
                <AppIcon icon={badge.icon} className="h-3 w-3" />
                {badge.label}
              </span>
            ))}
          </div>

          <div className="font-heading text-2xl leading-tight text-olive sm:text-3xl">
            {item.title ?? getOfferTypeLabel(item.offerType)}
          </div>
          <p className="text-sm font-medium text-olive/65">{routeSummary}</p>

          <div className="flex flex-wrap items-center gap-2">
            {hasPublishedReviews ? (
              <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm shadow-[0_2px_8px_rgba(58,43,35,0.07)] ring-1 ring-olive/8">
                <AppIcon icon={Star} className="h-4 w-4 text-amber-400" filled />
                <span className="font-bold text-olive">{item.avgRating.toFixed(1)}</span>
                <span className="text-olive/30">·</span>
                <span className="text-olive/55">
                  {pluralize(item.reviewsCount, "отзыв", "отзыва", "отзывов")}
                </span>
              </div>
            ) : (
              <div className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-olive/55 shadow-[0_2px_8px_rgba(58,43,35,0.07)] ring-1 ring-olive/8">
                Пока без отзывов
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm shadow-[0_2px_8px_rgba(58,43,35,0.07)] ring-1 ring-olive/8">
              <AppIcon icon={Clock3} className="h-4 w-4 text-terra/60" />
              <span className="font-semibold text-olive">{durationLabel}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm ring-1 ring-primary/15">
              <span className="font-bold text-primary">{priceLabel}</span>
            </div>
            <div className="rounded-full bg-sand/70 px-3.5 py-1.5 text-xs font-semibold text-olive/60 ring-1 ring-olive/10">
              {nextAvailableSession
                ? `Ближайший старт ${formatShortDate(nextAvailableSession.startAt)}`
                : availabilityLabel}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <FavoriteToggleButton
              itemId={item.id}
              entityType={favoriteEntityType}
              initialIsFavorite={false}
            />
          </div>

          {item.tags.length > 0 ? (
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
          ) : null}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,368px)]">
          <div className="min-w-0 space-y-5">
            {item.videoUrls.length > 0 ? (
              <SectionCard icon={Compass} title="Видео тура">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {item.videoUrls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="overflow-hidden rounded-2xl bg-midnight/5"
                    >
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        className="h-52 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {item.tags.length > 0 ? (
              <div className="hidden flex-wrap gap-2 md:flex">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gradient-to-r from-primary/11 to-primary/7 px-3.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/12"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {tourHeroSummaryFacts.length > 0 ? (
              <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-olive/8 bg-white px-5 py-3.5 text-sm text-olive/72">
                {tourHeroSummaryFacts.map((fact, index) => (
                  <Fragment key={`${fact.value}-${index}`}>
                    {index > 0 ? (
                      <span className="hidden text-olive/18 sm:inline" aria-hidden="true">
                        &middot;
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <AppIcon icon={fact.icon} className="h-4 w-4 text-primary/55" />
                      <span className="font-medium text-olive">{fact.value}</span>
                    </span>
                  </Fragment>
                ))}
              </section>
            ) : null}

            <SectionJumpNav items={sectionNavItems} />

            <SectionCard id="overview-section" icon={FileText} title="О туре">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
                <div className="space-y-4">
                  {overviewLead ? (
                    <p className="text-base font-medium leading-8 text-olive">{overviewLead}</p>
                  ) : null}
                  {descriptionText ? (
                    <p className="whitespace-pre-line text-sm leading-8 text-olive/78">
                      {descriptionText}
                    </p>
                  ) : null}
                  {!overviewLead && !descriptionText ? (
                    <p className="text-sm italic leading-7 text-olive/45">
                      Подробное описание пока не добавлено.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {bulletHighlights.length > 0 ? (
                    <div>
                      <p className="mb-3 text-sm font-semibold text-olive">Ключевые пункты</p>
                      <ul className="space-y-2.5">
                        {bulletHighlights.map((point, index) => (
                          <li
                            key={`${point}-${index}`}
                            className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/7 to-primary/3 px-4 py-3.5 text-sm text-olive/80 ring-1 ring-primary/10"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/18 text-primary">
                              <AppIcon icon={Check} className="h-3 w-3" />
                            </span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {routeSummary ? (
                    <div className="rounded-2xl border border-terra/15 bg-gradient-to-r from-terra/6 to-transparent px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-terra/70">
                        Маршрут
                      </p>
                      <p className="mt-2 text-sm font-medium text-olive">{routeSummary}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            {hasAvailabilitySection ? (
              <SectionCard id="dates-section" icon={CalendarDays} title="Даты и доступность">
                <div className="rounded-2xl border border-olive/10 bg-gradient-to-r from-cream/80 to-white px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/38">
                        Формат доступности
                      </p>
                      <p className="mt-2 text-base font-semibold text-olive">{availabilityLabel}</p>
                      {item.availabilityNote ? (
                        <p className="mt-1 text-sm text-olive/60">{item.availabilityNote}</p>
                      ) : null}
                      {item.scheduleText && item.scheduleText !== availabilityLabel ? (
                        <p className="mt-1 text-sm text-olive/60">{item.scheduleText}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/15">
                        {getAvailabilityBadgeLabel({
                          availabilityMode: item.availabilityMode,
                          sessionsCount: upcomingSessions.length,
                          departureMode: item.departureMode,
                        })}
                      </span>
                      {scheduleNote ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-olive/65 ring-1 ring-olive/10">
                          {scheduleNote}
                        </span>
                      ) : null}
                      {item.instantConfirmation ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                          Быстрое подтверждение
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <SectionPhotoGallery
                  label={item.offerType === "TOUR" ? "Фото дат и заездов" : "Фото расписания"}
                  photoUrls={datesPhotoUrls}
                  className="mt-4"
                />

                {upcomingSessions.length > 0 ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {upcomingSessions.map((entry) => {
                      const isAvailable = entry.status === ExcursionSessionStatus.AVAILABLE;
                      const sessionPriceLabel = buildSessionPriceLabel({
                        priceOverride: entry.priceOverride,
                        currency: item.currency,
                        fallbackPriceLabel: priceLabel,
                        priceUnitLabel: item.priceUnitLabel,
                      });

                      return (
                        <div
                          key={entry.id}
                          className={
                            isAvailable
                              ? "rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-white px-4 py-4"
                              : "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-4"
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-olive">
                                {formatSessionDateRange(entry.startAt, entry.endAt)}
                              </p>
                              <p className="mt-1 text-xs text-olive/55">
                                {entry.endAt ? "Старт и завершение тура" : "Фиксированный старт"}
                              </p>
                            </div>
                            <span
                              className={
                                isAvailable
                                  ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80"
                                  : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/80"
                              }
                            >
                              {formatSessionStatus(entry.status)}
                            </span>
                          </div>

                          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-white/80 px-3 py-3 ring-1 ring-olive/8">
                              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                                Стоимость
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-olive">
                                {sessionPriceLabel}
                              </dd>
                            </div>
                            <div className="rounded-xl bg-white/80 px-3 py-3 ring-1 ring-olive/8">
                              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                                Группа
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-olive">
                                {entry.capacity
                                  ? `До ${entry.capacity} чел.`
                                  : (groupSizeLabel ?? "Размер группы уточняется")}
                              </dd>
                            </div>
                          </dl>

                          {entry.bookingDeadlineMinutes ? (
                            <p className="mt-3 text-xs text-olive/58">
                              Заявку лучше отправить не позднее чем за{" "}
                              {Math.max(1, Math.round(entry.bookingDeadlineMinutes / 60))} ч до
                              старта.
                            </p>
                          ) : null}

                          {!isAvailable ? (
                            <p className="mt-3 text-xs text-amber-700/90">
                              Ближайший заезд уже занят, но можно запросить следующую дату у
                              организатора.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-olive/10 bg-white px-5 py-5">
                    <p className="text-sm font-medium text-olive">
                      {item.availabilityMode === ExcursionAvailabilityMode.ON_REQUEST
                        ? "Тур собирается под запрос: дата старта, состав группы и логистика подтверждаются после заявки."
                        : "Фиксированные даты сейчас не опубликованы. Напишите организатору, чтобы уточнить следующие старты."}
                    </p>
                    {departureModeLabel ? (
                      <p className="mt-2 text-sm text-olive/58">{departureModeLabel}</p>
                    ) : null}
                  </div>
                )}
              </SectionCard>
            ) : null}
            {hasProgram ? (
              <SectionCard
                id="program-section"
                icon={Route}
                title={
                  item.offerType === "TOUR"
                    ? getItineraryProgramTitle(itineraryItemLabel)
                    : "Программа маршрута"
                }
              >
                {item.routeDescription ? (
                  <p className="mb-4 text-sm leading-7 text-olive/68">{item.routeDescription}</p>
                ) : null}

                {programFallbackPhotoUrls.length > 0 ? (
                  <SectionPhotoGallery
                    label={item.offerType === "TOUR" ? "Фото программы тура" : "Фото маршрута"}
                    photoUrls={programFallbackPhotoUrls}
                    className="mb-4"
                  />
                ) : null}

                {item.offerType === "TOUR" && item.itineraryDays.length > 0 ? (
                  <div className="space-y-3">
                    {item.itineraryDays.map((day) => {
                      const dayItemLabel = resolveItineraryItemLabel(
                        day.itemLabel ?? itineraryItemLabel,
                      );
                      const dayPhotoUrls = getItineraryDayPhotoUrls(day);
                      const dayMeals = uniqueStrings([
                        ...(day.mealsIncluded ?? []),
                        ...(day.meals ? [day.meals] : []),
                      ]);
                      const dayAccommodation = uniqueStrings([
                        day.accommodationName,
                        day.accommodation,
                        day.overnightLocation,
                      ]);

                      return (
                        <details
                          key={`day-${day.day}`}
                          open={day.day === 1 || dayPhotoUrls.length > 0}
                          className="group rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45"
                        >
                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                  {formatItineraryItemIndexLabel(dayItemLabel, day.day)}
                                </span>
                                <h3 className="text-base font-semibold text-olive">{day.title}</h3>
                              </div>
                              {day.teaser ? (
                                <p className="mt-2 text-sm text-olive/62">{day.teaser}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {day.locations.slice(0, 4).map((locationName) => (
                                  <span
                                    key={`${day.day}-${locationName}`}
                                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-olive/65 ring-1 ring-olive/10"
                                  >
                                    {locationName}
                                  </span>
                                ))}
                                {dayMeals.length > 0 ? (
                                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                                    {dayMeals.join(", ")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-olive/10 bg-white text-olive/55 transition-transform group-open:rotate-180">
                              <AppIcon icon={ChevronDown} className="h-4 w-4" />
                            </span>
                          </summary>

                          <div className="border-t border-olive/8 px-5 py-4">
                            <p className="whitespace-pre-line text-sm leading-7 text-olive/78">
                              {day.description}
                            </p>

                            {dayPhotoUrls.length > 0 ? (
                              <InlinePhotoGallery
                                photoUrls={dayPhotoUrls}
                                title={
                                  day.title || formatItineraryItemIndexLabel(dayItemLabel, day.day)
                                }
                                className="mt-4"
                              />
                            ) : null}

                            {(day.activities?.length ?? 0) > 0 ||
                            (day.included?.length ?? 0) > 0 ||
                            dayAccommodation.length > 0 ||
                            (day.startTime ?? day.endTime ?? day.notes) ? (
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {day.startTime || day.endTime ? (
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-olive/10">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                                      Время
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-olive">
                                      {[day.startTime, day.endTime].filter(Boolean).join(" — ")}
                                    </p>
                                  </div>
                                ) : null}

                                {(day.activities?.length ?? 0) > 0 ? (
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-olive/10">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                                      Активности
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-olive">
                                      {day.activities?.join(", ")}
                                    </p>
                                  </div>
                                ) : null}

                                {dayAccommodation.length > 0 ? (
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-olive/10">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                                      Ночёвка
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-olive">
                                      {dayAccommodation.join(", ")}
                                    </p>
                                  </div>
                                ) : null}

                                {(day.included?.length ?? 0) > 0 ? (
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-olive/10">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                                      {`В этот ${getItineraryItemNoun(dayItemLabel, 1)} включено`}
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-olive">
                                      {day.included?.join(", ")}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {day.notes ? (
                              <p className="mt-4 rounded-2xl bg-sand/60 px-4 py-3 text-sm text-olive/72 ring-1 ring-olive/8">
                                {day.notes}
                              </p>
                            ) : null}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                ) : item.timeline.length > 0 ? (
                  <ExcursionTimeline steps={item.timeline} />
                ) : item.routeLocations.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {item.routeLocations.map((locationEntry, index) => (
                      <Fragment key={locationEntry.id}>
                        {index > 0 ? (
                          <AppIcon icon={ChevronRight} className="h-4 w-4 shrink-0 text-olive/35" />
                        ) : null}
                        <span className="rounded-full bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/12">
                          {locationEntry.name}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {hasLogistics || hasMap ? (
              <SectionCard id="logistics-section" icon={Car} title="Логистика старта и маршрута">
                <div className="grid gap-3 lg:grid-cols-2">
                  {item.startPoint || item.finishPoint ? (
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                        Старт и финиш
                      </p>
                      <p className="mt-2 text-sm font-semibold text-olive">
                        {item.startPoint ?? "Старт по согласованию"}
                      </p>
                      {item.finishPoint ? (
                        <p className="mt-1 text-sm text-olive/62">Финиш: {item.finishPoint}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {item.meetingPointText || item.pickupAvailable ? (
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                        Встреча и сбор
                      </p>
                      <p className="mt-2 text-sm font-semibold text-olive">
                        {item.meetingPointText ?? "Точка встречи сообщается после бронирования"}
                      </p>
                      {item.pickupAvailable ? (
                        <p className="mt-1 text-sm text-olive/62">
                          {item.pickupLocations.length > 0
                            ? `Есть точки сбора: ${item.pickupLocations.map((entry) => entry.name).join(", ")}`
                            : "Трансфер или сбор согласуются отдельно"}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {item.transferDetails ||
                  item.arrivalInfo ||
                  item.departureInfo ||
                  transportModeLabels.length > 0 ? (
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-4 py-4 lg:col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                        Трансфер и организационные детали
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-olive/72">
                        {item.transferDetails ? <p>{item.transferDetails}</p> : null}
                        {transportModeLabels.length > 0 ? (
                          <p>Транспорт по маршруту: {transportModeLabels.join(", ")}</p>
                        ) : null}
                        {item.arrivalInfo ? <p>Прибытие: {item.arrivalInfo}</p> : null}
                        {item.departureInfo ? <p>Выезд: {item.departureInfo}</p> : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {logisticsPhotoUrls.length > 0 ? (
                  <SectionPhotoGallery
                    label={
                      item.offerType === "TOUR"
                        ? "Фото старта и перемещений"
                        : "Фото места встречи и маршрута"
                    }
                    photoUrls={logisticsPhotoUrls}
                    className="mt-4"
                  />
                ) : null}

                {item.routeLocations.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-olive/10 bg-white px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/36">
                      Маршрут
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.routeLocations.map((locationEntry, index) => (
                        <Fragment key={locationEntry.id}>
                          {index > 0 ? (
                            <AppIcon
                              icon={ChevronRight}
                              className="h-4 w-4 shrink-0 text-olive/35"
                            />
                          ) : null}
                          <span className="rounded-full bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/12">
                            {locationEntry.name}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                ) : null}

                {hasMap ? (
                  <StaticMapPreview
                    latitude={mapLatitude!}
                    longitude={mapLongitude!}
                    label={mapOverlayAddress}
                    className="mt-4"
                  />
                ) : null}
              </SectionCard>
            ) : null}
            {hasAccommodationDetails || hasMeals ? (
              <SectionCard id="accommodation-section" icon={Building2} title="Проживание и питание">
                <div
                  className={`grid gap-4 ${hasAccommodationDetails && hasMeals ? "xl:grid-cols-2" : ""}`}
                >
                  {hasAccommodationDetails ? (
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                      <div className="flex items-center gap-2">
                        <AppIcon icon={Building2} className="h-4 w-4 text-primary" />
                        <h3 className="text-base font-semibold text-olive">Проживание</h3>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-olive/74">
                        <p>
                          {item.accommodationProvided === false
                            ? "Проживание не входит в стоимость."
                            : item.accommodationProvided === true
                              ? "Проживание входит в стоимость тура."
                              : "Условия проживания уточняются у организатора."}
                        </p>
                        {item.accommodationNights ? (
                          <p>
                            {pluralize(
                              item.accommodationNights,
                              "ночь проживания",
                              "ночи проживания",
                              "ночей проживания",
                            )}
                          </p>
                        ) : null}
                        {accommodationTypeLabel ? (
                          <p>Тип размещения: {accommodationTypeLabel}</p>
                        ) : null}
                        {item.accommodationFormat ? (
                          <p>Формат размещения: {item.accommodationFormat}</p>
                        ) : null}
                        {item.accommodationStars ? (
                          <p>Категория: {item.accommodationStars}</p>
                        ) : null}
                        {roomTypeLabels.length > 0 ? (
                          <p>Доступные комнаты: {roomTypeLabels.join(", ")}</p>
                        ) : null}
                        {item.singleSupplementAvailable ? (
                          <p>
                            Есть одноместное размещение
                            {item.singleSupplementPrice
                              ? ` (+ ${formatMoney(item.singleSupplementPrice, item.currency)})`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      {item.accommodationComment ? (
                        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-olive/72 ring-1 ring-olive/8">
                          {item.accommodationComment}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {hasMeals ? (
                    <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                      <div className="flex items-center gap-2">
                        <AppIcon icon={UtensilsCrossed} className="h-4 w-4 text-primary" />
                        <h3 className="text-base font-semibold text-olive">Питание</h3>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-olive/74">
                        {mealPlanLabel ? <p>{mealPlanLabel}</p> : null}
                        {item.mealDetails ? <p>{item.mealDetails}</p> : null}
                        {itineraryMealHighlights.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {itineraryMealHighlights.map((meal) => (
                              <span
                                key={meal}
                                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80"
                              >
                                {meal}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {accommodationPhotoUrls.length > 0 ? (
                  <SectionPhotoGallery
                    label={hasAccommodationDetails ? "Фото проживания" : "Фото условий и питания"}
                    photoUrls={accommodationPhotoUrls}
                    className="mt-4"
                  />
                ) : null}
              </SectionCard>
            ) : null}

            <SectionCard
              id="included-section"
              icon={CircleCheckBig}
              title="Что включено в стоимость"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-transparent p-5 ring-1 ring-emerald-100/70">
                  <p className="mb-3.5 flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <AppIcon icon={CircleCheckBig} className="h-4 w-4 text-emerald-500" />
                    Включено
                  </p>
                  {included.length > 0 ? (
                    <ul className="space-y-2.5">
                      {included.map((line, index) => (
                        <li
                          key={`${line}-${index}`}
                          className="flex items-start gap-2.5 text-sm text-olive/80"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <AppIcon icon={Check} className="h-3 w-3" />
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm italic text-olive/45">
                      Список включённых услуг уточняется у организатора.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent p-5 ring-1 ring-amber-100/70">
                  <p className="mb-3.5 flex items-center gap-2 text-sm font-bold text-amber-800">
                    <AppIcon icon={CircleX} className="h-4 w-4 text-amber-500" />
                    Не включено
                  </p>
                  {excluded.length > 0 ? (
                    <ul className="space-y-2.5">
                      {excluded.map((line, index) => (
                        <li
                          key={`${line}-${index}`}
                          className="flex items-start gap-2.5 text-sm text-olive/80"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            <AppIcon icon={CircleAlert} className="h-3 w-3" />
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm italic text-olive/45">
                      Дополнительные расходы не указаны.
                    </p>
                  )}
                </div>
              </div>

              {item.extraOptions.length > 0 ? (
                <details
                  className="mt-4 rounded-2xl border border-olive/10 bg-white"
                  open={item.extraOptions.length <= 2}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-olive">
                    Дополнительные опции и платные активности
                    <AppIcon
                      icon={ChevronDown}
                      className="h-4 w-4 text-olive/45 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="border-t border-olive/8 px-4 py-4">
                    <div className="grid gap-3">
                      {item.extraOptions.map((option, index) => (
                        <div
                          key={`${option.title}-${index}`}
                          className="rounded-2xl bg-cream/50 px-4 py-4 ring-1 ring-olive/8"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-olive">{option.title}</h3>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-olive/65 ring-1 ring-olive/10">
                              {option.included
                                ? "Уже включено"
                                : option.price !== null && option.price !== undefined
                                  ? `+ ${formatMoney(option.price, item.currency)}`
                                  : "Оплачивается отдельно"}
                            </span>
                          </div>
                          {option.description ? (
                            <p className="mt-2 text-sm leading-7 text-olive/72">
                              {option.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ) : null}

              {cancellationLabel ? (
                <div className="mt-4 rounded-2xl border border-olive/10 bg-sand/55 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-olive/38">
                    Отмена и изменения
                  </p>
                  <p className="mt-2 text-sm text-olive/72">{cancellationLabel}</p>
                </div>
              ) : null}

              {includedPhotoUrls.length > 0 ? (
                <SectionPhotoGallery
                  label="Фото услуг и деталей"
                  photoUrls={includedPhotoUrls}
                  className="mt-4"
                />
              ) : null}
            </SectionCard>

            {hasRequirements ? (
              <SectionCard
                id="requirements-section"
                icon={CircleAlert}
                title="Требования и подготовка"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                    <h3 className="text-base font-semibold text-olive">Кому подойдёт</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {difficultyLabel ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-olive/70 ring-1 ring-olive/10">
                          Сложность: {difficultyLabel}
                        </span>
                      ) : null}
                      {ageLabel ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-olive/70 ring-1 ring-olive/10">
                          {ageLabel}
                        </span>
                      ) : null}
                      {item.isKidFriendly === true ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                          Можно ехать с детьми
                        </span>
                      ) : null}
                      {item.hasGuideLicense ? (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/12">
                          Лицензированный гид
                        </span>
                      ) : null}
                    </div>

                    {item.physicalRequirements.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-olive">Физическая нагрузка</p>
                        <ul className="mt-3 space-y-2 text-sm text-olive/72">
                          {item.physicalRequirements.map((line) => (
                            <li key={line} className="flex items-start gap-2.5">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terra" />
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {item.routeConditions ? (
                      <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-olive/72 ring-1 ring-olive/8">
                        Условия маршрута: {item.routeConditions}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-olive/10 bg-gradient-to-br from-white to-cream/45 px-5 py-5">
                    <h3 className="text-base font-semibold text-olive">Что взять с собой</h3>
                    {item.whatToBring.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.whatToBring.map((entry) => (
                          <span
                            key={entry}
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-olive/70 ring-1 ring-olive/10"
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-olive/58">
                        Список вещей организатор сообщит дополнительно после бронирования.
                      </p>
                    )}

                    {item.equipmentProvided.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-olive">Что выдаёт организатор</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.equipmentProvided.map((entry) => (
                            <span
                              key={entry}
                              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80"
                            >
                              {entry}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {item.documentsRequired.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-olive">Документы</p>
                        <p className="mt-2 text-sm text-olive/72">
                          {item.documentsRequired.join(", ")}
                        </p>
                      </div>
                    ) : null}

                    {item.insuranceIncluded !== null || item.insuranceComment ? (
                      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-olive/72 ring-1 ring-olive/8">
                        <p>
                          {item.insuranceIncluded
                            ? "Страховка включена в стоимость."
                            : item.insuranceIncluded === false
                              ? "Страховка не включена."
                              : "Информация о страховке уточняется."}
                        </p>
                        {item.insuranceComment ? (
                          <p className="mt-2">{item.insuranceComment}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.safetyInfo ? (
                      <p className="mt-4 rounded-2xl bg-sand/60 px-4 py-3 text-sm leading-7 text-olive/72 ring-1 ring-olive/8">
                        {item.safetyInfo}
                      </p>
                    ) : null}
                  </div>
                </div>

                {requirementsPhotoUrls.length > 0 ? (
                  <SectionPhotoGallery
                    label="Фото подготовки и требований"
                    photoUrls={requirementsPhotoUrls}
                    className="mt-4"
                  />
                ) : null}
              </SectionCard>
            ) : null}
          </div>

          <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start">
            <div className="lg:w-full lg:max-w-[368px]">
              <div className="space-y-4">
                <article className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,243,236,0.92))] shadow-[0_28px_72px_rgba(58,43,35,0.14)] ring-1 ring-olive/8">
                  <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,#0f766e_0%,#0d7069_48%,#125d76_100%)] px-5 pb-5 pt-4 text-center">
                    <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)]" />
                    <div className="absolute -left-6 bottom-3 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -right-8 top-2 h-24 w-24 rounded-full bg-white/14 blur-2xl" />
                    <ExcursionPriceDisplay
                      priceLabel={priceLabel}
                      tone="dark"
                      align="center"
                      className="mt-2"
                    />
                    {item.priceTo !== null &&
                    item.priceFrom !== null &&
                    item.priceTo > item.priceFrom ? (
                      <p className="mt-2 text-sm text-white/62">
                        До {formatMoney(item.priceTo, item.currency)}
                      </p>
                    ) : null}
                    <p className="mx-auto mt-3 max-w-[286px] rounded-full border border-white/14 bg-white/10 px-4 py-1.5 text-[13px] leading-5 text-white/84 shadow-[0_14px_28px_rgba(8,39,41,0.16)] backdrop-blur-sm">
                      {nextAvailableSession
                        ? `Старт ${formatShortDate(nextAvailableSession.startAt)}`
                        : availabilityLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-[12px] leading-none text-white/88 shadow-[0_12px_26px_rgba(8,39,41,0.14)] backdrop-blur-sm">
                        <AppIcon icon={Clock3} className="h-3.5 w-3.5 shrink-0" />
                        {durationLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/85 bg-white px-3 py-1.5 text-[12px] font-semibold leading-none text-primary shadow-[0_12px_26px_rgba(8,39,41,0.14)]">
                        <AppIcon icon={CalendarDays} className="h-3.5 w-3.5 shrink-0" />
                        {nextAvailableSession
                          ? `Старт ${formatShortDate(nextAvailableSession.startAt)}`
                          : availabilityLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3.5 px-4 pb-4">
                    <ExcursionSidebarActions
                      actionLabel={leadRequestActionLabel}
                      actionDisabled={!showLeadForm}
                      offerType={item.offerType}
                      excursionTitle={item.title ?? getOfferTypeLabel(item.offerType)}
                      priceLabel={priceLabel}
                      durationLabel={durationLabel}
                      locationName={item.locationName}
                      phone={item.contacts.phone}
                      phone2={item.contacts.phone2}
                      websiteUrl={item.contacts.websiteUrl}
                      whatsappUrl={whatsappUrl}
                      telegramUrl={telegramUrl}
                      vkUrl={vkUrl}
                      maxUrl={maxUrl}
                      okUrl={okUrl}
                      organizerName={organizerName}
                      organizerAvatarUrl={item.owner.avatarUrl}
                      isInstantConfirmation={item.instantConfirmation}
                    />
                  </div>
                </article>

                {cancellationLabel ? (
                  <p className="rounded-[22px] border border-olive/10 bg-sand/45 px-4 py-3 text-xs leading-5 text-olive/56">
                    {cancellationLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="mt-6" id="reviews">
        <PropertyReviewsSection
          submitUrl={`/api/public/excursions/${encodeURIComponent(item.id)}/reviews`}
          loadMoreUrl={`/api/public/excursions/${encodeURIComponent(item.id)}/reviews`}
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

      {item.faqItems.length > 0 ? (
        <section className="mt-6 excursion-card p-6" id="faq-section">
          <h2 className="mb-5 font-heading text-2xl text-olive">Частые вопросы</h2>
          <ExcursionFaq items={item.faqItems} />
        </section>
      ) : null}

      <NearbyPropertiesSection
        items={nearbyProperties}
        searchHref={housingCatalogHref}
        radiusKm={DEFAULT_NEARBY_RADIUS_KM}
        className="mt-6 excursion-card p-6"
        titleClassName="mb-0 font-heading text-2xl"
      />

      {similarItems.length > 0 ? (
        <section className="mt-6 excursion-card p-6">
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
                  <div className="flex h-40 items-center justify-center bg-sand/60 text-xs text-olive/30">
                    Без фото
                  </div>
                )}
                <div className="p-3.5">
                  <p className="line-clamp-2 text-sm font-semibold text-olive">{card.title}</p>
                  <p className="mt-1.5 text-xs text-olive/50">{card.routeSummary}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-olive/50">{card.availabilitySummary}</p>
                    <p className="text-xs font-bold text-primary">{formatProgramPrice(card)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={catalogHref}
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

      <ExcursionMobileBar
        priceLabel={priceLabel}
        availabilityLabel={
          nextAvailableSession
            ? `Ближайший старт ${formatShortDate(nextAvailableSession.startAt)}`
            : availabilityLabel
        }
        actionLabel={leadRequestActionLabel}
        actionDisabled={!showLeadForm}
        offerType={item.offerType}
        excursionTitle={item.title ?? getOfferTypeLabel(item.offerType)}
        durationLabel={durationLabel}
        locationName={item.locationName}
        websiteUrl={item.contacts.websiteUrl}
        whatsappUrl={whatsappUrl}
        telegramUrl={telegramUrl}
        vkUrl={vkUrl}
        maxUrl={maxUrl}
        okUrl={okUrl}
        phone={item.contacts.phone}
        organizerName={organizerName}
        organizerAvatarUrl={item.owner.avatarUrl}
      />
    </div>
  );
}
