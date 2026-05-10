"use client";

import Image from "next/image";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Images,
  MapPin,
  PanelsTopLeft,
  Phone,
  RulerDimensionLine,
  Star,
  Toilet,
  TriangleAlert,
  TvMinimalPlay,
  User,
  Users,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { LeadMessageAuthorToggle } from "@/components/leads/lead-message-author-toggle";
import { PropertyContactsPanel } from "@/components/contacts/property-contacts-panel";
import { HousingSearchDateRangeField } from "@/components/public/housing-search-date-range-field";
import { HousingSearchGuestsField } from "@/components/public/housing-search-guests-field";
import { StaticMapPreview } from "@/components/maps/static-map-preview";
import { PropertyMediaGallery } from "@/components/public/property-media-gallery";
import { ContactBrandMark, type ContactBrand } from "@/components/ui/contact-brand-mark";
import { ContactWebsiteMark } from "@/components/ui/contact-website-mark";
import { AmenityIcon, NameBasedAmenityIcon } from "@/components/ui/amenity-icon";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { parseDetailedGuestsValue } from "@/components/ui/unified-guests-editor";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useLeadMessageAuthorGender } from "@/hooks/use-lead-message-author-gender";
import { trackListingAction } from "@/lib/client-listing-actions";
import { cn } from "@/lib/cn";
import { buildPropertyLeadMessage } from "@/lib/lead-message-author";
import {
  getContactActionTypeFromChannel,
  getPhoneListingActionType,
} from "@/lib/listing-analytics";
import {
  addDays,
  calculateRoomStayPrice,
  getRoomPriceNightlySuffix,
  normalizeRoomPriceType,
  parseIsoDate,
  toIsoDate,
  type RoomPriceCalculationType,
  type RoomPriceType,
} from "@/lib/pricing";
import { formatPublicPersonName } from "@/lib/public-display-name";
import {
  parseMealOptionsValue,
  parseParkingInfoValue,
  parsePrepaymentPolicyValue,
} from "@/lib/property-rules";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { normalizeWebsiteUrl } from "@/lib/website-favicon";
import type { PublicPropertyCard } from "@/lib/public-properties";
import { bedTypeOptions } from "@/lib/room-catalog";

type PublicPropertyDetailsProps = {
  item: PublicPropertyCard;
  initialIsFavorite: boolean;
  initialCheckIn?: string | null;
  initialCheckOut?: string | null;
  initialGuestsCount?: number | null;
  initialAdultsCount?: number | null;
  initialChildrenCount?: number | null;
};

type RoomAmenityItem = {
  key: string;
  name: string;
  featureId?: string;
  category: "bathroom" | "equipment" | "beds";
};

type RoomCardAmenityItem = RoomAmenityItem & {
  icon?: LucideIcon;
  isPrimary?: boolean;
};

type RulePolicyValue = "FORBIDDEN" | "ON_REQUEST" | "ALLOWED" | null;

type HouseRuleChipConfig = {
  key: string;
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
};

type RoomMedia = PublicPropertyCard["rooms"][number]["media"][number];
type PropertyMedia = PublicPropertyCard["media"][number];

type MobilePhoneOption = {
  key: string;
  href: string;
  label: string;
  name: string | null;
};

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatMoney(value: number, currency: string): string {
  const amount = ruNumberFormat.format(value);
  if (currency === "RUB") {
    return `${amount} ₽`;
  }
  return `${amount} ${currency}`;
}

function getNights(checkIn: string, checkOut: string): number {
  const from = parseIsoDate(checkIn);
  const to = parseIsoDate(checkOut);
  if (!from || !to || to <= from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function formatNightsLabel(nights: number): string {
  const abs = Math.abs(nights) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${nights} ночей`;
  if (last === 1) return `${nights} ночь`;
  if (last >= 2 && last <= 4) return `${nights} ночи`;
  return `${nights} ночей`;
}

function formatGuestsLabel(guests: number): string {
  const count = Math.max(1, Math.floor(guests));
  const abs = count % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${count} гостей`;
  if (last === 1) return `${count} гость`;
  if (last >= 2 && last <= 4) return `${count} гостя`;
  return `${count} гостей`;
}

function formatReviewsCountLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${count} отзывов`;
  if (last === 1) return `${count} отзыв`;
  if (last >= 2 && last <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
}

function formatRoomArea(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

function formatRoomsCountLabel(value: number): string {
  const rooms = Math.max(1, Math.floor(value));
  const abs = rooms % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${rooms} комнат`;
  if (last === 1) return `${rooms} комната`;
  if (last >= 2 && last <= 4) return `${rooms} комнаты`;
  return `${rooms} комнат`;
}

function formatRoomsCompactLabel(value: number): string {
  return `${Math.max(1, Math.floor(value))}К`;
}

function formatPlacesLabel(value: number): string {
  const places = Math.max(1, Math.floor(value));
  const abs = places % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${places} мест`;
  if (last === 1) return `${places} место`;
  if (last >= 2 && last <= 4) return `${places} места`;
  return `${places} мест`;
}

function formatRoomCapacityLabel(beds: number, extraBeds: number): string {
  const mainPlaces = formatPlacesLabel(beds);
  return extraBeds > 0 ? `${mainPlaces} + ${extraBeds} доп.` : mainPlaces;
}

function formatRoomLayoutLabel(areaSqm: number | null, roomsCount: number): string {
  const roomsLabel = formatRoomsCountLabel(roomsCount);
  return areaSqm !== null ? `${formatRoomArea(areaSqm)} м² · ${roomsLabel}` : roomsLabel;
}

function LocationPinIcon({ className }: { className?: string }) {
  return <AppIcon icon={MapPin} className={className} />;
}

function SparkStarIcon({ className }: { className?: string }) {
  return <AppIcon icon={Star} className={className} filled />;
}

function CheckBadgeIcon({ className }: { className?: string }) {
  return <AppIcon icon={BadgeCheck} className={className} />;
}

function getPolicyRuleChipClasses(value: RulePolicyValue) {
  if (value === "FORBIDDEN") {
    return {
      className: "border-rose-200/80 bg-rose-50/85",
      valueClassName: "text-rose-700",
    };
  }

  if (value === "ALLOWED") {
    return {
      className: "border-emerald-200/80 bg-emerald-50/90",
      valueClassName: "text-emerald-800",
    };
  }

  if (value === "ON_REQUEST") {
    return {
      className: "border-terra/18 bg-terra/8",
      valueClassName: "text-terra-ink",
    };
  }

  return {
    className: "border-olive/10 bg-white/88",
    valueClassName: "text-olive",
  };
}

function AlertIcon({ className }: { className?: string }) {
  return <AppIcon icon={TriangleAlert} className={className} />;
}

function CalendarSmIcon({ className }: { className?: string }) {
  return <AppIcon icon={CalendarDays} className={className} />;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return <AppIcon icon={ChevronDown} className={className} />;
}

function ChevronUpIcon({ className }: { className?: string }) {
  return <AppIcon icon={ChevronUp} className={className} />;
}

function CloseIcon({ className }: { className?: string }) {
  return <AppIcon icon={X} className={className} />;
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return <AppIcon icon={ChevronLeft} className={className} />;
}

function ChevronRightIcon({ className }: { className?: string }) {
  return <AppIcon icon={ChevronRight} className={className} />;
}

function RoomFeatureIcon(props: { name: string; featureId?: string; className?: string }) {
  const { featureId, className } = props;
  if (featureId === "room_area") {
    return <AppIcon icon={RulerDimensionLine} className={className} />;
  }
  if (featureId === "room_rooms") {
    return <AppIcon icon={PanelsTopLeft} className={className} />;
  }
  return <AmenityIcon featureId={featureId} className={className} />;
}

function getRoomAmenityCategory(name: string): RoomAmenityItem["category"] {
  const value = name.trim().toLowerCase().replaceAll("ё", "е");
  if (/душ|ванн|туалет|сануз|писсуар|гигиен|биде/.test(value)) {
    return "bathroom";
  }
  if (/кровать|диван|спальн|двусп|односп|матрас|расклад/.test(value)) {
    return "beds";
  }
  return "equipment";
}

function formatBathroomSectionLabel(bathroomTypeLabel?: string | null): string {
  if (!bathroomTypeLabel) {
    return "Ванная комната";
  }

  return `Ванная комната · ${bathroomTypeLabel.toLowerCase()}`;
}

function formatTime(value: string | null): string {
  if (!value) return "Не указано";
  const [hours = "", minutes = ""] = value.split(":");
  if (!hours || !minutes) return value;
  return `${hours}:${minutes}`;
}

function extractSeaDistanceLabel(values: string[]): string | null {
  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;

    if (/первая\s+линия/i.test(value)) {
      return "Первая линия";
    }

    const match = value.match(/до\s*моря[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(км|м)\b/i);
    if (match) {
      return `До моря: ${match[1].replace(",", ".")} ${match[2].toLowerCase()}`;
    }

    if (/до\s*моря/i.test(value)) {
      return value.length > 42 ? `${value.slice(0, 39)}...` : value;
    }
  }
  return null;
}

function getNextMediaIndex(current: number, direction: -1 | 1, total: number): number {
  if (total <= 1) return 0;
  return direction === 1 ? (current + 1) % total : (current - 1 + total) % total;
}

type MediaPreviewProps = {
  media: RoomMedia;
  alt: string;
  className: string;
  loading?: "lazy" | "eager";
};

type MobileMessengerLink = {
  key: string;
  href: string;
  label: string;
  brand: ContactBrand | "website";
};

function MediaPreview({ media, alt, className, loading = "lazy" }: MediaPreviewProps) {
  if (media.type === "IMAGE") {
    return (
      <Image
        src={media.url}
        alt={alt}
        fill
        loading={loading}
        sizes="(max-width: 768px) 100vw, 400px"
        className={className}
      />
    );
  }

  return (
    <video
      src={media.url}
      aria-label={alt}
      controls
      playsInline
      preload="metadata"
      className={className}
    />
  );
}

function PropertyVideoSection({ videos, title }: { videos: PropertyMedia[]; title: string }) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <section
      id="videos"
      className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:scroll-mt-[152px] md:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <AppIcon icon={TvMinimalPlay} className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl text-olive md:text-[1.85rem]">Видео объекта</h2>
          <p className="mt-1 text-sm text-olive/68">{title}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {videos.map((video, index) => (
          <div
            key={video.id}
            className="overflow-hidden rounded-2xl border border-olive/10 bg-black shadow-[0_12px_28px_rgba(58,43,35,0.08)]"
          >
            <video
              src={video.url}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black object-contain"
              aria-label={`Видео объекта ${index + 1}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function toPetsLabel(value: "FORBIDDEN" | "ON_REQUEST" | "ALLOWED" | null): string {
  if (value === "FORBIDDEN") return "Запрещено";
  if (value === "ON_REQUEST") return "По согласованию";
  if (value === "ALLOWED") return "Можно с животными";
  return "Не указано";
}

function toSmokingLabel(value: "FORBIDDEN" | "ON_REQUEST" | "ALLOWED" | null): string {
  if (value === "FORBIDDEN") return "Запрещено";
  if (value === "ON_REQUEST") return "По согласованию";
  if (value === "ALLOWED") return "Разрешено";
  return "Не указано";
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

function normalizePhoneHref(phone: string | null | undefined): string | null {
  const value = phone?.trim() ?? "";
  if (!value) {
    return null;
  }

  const hasLeadingPlus = value.startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  return hasLeadingPlus ? `tel:+${digits}` : `tel:${digits}`;
}

function buildMobilePhoneOption(params: {
  key: string;
  phone: string | null | undefined;
  label?: string | null;
  name?: string | null;
}): MobilePhoneOption | null {
  const preparedPhone = params.phone?.trim() ?? "";
  if (!preparedPhone) {
    return null;
  }

  const href = normalizePhoneHref(preparedPhone);
  if (!href) {
    return null;
  }

  return {
    key: params.key,
    href,
    label: params.label?.trim() || formatPhoneLabel(preparedPhone) || preparedPhone,
    name: params.name?.trim() || null,
  };
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

function getRoomBasePrice(room: PublicPropertyCard["rooms"][number]): {
  value: number | null;
  priceType: RoomPriceType | null;
  currency: string | null;
} {
  let value: number | null = null;
  let priceType: RoomPriceType | null = null;
  let currency: string | null = null;
  for (const item of room.prices) {
    if (value === null || item.price < value) {
      value = item.price;
      priceType = normalizeRoomPriceType(item.priceType);
      currency = item.currency;
    }
  }
  return { value, priceType, currency };
}

function formatNightlyPriceLabel(
  value: number,
  currency: string,
  priceType: RoomPriceCalculationType | null,
): string {
  return `${formatMoney(value, currency)} ${getRoomPriceNightlySuffix(priceType)}`;
}

function getMaxRequiredMinGuests(
  room: PublicPropertyCard["rooms"][number],
  checkIn: string,
  nights: number,
): number {
  const from = parseIsoDate(checkIn);
  if (!from || nights <= 0) return 1;
  let required = 1;
  for (let index = 0; index < nights; index += 1) {
    const dayIso = toIsoDate(addDays(from, index));
    const period = room.prices.find((price) => price.dateFrom <= dayIso && price.dateTo >= dayIso);
    if (period?.minGuests && period.minGuests > required) required = period.minGuests;
  }
  return required;
}

function getRoomPriceSummary(
  room: PublicPropertyCard["rooms"][number],
  checkIn: string | null,
  checkOut: string | null,
  guests: number,
): {
  text: string;
  meta?: string;
  tone: "ok" | "warn";
  bigPrice: string | null;
  sideLabel: string | null;
  smallLabel: string | null;
} {
  const capacity = room.beds + room.extraBeds;
  if (guests > capacity) {
    return {
      text: `Не подходит для группы ${guests} гостей (вместимость ${capacity})`,
      tone: "warn",
      bigPrice: null,
      sideLabel: null,
      smallLabel: null,
    };
  }

  if (!checkIn || !checkOut) {
    const base = getRoomBasePrice(room);
    if (base.value !== null && base.currency) {
      const price = formatMoney(base.value, base.currency);
      const nightlyLabel = formatNightlyPriceLabel(base.value, base.currency, base.priceType);
      const unitLabel =
        base.priceType === "PER_PERSON" ? "за человека в сутки" : "за номер в сутки";
      return {
        text: `от ${nightlyLabel}`,
        tone: "ok",
        bigPrice: `от ${price}`,
        sideLabel: null,
        smallLabel: unitLabel,
      };
    }
    return {
      text: "Цена по запросу",
      tone: "ok",
      bigPrice: "По запросу",
      sideLabel: null,
      smallLabel: null,
    };
  }

  const calculation = calculateRoomStayPrice({
    prices: room.prices.map((price) => ({
      dateFrom: price.dateFrom,
      dateTo: price.dateTo,
      price: price.price,
      priceType: price.priceType,
      minGuests: price.minGuests,
      currency: price.currency,
    })),
    checkIn,
    checkOut,
    guests,
  });
  if (!calculation.ok) {
    return {
      text: "Для части выбранного периода цена не задана",
      tone: "warn",
      bigPrice: null,
      sideLabel: null,
      smallLabel: null,
    };
  }

  const requiredMinGuests = getMaxRequiredMinGuests(room, checkIn, calculation.nights);
  if (guests < requiredMinGuests) {
    return {
      text: `Минимальный состав гостей: ${requiredMinGuests}`,
      tone: "warn",
      bigPrice: null,
      sideLabel: null,
      smallLabel: null,
    };
  }

  const totalNightly = Math.round(calculation.total / calculation.nights);
  const unitNightly = Math.round(calculation.unitTotal / calculation.nights);
  const perNight =
    calculation.priceType === "PER_PERSON"
      ? `${formatMoney(unitNightly, calculation.currency)} за человека`
      : calculation.priceType === "MIXED"
        ? `${formatMoney(totalNightly, calculation.currency)} за ночь`
        : `${formatMoney(totalNightly, calculation.currency)} за номер в сутки`;
  const nightsLabel = formatNightsLabel(calculation.nights);
  const sideLabel =
    calculation.priceType === "PER_PERSON"
      ? `за ${nightsLabel}, ${formatGuestsLabel(guests)}`
      : `за ${nightsLabel}`;
  return {
    text: `${formatMoney(calculation.total, calculation.currency)} ${sideLabel}`,
    meta: perNight,
    tone: "ok",
    bigPrice: formatMoney(calculation.total, calculation.currency),
    sideLabel,
    smallLabel: perNight,
  };
}

function resolveInitialGuestState(input: {
  initialGuestsCount?: number | null;
  initialAdultsCount?: number | null;
  initialChildrenCount?: number | null;
}): { adults: number; childrenAges: number[] } {
  return parseDetailedGuestsValue({
    guests:
      typeof input.initialGuestsCount === "number" && Number.isFinite(input.initialGuestsCount)
        ? String(Math.max(0, Math.round(input.initialGuestsCount)))
        : undefined,
    adults:
      typeof input.initialAdultsCount === "number" && Number.isFinite(input.initialAdultsCount)
        ? String(Math.max(0, Math.round(input.initialAdultsCount)))
        : undefined,
    children:
      typeof input.initialChildrenCount === "number" && Number.isFinite(input.initialChildrenCount)
        ? String(Math.max(0, Math.round(input.initialChildrenCount)))
        : undefined,
  });
}

type GuestsPlacementFieldProps = {
  adults: number;
  childrenAges: number[];
  onAdultsChange: (value: number) => void;
  onChildrenAgesChange: (value: number[]) => void;
  onDone?: () => void;
};

function GuestsPlacementField({
  adults,
  childrenAges,
  onAdultsChange,
  onChildrenAgesChange,
  onDone,
}: GuestsPlacementFieldProps) {
  return (
    <HousingSearchGuestsField
      initialGuests={String(adults + childrenAges.length)}
      initialAdults={String(adults)}
      initialChildren={String(childrenAges.length)}
      autoSubmitOnComplete={false}
      showHiddenInputs={false}
      buttonClassName="h-[62px] w-full rounded-2xl border border-sand bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
      onGuestsChange={({ adults: nextAdults, children: nextChildren }) => {
        const normalizedAdults = Number.parseInt(nextAdults, 10);
        const normalizedChildren = Number.parseInt(nextChildren, 10);

        onAdultsChange(Number.isFinite(normalizedAdults) ? normalizedAdults : adults);
        onChildrenAgesChange(
          Array.from(
            { length: Number.isFinite(normalizedChildren) ? Math.max(0, normalizedChildren) : 0 },
            (_, index) => childrenAges[index] ?? 0,
          ),
        );
        onDone?.();
      }}
    />
  );
}

type RoomPhotoGalleryState = {
  roomId: string;
  index: number;
};

type RoomPhotoLightboxProps = {
  room: PublicPropertyCard["rooms"][number];
  photos: RoomMedia[];
  activeIndex: number;
  amenities: RoomCardAmenityItem[];
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

function RoomPhotoLightbox({
  room,
  photos,
  activeIndex,
  amenities,
  onIndexChange,
  onClose,
}: RoomPhotoLightboxProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const count = photos.length;
  const safeActiveIndex = count > 0 ? Math.min(Math.max(activeIndex, 0), count - 1) : 0;
  const activePhoto = photos[safeActiveIndex] ?? null;
  const titleId = `room-photo-gallery-title-${room.id}`;
  const featureAmenities = amenities.filter((amenity) => !amenity.isPrimary).slice(0, 4);

  const prev = useCallback(() => {
    if (count <= 1) return;
    onIndexChange((safeActiveIndex - 1 + count) % count);
  }, [count, onIndexChange, safeActiveIndex]);

  const next = useCallback(() => {
    if (count <= 1) return;
    onIndexChange((safeActiveIndex + 1) % count);
  }, [count, onIndexChange, safeActiveIndex]);

  useEffect(() => {
    if (count === 0) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") prev();
      else if (event.key === "ArrowRight") next();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [count, next, onClose, prev]);

  useEffect(() => {
    if (!thumbsRef.current) return;

    const thumb = thumbsRef.current.children[safeActiveIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [safeActiveIndex]);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = event.changedTouches[0].clientX - touchStartX.current;
    const dy = event.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const portalRoot = typeof document === "undefined" ? null : document.body;
  if (!portalRoot || count === 0 || !activePhoto) {
    return null;
  }

  return createPortal(
    <div
      className="gallery-lightbox room-photo-lightbox"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="gallery-lightbox-content"
        onClick={(event) => {
          if (event.target !== event.currentTarget) {
            event.stopPropagation();
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activePhoto.id}
          src={activePhoto.url}
          alt={`Фото номера ${room.title}, ${safeActiveIndex + 1} из ${count}`}
          className="gallery-lightbox-img"
        />

        <div className="room-photo-lightbox-info" onClick={(event) => event.stopPropagation()}>
          <div className="room-photo-lightbox-title-row flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Фото номера
              </p>
              <h3
                id={titleId}
                className="room-photo-lightbox-title mt-1 truncate text-lg font-semibold text-white"
              >
                {room.title}
              </h3>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/82">
              <AppIcon icon={Images} className="h-3.5 w-3.5" />
              {count}
            </span>
          </div>

          <div className="room-photo-lightbox-summary mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/88">
              <AppIcon icon={Users} className="h-3.5 w-3.5 text-white/68" />
              {formatRoomCapacityLabel(room.beds, room.extraBeds)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/88">
              <AppIcon icon={RulerDimensionLine} className="h-3.5 w-3.5 text-white/68" />
              {formatRoomLayoutLabel(room.areaSqm, room.roomsCount)}
            </span>
            {room.bathroomTypeLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/88">
                <AppIcon icon={Toilet} className="h-3.5 w-3.5 text-white/68" />
                {room.bathroomTypeLabel}
              </span>
            ) : null}
          </div>

          {featureAmenities.length > 0 ? (
            <div className="room-photo-lightbox-feature-list mt-2.5 flex flex-wrap gap-1.5">
              {featureAmenities.map((amenity) => (
                <span
                  key={amenity.key}
                  className="room-photo-lightbox-feature-chip inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-2 py-1 text-[11px] leading-snug text-white/74"
                  title={amenity.name}
                >
                  {amenity.icon ? (
                    <AppIcon icon={amenity.icon} className="h-3.5 w-3.5 shrink-0 text-white/54" />
                  ) : (
                    <RoomFeatureIcon
                      name={amenity.name}
                      featureId={amenity.featureId}
                      className="h-3.5 w-3.5 shrink-0 text-white/54"
                    />
                  )}
                  <span className="room-photo-lightbox-chip-text min-w-0 truncate">
                    {amenity.name}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="gallery-lightbox-counter">
        {safeActiveIndex + 1} / {count}
      </div>

      <button className="gallery-lightbox-close" onClick={onClose} aria-label="Закрыть">
        <CloseIcon className="h-5 w-5" />
      </button>

      {count > 1 ? (
        <>
          <button
            className="gallery-lightbox-nav gallery-lightbox-prev"
            onClick={(event) => {
              event.stopPropagation();
              prev();
            }}
            aria-label="Предыдущее фото"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            className="gallery-lightbox-nav gallery-lightbox-next"
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
            aria-label="Следующее фото"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </>
      ) : null}

      {count > 1 ? (
        <div
          className="gallery-lightbox-thumbs"
          ref={thumbsRef}
          onClick={(event) => event.stopPropagation()}
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              className={`gallery-lightbox-thumb ${index === safeActiveIndex ? "active" : ""}`}
              onClick={() => onIndexChange(index)}
              aria-label={`Фото ${index + 1}`}
              aria-current={index === safeActiveIndex}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    portalRoot,
  );
}

export function PublicPropertyDetails({
  item,
  initialIsFavorite,
  initialCheckIn,
  initialCheckOut,
  initialGuestsCount,
  initialAdultsCount,
  initialChildrenCount,
}: PublicPropertyDetailsProps) {
  const detailsRootRef = useRef<HTMLDivElement | null>(null);
  const todayIso = useMemo(() => getLocalTodayIso(), []);
  const defaultCheckOutIso = useMemo(() => {
    const parsedToday = parseIsoDate(todayIso);
    return parsedToday ? toIsoDate(addDays(parsedToday, 1)) : todayIso;
  }, [todayIso]);
  const normalizedInitialStayRange = useMemo(() => {
    const parsedCheckIn = initialCheckIn ? parseIsoDate(initialCheckIn) : null;
    const parsedCheckOut = initialCheckOut ? parseIsoDate(initialCheckOut) : null;

    if (parsedCheckIn && parsedCheckOut && parsedCheckOut > parsedCheckIn) {
      return {
        checkIn: toIsoDate(parsedCheckIn),
        checkOut: toIsoDate(parsedCheckOut),
      };
    }

    return {
      checkIn: todayIso,
      checkOut: defaultCheckOutIso,
    };
  }, [defaultCheckOutIso, initialCheckIn, initialCheckOut, todayIso]);
  const normalizedInitialGuestState = useMemo(
    () =>
      resolveInitialGuestState({
        initialGuestsCount,
        initialAdultsCount,
        initialChildrenCount,
      }),
    [initialAdultsCount, initialChildrenCount, initialGuestsCount],
  );
  const [checkIn, setCheckIn] = useState<string | null>(normalizedInitialStayRange.checkIn);
  const [checkOut, setCheckOut] = useState<string | null>(normalizedInitialStayRange.checkOut);
  const [adults, setAdults] = useState(normalizedInitialGuestState.adults);
  const [childrenAges, setChildrenAges] = useState<number[]>(
    normalizedInitialGuestState.childrenAges,
  );
  const [roomMediaIndexByRoom, setRoomMediaIndexByRoom] = useState<Record<string, number>>({});
  const [roomPhotoGallery, setRoomPhotoGallery] = useState<RoomPhotoGalleryState | null>(null);
  const [activeRoomDetailsId, setActiveRoomDetailsId] = useState<string | null>(null);
  const [isMobileBookingOpen, setIsMobileBookingOpen] = useState(false);
  const [isMobileCallSheetOpen, setIsMobileCallSheetOpen] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [leadModalRoom, setLeadModalRoom] = useState<PublicPropertyCard["rooms"][number] | null>(
    null,
  );
  const [leadExtra, setLeadExtra] = useState("");
  const [leadCopied, setLeadCopied] = useState(false);
  const { authorGender, setAuthorGender } = useLeadMessageAuthorGender();
  useBodyScrollLock(
    Boolean(
      activeRoomDetailsId ||
      roomPhotoGallery ||
      isMobileBookingOpen ||
      leadModalRoom ||
      isMobileCallSheetOpen,
    ),
  );
  const propertyMedia = useMemo(
    () => item.media.filter((media) => media.type === "IMAGE").slice(0, 10),
    [item.media],
  );
  const propertyVideos = useMemo(
    () => item.media.filter((media) => media.type === "VIDEO").slice(0, 2),
    [item.media],
  );
  const hasAnyVideo = propertyVideos.length > 0;
  const totalGuests = adults + childrenAges.length;
  const selectedNights = checkIn && checkOut ? getNights(checkIn, checkOut) : 0;
  const allAmenities =
    item.amenityGroups.combined.length > 0
      ? item.amenityGroups.combined
      : [...item.amenities.map((amenity) => amenity.name), ...item.customAmenities];
  const visibleAmenities = showAllAmenities ? allAmenities : allAmenities.slice(0, 10);
  const description = item.description?.trim() ?? "";
  const shortDescription =
    description.length > 420 && !showFullDescription
      ? `${description.slice(0, 420)}...`
      : description;
  const registryNumber = item.classification.registryNumber?.trim() ?? "";
  const hasRegistryNumber = registryNumber.length > 0;
  const yandexMapsHref = item.address
    ? item.latitude !== null && item.longitude !== null
      ? `https://yandex.ru/maps/?pt=${item.longitude},${item.latitude}&z=15&l=map`
      : `https://yandex.ru/maps/?text=${encodeURIComponent(item.address)}`
    : null;
  const hasMapSection = item.latitude !== null && item.longitude !== null;
  const mapOverlayAddress = item.address ?? item.locationName ?? "Координаты объекта";
  const mobilePhoneLabel = formatPhoneLabel(item.contacts.phone);
  const phone2Label = formatPhoneLabel(item.contacts.phone2);
  const phone3Label = formatPhoneLabel(item.contacts.phone3);
  const extraContactPhones = [
    item.contacts.phone2?.trim()
      ? {
          phone: item.contacts.phone2,
          label: phone2Label,
          name: item.contacts.phone2Name,
        }
      : null,
    item.contacts.phone3?.trim()
      ? {
          phone: item.contacts.phone3,
          label: phone3Label,
          name: item.contacts.phone3Name,
        }
      : null,
  ].filter(
    (
      phone,
    ): phone is {
      phone: string;
      label: string | null;
      name: string | null;
    } => phone !== null,
  );
  const mobileCallPhones = [
    buildMobilePhoneOption({
      key: "primary",
      phone: item.contacts.phone,
      label: mobilePhoneLabel,
      name: item.contacts.phoneName,
    }),
    ...extraContactPhones.map((phone, index) =>
      buildMobilePhoneOption({
        key: `extra-${index + 1}`,
        phone: phone.phone,
        label: phone.label,
        name: phone.name,
      }),
    ),
  ].filter((phone): phone is MobilePhoneOption => phone !== null);
  const primaryMobileCallPhone = mobileCallPhones[0] ?? null;
  const hasMultipleMobileCallPhones = mobileCallPhones.length > 1;
  const mobileMessengerLinks = buildMobileMessengerLinks({
    websiteUrl: item.contacts.websiteUrl,
    whatsappUrl: item.contacts.whatsappUrl,
    telegramUrl: item.contacts.telegramUrl,
    vkUrl: item.contacts.vkUrl,
    maxUrl: item.contacts.maxUrl,
    okUrl: item.contacts.okUrl,
  });
  const contactTracking = { entityType: "property" as const, entityId: item.id };
  const seaDistanceLabel = extractSeaDistanceLabel(allAmenities);
  const mainPriceLabel =
    item.minNightPrice !== null && item.currency
      ? `от ${formatMoney(item.minNightPrice, item.currency)}`
      : "Цена по запросу";
  const locationLabel = item.locationName ?? "Крым";
  const hasReviews = item.reviewsCount > 0;
  const reviewsCountLabel = formatReviewsCountLabel(item.reviewsCount);
  const headerRatingLine = hasReviews
    ? `${item.avgRating.toFixed(1)} · ${reviewsCountLabel}`
    : null;
  const heroBadges = [
    item.avgRating >= 4.8 && item.reviewsCount >= 10 ? "Топ выбор гостей" : null,
    item.reviewsCount >= 25 ? "Проверено отзывами" : null,
    hasRegistryNumber ? "Проверено в реестре" : null,
    seaDistanceLabel,
  ].filter((badge): badge is string => Boolean(badge));
  const ownerDisplayName = formatPublicPersonName(item.owner, "Владелец");
  const ownerVerificationLabel = "Владелец проверен";
  const rankedRooms = useMemo(() => {
    return item.rooms
      .map((room, index) => {
        const capacity = room.beds + room.extraBeds;
        const requiredMinGuests =
          checkIn && selectedNights > 0
            ? getMaxRequiredMinGuests(room, checkIn, selectedNights)
            : 1;
        const isSuitable = totalGuests <= capacity && totalGuests >= requiredMinGuests;

        let hasStayPrice = false;
        let stayTotal: number | null = null;
        let stayCurrency: string | null = null;
        let stayNightly: number | null = null;
        let stayUnitNightly: number | null = null;
        let stayPriceType: RoomPriceCalculationType | null = null;

        if (checkIn && checkOut && selectedNights > 0) {
          const calculation = calculateRoomStayPrice({
            prices: room.prices.map((price) => ({
              dateFrom: price.dateFrom,
              dateTo: price.dateTo,
              price: price.price,
              priceType: price.priceType,
              minGuests: price.minGuests,
              currency: price.currency,
            })),
            checkIn,
            checkOut,
            guests: totalGuests,
          });
          if (calculation.ok) {
            hasStayPrice = true;
            stayTotal = calculation.total;
            stayCurrency = calculation.currency;
            stayNightly = Math.round(calculation.total / calculation.nights);
            stayUnitNightly = Math.round(calculation.unitTotal / calculation.nights);
            stayPriceType = calculation.priceType;
          }
        }

        const basePrice = getRoomBasePrice(room);
        const sortPrice = stayNightly ?? basePrice.value;

        return {
          room,
          index,
          isSuitable,
          hasStayPrice,
          stayTotal,
          stayCurrency,
          stayNightly,
          stayUnitNightly,
          stayPriceType,
          sortPrice,
          capacityDelta: Math.abs(capacity - totalGuests),
        };
      })
      .sort((left, right) => {
        if (left.isSuitable !== right.isSuitable) {
          return left.isSuitable ? -1 : 1;
        }
        if (left.hasStayPrice !== right.hasStayPrice) {
          return left.hasStayPrice ? -1 : 1;
        }
        if (left.capacityDelta !== right.capacityDelta) {
          return left.capacityDelta - right.capacityDelta;
        }
        if (
          left.sortPrice !== null &&
          right.sortPrice !== null &&
          left.sortPrice !== right.sortPrice
        ) {
          return left.sortPrice - right.sortPrice;
        }
        if (left.sortPrice !== null && right.sortPrice === null) return -1;
        if (left.sortPrice === null && right.sortPrice !== null) return 1;
        return left.index - right.index;
      });
  }, [checkIn, checkOut, item.rooms, selectedNights, totalGuests]);
  const sidebarQuote = useMemo(() => {
    if (!checkIn || !checkOut || selectedNights <= 0) {
      return null;
    }

    type QuoteResult = {
      total: number;
      currency: string;
      nights: number;
      nightly: number;
      unitNightly: number | null;
      priceType: RoomPriceCalculationType | null;
      roomTitle: string;
    };

    const bestAutoEntry = rankedRooms.find(
      (entry) =>
        entry.isSuitable &&
        entry.hasStayPrice &&
        entry.stayTotal !== null &&
        entry.stayNightly !== null &&
        entry.stayCurrency,
    );

    if (!bestAutoEntry) {
      return null;
    }
    const bestTotal = bestAutoEntry.stayTotal;
    const bestCurrency = bestAutoEntry.stayCurrency;
    const bestNightly = bestAutoEntry.stayNightly;
    if (bestTotal === null || bestNightly === null || !bestCurrency) {
      return null;
    }

    return {
      total: bestTotal,
      currency: bestCurrency,
      nights: selectedNights,
      nightly: bestNightly,
      unitNightly: bestAutoEntry.stayUnitNightly,
      priceType: bestAutoEntry.stayPriceType,
      roomTitle: bestAutoEntry.room.title,
    } satisfies QuoteResult;
  }, [checkIn, checkOut, rankedRooms, selectedNights]);
  const sortedRooms = rankedRooms;
  const sidebarNightlyLabel = sidebarQuote
    ? `${formatMoney(sidebarQuote.nightly, sidebarQuote.currency)} за ночь`
    : `${mainPriceLabel} ${getRoomPriceNightlySuffix(item.minNightPriceType)}`;
  const sidebarPriceMeta =
    sidebarQuote?.priceType === "PER_PERSON" && sidebarQuote.unitNightly !== null
      ? `${formatNightsLabel(selectedNights)}, ${formatGuestsLabel(totalGuests)} · ${formatMoney(
          sidebarQuote.unitNightly,
          sidebarQuote.currency,
        )} за человека`
      : selectedNights > 0
        ? `${formatNightsLabel(selectedNights)}, ${formatGuestsLabel(totalGuests)}`
        : "Выберите даты и состав гостей";
  const sidebarPriceRoomHint = sidebarQuote ? `Лучший номер: ${sidebarQuote.roomTitle}` : null;
  const checkInRuleValue = item.rules.checkInFrom
    ? `с ${formatTime(item.rules.checkInFrom)}`
    : "Не указано";
  const checkOutRuleValue = item.rules.checkOutUntil
    ? `до ${formatTime(item.rules.checkOutUntil)}`
    : "Не указано";
  const childrenRuleValue = item.rules.childrenAllowed
    ? item.rules.childrenMinAge === null
      ? "любого возраста"
      : `с ${item.rules.childrenMinAge} лет`
    : "уточняйте у владельца";
  const quietHoursRuleValue = item.rules.quietHoursEnabled
    ? `${item.rules.quietHoursFrom ?? "--:--"} – ${item.rules.quietHoursTo ?? "--:--"}`
    : null;
  const parsedParkingInfo = parseParkingInfoValue(item.rules.parkingInfo);
  const parsedMealOptions = parseMealOptionsValue(item.rules.mealOptions);
  const parsedPrepaymentPolicy = parsePrepaymentPolicyValue(item.rules.prepaymentPolicy);
  const parkingRuleValues =
    parsedParkingInfo.labels.length > 0
      ? parsedParkingInfo.labels
      : parsedParkingInfo.legacyText
        ? [parsedParkingInfo.legacyText]
        : [];
  const mealRuleValues =
    parsedMealOptions.labels.length > 0
      ? parsedMealOptions.labels
      : parsedMealOptions.legacyText
        ? [parsedMealOptions.legacyText]
        : [];
  const petsRuleClasses = getPolicyRuleChipClasses(item.rules.petsPolicy);
  const smokingRuleClasses = getPolicyRuleChipClasses(item.rules.smokingPolicy);
  const ruleChips: HouseRuleChipConfig[] = [
    {
      key: "check-in",
      label: "Заезд",
      value: checkInRuleValue,
      className: "border-primary/12 bg-white/85",
      valueClassName: "text-primary",
    },
    {
      key: "check-out",
      label: "Выезд",
      value: checkOutRuleValue,
      className: "border-terra/15 bg-white/85",
      valueClassName: "text-terra",
    },
    {
      key: "children",
      label: "Дети",
      value: childrenRuleValue,
      className: "border-sage/35 bg-white/80",
    },
    {
      key: "pets",
      label: "Животные",
      value: toPetsLabel(item.rules.petsPolicy),
      ...petsRuleClasses,
    },
    {
      key: "smoking",
      label: "Курение",
      value: toSmokingLabel(item.rules.smokingPolicy),
      ...smokingRuleClasses,
    },
    ...(quietHoursRuleValue
      ? [
          {
            key: "quiet-hours",
            label: "Тишина",
            value: quietHoursRuleValue,
            className: "border-midnight/10 bg-white/80",
          } satisfies HouseRuleChipConfig,
        ]
      : []),
    ...parkingRuleValues.map(
      (value, index) =>
        ({
          key: `parking-${index}`,
          label: "Парковка",
          value,
          className: "border-sand bg-cream/80",
        }) satisfies HouseRuleChipConfig,
    ),
    ...mealRuleValues.map(
      (value, index) =>
        ({
          key: `meal-${index}`,
          label: "Питание",
          value,
          className: "border-sage/28 bg-sage/18",
        }) satisfies HouseRuleChipConfig,
    ),
    ...(parsedPrepaymentPolicy.displayValue
      ? [
          {
            key: "prepayment",
            label: "Предоплата при бронировании",
            value: parsedPrepaymentPolicy.displayValue,
            className: "border-olive/12 bg-white/88",
          } satisfies HouseRuleChipConfig,
        ]
      : []),
  ];

  const handleStayRangeChange = useCallback((range: { checkIn: string; checkOut: string }) => {
    setCheckIn(range.checkIn || null);
    setCheckOut(range.checkOut || null);
  }, []);

  function cycleRoomMedia(roomId: string, direction: -1 | 1, total: number) {
    if (total <= 1) return;
    setRoomMediaIndexByRoom((prev) => {
      const current = prev[roomId] ?? 0;
      const next = getNextMediaIndex(current, direction, total);
      return { ...prev, [roomId]: next };
    });
  }

  const openRoomPhotoGallery = useCallback((roomId: string, index: number) => {
    setRoomPhotoGallery({ roomId, index: Math.max(0, index) });
  }, []);

  const closeRoomPhotoGallery = useCallback(() => {
    setRoomPhotoGallery(null);
  }, []);

  const setRoomPhotoGalleryIndex = useCallback((roomId: string, index: number) => {
    setRoomPhotoGallery((current) => {
      if (!current || current.roomId !== roomId) {
        return current;
      }

      return { ...current, index: Math.max(0, index) };
    });
  }, []);

  function scrollToRoomFund() {
    const roomFundSection = document.getElementById("room-fund");
    if (roomFundSection) {
      roomFundSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function openContactsSection() {
    setIsMobileBookingOpen(false);

    if (hasMultipleMobileCallPhones) {
      setIsMobileCallSheetOpen(true);
      return;
    }

    if (primaryMobileCallPhone) {
      trackListingAction({
        ...contactTracking,
        actionType: getPhoneListingActionType(0),
      });
      window.location.assign(primaryMobileCallPhone.href);
      return;
    }

    const firstMessenger = mobileMessengerLinks[0];
    if (firstMessenger) {
      const actionType = getContactActionTypeFromChannel(firstMessenger.key);
      if (actionType) {
        trackListingAction({ ...contactTracking, actionType });
      }
      window.open(firstMessenger.href, "_blank", "noopener,noreferrer");
      return;
    }

    const contactsPanel = detailsRootRef.current?.querySelector<HTMLElement>(
      "[data-property-contacts-panel]",
    );
    contactsPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      ref={detailsRootRef}
      className="property-details-page space-y-6 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] lg:pb-0"
    >
      {/* Hero: gallery + overlaid info */}
      <section className="relative overflow-hidden rounded-3xl">
        {propertyMedia.length > 0 ? (
          <PropertyMediaGallery media={propertyMedia} title={item.name ?? "Объект"} />
        ) : (
          <div className="bg-cream py-12 text-center text-sm text-olive/60 ring-1 ring-olive/10">
            Фото и видео объекта пока не загружены.
          </div>
        )}

        {/* Overlay info — desktop: over gallery, mobile: below gallery images */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden bg-gradient-to-t from-midnight/75 via-midnight/40 to-transparent px-6 pb-6 pt-28 md:block">
          <div className="pointer-events-auto flex items-end justify-between gap-6">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
                  {item.typeLabel ?? "Объект размещения"}
                </span>
                {heroBadges
                  .filter((b) => !/проверено в реестре/i.test(b))
                  .map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm"
                    >
                      {badge}
                    </span>
                  ))}
              </div>
              <h1 className="text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-[2.4rem]">
                {item.name ?? "Объект"}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <LocationPinIcon className="h-4 w-4 text-white/70" />
                  <span>{locationLabel}</span>
                </span>
                {headerRatingLine ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium text-white/90 backdrop-blur-sm">
                    <SparkStarIcon className="h-4 w-4 text-sage" />
                    <span>{headerRatingLine}</span>
                  </span>
                ) : null}
              </div>
              {item.address ? (
                <a
                  href={yandexMapsHref ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex max-w-full items-start gap-1.5 text-sm text-white/70 underline decoration-dotted underline-offset-4 transition hover:text-white"
                >
                  <LocationPinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item.address}</span>
                </a>
              ) : null}
            </div>
            <div className="shrink-0">
              <FavoriteToggleButton itemId={item.id} initialIsFavorite={initialIsFavorite} />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-only info strip below gallery */}
      <div className="space-y-2.5 px-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-olive/10 bg-cream/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/70">
            {item.typeLabel ?? "Объект размещения"}
          </span>
          {heroBadges
            .filter((b) => !/проверено в реестре/i.test(b))
            .map((badge) => (
              <span
                key={badge}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  /первая\s+линия|до моря/i.test(badge)
                    ? "bg-terra/12 text-terra-ink"
                    : "bg-sage/18 text-olive/80",
                )}
              >
                {badge}
              </span>
            ))}
        </div>
        <div className="text-2xl font-bold leading-tight text-olive sm:text-3xl">
          {item.name ?? "Объект"}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-olive/68">
          <span className="inline-flex items-center gap-1.5">
            <LocationPinIcon className="h-4 w-4 text-terra" />
            <span>{locationLabel}</span>
          </span>
          {headerRatingLine ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/16 px-3 py-1 font-medium text-olive">
              <SparkStarIcon className="h-4 w-4 text-terra" />
              <span>{headerRatingLine}</span>
            </span>
          ) : null}
        </div>
        {item.address ? (
          <a
            href={yandexMapsHref ?? "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-start gap-1.5 text-sm text-olive/72 underline decoration-dotted underline-offset-4 transition hover:text-terra"
          >
            <LocationPinIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{item.address}</span>
          </a>
        ) : null}
        <div className="flex items-center justify-between">
          <FavoriteToggleButton itemId={item.id} initialIsFavorite={initialIsFavorite} />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,368px)]">
        {/* в”Ђв”Ђ Left column в”Ђв”Ђ */}
        <div className="min-w-0 space-y-5">
          {/* Section navigation */}
          <nav
            className="-mx-1 w-auto max-w-full overflow-x-auto rounded-2xl border border-olive/10 bg-white/94 px-1.5 shadow-[0_10px_26px_rgba(58,43,35,0.06)] backdrop-blur-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-2"
            aria-label="Навигация по разделам"
          >
            <div className="flex min-w-max snap-x snap-mandatory items-center gap-1.5 pb-1">
              {[
                { href: "#room-fund", label: "Варианты размещения" },
                ...(hasAnyVideo ? [{ href: "#videos", label: "Видео" }] : []),
                { href: "#description-panel", label: "Описание" },
                { href: "#amenities", label: "Удобства" },
                { href: "#house-rules", label: "Правила" },
                ...(hasMapSection ? [{ href: "#map-panel", label: "Расположение" }] : []),
                { href: "#reviews", label: "Отзывы" },
              ].map((link) => (
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
            aria-label="Даты и гости"
            className="rounded-[28px] border border-olive/10 bg-white p-4 shadow-[0_14px_36px_rgba(58,43,35,0.06)] md:p-5"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-5">
              <div className="flex items-start gap-3 xl:w-[280px] xl:shrink-0">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-terra ring-1 ring-olive/10">
                  <CalendarSmIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/42">
                    Даты и гости
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-lg font-semibold text-olive">{sidebarNightlyLabel}</p>
                    <p className="text-sm text-olive/60">{sidebarPriceMeta}</p>
                  </div>
                  {sidebarPriceRoomHint ? (
                    <p className="mt-1 text-sm text-olive/66">{sidebarPriceRoomHint}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.9fr)] xl:flex-1">
                <HousingSearchDateRangeField
                  initialCheckIn={checkIn ?? ""}
                  initialCheckOut={checkOut ?? ""}
                  onRangeChange={handleStayRangeChange}
                  autoSubmitOnComplete={false}
                  showHiddenInputs={false}
                  buttonClassName="h-[62px] w-full rounded-2xl border border-olive/14 bg-white px-4 text-left text-olive transition hover:border-olive/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/30"
                />
                <GuestsPlacementField
                  adults={adults}
                  childrenAges={childrenAges}
                  onAdultsChange={setAdults}
                  onChildrenAgesChange={setChildrenAges}
                />
              </div>
            </div>
          </section>

          <section
            id="room-fund"
            className="relative scroll-mt-[132px] overflow-hidden rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:scroll-mt-[152px] md:p-6"
          >
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl text-olive md:text-[1.85rem]">Доступные варианты</h2>
                <p className="mt-1 text-sm text-olive/68">
                  {item.rooms.length}{" "}
                  {item.rooms.length === 1
                    ? "вариант"
                    : item.rooms.length >= 2 && item.rooms.length <= 4
                      ? "варианта"
                      : "вариантов"}{" "}
                  размещения
                </p>
              </div>
            </div>
            {item.rooms.length === 0 ? (
              <p className="relative mt-3 text-sm text-olive/70">Номера пока не добавлены.</p>
            ) : (
              <div className="relative mt-5 space-y-4">
                {sortedRooms.map(({ room }) => {
                  const roomMedia = room.media
                    .filter((media) => media.type === "IMAGE" || media.type === "VIDEO")
                    .slice(0, 10);
                  const roomPhotos = room.media
                    .filter((media) => media.type === "IMAGE")
                    .slice(0, 10);
                  const roomIndex = Math.min(
                    roomMediaIndexByRoom[room.id] ?? 0,
                    Math.max(roomMedia.length - 1, 0),
                  );
                  const activeRoomMedia = roomMedia[roomIndex] ?? roomMedia[0] ?? null;
                  const summary = getRoomPriceSummary(room, checkIn, checkOut, totalGuests);
                  const isDetailsOpen = activeRoomDetailsId === room.id;
                  const bedLabelById = Object.fromEntries(
                    bedTypeOptions.map((o) => [o.id, o.label]),
                  );
                  const bedConfigItems: RoomAmenityItem[] =
                    room.meta?.bedConfiguration && room.meta.bedConfiguration.length > 0
                      ? room.meta.bedConfiguration
                          .filter((bc) => bc.type !== "no_bed")
                          .map((bc, i) => ({
                            key: `${room.id}-bed-type-${i}-${bc.type}`,
                            featureId: "beds_base",
                            name:
                              bc.count > 1
                                ? `${bc.count} Г— ${bedLabelById[bc.type] ?? bc.type}`
                                : (bedLabelById[bc.type] ?? bc.type),
                            category: "beds" as const,
                          }))
                      : [];
                  const roomAmenityItems: RoomAmenityItem[] = [
                    {
                      key: `${room.id}-beds-base`,
                      featureId: "beds_base",
                      name:
                        room.extraBeds > 0
                          ? `Спальные места: ${room.beds} + ${room.extraBeds} доп.`
                          : `Спальные места: ${room.beds}`,
                      category: "beds",
                    },
                    ...(room.areaSqm !== null
                      ? [
                          {
                            key: `${room.id}-area`,
                            featureId: "room_area",
                            name: `Площадь: ${formatRoomArea(room.areaSqm)} м²`,
                            category: "equipment" as const,
                          },
                        ]
                      : []),
                    {
                      key: `${room.id}-rooms-count`,
                      featureId: "room_rooms",
                      name: `Количество комнат: ${room.roomsCount} (${formatRoomsCompactLabel(room.roomsCount)})`,
                      category: "equipment",
                    },
                    ...bedConfigItems,
                    ...room.features.map((feature, index) => ({
                      key: `${room.id}-feature-${index}-${feature.id}`,
                      name: feature.name,
                      featureId: feature.id,
                      category: getRoomAmenityCategory(feature.name),
                    })),
                    ...room.customFeatures.map((name, index) => ({
                      key: `${room.id}-custom-feature-${index}-${name}`,
                      name,
                      category: getRoomAmenityCategory(name),
                    })),
                  ];
                  const visibleRoomAmenities = roomAmenityItems
                    .filter(
                      (amenity) =>
                        !amenity.key.startsWith(`${room.id}-bed-type-`) &&
                        amenity.key !== `${room.id}-beds-base` &&
                        amenity.featureId !== "room_area" &&
                        amenity.featureId !== "room_rooms",
                    )
                    .slice(0, 5);
                  const roomCardAmenities: RoomCardAmenityItem[] = [
                    {
                      key: `${room.id}-summary-capacity`,
                      icon: Users,
                      name: formatRoomCapacityLabel(room.beds, room.extraBeds),
                      category: "beds",
                      isPrimary: true,
                    },
                    {
                      key: `${room.id}-summary-layout`,
                      icon: RulerDimensionLine,
                      name: formatRoomLayoutLabel(room.areaSqm, room.roomsCount),
                      category: "equipment",
                      isPrimary: true,
                    },
                    ...(room.bathroomTypeLabel
                      ? [
                          {
                            key: `${room.id}-summary-bathroom`,
                            icon: Toilet,
                            name: room.bathroomTypeLabel,
                            category: "bathroom" as const,
                            isPrimary: true,
                          },
                        ]
                      : []),
                    ...visibleRoomAmenities,
                  ];
                  const roomDetailsDialogId = `room-details-${room.id}`;
                  const roomDetailsTitleId = `room-details-title-${room.id}`;
                  const isRoomPhotoGalleryOpen = roomPhotoGallery?.roomId === room.id;
                  const openCurrentRoomGallery = () => {
                    if (roomPhotos.length === 0) return;

                    const activePhotoIndex = activeRoomMedia
                      ? roomPhotos.findIndex((photo) => photo.id === activeRoomMedia.id)
                      : -1;
                    openRoomPhotoGallery(room.id, activePhotoIndex >= 0 ? activePhotoIndex : 0);
                  };
                  return (
                    <Fragment key={room.id}>
                      <article className="room-card group relative overflow-hidden rounded-[20px] border border-olive/10 bg-white p-3 shadow-[0_2px_12px_rgba(58,43,35,0.06)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(58,43,35,0.1)] md:p-4">
                        <div className="relative flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
                          {/* в”Ђв”Ђ IMAGE в”Ђв”Ђ */}
                          <div className="shrink-0 md:w-[200px]">
                            {roomMedia.length > 0 ? (
                              <div className="room-card-media-shell relative h-full overflow-hidden rounded-[14px] bg-[#ebe5d8]">
                                {roomMedia.length > 1 ? (
                                  <span className="absolute left-2 bottom-2 z-10 inline-flex items-center rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                                    {roomIndex + 1} / {roomMedia.length}
                                  </span>
                                ) : null}
                                {activeRoomMedia?.type === "VIDEO" ? (
                                  <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                                    <AppIcon icon={TvMinimalPlay} className="h-3.5 w-3.5" />
                                    Видео
                                  </span>
                                ) : null}
                                {activeRoomMedia ? (
                                  activeRoomMedia.type === "IMAGE" && roomPhotos.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={openCurrentRoomGallery}
                                      aria-label={`Смотреть фото номера ${room.title}`}
                                      className="room-media-stage relative block w-full cursor-zoom-in overflow-hidden bg-[#ebe5d8] text-left"
                                    >
                                      <MediaPreview
                                        media={activeRoomMedia}
                                        alt={room.title}
                                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                      />
                                    </button>
                                  ) : (
                                    <div className="room-media-stage relative overflow-hidden bg-[#ebe5d8]">
                                      <MediaPreview
                                        media={activeRoomMedia}
                                        alt={
                                          activeRoomMedia.type === "VIDEO"
                                            ? `${room.title} — видео`
                                            : room.title
                                        }
                                        className={cn(
                                          "h-full w-full",
                                          activeRoomMedia.type === "VIDEO"
                                            ? "bg-black object-cover"
                                            : "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
                                        )}
                                      />
                                    </div>
                                  )
                                ) : null}
                                {roomMedia.length > 1 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => cycleRoomMedia(room.id, -1, roomMedia.length)}
                                      aria-label="Предыдущий файл номера"
                                      className="absolute left-1.5 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-olive shadow-sm transition hover:bg-white md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
                                    >
                                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cycleRoomMedia(room.id, 1, roomMedia.length)}
                                      aria-label="Следующий файл номера"
                                      className="absolute right-1.5 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-olive shadow-sm transition hover:bg-white md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
                                    >
                                      <ChevronRightIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex h-full items-center justify-center rounded-[14px] border border-dashed border-olive/18 bg-cream/50 p-4 text-sm text-olive/50">
                                Нет фото
                              </div>
                            )}
                          </div>

                          {/* в”Ђв”Ђ DETAILS в”Ђв”Ђ */}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <h3 className="text-base font-bold leading-snug text-olive md:text-[1.1rem]">
                              {roomPhotos.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openRoomPhotoGallery(room.id, 0)}
                                  className="text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
                                >
                                  {room.title}
                                </button>
                              ) : (
                                room.title
                              )}
                            </h3>

                            {/* Amenities as icon+text pairs in a compact grid */}
                            <div
                              className="mt-3 flex flex-wrap gap-1.5"
                              role="list"
                              aria-label="Краткое оснащение номера"
                            >
                              {roomCardAmenities.map((amenity) => (
                                <span
                                  key={amenity.key}
                                  role="listitem"
                                  title={amenity.name}
                                  className={cn(
                                    "inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] leading-snug ring-1",
                                    amenity.isPrimary
                                      ? "bg-primary/7 font-semibold text-olive/80 ring-primary/12"
                                      : "bg-cream/65 text-olive/68 ring-olive/8",
                                  )}
                                >
                                  {amenity.icon ? (
                                    <AppIcon
                                      icon={amenity.icon}
                                      className={cn(
                                        "h-3.5 w-3.5 shrink-0",
                                        amenity.isPrimary ? "text-primary/75" : "text-olive/40",
                                      )}
                                    />
                                  ) : (
                                    <RoomFeatureIcon
                                      name={amenity.name}
                                      featureId={amenity.featureId}
                                      className="h-3.5 w-3.5 shrink-0 text-olive/40"
                                    />
                                  )}
                                  <span className="min-w-0 truncate">{amenity.name}</span>
                                </span>
                              ))}
                            </div>
                            {/* "Подробное описание" link */}
                            <button
                              type="button"
                              onClick={() =>
                                setActiveRoomDetailsId((prev) =>
                                  prev === room.id ? null : room.id,
                                )
                              }
                              aria-expanded={isDetailsOpen}
                              aria-controls={roomDetailsDialogId}
                              aria-haspopup="dialog"
                              className="mt-auto pt-2.5 text-left text-[13px] font-semibold text-primary hover:text-primary-hover transition-colors"
                            >
                              Подробное описание
                            </button>
                          </div>

                          {/* в”Ђв”Ђ PRICE + CTA в”Ђв”Ђ */}
                          <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-olive/8 pt-3 md:w-[168px] md:flex-col md:items-end md:justify-start md:border-l md:border-t-0 md:pl-3 md:pt-0">
                            {summary.tone === "warn" ? (
                              <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[13px] text-amber-700">
                                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <span>{summary.text}</span>
                              </div>
                            ) : (
                              <>
                                <div className="md:text-right">
                                  <p className="text-xl font-bold leading-none text-olive md:text-[1.35rem]">
                                    {summary.bigPrice}
                                  </p>
                                  <p className="mt-1 text-[12px] text-olive/55">
                                    {summary.smallLabel || "за номер в сутки"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    trackListingAction({
                                      ...contactTracking,
                                      actionType: "lead_phrase",
                                    });
                                    setLeadModalRoom(room);
                                    setLeadExtra("");
                                    setLeadCopied(false);
                                  }}
                                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#e8621a] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#d45615] active:scale-[0.97]"
                                >
                                  Забронировать
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                      {/* в”Ђв”Ђ DETAILS MODAL в”Ђв”Ђ */}
                      {isDetailsOpen ? (
                        <>
                          <button
                            type="button"
                            aria-label="Закрыть подробности номера"
                            onClick={() => setActiveRoomDetailsId(null)}
                            className="fixed inset-x-0 -top-8 z-[49] h-[calc(100dvh_+_160px)] min-h-[calc(100svh_+_160px)] bg-black/45 backdrop-blur-[1px]"
                          />
                          {/* Bottom sheet on mobile, centered modal on lg+ */}
                          <div
                            id={roomDetailsDialogId}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={roomDetailsTitleId}
                            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[72vh] flex-col rounded-t-2xl border-t border-olive/12 bg-white shadow-2xl lg:inset-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:max-h-[64vh] lg:w-full lg:max-w-[520px] lg:rounded-2xl lg:border"
                          >
                            {/* Header */}
                            <div className="shrink-0">
                              {/* Drag handle (mobile only) */}
                              <div className="flex justify-center pb-1 pt-2 lg:hidden">
                                <div className="h-1 w-8 rounded-full bg-olive/15" />
                              </div>
                              <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1.5 lg:pt-3.5">
                                <div>
                                  <p
                                    id={roomDetailsTitleId}
                                    className="text-sm font-semibold text-olive"
                                  >
                                    {room.title}
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-olive/70 ring-1 ring-olive/10">
                                      {formatPlacesLabel(room.beds)}
                                      {room.extraBeds > 0 ? ` + ${room.extraBeds} доп.` : ""}
                                    </span>
                                    {room.areaSqm !== null ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-olive/70 ring-1 ring-olive/10">
                                        {formatRoomArea(room.areaSqm)}&nbsp;м²
                                      </span>
                                    ) : null}
                                    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-olive/70 ring-1 ring-olive/10">
                                      {formatRoomsCountLabel(room.roomsCount)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-olive/70 ring-1 ring-olive/10">
                                      {room.bathroomTypeLabel}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveRoomDetailsId(null)}
                                  aria-label="Закрыть"
                                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-olive/18 text-olive/70 transition hover:bg-cream hover:text-olive"
                                >
                                  <CloseIcon className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="h-px bg-olive/8" />
                            </div>

                            {/* Scrollable amenities */}
                            <div className="flex-1 overflow-y-auto">
                              <div className="p-4">
                                {roomAmenityItems.length > 0 ? (
                                  <div className="space-y-4">
                                    {(["beds", "bathroom", "equipment"] as const).map((cat) => {
                                      const catItems = roomAmenityItems.filter(
                                        (a) => a.category === cat,
                                      );
                                      if (catItems.length === 0) return null;
                                      const catLabel =
                                        cat === "beds"
                                          ? "Спальные места"
                                          : cat === "bathroom"
                                            ? formatBathroomSectionLabel(room.bathroomTypeLabel)
                                            : "Оснащение и удобства";
                                      return (
                                        <div key={cat}>
                                          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-olive/40">
                                            {catLabel}
                                          </h4>
                                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                            {catItems.map((amenity) => (
                                              <div
                                                key={amenity.key}
                                                className="flex items-center gap-2.5 rounded-lg bg-cream/70 px-2.5 py-2 ring-1 ring-olive/10"
                                              >
                                                <RoomFeatureIcon
                                                  name={amenity.name}
                                                  featureId={amenity.featureId}
                                                  className="h-4 w-4 shrink-0 text-terra/80"
                                                />
                                                <span className="text-[11px] leading-snug text-olive/80">
                                                  {amenity.name}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-olive/60">
                                    Оснащение номера не указано
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Sticky price footer */}
                            {summary.tone === "ok" && summary.bigPrice ? (
                              <div className="shrink-0 border-t border-olive/8 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="truncate text-xl font-bold leading-none text-olive">
                                        {summary.bigPrice}
                                      </p>
                                      {summary.sideLabel ? (
                                        <p className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-olive/70">
                                          {summary.sideLabel}
                                        </p>
                                      ) : null}
                                    </div>
                                    {summary.smallLabel ? (
                                      <p className="mt-0.5 text-[11px] text-olive/60">
                                        {summary.smallLabel}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                      {isRoomPhotoGalleryOpen ? (
                        <RoomPhotoLightbox
                          room={room}
                          photos={roomPhotos}
                          activeIndex={roomPhotoGallery?.index ?? 0}
                          amenities={roomCardAmenities}
                          onIndexChange={(index) => setRoomPhotoGalleryIndex(room.id, index)}
                          onClose={closeRoomPhotoGallery}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </section>

          <PropertyVideoSection videos={propertyVideos} title={item.name ?? "Объект"} />

          <section
            id="description-panel"
            className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:scroll-mt-[152px] md:p-6"
          >
            <h2 className="text-2xl text-olive md:text-[1.85rem]">Описание</h2>
            <p className="mt-2 text-sm text-olive/66">
              Коротко о проживании, атмосфере и том, что важно знать перед бронированием.
            </p>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-olive/82">
              {description.length > 0 ? shortDescription : "Описание пока не добавлено владельцем."}
            </p>
            {description.length > 420 ? (
              <button
                type="button"
                onClick={() => setShowFullDescription((prev) => !prev)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-olive/16 px-4 py-2 text-sm font-semibold text-olive/74 transition hover:bg-cream hover:text-olive"
              >
                {showFullDescription ? (
                  <>
                    <ChevronUpIcon className="h-4 w-4" />
                    Свернуть
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-4 w-4" />
                    Читать полностью
                  </>
                )}
              </button>
            ) : null}
          </section>

          {hasMapSection ? (
            <section id="map-panel" className="scroll-mt-[132px] md:scroll-mt-[152px]">
              <StaticMapPreview
                latitude={item.latitude!}
                longitude={item.longitude!}
                label={mapOverlayAddress}
              />
            </section>
          ) : null}

          {allAmenities.length > 0 ? (
            <section
              id="amenities"
              className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:scroll-mt-[152px] md:p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2.5 text-2xl text-olive">
                  <span className="h-6 w-1 shrink-0 rounded-full bg-terra" aria-hidden="true" />
                  Что есть в объекте
                </h2>
                {allAmenities.length > 10 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllAmenities((prev) => !prev)}
                    className="text-sm font-semibold text-terra hover:underline"
                  >
                    {showAllAmenities ? "Скрыть" : "Показать все"}
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {visibleAmenities.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm text-olive/75"
                  >
                    <NameBasedAmenityIcon name={name} className="h-3.5 w-3.5 text-terra/70" />
                    {name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {/* House rules (moved from sidebar) */}
          <section
            id="house-rules"
            className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:scroll-mt-[152px] md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl text-olive md:text-[1.75rem]">Правила проживания</h2>
                <p className="mt-2 text-sm text-olive/66">
                  Базовые условия заселения, проживания и дополнительных услуг.
                </p>
              </div>
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-primary ring-1 ring-olive/10 sm:inline-flex">
                <CheckBadgeIcon className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {ruleChips.map((chip) => (
                <span
                  key={chip.key}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-2xl border px-3.5 py-2 text-sm text-olive/72 sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-2",
                    chip.className,
                  )}
                >
                  <span className="shrink-0 text-olive/55">{chip.label}</span>
                  <span
                    className={cn(
                      "max-w-full whitespace-normal break-words font-semibold leading-snug sm:max-w-none",
                      chip.valueClassName,
                    )}
                  >
                    {chip.value}
                  </span>
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* в”Ђв”Ђ Right sticky info panel (desktop only) в”Ђв”Ђ */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start lg:mt-14">
          <div className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.06)]">
            <div className="flex items-center gap-3">
              <AvatarImage
                src={item.owner.avatarUrl}
                alt={ownerDisplayName}
                className="h-[52px] w-[52px] shrink-0 rounded-full object-cover ring-1 ring-olive/10"
              >
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-cream text-olive/55 ring-1 ring-olive/10">
                  <AppIcon icon={User} className="h-5 w-5" />
                </span>
              </AvatarImage>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-olive">{ownerDisplayName}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-primary/85">
                  <AppIcon icon={BadgeCheck} className="h-3.5 w-3.5" />
                  <span>{ownerVerificationLabel}</span>
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3" data-property-contacts-panel>
              <PropertyContactsPanel
                phone={item.contacts.phone}
                phoneLabel={mobilePhoneLabel}
                phoneName={item.contacts.phoneName}
                extraPhones={extraContactPhones}
                websiteUrl={item.contacts.websiteUrl}
                whatsappUrl={item.contacts.whatsappUrl}
                telegramUrl={item.contacts.telegramUrl}
                vkUrl={item.contacts.vkUrl}
                maxUrl={item.contacts.maxUrl}
                okUrl={item.contacts.okUrl}
                secondaryContactsCompact
                tracking={contactTracking}
              />
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-olive/15 bg-white/97 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shadow-[0_-4px_24px_rgba(15,118,110,0.12)] backdrop-blur-sm lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <AvatarImage
                src={item.owner.avatarUrl}
                alt={ownerDisplayName}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-olive/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-olive/55 ring-1 ring-olive/10">
                  <AppIcon icon={User} className="h-4.5 w-4.5" />
                </span>
              </AvatarImage>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-olive">{ownerDisplayName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-primary/85">
                  <AppIcon icon={BadgeCheck} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{ownerVerificationLabel}</span>
                </p>
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
                    onClick={() => {
                      const actionType = getContactActionTypeFromChannel(channel.key);
                      if (actionType) {
                        trackListingAction({ ...contactTracking, actionType });
                      }
                    }}
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
            {hasMultipleMobileCallPhones ? (
              <button
                type="button"
                onClick={() => setIsMobileCallSheetOpen(true)}
                className="btn-primary inline-flex h-11 min-w-[112px] items-center justify-center gap-2 rounded-2xl px-3.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,118,110,0.24)] sm:h-12 sm:min-w-[122px] sm:px-4"
              >
                <AppIcon icon={Phone} className="h-4 w-4" />
                Позвонить
              </button>
            ) : primaryMobileCallPhone ? (
              <a
                href={primaryMobileCallPhone.href}
                onClick={() =>
                  trackListingAction({
                    ...contactTracking,
                    actionType: getPhoneListingActionType(0),
                  })
                }
                className="btn-primary inline-flex h-11 min-w-[112px] items-center justify-center gap-2 rounded-2xl px-3.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,118,110,0.24)] sm:h-12 sm:min-w-[122px] sm:px-4"
              >
                <AppIcon icon={Phone} className="h-4 w-4" />
                Позвонить
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {isMobileCallSheetOpen ? (
        <>
          <button
            type="button"
            aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0432\u044B\u0431\u043E\u0440 \u043D\u043E\u043C\u0435\u0440\u0430"
            onClick={() => setIsMobileCallSheetOpen(false)}
            className="fixed inset-x-0 -top-8 z-50 h-[calc(100dvh_+_160px)] min-h-[calc(100svh_+_160px)] bg-[linear-gradient(180deg,rgba(58,43,35,0.92)_0%,rgba(43,31,25,0.96)_100%)] backdrop-blur-[2px] lg:hidden"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-call-sheet-title"
            className="fixed inset-x-3 bottom-3 z-[51] flex flex-col rounded-2xl bg-white shadow-2xl lg:hidden"
          >
            <div className="flex justify-center pb-1 pt-2">
              <div className="h-1 w-8 rounded-full bg-olive/15" />
            </div>
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1">
              <div>
                <h3 id="mobile-call-sheet-title" className="text-base font-semibold text-olive">
                  {
                    "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u043E\u043C\u0435\u0440"
                  }
                </h3>
                <p className="mt-1 text-sm text-olive/60">
                  {
                    "\u0415\u0441\u043B\u0438 \u0443 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0435\u0441\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u043E\u0432, \u043C\u043E\u0436\u043D\u043E \u0441\u0440\u0430\u0437\u0443 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043D\u0443\u0436\u043D\u044B\u0439."
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCallSheetOpen(false)}
                aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="border-t border-olive/10 px-4 py-4">
              <div className="space-y-2">
                {mobileCallPhones.map((phone, index) => (
                  <a
                    key={phone.key}
                    href={phone.href}
                    onClick={() => {
                      trackListingAction({
                        ...contactTracking,
                        actionType: getPhoneListingActionType(index),
                      });
                      setIsMobileCallSheetOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-[18px] border border-olive/10 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(58,43,35,0.05)] transition-colors hover:border-primary/20 hover:bg-primary/[0.04]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(145deg,rgba(15,118,110,0.98),rgba(14,116,144,0.92))] text-white shadow-[0_12px_24px_rgba(15,118,110,0.22)]">
                      <AppIcon icon={Phone} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-olive">
                        {phone.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-olive/55">
                        {phone.name ||
                          (index === 0
                            ? "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u043D\u043E\u043C\u0435\u0440"
                            : `\u0414\u043E\u043F. \u043D\u043E\u043C\u0435\u0440 ${index}`)}
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-olive/35" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* в”Ђв”Ђ LEAD MESSAGE MODAL в”Ђв”Ђ */}
      {leadModalRoom
        ? (() => {
            const leadSummary = getRoomPriceSummary(leadModalRoom, checkIn, checkOut, totalGuests);
            const fullMessage = buildPropertyLeadMessage({
              authorGender,
              propertyName: item.name ?? "Объект",
              roomTitle: leadModalRoom.title,
              checkIn,
              checkOut,
              nightsLabel: checkIn && checkOut ? formatNightsLabel(selectedNights) : null,
              totalGuests,
              adults,
              childrenCount: childrenAges.length,
              priceLabel:
                leadSummary.tone === "ok" && leadSummary.bigPrice
                  ? `${leadSummary.bigPrice}${leadSummary.smallLabel ? ` (${leadSummary.smallLabel})` : ""}`
                  : null,
              extra: leadExtra,
            });

            const handleCopy = async () => {
              try {
                await navigator.clipboard.writeText(fullMessage);
                setLeadCopied(true);
                setTimeout(() => setLeadCopied(false), 2500);
                setLeadModalRoom(null);
              } catch {
                // fallback
                const ta = document.createElement("textarea");
                ta.value = fullMessage;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                setLeadCopied(true);
                setTimeout(() => setLeadCopied(false), 2500);
                setLeadModalRoom(null);
              }
            };

            return (
              <>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => setLeadModalRoom(null)}
                  className="fixed inset-x-0 -top-8 z-50 h-[calc(100dvh_+_160px)] min-h-[calc(100svh_+_160px)] bg-[linear-gradient(180deg,rgba(58,43,35,0.92)_0%,rgba(43,31,25,0.96)_100%)] backdrop-blur-[2px]"
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-[480px] sm:rounded-2xl"
                >
                  {/* Header */}
                  <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
                    <h3 className="text-[15px] font-semibold text-olive">Сообщение владельцу</h3>
                    <button
                      type="button"
                      onClick={() => setLeadModalRoom(null)}
                      aria-label="Закрыть"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <p className="text-[13px] leading-relaxed text-olive/70">
                      Скопируйте готовое сообщение нажатием кнопки ниже и отправьте его владельцу
                      объекта в любой удобный мессенджер.
                    </p>

                    <LeadMessageAuthorToggle
                      value={authorGender}
                      onChange={(value) => {
                        setAuthorGender(value);
                        setLeadCopied(false);
                      }}
                      className="mt-3"
                    />

                    {/* Message preview */}
                    <div className="mt-3 rounded-xl border border-olive/12 bg-cream/50 p-3.5">
                      <pre className="whitespace-pre-wrap break-words font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-olive/85">
                        {fullMessage}
                      </pre>
                    </div>

                    {/* Extra info textarea */}
                    <div className="mt-3">
                      <label
                        htmlFor="lead-extra-info"
                        className="block text-[12px] font-medium text-olive/60"
                      >
                        Дополнительная информация (необязательно)
                      </label>
                      <textarea
                        id="lead-extra-info"
                        value={leadExtra}
                        onChange={(e) => {
                          setLeadExtra(e.target.value);
                          setLeadCopied(false);
                        }}
                        placeholder="Например: нужна детская кроватка, приедем поздно вечером..."
                        rows={2}
                        className="mt-1.5 w-full resize-none rounded-xl border border-olive/16 bg-white px-3.5 py-2.5 text-[13px] text-olive placeholder:text-olive/35 outline-none transition focus:border-olive/30 focus:ring-2 focus:ring-sage/25"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 border-t border-olive/10 px-5 py-3.5">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold shadow-sm transition active:scale-[0.97]",
                        leadCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-[#e8621a] text-white hover:bg-[#d45615]",
                      )}
                    >
                      {leadCopied ? (
                        <>
                          <Check className="h-4.5 w-4.5" />
                          Скопировано!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4.5 w-4.5" />
                          Скопировать сообщение
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            );
          })()
        : null}

      {isMobileBookingOpen ? (
        <div className="fixed inset-0 z-50 bg-midnight/55 p-4 lg:hidden">
          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg text-olive">Параметры бронирования</h3>
              <button
                type="button"
                onClick={() => setIsMobileBookingOpen(false)}
                aria-label="Закрыть"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-olive/20 text-olive transition hover:bg-cream"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <HousingSearchDateRangeField
                  initialCheckIn={checkIn ?? ""}
                  initialCheckOut={checkOut ?? ""}
                  onRangeChange={handleStayRangeChange}
                  autoSubmitOnComplete={false}
                  showHiddenInputs={false}
                  buttonClassName="h-[62px] w-full rounded-2xl border border-olive/16 bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
                />
              </div>
              <div className="col-span-2">
                <GuestsPlacementField
                  adults={adults}
                  childrenAges={childrenAges}
                  onAdultsChange={setAdults}
                  onChildrenAgesChange={setChildrenAges}
                />
              </div>
            </div>
            {sidebarQuote ? (
              <div className="mt-3 rounded-xl bg-cream/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-olive/58">Лучший вариант</p>
                <p className="mt-1 text-sm font-semibold text-olive">
                  {formatMoney(sidebarQuote.total, sidebarQuote.currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-olive/65">{sidebarQuote.roomTitle}</p>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileBookingOpen(false);
                  scrollToRoomFund();
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-olive/20 bg-white px-3 text-sm font-semibold text-olive transition hover:bg-cream"
              >
                Выбрать номер
              </button>
              <button
                type="button"
                onClick={openContactsSection}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-white hover:bg-primary/90"
              >
                К контактам
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
