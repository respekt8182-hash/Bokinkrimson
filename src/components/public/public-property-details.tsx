"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Mail,
  MapPin,
  Phone,
  RulerDimensionLine,
  Star,
  TriangleAlert,
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
import { AmenityIcon } from "@/components/ui/amenity-icon";
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

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().slice(0, 1);
  const fallback = lastName.trim().slice(0, 1);
  return (first || fallback || "?").toUpperCase();
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
            className="fixed inset-0 z-[1190] bg-primary/30 md:hidden"
            onClick={closePanel}
            aria-label="Закрыть выбор гостей"
          />

          <div className="absolute left-0 top-[calc(100%+8px)] z-[1200] w-full rounded-2xl border border-sand bg-white p-4 shadow-[0_18px_38px_-20px_rgba(15,118,110,0.58)] md:right-0 md:left-auto md:w-[412px]">
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
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
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
  const contactWhatsappUrl = item.contacts.whatsappUrl?.trim()
    ? item.contacts.whatsappUrl.trim()
    : null;
  const contactTelegramUrl = normalizeTelegramProfileUrl(item.contacts.telegramUrl);
  const seaDistanceLabel = extractSeaDistanceLabel(allAmenities);
  const mainPriceLabel =
    item.minNightPrice !== null && item.currency
      ? `от ${formatMoney(item.minNightPrice, item.currency)}`
      : "Цена по запросу";
  const locationLabel = item.locationName ?? "Крым";
  const headerRatingLine =
    item.reviewsCount > 0
      ? `${item.avgRating.toFixed(1)} · ${item.reviewsCount} отзывов`
      : "Нет отзывов";
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
    mobilePhoneHref || contactWhatsappUrl || contactTelegramUrl || hasOwnerEmail,
  );
  const ownerVerificationLabel = "Продавец проверен";
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
      {/* ── 2-column layout: gallery+content left, sticky info right ── */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.48fr)_minmax(300px,368px)]">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Gallery */}
          <section>
            {propertyMedia.length > 0 ? (
              <PropertyMediaGallery
                media={propertyMedia}
                title={item.name ?? "Объект"}
                phoneHref={mobilePhoneHref}
              />
            ) : (
              <div className="rounded-3xl bg-cream py-12 text-center text-sm text-olive/60 ring-1 ring-olive/10">
                Фото и видео объекта пока не загружены.
              </div>
            )}
          </section>

          {/* Mobile-only property info (visible below gallery on mobile, hidden on desktop) */}
          <div className="lg:hidden rounded-3xl bg-white p-5 ring-1 ring-olive/10 shadow-[0_4px_24px_rgba(15,118,110,0.07)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/70 ring-1 ring-olive/12">
                {item.typeLabel ?? "Объект размещения"}
              </span>
              {heroBadges.map((badge) => (
                <span
                  key={badge}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    /первая\s+линия|до моря/i.test(badge) ? "bg-terra/14 text-terra" : "bg-sage/25 text-olive",
                  )}
                >
                  {badge}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-2xl leading-tight text-olive">{item.name ?? "Объект"}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-olive/72">
              <SparkStarIcon className="h-4 w-4 text-terra" />
              <span>{headerRatingLine}</span>
              <span className="text-olive/45">•</span>
              <LocationPinIcon className="h-4 w-4 text-terra" />
              <span>{locationLabel}</span>
            </p>
            {item.address ? (
              <a
                href={yandexMapsHref ?? "#"}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1.5 inline-flex items-start gap-1.5 text-sm underline decoration-dotted underline-offset-4 text-olive/75 hover:text-terra"
              >
                <LocationPinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item.address}</span>
              </a>
            ) : null}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black leading-none text-olive">{mainPriceLabel}</p>
                <p className="mt-1 text-sm text-olive/60">за ночь</p>
              </div>
              <FavoriteToggleButton propertyId={item.id} initialIsFavorite={initialIsFavorite} />
            </div>
          </div>

          {/* Sticky section navigation */}
          <nav
            className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-olive/8 bg-white/97 shadow-sm backdrop-blur-sm"
            aria-label="Навигация по разделам"
          >
            <div className="flex min-w-max items-center gap-0 px-4">
              {[
                { href: "#room-fund", label: "Номера и цены" },
                { href: "#description-panel", label: "Описание" },
                { href: "#amenities", label: "Удобства" },
                { href: "#house-rules", label: "Правила" },
                ...(hasMapSection ? [{ href: "#map-panel", label: "Расположение" }] : []),
                { href: "#reviews", label: "Отзывы" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap rounded-lg px-3 py-3 text-sm font-medium text-olive/60 transition hover:bg-cream hover:text-olive"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>

          <section
            id="room-fund"
            className="relative overflow-hidden rounded-[32px] border border-white/75 bg-white/90 p-4 shadow-[0_20px_55px_rgba(17,29,16,0.045)] ring-1 ring-olive/8 backdrop-blur-sm md:p-6"
          >
            <div
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,118,110,0.2),transparent)]"
              aria-hidden="true"
            />
            <div className="relative">
              <div>
                <h2 className="flex items-center gap-2.5 text-2xl text-olive">
                  <span className="h-6 w-1 shrink-0 rounded-full bg-terra" aria-hidden="true" />
                  Номерной фонд
                </h2>
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
                    .slice(0, 3);
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
                      <article className="room-card group relative overflow-hidden rounded-[28px] border border-olive/10 bg-white p-3 shadow-[0_14px_34px_rgba(17,29,16,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/18 hover:shadow-[0_22px_44px_rgba(17,29,16,0.08)] md:p-3.5">
                        <div
                          className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,rgba(15,118,110,0.14),rgba(201,88,72,0.12),transparent_75%)]"
                          aria-hidden="true"
                        />
                        <div className="relative grid gap-3.5 md:grid-cols-[278.25px_minmax(0,1fr)] md:items-start md:gap-4">
                          <div className="space-y-2">
                            {roomMedia.length > 0 ? (
                              <>
                                <div className="room-card-media-shell relative overflow-hidden rounded-[20px] border border-black/5 bg-[linear-gradient(180deg,rgba(247,243,234,0.94),rgba(255,255,255,0.98))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_24px_rgba(17,29,16,0.04)] ring-1 ring-olive/8">
                                  <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5">
                                    <span className="inline-flex items-center rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-olive shadow-sm ring-1 ring-olive/8 backdrop-blur">
                                      {activeRoomMedia?.type === "VIDEO" ? "Видео" : "Фото"}
                                    </span>
                                    {roomMedia.length > 1 ? (
                                      <span className="inline-flex items-center rounded-full bg-olive/88 px-2 py-1 text-[10px] font-semibold text-white/95 shadow-sm backdrop-blur">
                                        {roomIndex + 1} / {roomMedia.length}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="room-media-stage relative overflow-hidden rounded-[16px] bg-[#ebe5d8]">
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
                                            : "object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]",
                                          activeRoomMedia.type === "IMAGE" ? "" : "",
                                        )}
                                      />
                                    ) : null}
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 via-black/0 to-transparent" />
                                  </div>
                                  {roomMedia.length > 1 ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          cycleRoomMedia(room.id, -1, roomMedia.length)
                                        }
                                        aria-label="Предыдущий файл номера"
                                        className="absolute left-2.5 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[14px] border border-white/70 bg-white/92 text-olive opacity-100 shadow-[0_10px_24px_rgba(17,29,16,0.12)] backdrop-blur transition-all duration-300 hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                                      >
                                        <ChevronLeftIcon className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => cycleRoomMedia(room.id, 1, roomMedia.length)}
                                        aria-label="Следующий файл номера"
                                        className="absolute right-2.5 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[14px] border border-white/70 bg-white/92 text-olive opacity-100 shadow-[0_10px_24px_rgba(17,29,16,0.12)] backdrop-blur transition-all duration-300 hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                                      >
                                        <ChevronRightIcon className="h-4 w-4" />
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <div className="rounded-[20px] border border-dashed border-olive/18 bg-[linear-gradient(180deg,rgba(249,247,241,0.9),rgba(255,255,255,0.92))] p-4 text-sm text-olive/60">
                                Фото и видео номера отсутствуют.
                              </div>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col rounded-[22px] bg-[linear-gradient(180deg,rgba(247,244,237,0.78),rgba(255,255,255,0.98))] p-3 ring-1 ring-olive/8 md:p-3.5">
                            <div>
                              <h3 className="text-[1.1rem] font-semibold leading-[1.2] text-olive md:text-[1.22rem]">
                                {room.title}
                              </h3>
                              {roomSummaryLine ? (
                                <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive/63 md:text-[13px]">
                                  {roomSummaryLine}
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-medium text-olive/78 ring-1 ring-olive/8 shadow-[0_1px_0_rgba(255,255,255,0.65)]">
                                <BedIcon className="h-4 w-4 shrink-0" />
                                {room.beds}
                                {room.extraBeds > 0 ? ` + ${room.extraBeds} доп.` : ""}&nbsp;мест
                              </span>
                              {room.areaSqm !== null ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-medium text-olive/78 ring-1 ring-olive/8 shadow-[0_1px_0_rgba(255,255,255,0.65)]">
                                  <AppIcon
                                    icon={RulerDimensionLine}
                                    className="h-4 w-4 shrink-0"
                                  />
                                  {room.areaSqm}&nbsp;м²
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-medium text-olive/78 ring-1 ring-olive/8 shadow-[0_1px_0_rgba(255,255,255,0.65)]">
                                <AppIcon icon={Bath} className="h-4 w-4 shrink-0" />
                                {room.bathroomTypeLabel}
                              </span>
                            </div>

                            <div className="mt-3 rounded-[20px] border border-olive/8 bg-white/88 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                              <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-olive/38">
                                Оснащение номера
                              </p>
                              {roomAmenityItems.length > 0 ? (
                                <div className="amenities-grid mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                                  {visibleRoomAmenities.map((amenity) => (
                                    <div
                                      key={amenity.key}
                                      className="flex items-center gap-2 rounded-[14px] bg-[linear-gradient(180deg,rgba(247,243,234,0.82),rgba(255,255,255,0.92))] px-2.5 py-1.5 ring-1 ring-olive/6"
                                    >
                                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] bg-white text-terra shadow-[0_6px_14px_rgba(17,29,16,0.06)] ring-1 ring-olive/10">
                                        <RoomFeatureIcon
                                          name={amenity.name}
                                          featureId={amenity.featureId}
                                          className="h-4 w-4 text-terra/90"
                                        />
                                      </span>
                                      <span className="min-w-0 text-[11.5px] leading-snug text-olive/74">
                                        {amenity.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
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
                                data-state={isDetailsOpen ? "open" : "closed"}
                                className={cn(
                                  "room-amenities-trigger group mt-2.5 inline-flex w-full items-center justify-between gap-2.5 rounded-[16px] border px-3 py-2.5 text-left transition-all duration-300",
                                  isDetailsOpen
                                    ? "border-primary/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(15,118,110,0.06),rgba(255,255,255,0.98))] shadow-[0_12px_24px_rgba(15,118,110,0.08)]"
                                    : "border-olive/10 bg-white/92 hover:-translate-y-0.5 hover:border-primary/16 hover:shadow-[0_12px_24px_rgba(17,29,16,0.08)]",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,243,234,0.92))] text-terra shadow-sm ring-1 ring-olive/8">
                                    <CheckBadgeIcon className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0 text-[12.5px] font-semibold text-olive">
                                    {isDetailsOpen
                                      ? "Скрыть удобства"
                                      : roomAmenityItems.length > 4
                                        ? `Все удобства · ${roomAmenityItems.length}`
                                        : "Подробнее о номере"}
                                  </span>
                                </span>
                                <ChevronDownIcon
                                  className={cn(
                                    "h-4 w-4 shrink-0 transition-transform duration-300",
                                    isDetailsOpen ? "rotate-180" : "group-hover:-translate-y-0.5",
                                  )}
                                />
                              </button>
                            </div>

                            <div className="mt-3 lg:mt-auto">
                              {summary.tone === "warn" ? (
                                <div className="flex items-start gap-2.5 rounded-[20px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,244,214,0.92))] px-3.5 py-3 text-sm text-amber-700 shadow-[0_10px_24px_rgba(217,119,6,0.1)]">
                                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                  <span>{summary.text}</span>
                                </div>
                              ) : (
                                <div className="relative overflow-hidden rounded-[20px] border border-primary/12 bg-[linear-gradient(135deg,rgba(241,248,246,0.98),rgba(255,255,255,0.98)_56%,rgba(249,243,238,0.94))] p-3.5 shadow-[0_14px_28px_rgba(15,118,110,0.08)]">
                                  <div
                                    className="pointer-events-none absolute right-0 top-0 h-20 w-24 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.16),transparent_68%)]"
                                    aria-hidden="true"
                                  />
                                  <div className="relative min-w-0 flex-1">
                                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                                      Стоимость проживания
                                    </p>
                                    <div className="mt-1.5 flex items-end justify-between gap-2">
                                      <p className="truncate text-[1.55rem] font-bold leading-none text-olive md:text-[1.68rem]">
                                        {summary.bigPrice}
                                      </p>
                                      {summary.sideLabel ? (
                                        <p className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-olive/60 ring-1 ring-olive/8">
                                          {summary.sideLabel}
                                        </p>
                                      ) : null}
                                    </div>
                                    {summary.smallLabel ? (
                                      <p className="mt-1.5 text-[11.5px] text-olive/60">
                                        {summary.smallLabel}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              )}
                            </div>
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
            className="rounded-3xl bg-white p-5 ring-1 ring-olive/10 md:p-6"
          >
            <h2 className="flex items-center gap-2.5 text-2xl text-olive">
              <span className="h-6 w-1 shrink-0 rounded-full bg-terra" aria-hidden="true" />
              Описание объекта
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-olive/80">
              {description.length > 0 ? shortDescription : "Описание пока не добавлено владельцем."}
            </p>
            {description.length > 420 ? (
              <button
                type="button"
                onClick={() => setShowFullDescription((prev) => !prev)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-olive/18 px-4 py-1.5 text-sm font-semibold text-olive/75 transition hover:bg-cream hover:text-olive"
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
              <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-olive/10 shadow-sm">
                <div className="px-6 pb-3 pt-5">
                  <h3 className="text-lg text-olive">Местоположение на карте</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-olive/55">
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
            <section
              className="rounded-3xl bg-white p-5 ring-1 ring-olive/10 md:p-6"
            >
              <h2 className="flex items-center gap-2.5 text-2xl text-olive">
                <span className="h-6 w-1 shrink-0 rounded-full bg-terra" aria-hidden="true" />
                Похожие предложения
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {similarCards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.path}
                    className="overflow-hidden rounded-xl border border-olive/12 bg-cream/45 transition hover:-translate-y-0.5 hover:shadow-md"
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

          {/* Amenities (moved from sidebar) */}
          {allAmenities.length > 0 ? (
            <section
              id="amenities"
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
                    className="rounded-full bg-cream px-3 py-1.5 text-sm text-olive/75"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {/* House rules (moved from sidebar) */}
          <section
            id="house-rules"
            className="overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-[0_20px_48px_rgba(58,43,35,0.08)] ring-1 ring-olive/8 backdrop-blur-sm"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-cream via-white to-primary/5 px-5 py-5">
              <span
                className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-terra/10 blur-3xl"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between gap-4">
                <h2 className="flex items-center gap-2.5 text-2xl text-olive">
                  <span className="h-6 w-1 shrink-0 rounded-full bg-terra" aria-hidden="true" />
                  Правила проживания
                </h2>
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-primary shadow-[0_10px_24px_rgba(15,118,110,0.14)] ring-1 ring-white/90 backdrop-blur sm:flex">
                  <CheckBadgeIcon className="h-6 w-6" />
                </span>
              </div>
              <div className="relative mt-4 flex flex-wrap gap-2">
                {ruleChips.map((chip) => (
                  <span
                    key={chip.key}
                    className={cn(
                      "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-olive/70 shadow-sm backdrop-blur",
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
            </div>
          </section>
        </div>

        {/* ── Right sticky info panel (desktop only) ── */}
        <aside
          id="owner-contacts"
          className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start"
        >
          {/* Property info card */}
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-olive/10 shadow-[0_16px_40px_rgba(15,118,110,0.13)]">
            <div className="relative space-y-3 px-5 pb-5 pt-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.22),transparent_48%),radial-gradient(circle_at_top_left,rgba(242,196,77,0.18),transparent_36%)]"
              />
              {/* Type + badges */}
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/70 ring-1 ring-olive/12">
                  {item.typeLabel ?? "Объект размещения"}
                </span>
                {heroBadges.map((badge) => (
                  <span
                    key={badge}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      /первая\s+линия|до моря/i.test(badge) ? "bg-terra/14 text-terra" : "bg-sage/25 text-olive",
                    )}
                  >
                    {badge}
                  </span>
                ))}
              </div>
              {/* Name + rating + location + address */}
              <div className="relative">
                <h1 className="text-2xl leading-tight text-olive">{item.name ?? "Объект"}</h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-olive/72">
                  <SparkStarIcon className="h-4 w-4 text-terra" />
                  <span>{headerRatingLine}</span>
                  <span className="text-olive/45">•</span>
                  <LocationPinIcon className="h-4 w-4 text-terra" />
                  <span>{locationLabel}</span>
                </p>
                {item.address ? (
                  <a
                    href={yandexMapsHref ?? "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1.5 inline-flex items-start gap-1.5 text-sm underline decoration-dotted underline-offset-4 text-olive/75 hover:text-terra"
                  >
                    <LocationPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{item.address}</span>
                  </a>
                ) : null}
              </div>
              {/* Price + favorite */}
              <div className="relative flex items-end justify-between gap-3 border-b border-olive/8 pb-4">
                <div>
                  <p className="text-3xl font-black leading-none text-olive">{mainPriceLabel}</p>
                  <p className="mt-1 text-sm text-olive/60">за ночь</p>
                </div>
                <FavoriteToggleButton propertyId={item.id} initialIsFavorite={initialIsFavorite} />
              </div>
              {/* Contacts */}
              <div className="relative space-y-2.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-olive/38">
                  Способы связи
                </p>
                {mobilePhoneHref ? (
                  <a
                    href={mobilePhoneHref}
                    className="group flex min-h-[60px] w-full items-center justify-between gap-3 overflow-hidden rounded-[24px] bg-primary px-4 py-3 text-white shadow-[0_18px_36px_rgba(15,118,110,0.28)] ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-[0_22px_44px_rgba(15,118,110,0.34)] active:scale-[0.98]"
                  >
                    <span className="flex min-w-0 items-center gap-3 text-left">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/15">
                        <PhoneIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">Позвонить</span>
                        <span className="mt-0.5 block text-xs text-white/72">Быстрый ответ напрямую</span>
                      </span>
                    </span>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-white/75 transition group-hover:translate-x-0.5" />
                  </a>
                ) : null}
                <div className="space-y-2.5">
                  {contactWhatsappUrl ? (
                    <a
                      href={contactWhatsappUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group flex h-14 items-center justify-between gap-3 rounded-[22px] border border-[#25D366]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(37,211,102,0.08))] px-4 shadow-[0_12px_28px_rgba(37,211,102,0.1),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#25D366]/32 hover:shadow-[0_18px_36px_rgba(37,211,102,0.16),inset_0_1px_0_rgba(255,255,255,0.98)] active:scale-[0.98]"
                    >
                      <span className="flex min-w-0 items-center gap-3 text-left">
                        <ContactBrandMark brand="whatsapp" className="h-10 w-10 rounded-2xl" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-olive">WhatsApp</span>
                          <span className="mt-0.5 block text-xs text-olive/52">Открыть чат</span>
                        </span>
                      </span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-primary/50 transition group-hover:translate-x-0.5 group-hover:text-[#25D366]" />
                    </a>
                  ) : null}
                  {contactTelegramUrl ? (
                    <a
                      href={contactTelegramUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group flex h-14 items-center justify-between gap-3 rounded-[22px] border border-[#27A7E7]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(39,167,231,0.08))] px-4 shadow-[0_12px_28px_rgba(39,167,231,0.1),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#27A7E7]/32 hover:shadow-[0_18px_36px_rgba(39,167,231,0.16),inset_0_1px_0_rgba(255,255,255,0.98)] active:scale-[0.98]"
                    >
                      <span className="flex min-w-0 items-center gap-3 text-left">
                        <ContactBrandMark brand="telegram" className="h-10 w-10 rounded-2xl" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-olive">Telegram</span>
                          <span className="mt-0.5 block text-xs text-olive/52">Открыть чат</span>
                        </span>
                      </span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-primary/50 transition group-hover:translate-x-0.5 group-hover:text-[#26A5E4]" />
                    </a>
                  ) : null}
                </div>
                {hasOwnerEmail ? (
                  <a
                    href={`mailto:${ownerEmail}`}
                    className="group flex h-14 items-center justify-between gap-3 rounded-[20px] border border-olive/10 bg-white/85 px-4 shadow-[0_10px_24px_rgba(58,43,35,0.06)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-olive/18 hover:bg-white hover:shadow-[0_16px_28px_rgba(58,43,35,0.10)] active:scale-[0.98]"
                  >
                    <span className="flex min-w-0 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cream ring-1 ring-olive/10 text-olive/70">
                        <MailIcon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-olive">Электронная почта</span>
                        <span className="mt-0.5 block truncate text-xs text-olive/52">{ownerEmail}</span>
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-primary/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </a>
                ) : null}
                {!hasAnyOwnerContacts ? (
                  <p className="rounded-[22px] border border-dashed border-olive/18 bg-white/75 px-4 py-4 text-center text-sm text-olive/70">
                    Контакты владельца пока не добавлены
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Date/guests compact widget */}
          <div className="rounded-3xl bg-white p-5 ring-1 ring-olive/10">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-olive/38">
              Период и гости
            </p>
            <HousingSearchDateRangeField
              initialCheckIn={checkIn ?? ""}
              initialCheckOut={checkOut ?? ""}
              onRangeChange={handleStayRangeChange}
              autoSubmitOnComplete={false}
              showHiddenInputs={false}
              buttonClassName="h-[62px] w-full rounded-2xl border border-olive/16 bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
            />
            <div className="mt-2">
              <GuestsPlacementField
                adults={adults}
                childrenAges={childrenAges}
                onAdultsChange={setAdults}
                onChildrenAgesChange={setChildrenAges}
              />
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
