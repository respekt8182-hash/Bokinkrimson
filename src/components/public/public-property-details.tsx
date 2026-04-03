"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Mail,
  MapPin,
  Phone,
  RulerDimensionLine,
  Star,
  TriangleAlert,
  User,
  Users,
  X,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { HousingSearchDateRangeField } from "@/components/public/housing-search-date-range-field";
import { ExcursionMapPreview } from "@/components/maps/excursion-map-preview";
import { PropertyMediaGallery } from "@/components/public/property-media-gallery";
import { AmenityIcon, NameBasedAmenityIcon } from "@/components/ui/amenity-icon";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import { cn } from "@/lib/cn";
import { addDays, calculateRoomStayPrice, parseIsoDate, toIsoDate } from "@/lib/pricing";
import {
  parseMealOptionsValue,
  parseParkingInfoValue,
  parsePrepaymentPolicyValue,
} from "@/lib/property-rules";
import type { PublicCatalogItem, PublicPropertyCard } from "@/lib/public-properties";
import { bedTypeOptions } from "@/lib/room-catalog";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

type PublicPropertyDetailsProps = {
  item: PublicPropertyCard;
  similarItems?: PublicCatalogItem[];
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

type RulePolicyValue = "FORBIDDEN" | "ON_REQUEST" | "ALLOWED" | null;

type HouseRuleChipConfig = {
  key: string;
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
};

type ContactChannelLink = {
  key: string;
  href: string;
  label: string;
  brand: "whatsapp" | "telegram" | "vk" | "max" | "ok";
};

type RoomMedia = PublicPropertyCard["rooms"][number]["media"][number];



function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number, currency: string): string {
  const amount = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
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

function formatReviewsCountLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${count} отзывов`;
  if (last === 1) return `${count} отзыв`;
  if (last >= 2 && last <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
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

function PhoneIcon({ className }: { className?: string }) {
  return <AppIcon icon={Phone} className={className} />;
}

function MailIcon({ className }: { className?: string }) {
  return <AppIcon icon={Mail} className={className} />;
}

function AlertIcon({ className }: { className?: string }) {
  return <AppIcon icon={TriangleAlert} className={className} />;
}

function BedIcon({ className }: { className?: string }) {
  return <AppIcon icon={BedDouble} className={className} />;
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

function RoomFeatureIcon(props: {
  name: string;
  featureId?: string;
  className?: string;
}) {
  const { featureId, className } = props;
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

function MediaPreview({
  media,
  alt,
  className,
  loading = "lazy",
}: MediaPreviewProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt={alt} loading={loading} decoding="async" className={className} />
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

function getRoomBasePrice(room: PublicPropertyCard["rooms"][number]): {
  value: number | null;
  currency: string | null;
} {
  let value: number | null = null;
  let currency: string | null = null;
  for (const item of room.prices) {
    if (value === null || item.price < value) {
      value = item.price;
      currency = item.currency;
    }
  }
  return { value, currency };
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
      return {
        text: `от ${price} за ночь`,
        tone: "ok",
        bigPrice: `от ${price}`,
        sideLabel: null,
        smallLabel: "/ ночь",
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
      minGuests: price.minGuests,
      currency: price.currency,
    })),
    checkIn,
    checkOut,
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

  const perNight = formatMoney(
    Math.round(calculation.total / calculation.nights),
    calculation.currency,
  );
  const nightsLabel = formatNightsLabel(calculation.nights);
  const sideLabel = `за ${nightsLabel}`;
  return {
    text: `${formatMoney(calculation.total, calculation.currency)} ${sideLabel}`,
    meta: `${perNight} / ночь`,
    tone: "ok",
    bigPrice: formatMoney(calculation.total, calculation.currency),
    sideLabel,
    smallLabel: `${perNight} / ночь`,
  };
}

const minAdultsCount = 1;
const maxAdultsCount = 12;
const maxChildrenCount = 8;
const maxGuestsCount = maxAdultsCount + maxChildrenCount;

function clampAdultsCount(value: number): number {
  if (!Number.isFinite(value)) {
    return minAdultsCount;
  }

  return Math.max(minAdultsCount, Math.min(maxAdultsCount, Math.round(value)));
}

function clampChildrenCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(maxChildrenCount, Math.round(value)));
}

function pluralize(value: number, variants: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs > 10 && abs < 20) {
    return variants[2];
  }
  if (mod > 1 && mod < 5) {
    return variants[1];
  }
  if (mod === 1) {
    return variants[0];
  }

  return variants[2];
}

function formatChildAgeOption(age: number): string {
  if (age === 0) {
    return "до 1 года";
  }

  return `${age} ${pluralize(age, ["год", "года", "лет"])}`;
}

function getGuestsFieldValue(adults: number, childrenCount: number): string {
  const total = adults + childrenCount;
  return `${total} ${pluralize(total, ["гость", "гостя", "гостей"])}`;
}

function resolveInitialGuestState(input: {
  initialGuestsCount?: number | null;
  initialAdultsCount?: number | null;
  initialChildrenCount?: number | null;
}): { adults: number; childrenAges: number[] } {
  const guestsCount =
    typeof input.initialGuestsCount === "number" && Number.isFinite(input.initialGuestsCount)
      ? Math.max(0, Math.round(input.initialGuestsCount))
      : null;
  let adults =
    typeof input.initialAdultsCount === "number" && Number.isFinite(input.initialAdultsCount)
      ? input.initialAdultsCount
      : null;
  let children =
    typeof input.initialChildrenCount === "number" && Number.isFinite(input.initialChildrenCount)
      ? input.initialChildrenCount
      : null;

  if (adults === null && guestsCount !== null) {
    adults = children !== null ? guestsCount - children : guestsCount;
  }
  if (adults === null) {
    adults = 2;
  }
  adults = clampAdultsCount(adults);

  if (children === null && guestsCount !== null) {
    children = guestsCount - adults;
  }
  if (children === null) {
    children = 0;
  }
  children = clampChildrenCount(children);

  const allowedChildren = Math.min(maxChildrenCount, Math.max(0, maxGuestsCount - adults));
  const normalizedChildren = Math.min(children, allowedChildren);

  return {
    adults,
    childrenAges: Array.from({ length: normalizedChildren }, () => 0),
  };
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
  const [isOpen, setIsOpen] = useState(false);
  const [newChildAge, setNewChildAge] = useState("");
  const [isChildAgeSelectExpanded, setIsChildAgeSelectExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const totalGuests = adults + childrenAges.length;
  const guestsFieldValue = useMemo(
    () => getGuestsFieldValue(adults, childrenAges.length),
    [adults, childrenAges.length],
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setIsChildAgeSelectExpanded(false);
  }, []);

  const updateAdults = useCallback(
    (value: number) => {
      const nextAdults = clampAdultsCount(value);
      const allowedChildren = Math.min(maxChildrenCount, Math.max(0, maxGuestsCount - nextAdults));
      onAdultsChange(nextAdults);
      if (childrenAges.length > allowedChildren) {
        onChildrenAgesChange(childrenAges.slice(0, allowedChildren));
      }
    },
    [childrenAges, onAdultsChange, onChildrenAgesChange],
  );

  const addChild = useCallback(() => {
    const age = Number.parseInt(newChildAge, 10);
    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }
    if (childrenAges.length >= maxChildrenCount || totalGuests >= maxGuestsCount) {
      return;
    }

    onChildrenAgesChange([...childrenAges, age]);
    setNewChildAge("");
    setIsChildAgeSelectExpanded(false);
  }, [childrenAges, newChildAge, onChildrenAgesChange, totalGuests]);

  const updateChildAge = useCallback(
    (index: number, value: string) => {
      const age = Number.parseInt(value, 10);
      if (!Number.isFinite(age) || age < 0 || age > 17) {
        return;
      }

      onChildrenAgesChange(
        childrenAges.map((item, itemIndex) => (itemIndex === index ? age : item)),
      );
    },
    [childrenAges, onChildrenAgesChange],
  );

  const removeChild = useCallback(
    (index: number) => {
      onChildrenAgesChange(childrenAges.filter((_, itemIndex) => itemIndex !== index));
    },
    [childrenAges, onChildrenAgesChange],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      closePanel();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closePanel();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, isOpen]);

  return (
    <div ref={rootRef} className={cn("relative", isOpen ? "z-[1200]" : "")}>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closePanel();
            return;
          }
          setIsOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="relative h-[62px] w-full rounded-2xl border border-sand bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
      >
        <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-olive/60">
          Р азмещение
        </span>
        <span className="block truncate pr-12 text-sm font-semibold">{guestsFieldValue}</span>
        <FieldAdornmentIcon icon={Users} shellClassName="right-3.5" />
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[1190] bg-primary/30"
            onClick={closePanel}
            aria-label="Закрыть выбор гостей"
          />

          <div className="fixed left-1/2 top-1/2 z-[1200] max-h-[calc(100vh-32px)] w-[min(92vw,412px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-sand bg-white p-4 shadow-[0_18px_38px_-20px_rgba(15,118,110,0.58)]">
            <h3 className="text-lg font-semibold text-olive">Гости</h3>

            <div className="mt-3 space-y-3">
              <section className="rounded-xl border border-sand bg-cream p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Взрослые</p>
                    <p className="text-xs text-olive">от 18 лет</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateAdults(adults - 1)}
                      disabled={adults <= minAdultsCount}
                      aria-label="Уменьшить количество взрослых"
                      className="h-8 w-8 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-olive">
                      {adults}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateAdults(adults + 1)}
                      disabled={totalGuests >= maxGuestsCount}
                      aria-label="Увеличить количество взрослых"
                      className="h-8 w-8 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-sand bg-cream p-3">
                <p className="text-sm font-semibold text-olive">Дети</p>
                <p className="mt-0.5 text-xs text-olive">Возраст на момент выезда из отеля</p>

                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isChildAgeSelectExpanded}
                      onClick={() => setIsChildAgeSelectExpanded((prev) => !prev)}
                      className="flex h-10 w-full items-center justify-between rounded-xl border border-sand bg-white px-3 text-sm text-olive transition hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <span className="truncate">
                        {newChildAge
                          ? formatChildAgeOption(Number.parseInt(newChildAge, 10))
                          : "Выберите возраст"}
                      </span>
                      <ChevronDownIcon
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          isChildAgeSelectExpanded ? "rotate-180" : "",
                        )}
                      />
                    </button>
                    <div
                      role="listbox"
                      className={cn(
                        "animated-popover custom-scrollbar absolute left-0 top-[calc(100%+4px)] z-40 h-[160px] w-full overflow-y-auto rounded-xl border border-sand bg-white p-1.5 shadow-lg transition-all duration-300 ease-out",
                        isChildAgeSelectExpanded
                          ? "visible translate-y-0 opacity-100 pointer-events-auto"
                          : "invisible -translate-y-[10px] opacity-0 pointer-events-none",
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        {Array.from({ length: 18 }, (_, age) => (
                          <button
                            key={`room-child-age-${age}`}
                            type="button"
                            role="option"
                            aria-selected={newChildAge === String(age)}
                            onClick={() => {
                              setNewChildAge(String(age));
                              setIsChildAgeSelectExpanded(false);
                            }}
                            className="cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-olive transition active:bg-sand/30 hover:bg-cream"
                          >
                            {formatChildAgeOption(age)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addChild}
                    disabled={
                      !newChildAge ||
                      totalGuests >= maxGuestsCount ||
                      childrenAges.length >= maxChildrenCount
                    }
                    className="h-10 rounded-xl border border-sand bg-white px-3 text-sm font-semibold text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Добавить
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {childrenAges.length === 0 ? (
                    <p className="text-xs text-olive">Дети не добавлены</p>
                  ) : (
                    childrenAges.map((age, index) => (
                      <div
                        key={`room-child-${index}-${age}`}
                        className="grid grid-cols-[1fr_minmax(0,120px)_auto] items-center gap-2 rounded-lg bg-white px-2 py-1.5"
                      >
                        <span className="text-xs font-medium text-olive">Р ебенок {index + 1}</span>

                        <select
                          value={String(age)}
                          onChange={(event) => updateChildAge(index, event.target.value)}
                          className="h-8 rounded-lg border border-sand bg-white px-2 text-xs text-olive outline-none focus:border-primary"
                        >
                          {Array.from({ length: 18 }, (_, ageOption) => (
                            <option
                              key={`room-child-age-option-${index}-${ageOption}`}
                              value={String(ageOption)}
                            >
                              {formatChildAgeOption(ageOption)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeChild(index)}
                          aria-label={`Удалить ребенка ${index + 1}`}
                          className="h-8 rounded-lg border border-terra bg-white px-2 text-xs font-semibold text-terra transition hover:bg-foam"
                        >
                          Удалить
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <button
              type="button"
              onClick={() => {
                closePanel();
                onDone?.();
              }}
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Готово
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PublicPropertyDetails({
  item,
  similarItems = [],
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
  const [activeRoomDetailsId, setActiveRoomDetailsId] = useState<string | null>(null);
  const [isMobileBookingOpen, setIsMobileBookingOpen] = useState(false);
  const [isPhoneExpanded, setIsPhoneExpanded] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [leadModalRoom, setLeadModalRoom] = useState<PublicPropertyCard["rooms"][number] | null>(null);
  const [leadExtra, setLeadExtra] = useState("");
  const [leadCopied, setLeadCopied] = useState(false);
  const propertyMedia = useMemo(
    () => item.media.filter((media) => media.type === "IMAGE").slice(0, 10),
    [item.media],
  );
  const totalGuests = adults + childrenAges.length;
  const selectedNights = checkIn && checkOut ? getNights(checkIn, checkOut) : 0;
  const allAmenities =
    item.amenityGroups.combined.length > 0
      ? item.amenityGroups.combined
      : [...item.amenities.map((amenity) => amenity.name), ...item.customAmenities];
  const visibleAmenities = showAllAmenities ? allAmenities : allAmenities.slice(0, 10);
  const similarCards = similarItems.filter((card) => card.id !== item.id).slice(0, 6);
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
  const mobilePhoneHref = normalizePhoneHref(item.contacts.phone);
  const mobilePhoneLabel = formatPhoneLabel(item.contacts.phone);
  const phone2Href = normalizePhoneHref(item.contacts.phone2);
  const phone2Label = formatPhoneLabel(item.contacts.phone2);
  const phone3Href = normalizePhoneHref(item.contacts.phone3);
  const phone3Label = formatPhoneLabel(item.contacts.phone3);
  const phoneEntries = [
    mobilePhoneHref && mobilePhoneLabel
      ? { href: mobilePhoneHref, label: mobilePhoneLabel, name: item.contacts.phoneName?.trim() || null }
      : null,
    phone2Href && phone2Label
      ? { href: phone2Href, label: phone2Label, name: item.contacts.phone2Name?.trim() || null }
      : null,
    phone3Href && phone3Label
      ? { href: phone3Href, label: phone3Label, name: item.contacts.phone3Name?.trim() || null }
      : null,
  ].filter((entry): entry is { href: string; label: string; name: string | null } => entry !== null);
  const contactWhatsappUrl = item.contacts.whatsappUrl?.trim()
    ? item.contacts.whatsappUrl.trim()
    : null;
  const contactTelegramUrl = normalizeTelegramProfileUrl(item.contacts.telegramUrl);
  const contactVkUrl = item.contacts.vkUrl?.trim() ? item.contacts.vkUrl.trim() : null;
  const contactMaxUrl = item.contacts.maxUrl?.trim() ? item.contacts.maxUrl.trim() : null;
  const contactOkUrl = item.contacts.okUrl?.trim() ? item.contacts.okUrl.trim() : null;
  const seaDistanceLabel = extractSeaDistanceLabel(allAmenities);
  const mainPriceLabel =
    item.minNightPrice !== null && item.currency
      ? `от ${formatMoney(item.minNightPrice, item.currency)}`
      : "Цена по запросу";
  const locationLabel = item.locationName ?? "Крым";
  const hasReviews = item.reviewsCount > 0;
  const reviewsCountLabel = formatReviewsCountLabel(item.reviewsCount);
  const headerRatingLine = hasReviews ? `${item.avgRating.toFixed(1)} · ${reviewsCountLabel}` : null;
  const heroBadges = [
    item.avgRating >= 4.8 && item.reviewsCount >= 10 ? "Топ выбор гостей" : null,
    item.reviewsCount >= 25 ? "Проверено отзывами" : null,
    hasRegistryNumber ? "Проверено в реестре" : null,
    seaDistanceLabel,
  ].filter((badge): badge is string => Boolean(badge));
  const ownerDisplayName =
    [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ") || "Владелец";
  const ownerEmail = item.contacts.email?.trim() ?? "";
  const hasOwnerEmail = ownerEmail.length > 0;
  const hasAnyOwnerContacts = Boolean(
    mobilePhoneHref || phone2Href || phone3Href || contactWhatsappUrl || contactTelegramUrl || contactVkUrl || contactMaxUrl || contactOkUrl || hasOwnerEmail,
  );
  const ownerVerificationLabel = "Владелец проверен";
  const contactChannelLinks = [
    contactWhatsappUrl
      ? {
          key: "whatsapp",
          href: contactWhatsappUrl,
          label: "WhatsApp",
          brand: "whatsapp",
        }
      : null,
    contactTelegramUrl
      ? {
          key: "telegram",
          href: contactTelegramUrl,
          label: "Telegram",
          brand: "telegram",
        }
      : null,
    contactVkUrl
      ? {
          key: "vk",
          href: contactVkUrl,
          label: "ВКонтакте",
          brand: "vk",
        }
      : null,
    contactOkUrl
      ? {
          key: "ok",
          href: contactOkUrl,
          label: "Одноклассники",
          brand: "ok",
        }
      : null,
    contactMaxUrl
      ? {
          key: "max",
          href: contactMaxUrl,
          label: "Max",
          brand: "max",
        }
      : null,
  ].filter((channel): channel is ContactChannelLink => channel !== null);
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

        if (checkIn && checkOut && selectedNights > 0) {
          const calculation = calculateRoomStayPrice({
            prices: room.prices.map((price) => ({
              dateFrom: price.dateFrom,
              dateTo: price.dateTo,
              price: price.price,
              minGuests: price.minGuests,
              currency: price.currency,
            })),
            checkIn,
            checkOut,
          });
          if (calculation.ok) {
            hasStayPrice = true;
            stayTotal = calculation.total;
            stayCurrency = calculation.currency;
            stayNightly = Math.round(calculation.total / calculation.nights);
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
      roomTitle: bestAutoEntry.room.title,
    } satisfies QuoteResult;
  }, [checkIn, checkOut, rankedRooms, selectedNights]);
  const sortedRooms = rankedRooms;
  const sidebarNightlyLabel = sidebarQuote
    ? `${formatMoney(sidebarQuote.nightly, sidebarQuote.currency)} / ночь`
    : `${mainPriceLabel} / ночь`;
  const sidebarPriceMeta =
    selectedNights > 0
      ? `${formatNightsLabel(selectedNights)}, гостей: ${totalGuests}`
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

  function openContactsSection() {
    const contactsSection = document.getElementById("owner-contacts");
    if (contactsSection) {
      contactsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsMobileBookingOpen(false);
  }

  function scrollToRoomFund() {
    const roomFundSection = document.getElementById("room-fund");
    if (roomFundSection) {
      roomFundSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div ref={detailsRootRef} className="property-details-page space-y-6">
      {/* Hero: gallery + overlaid info */}
      <section className="relative overflow-hidden rounded-3xl">
        {propertyMedia.length > 0 ? (
          <PropertyMediaGallery
            media={propertyMedia}
            title={item.name ?? "Объект"}
            phoneHref={mobilePhoneHref}
          />
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
              <FavoriteToggleButton propertyId={item.id} initialIsFavorite={initialIsFavorite} />
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
        <h1 className="text-2xl font-bold leading-tight text-olive sm:text-3xl">
          {item.name ?? "Объект"}
        </h1>
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
          <FavoriteToggleButton propertyId={item.id} initialIsFavorite={initialIsFavorite} />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,368px)]">
        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* Sticky section navigation */}
          <nav
            className="sticky top-4 z-20 overflow-x-auto rounded-2xl border border-olive/10 bg-white/94 px-2 shadow-[0_10px_26px_rgba(58,43,35,0.06)] backdrop-blur-sm"
            aria-label="Навигация по разделам"
          >
            <div className="flex min-w-max items-center gap-1">
              {[
                { href: "#room-fund", label: "Варианты размещения" },
                { href: "#description-panel", label: "Описание" },
                { href: "#amenities", label: "Удобства" },
                { href: "#house-rules", label: "Правила" },
                ...(hasMapSection ? [{ href: "#map-panel", label: "Расположение" }] : []),
                { href: "#reviews", label: "Отзывы" },
              ].map((link) => (
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
            className="relative overflow-hidden rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:p-6"
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
                                ? `${bc.count} × ${bedLabelById[bc.type] ?? bc.type}`
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
                        amenity.key !== `${room.id}-beds-base`,
                    )
                    .slice(0, 6);
                  const roomDetailsDialogId = `room-details-${room.id}`;
                  const roomDetailsTitleId = `room-details-title-${room.id}`;
                  const roomSummaryLine = [
                    `До ${room.beds + room.extraBeds} гостей`,
                    room.areaSqm !== null ? `${room.areaSqm} м²` : null,
                    room.bathroomTypeLabel,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" · ");
                  return (
                    <Fragment key={room.id}>
                      <article className="room-card group relative overflow-hidden rounded-[20px] border border-olive/10 bg-white p-3 shadow-[0_2px_12px_rgba(58,43,35,0.06)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(58,43,35,0.1)] md:p-4">
                        <div className="relative flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
                          {/* ── IMAGE ── */}
                          <div className="shrink-0 md:w-[200px]">
                            {roomMedia.length > 0 ? (
                              <div className="room-card-media-shell relative h-full overflow-hidden rounded-[14px] bg-[#ebe5d8]">
                                {roomMedia.length > 1 ? (
                                  <span className="absolute left-2 bottom-2 z-10 inline-flex items-center rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                                    {roomIndex + 1} / {roomMedia.length}
                                  </span>
                                ) : null}
                                <div className="room-media-stage relative overflow-hidden bg-[#ebe5d8]">
                                  {activeRoomMedia ? (
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
                                  ) : null}
                                </div>
                                {roomMedia.length > 1 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        cycleRoomMedia(room.id, -1, roomMedia.length)
                                      }
                                      aria-label="Предыдущий файл номера"
                                      className="absolute left-1.5 top-1/2 z-10 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-olive shadow-sm transition hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                                    >
                                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cycleRoomMedia(room.id, 1, roomMedia.length)}
                                      aria-label="Следующий файл номера"
                                      className="absolute right-1.5 top-1/2 z-10 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-olive shadow-sm transition hover:bg-white md:opacity-0 md:group-hover:opacity-100"
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

                          {/* ── DETAILS ── */}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <h3 className="text-base font-bold leading-snug text-olive md:text-[1.1rem]">
                              {room.title}
                            </h3>

                            {/* Key specs as icon+text rows */}
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2 text-[13px] text-olive/75">
                                <BedIcon className="h-4 w-4 shrink-0 text-olive/45" />
                                <span>
                                  {room.beds}
                                  {room.extraBeds > 0 ? ` места + ${room.extraBeds} доп.` : " мест"}
                                </span>
                              </div>
                              {room.roomsCount > 0 ? (
                                <div className="flex items-center gap-2 text-[13px] text-olive/75">
                                  <AppIcon icon={Bath} className="h-4 w-4 shrink-0 text-olive/45" />
                                  <span>
                                    {String(room.roomsCount).padStart(2, "0")} комнат{room.roomsCount === 1 ? "а" : room.roomsCount >= 2 && room.roomsCount <= 4 ? "ы" : ""}
                                  </span>
                                </div>
                              ) : null}
                              {room.bathroomTypeLabel ? (
                                <div className="flex items-center gap-2 text-[13px] text-olive/75">
                                  <AppIcon icon={Bath} className="h-4 w-4 shrink-0 text-olive/45" />
                                  <span>{room.bathroomTypeLabel}</span>
                                </div>
                              ) : null}
                            </div>

                            {/* Amenities as icon+text pairs in a compact grid */}
                            {visibleRoomAmenities.length > 0 ? (
                              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                                {visibleRoomAmenities.map((amenity) => (
                                  <span
                                    key={amenity.key}
                                    className="inline-flex items-center gap-1.5 text-[12.5px] text-olive/65"
                                  >
                                    <RoomFeatureIcon
                                      name={amenity.name}
                                      featureId={amenity.featureId}
                                      className="h-3.5 w-3.5 shrink-0 text-olive/40"
                                    />
                                    {amenity.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}

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

                          {/* ── PRICE + CTA ── */}
                          <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-olive/8 pt-3 md:w-[180px] md:flex-col md:items-end md:justify-start md:border-l md:border-t-0 md:pl-4 md:pt-0">
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
                                    setLeadModalRoom(room);
                                    setLeadExtra("");
                                    setLeadCopied(false);
                                  }}
                                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#e8621a] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#d45615] active:scale-[0.97]"
                                >
                                  Отправить заявку
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                      {/* ── DETAILS MODAL ── */}
                      {isDetailsOpen ? (
                        <>
                          <button
                            type="button"
                            aria-label="Закрыть подробности номера"
                            onClick={() => setActiveRoomDetailsId(null)}
                            className="fixed inset-0 z-40 rounded-3xl bg-black/35 backdrop-blur-[1px]"
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
                                      {room.beds}
                                      {room.extraBeds > 0 ? ` + ${room.extraBeds} доп.` : ""}
                                      &nbsp;мест
                                    </span>
                                    {room.areaSqm !== null ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-olive/70 ring-1 ring-olive/10">
                                        {room.areaSqm}&nbsp;м²
                                      </span>
                                    ) : null}
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
                                            ? "Ванная комната"
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
                    </Fragment>
                  );
                })}
              </div>
            )}
          </section>

          <section
            id="description-panel"
            className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:p-6"
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
            <section id="map-panel">
              <article className="overflow-hidden rounded-[28px] border border-olive/10 bg-white shadow-[0_14px_36px_rgba(58,43,35,0.05)]">
                <div className="px-5 pb-4 pt-5 md:px-6">
                  <h3 className="text-2xl text-olive md:text-[1.7rem]">На карте</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-olive/62">
                    <LocationPinIcon className="h-4 w-4 shrink-0 text-terra" />
                    {item.address ?? "Координаты объекта доступны"}
                  </p>
                </div>
                <ExcursionMapPreview
                  latitude={item.latitude!}
                  longitude={item.longitude!}
                  addressLabel={mapOverlayAddress}
                  className="h-64 w-full"
                />
              </article>
            </section>
          ) : null}

          {similarCards.length > 0 ? (
            <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:p-6">
              <h2 className="text-2xl text-olive md:text-[1.75rem]">Похожие предложения рядом</h2>
              <p className="mt-2 text-sm text-olive/66">
                Несколько спокойных альтернатив в той же локации.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {similarCards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.path}
                    className="overflow-hidden rounded-[22px] border border-olive/12 bg-[#fcfbf7] transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {card.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.coverImageUrl}
                        alt={card.name}
                        loading="lazy"
                        decoding="async"
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center text-xs text-olive/55">
                        Без фото
                      </div>
                    )}
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-olive">{card.name}</p>
                      <p className="text-xs text-olive/70">{card.locationName ?? "Крым"}</p>
                      <p className="text-xs text-olive/70">
                        {card.minNightPrice !== null && card.currency
                          ? `от ${formatMoney(card.minNightPrice, card.currency)}`
                          : "Цена по запросу"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Amenities removed */}
          {false ? (
            <section
              id="amenities-remove"
              className="rounded-3xl bg-white p-5 ring-1 ring-olive/10 md:p-6"
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
            className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:p-6"
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
                    "inline-flex max-w-full items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm text-olive/72",
                    chip.className,
                  )}
                >
                  <span className="shrink-0 text-olive/55">{chip.label}</span>
                  <span className={cn("min-w-0 break-words font-semibold", chip.valueClassName)}>
                    {chip.value}
                  </span>
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* ── Right sticky info panel (desktop only) ── */}
        <aside
          id="owner-contacts"
          className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start lg:mt-14"
        >
          <div className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.06)]">
            <div className="flex items-center gap-3">
              {item.owner.avatarUrl ? (
                <Image
                  src={item.owner.avatarUrl}
                  alt={ownerDisplayName}
                  width={52}
                  height={52}
                  className="h-[52px] w-[52px] shrink-0 rounded-full object-cover ring-1 ring-olive/10"
                />
              ) : (
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-cream text-olive/55 ring-1 ring-olive/10">
                  <AppIcon icon={User} className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-olive">{ownerDisplayName}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-primary/85">
                  <AppIcon icon={BadgeCheck} className="h-3.5 w-3.5" />
                  <span>{ownerVerificationLabel}</span>
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {phoneEntries.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/42">
                      Телефон
                    </p>
                    {phoneEntries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setIsPhoneExpanded((value) => !value)}
                        className="text-xs font-semibold text-olive/62 transition hover:text-olive"
                      >
                        {isPhoneExpanded ? "Скрыть" : `Еще ${phoneEntries.length - 1}`}
                      </button>
                    ) : null}
                  </div>

                  <a
                    href={phoneEntries[0]!.href}
                    className="block rounded-[22px] border border-olive/10 bg-white px-4 py-3 transition hover:border-olive/18 hover:shadow-sm"
                  >
                    {phoneEntries[0]!.name ? (
                      <span className="block text-xs text-olive/52">{phoneEntries[0]!.name}</span>
                    ) : null}
                    <span className="mt-1 block text-[1.55rem] font-semibold leading-tight text-olive">
                      {phoneEntries[0]!.label}
                    </span>
                  </a>

                  {isPhoneExpanded && phoneEntries.length > 1 ? (
                    <div className="space-y-2">
                      {phoneEntries.slice(1).map((entry, idx) => (
                        <a
                          key={`${entry.label}-${idx}`}
                          href={entry.href}
                          className="flex items-center justify-between gap-3 rounded-[18px] border border-olive/10 bg-white px-4 py-3 transition hover:border-olive/18 hover:shadow-sm"
                        >
                          <span className="min-w-0">
                            {entry.name ? (
                              <span className="block truncate text-xs text-olive/52">{entry.name}</span>
                            ) : null}
                            <span className="block truncate text-sm font-semibold text-olive">
                              {entry.label}
                            </span>
                          </span>
                          <PhoneIcon className="h-4 w-4 shrink-0 text-terra" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {contactChannelLinks.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {contactChannelLinks.map((channel) => (
                    <a
                      key={channel.key}
                      href={channel.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-2.5 rounded-[18px] border border-olive/10 bg-white px-3 py-2.5 transition hover:border-olive/18 hover:shadow-sm"
                    >
                      <ContactBrandMark brand={channel.brand} className="h-9 w-9 rounded-xl" />
                      <span className="min-w-0 truncate text-sm font-medium text-olive">
                        {channel.label}
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}

              {hasOwnerEmail ? (
                <a
                  href={`mailto:${ownerEmail}`}
                  className="flex items-center gap-3 rounded-[18px] border border-olive/10 bg-white px-3.5 py-3 transition hover:border-olive/18 hover:shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream ring-1 ring-olive/10 text-olive/60">
                    <MailIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-olive">Электронная почта</span>
                    <span className="block truncate text-xs text-olive/52">{ownerEmail}</span>
                  </span>
                </a>
              ) : null}

              {!hasAnyOwnerContacts ? (
                <p className="rounded-[22px] border border-dashed border-olive/18 bg-cream/40 px-4 py-4 text-center text-sm text-olive/70">
                  Контакты владельца пока не добавлены
                </p>
              ) : null}
            </div>
          </div>

        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-olive/15 bg-white/97 px-4 py-3 shadow-[0_-4px_24px_rgba(15,118,110,0.12)] backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-olive/50">
              {sidebarQuote ? "Цена по фильтрам" : "Цена за ночь"}
            </p>
            <p className="truncate text-base font-bold text-olive">{sidebarNightlyLabel}</p>
            <p className="truncate text-[11px] text-olive/65">
              {sidebarPriceRoomHint ?? sidebarPriceMeta}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileBookingOpen(true)}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-olive/22 bg-white px-3 text-sm font-semibold text-olive"
            >
              <CalendarSmIcon className="h-4 w-4 text-terra" />
              Даты
            </button>
            <button
              type="button"
              onClick={scrollToRoomFund}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-olive/22 bg-white px-3 text-sm font-semibold text-olive"
            >
              <BedIcon className="h-4 w-4 text-terra" />
              Номер
            </button>
            {mobilePhoneHref ? (
              <a
                href={mobilePhoneHref}
                className="btn-primary inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white"
              >
                <PhoneIcon className="h-4 w-4" />
                Позвонить
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setIsMobileBookingOpen(true)}
                className="btn-primary inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
              >
                Контакты
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── LEAD MESSAGE MODAL ── */}
      {leadModalRoom ? (() => {
        const fmtDate = (iso: string) => {
          const d = parseIsoDate(iso);
          if (!d) return iso;
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          return `${dd}.${mm}.${yyyy}`;
        };
        const leadSummary = getRoomPriceSummary(leadModalRoom, checkIn, checkOut, totalGuests);
        const lines: string[] = [
          "Добрый день! Нашел ваше объявление на сайте \"Крым Вокруг\".",
          "",
          "Хотел бы уточнить наличие свободных мест:",
        ];
        if (checkIn && checkOut) {
          lines.push(`- Даты: ${fmtDate(checkIn)} - ${fmtDate(checkOut)} (${selectedNights} ${selectedNights === 1 ? "ночь" : selectedNights >= 2 && selectedNights <= 4 ? "ночи" : "ночей"})`);
        }
        lines.push(`- Гостей: ${totalGuests} (взрослых: ${adults}${childrenAges.length > 0 ? `, детей: ${childrenAges.length}` : ""})`);
        lines.push(`- Номер: "${leadModalRoom.title}"`);
        lines.push(`- Объект: "${item.name}"`);
        if (leadSummary.tone === "ok" && leadSummary.bigPrice) {
          lines.push(`- Стоимость: ${leadSummary.bigPrice}${leadSummary.smallLabel ? ` (${leadSummary.smallLabel})` : ""}`);
        }
        lines.push("");
        lines.push("Прошу подтвердить актуальность цены и наличие свободных мест.");
        const extraTrimmed = leadExtra.trim();
        if (extraTrimmed) {
          lines.push("");
          lines.push(`(Дополнительно: ${extraTrimmed})`);
        }
        lines.push("");
        lines.push("Буду благодарен за ответ!");
        const fullMessage = lines.join("\n");

        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(fullMessage);
            setLeadCopied(true);
            setTimeout(() => setLeadCopied(false), 2500);
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
          }
        };

        return (
          <>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={() => setLeadModalRoom(null)}
              className="fixed inset-0 z-50 bg-midnight/55 backdrop-blur-[2px]"
            />
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-[480px] sm:rounded-2xl"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
                <h3 className="text-[15px] font-semibold text-olive">Заявка на бронирование</h3>
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
                  Скопируйте готовое сообщение нажатием кнопки ниже и отправьте его владельцу объекта в любой удобный мессенджер.
                </p>

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
      })() : null}

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
