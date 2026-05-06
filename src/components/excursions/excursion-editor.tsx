"use client";

import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionStatus,
} from "@prisma/client";
import {
  Check,
  CircleCheckBig,
  CircleX,
  Clock3,
  Globe,
  Info,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Plus,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DepartureDatesEditor,
  type DepartureDateItem,
} from "@/components/excursions/editor/departure-dates-editor";
import { ContentPhotoManager } from "@/components/excursions/editor/content-photo-manager";
import { ExtraOptionsEditor } from "@/components/excursions/editor/extra-options-editor";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { Input } from "@/components/ui/input";
import { SingleDatePopoverField } from "@/components/ui/single-date-popover-field";
import { SeaToggle } from "@/components/ui/sea-toggle";
import { WizardStepper } from "@/components/excursions/editor/wizard-stepper";
import { TimelineEditor } from "@/components/excursions/editor/timeline-editor";
import { PricingTiersEditor } from "@/components/excursions/editor/pricing-tiers-editor";
import { IncludedEditor } from "@/components/excursions/editor/included-editor";
import { FaqEditor } from "@/components/excursions/editor/faq-editor";
import { TourDaysEditor } from "@/components/excursions/editor/tour-days-editor";
import { ExcursionPaymentPanel } from "@/components/payments/excursion-payment-panel";
import { cn } from "@/lib/cn";
import { crimeaLocations } from "@/lib/constants";
import { isTourOffer } from "@/lib/excursion-offers";
import type { SerializedExcursion } from "@/lib/excursions";
import {
  accommodationPhotoUploadFormatsLabel,
  accommodationPhotoUploadLimitsLabel,
  detectSupportedPhotoUploadType,
  getAccommodationPhotoUploadSizeError,
  getAccommodationPhotoUploadSizeLimitBytes,
  getUnsupportedAccommodationPhotoFormatError,
} from "@/lib/photo-upload";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { buildWebsiteFaviconUrl } from "@/lib/website-favicon";
import {
  type ExcursionExtraOption,
  type TimelineStep,
  type ItineraryDay,
  type ItineraryItemLabel,
  type PricingTier,
  type FaqItem,
  type ExcursionSectionPhotoGroupKey,
  type ExcursionSectionPhotoGroups,
  EXCURSION_PROGRAM_PHOTO_LIMIT,
  EXCURSION_SECTION_PHOTO_LIMIT,
  collectExcursionSectionPhotoUrls,
  formatItineraryItemCount,
  getItineraryDayPhotoUrls,
  getItineraryProgramTitle,
  getTimelineStepPhotoUrls,
  EXCURSION_CATEGORY_TAGS,
  INCLUDED_PRESETS,
  EXCLUDED_PRESETS,
  CANCELLATION_POLICY_OPTIONS,
  HIGHLIGHT_PRESETS,
  OFFER_SUBTYPE_PRESETS,
  OFFER_TYPE_OPTIONS,
  PRICE_UNIT_PRESETS,
  PHYSICAL_REQUIREMENTS_PRESETS,
  WHAT_TO_BRING_PRESETS,
  // V2 Tour types
  TOUR_KIND_OPTIONS,
  TRANSPORT_MODE_OPTIONS,
  DEPARTURE_MODE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  MEAL_PLAN_OPTIONS,
  ACCOMMODATION_TYPE_OPTIONS,
  EQUIPMENT_PROVIDED_PRESETS,
  DOCUMENTS_REQUIRED_PRESETS,
  normalizeExcursionSectionPhotoGroups,
  resolveItineraryItemLabel,
  requiresAccommodationBlock,
  requiresSafetyBlock,
} from "@/types/excursions";

type ExcursionEditorProps = {
  initialExcursion: SerializedExcursion;
  displayExcursionNumber: number;
  adminMode?: boolean;
  backHref?: string;
  backLabel?: string;
  listHref?: string;
  moderationHref?: string | null;
  previewHref?: string | null;
};

type UpdateExcursionResponse = {
  error?: string;
  item?: SerializedExcursion;
};

type ReverseGeocodeItem = {
  address: string;
  localityName?: string | null;
  localityDisplayName?: string | null;
};

const excursionPhotoLimit = 12;
const excursionPhotoMinForModeration = 3;

type SectionPhotoFieldConfig = {
  key: ExcursionSectionPhotoGroupKey;
  title: string;
  description: string;
  addLabel: string;
  emptyText: string;
};

function getSectionPhotoFieldConfigs(input: {
  isTour: boolean;
  showAccommodationBlock: boolean;
}): SectionPhotoFieldConfig[] {
  return [
    {
      key: "dates",
      title: input.isTour ? "Фото дат и заездов" : "Фото расписания и бронирования",
      description: input.isTour
        ? "Показываются рядом с датами заездов, свободными местами и условиями бронирования."
        : "Показываются рядом с расписанием, доступностью и условиями бронирования.",
      addLabel: "Добавить фото",
      emptyText: input.isTour
        ? "Фото для дат и заездов пока не выбраны."
        : "Фото для расписания пока не выбраны.",
    },
    {
      key: "program",
      title: input.isTour ? "Фото программы тура" : "Фото маршрута экскурсии",
      description:
        "Общие кадры для блока программы. Фото конкретного дня или шага лучше добавлять прямо в этот день или шаг.",
      addLabel: "Добавить фото программы",
      emptyText: "Фото для программы пока не выбраны.",
    },
    {
      key: "logistics",
      title: input.isTour ? "Фото старта и перемещений" : "Фото места встречи и маршрута",
      description: "Подходят кадры точки сбора, транспорта, дороги или ориентиров по пути.",
      addLabel: "Добавить фото",
      emptyText: "Фото для старта и маршрута пока не выбраны.",
    },
    {
      key: "accommodation",
      title: input.showAccommodationBlock ? "Фото проживания" : "Фото условий участия",
      description: input.showAccommodationBlock
        ? "Показываются в блоке проживания, размещения и ночёвок."
        : "Необязательные кадры: пространство, комфорт, питание, снаряжение или другие детали формата.",
      addLabel: input.showAccommodationBlock ? "Добавить фото проживания" : "Добавить фото условий",
      emptyText: input.showAccommodationBlock
        ? "Фото проживания пока не выбраны."
        : "Фото условий участия пока не выбраны.",
    },
    {
      key: "included",
      title: "Фото услуг и деталей",
      description:
        "Показываются рядом с тем, что входит в стоимость: сервисы, питание, снаряжение или бонусы.",
      addLabel: "Добавить фото деталей",
      emptyText: "Фото услуг и деталей пока не выбраны.",
    },
    {
      key: "requirements",
      title: "Фото подготовки и требований",
      description:
        "Подойдут кадры экипировки, документов, уровня нагрузки или других условий участия.",
      addLabel: "Добавить фото подготовки",
      emptyText: "Фото подготовки пока не выбраны.",
    },
  ];
}

function movePhotoUrlToFirst(photoUrls: string[], photoIndex: number): string[] {
  if (photoIndex <= 0 || photoIndex >= photoUrls.length) {
    return photoUrls;
  }

  const nextPhotoUrls = [...photoUrls];
  const [selectedPhotoUrl] = nextPhotoUrls.splice(photoIndex, 1);
  if (!selectedPhotoUrl) {
    return photoUrls;
  }

  return [selectedPhotoUrl, ...nextPhotoUrls];
}

type WeekdayId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type WeekdaySchedule = {
  enabled: boolean;
  from: string;
  to: string;
};

type DayScheduleState = Record<WeekdayId, WeekdaySchedule>;

type ScheduleRuleResponseItem = {
  dateFrom: string | null;
  dateTo: string | null;
  weekdays: number[];
  timeStarts: string[];
  durationMinutes: number | null;
};

type ScheduleExceptionResponseItem = {
  date: string;
  isClosed: boolean;
  overrideTimeStarts: string[];
  overrideCapacity: number | null;
  overridePrice: number | null;
  notes: string | null;
};

type ScheduleRulesResponse = {
  rules: ScheduleRuleResponseItem[];
  exceptions: ScheduleExceptionResponseItem[];
};

type SessionResponseItem = {
  startAt: string;
  endAt: string | null;
  capacity: number | null;
  priceOverride: number | null;
};

type SessionsResponse = {
  items: SessionResponseItem[];
};

type AddActionButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type TourDurationMode = "days" | "time";

type LanguageOption = {
  code: string;
  label: string;
};

type FormatOption = {
  id: string;
  value: ExcursionFormat;
  label: string;
};

const weekdayOrder: WeekdayId[] = [1, 2, 3, 4, 5, 6, 0];

const weekdayLabels: Record<WeekdayId, string> = {
  0: "Воскресенье",
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
};

const weekdayShortLabels: Record<WeekdayId, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const scheduleDayPresets: Array<{
  id: "weekdays" | "weekend" | "all";
  label: string;
  days: WeekdayId[];
}> = [
  { id: "weekdays", label: "Будни", days: [1, 2, 3, 4, 5] },
  { id: "weekend", label: "Выходные", days: [6, 0] },
  { id: "all", label: "Все дни", days: [1, 2, 3, 4, 5, 6, 0] },
];

const isoDateValueRegex = /^\d{4}-\d{2}-\d{2}$/;
const languageCodeRegex = /^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/;

const defaultLanguageOptions: LanguageOption[] = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "tr", label: "Türkçe" },
];

const defaultFormatOptions: FormatOption[] = [
  { id: "group", value: ExcursionFormat.GROUP, label: "Групповая" },
  { id: "individual", value: ExcursionFormat.INDIVIDUAL, label: "Индивидуальная" },
  { id: "vip", value: ExcursionFormat.VIP, label: "VIP" },
];

const defaultCategoryTagSet = new Set(EXCURSION_CATEGORY_TAGS.map((item) => item.toLowerCase()));
const defaultLanguageCodeSet = new Set(
  defaultLanguageOptions.map((item) => normalizeLanguageCode(item.code)),
);
const defaultFormatOptionIdSet = new Set(defaultFormatOptions.map((item) => item.id));

function normalizeExcursionFormat(value: ExcursionFormat | null | undefined): ExcursionFormat {
  if (
    value === ExcursionFormat.GROUP ||
    value === ExcursionFormat.INDIVIDUAL ||
    value === ExcursionFormat.VIP
  ) {
    return value;
  }
  if (value === ExcursionFormat.PRIVATE) {
    return ExcursionFormat.INDIVIDUAL;
  }
  return ExcursionFormat.GROUP;
}

function normalizeLanguageCode(value: string): string {
  return value.trim().toLowerCase();
}

function AddActionButton({ label, onClick, disabled = false }: AddActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-4 py-3 text-sm font-medium text-olive/70 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <AppIcon icon={Plus} className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const shortDescriptionMaxLength = 1000;

function buildShortDescription(value: string): string | null {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= shortDescriptionMaxLength) {
    return normalized;
  }

  return `${normalized.slice(0, shortDescriptionMaxLength - 3).trimEnd()}...`;
}

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /^(?:г\.?|город|пгт|с\.?|село|пос\.?|поселок(?:\s+городского\s+типа)?|посёлок(?:\s+городского\s+типа)?|д\.?|деревня|х\.?|хутор)\s+/,
      "",
    )
    .replace(/\s+/g, " ");
}

function resolveCrimeaLocationFromAddress(
  addressValue: string,
  localityHint?: string,
): (typeof crimeaLocations)[number] | null {
  const candidates = [localityHint ?? "", addressValue]
    .map((value) => value.trim())
    .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLocation(candidate);
    const directMatch = crimeaLocations.find((location) =>
      normalizedCandidate.includes(normalizeLocation(location.name)),
    );

    if (directMatch) {
      return directMatch;
    }
  }
  return null;
}

function findExactCrimeaLocationByName(value: string): (typeof crimeaLocations)[number] | null {
  const normalizedValue = normalizeLocation(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    crimeaLocations.find((location) => normalizeLocation(location.name) === normalizedValue) ?? null
  );
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) {
    return "Не указана";
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

function resolveTourDurationMode(input: {
  durationDays: number | null;
  durationMinutes: number | null;
}): TourDurationMode {
  if (input.durationDays !== null && input.durationDays >= 1) {
    return "days";
  }

  return "time";
}

function splitDurationMinutesForInputs(totalMinutes: number | null): {
  hours: string;
  minutes: string;
} {
  if (!totalMinutes || totalMinutes <= 0) {
    return { hours: "", minutes: "" };
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    hours: hours > 0 ? String(hours) : "",
    minutes: minutes > 0 ? String(minutes) : "",
  };
}

function buildDurationMinutesFromInputs(hoursInput: string, minutesInput: string): string {
  const hours = hoursInput.trim() ? Number.parseInt(hoursInput.trim(), 10) : 0;
  const minutes = minutesInput.trim() ? Number.parseInt(minutesInput.trim(), 10) : 0;

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return "";
  }

  const totalMinutes = hours * 60 + minutes;
  return totalMinutes > 0 ? String(totalMinutes) : "";
}

function createDefaultDaySchedule(): DayScheduleState {
  return {
    0: { enabled: false, from: "10:00", to: "14:00" },
    1: { enabled: false, from: "10:00", to: "14:00" },
    2: { enabled: false, from: "10:00", to: "14:00" },
    3: { enabled: false, from: "10:00", to: "14:00" },
    4: { enabled: false, from: "10:00", to: "14:00" },
    5: { enabled: false, from: "10:00", to: "14:00" },
    6: { enabled: false, from: "10:00", to: "14:00" },
  };
}

function isValidTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function timeToMinutes(value: string): number | null {
  if (!isValidTimeValue(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":");
  return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
}

function minutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutesToTime(startTime: string, minutesToAdd: number | null): string {
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null || minutesToAdd === null || minutesToAdd <= 0) {
    return "14:00";
  }
  return minutesToTime(startMinutes + minutesToAdd);
}

function normalizeWeekday(value: number): WeekdayId | null {
  if (value >= 0 && value <= 6) {
    return value as WeekdayId;
  }
  return null;
}

function formatIsoToDayMonthYear(value: string): string {
  if (!isoDateValueRegex.test(value)) {
    return value;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  return `${dayValue}.${monthValue}.${yearValue}`;
}

function normalizeIsoDateList(values: string[]): string[] {
  return [...new Set(values)]
    .filter((item) => isoDateValueRegex.test(item))
    .sort((left, right) => left.localeCompare(right));
}

function toDepartureDateItem(item: SessionResponseItem): DepartureDateItem {
  const startAt = new Date(item.startAt);
  const endAt = item.endAt ? new Date(item.endAt) : null;

  return {
    startDate: Number.isNaN(startAt.getTime()) ? "" : startAt.toISOString().slice(0, 10),
    startTime: Number.isNaN(startAt.getTime()) ? "09:00" : startAt.toISOString().slice(11, 16),
    endDate: !endAt || Number.isNaN(endAt.getTime()) ? "" : endAt.toISOString().slice(0, 10),
    endTime: !endAt || Number.isNaN(endAt.getTime()) ? "" : endAt.toISOString().slice(11, 16),
    capacity: item.capacity === null ? "" : String(item.capacity),
    priceOverride: item.priceOverride === null ? "" : String(item.priceOverride),
  };
}

function buildSessionStartIso(item: DepartureDateItem): string | null {
  if (!item.startDate || !item.startTime) {
    return null;
  }
  return `${item.startDate}T${item.startTime}:00.000Z`;
}

function buildSessionEndIso(item: DepartureDateItem): string | null {
  if (!item.endDate || !item.endTime) {
    return null;
  }
  return `${item.endDate}T${item.endTime}:00.000Z`;
}

function buildScheduleSummary(params: {
  isYearRound: boolean;
  seasonDateFrom: string;
  seasonDateTo: string;
  daySchedule: DayScheduleState;
  additionalClosedDates: string[];
  scheduleComment: string;
}): string | null {
  const activeDays = weekdayOrder.filter((day) => params.daySchedule[day].enabled);
  if (activeDays.length === 0) {
    return null;
  }

  const period = params.isYearRound
    ? "Круглый год"
    : params.seasonDateFrom && params.seasonDateTo
      ? `Период: ${formatIsoToDayMonthYear(params.seasonDateFrom)} — ${formatIsoToDayMonthYear(params.seasonDateTo)}`
      : "Период: по датам";

  const weekdaysSummary = activeDays
    .map(
      (day) =>
        `${weekdayLabels[day]} ${params.daySchedule[day].from}-${params.daySchedule[day].to}`,
    )
    .join("; ");

  const segments = [`${period}. ${weekdaysSummary}`];

  if (params.additionalClosedDates.length > 0) {
    segments.push(
      `Доп. даты выходных: ${params.additionalClosedDates.map((item) => formatIsoToDayMonthYear(item)).join(", ")}`,
    );
  }

  const normalizedComment = params.scheduleComment.trim();
  if (normalizedComment.length > 0) {
    segments.push(`Комментарий: ${normalizedComment}`);
  }

  return segments.join(". ");
}

export function ExcursionEditor({
  initialExcursion,
  adminMode = false,
  backHref = "/dashboard/excursions",
  backLabel = "Все программы",
  listHref = "/dashboard/excursions",
  moderationHref = null,
  previewHref = null,
}: ExcursionEditorProps) {
  const router = useRouter();
  const [excursion, setExcursion] = useState(initialExcursion);
  const initialDescriptionValue =
    initialExcursion.description ??
    initialExcursion.fullDescription ??
    initialExcursion.shortDescription ??
    "";
  const [offerType, setOfferType] = useState<ExcursionOfferType>(initialExcursion.offerType);
  const [subtypeLabel, setSubtypeLabel] = useState(initialExcursion.subtypeLabel ?? "");
  const [title, setTitle] = useState(initialExcursion.title ?? "");
  const [locationId, setLocationId] = useState(initialExcursion.locationId ?? "");
  const [locationInput, setLocationInput] = useState(initialExcursion.locationName ?? "");
  const [address, setAddress] = useState(initialExcursion.address ?? "");
  const [latitude, setLatitude] = useState<number | null>(initialExcursion.latitude);
  const [longitude, setLongitude] = useState<number | null>(initialExcursion.longitude);
  const [mapDraftLatitude, setMapDraftLatitude] = useState<number | null>(
    initialExcursion.latitude,
  );
  const [mapDraftLongitude, setMapDraftLongitude] = useState<number | null>(
    initialExcursion.longitude,
  );
  const [mapDraftAddress, setMapDraftAddress] = useState(initialExcursion.address ?? "");
  const [mapDraftLocationName, setMapDraftLocationName] = useState(
    initialExcursion.locationName ?? "",
  );
  const [mapDraftLocationId, setMapDraftLocationId] = useState(initialExcursion.locationId ?? "");
  const [startPoint, setStartPoint] = useState(initialExcursion.startPoint ?? "");
  const [finishPoint, setFinishPoint] = useState(initialExcursion.finishPoint ?? "");
  const [description, setDescription] = useState(initialDescriptionValue);
  const [routeDescription, setRouteDescription] = useState(initialExcursion.routeDescription ?? "");
  const [highlights, setHighlights] = useState<string[]>(initialExcursion.highlights ?? []);
  const initialTourDurationParts = splitDurationMinutesForInputs(initialExcursion.durationMinutes);
  const [tourDurationMode, setTourDurationMode] = useState<TourDurationMode>(() =>
    resolveTourDurationMode(initialExcursion),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialExcursion.durationMinutes === null ? "" : String(initialExcursion.durationMinutes),
  );
  const [durationHours, setDurationHours] = useState(initialTourDurationParts.hours);
  const [durationClockMinutes, setDurationClockMinutes] = useState(
    initialTourDurationParts.minutes,
  );
  const [durationDays, setDurationDays] = useState(
    initialExcursion.durationDays === null ? "" : String(initialExcursion.durationDays),
  );
  const [durationNights, setDurationNights] = useState(
    initialExcursion.durationNights === null ? "" : String(initialExcursion.durationNights),
  );
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>(
    initialExcursion.itineraryDays ?? [],
  );
  const [itineraryItemLabel, setItineraryItemLabel] = useState<ItineraryItemLabel>(() =>
    resolveItineraryItemLabel(initialExcursion.itineraryDays?.[0]?.itemLabel),
  );
  const normalizedItineraryDays = useMemo(
    () => itineraryDays.map((day) => ({ ...day, itemLabel: itineraryItemLabel })),
    [itineraryDays, itineraryItemLabel],
  );
  const [scheduleText, setScheduleText] = useState(initialExcursion.scheduleText ?? "");
  const [availabilityMode, setAvailabilityMode] = useState<ExcursionAvailabilityMode>(
    initialExcursion.availabilityMode,
  );
  const [availabilityNote, setAvailabilityNote] = useState(initialExcursion.availabilityNote ?? "");
  const [isYearRound, setIsYearRound] = useState(true);
  const [seasonDateFrom, setSeasonDateFrom] = useState("");
  const [seasonDateTo, setSeasonDateTo] = useState("");
  const [daySchedule, setDaySchedule] = useState<DayScheduleState>(createDefaultDaySchedule);
  const [bulkTimeFrom, setBulkTimeFrom] = useState("10:00");
  const [bulkTimeTo, setBulkTimeTo] = useState("14:00");
  const [additionalClosedDates, setAdditionalClosedDates] = useState<string[]>([]);
  const [scheduleComment, setScheduleComment] = useState("");
  const [isLoadingScheduleRules, setIsLoadingScheduleRules] = useState(false);
  const [priceFrom, setPriceFrom] = useState(
    initialExcursion.priceFrom === null ? "" : String(initialExcursion.priceFrom),
  );
  const [contactFirstName, setContactFirstName] = useState(initialExcursion.contactFirstName ?? "");
  const [contactLastName, setContactLastName] = useState(initialExcursion.contactLastName ?? "");
  const [contactPhone, setContactPhone] = useState(initialExcursion.contactPhone ?? "");
  const [contactPhone2, setContactPhone2] = useState(initialExcursion.contactPhone2 ?? "");
  const [contactEmail, setContactEmail] = useState(initialExcursion.contactEmail ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialExcursion.websiteUrl ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(initialExcursion.whatsappUrl ?? "");
  const [telegramUrl, setTelegramUrl] = useState(initialExcursion.telegramUrl ?? "");
  const [vkUrl, setVkUrl] = useState(initialExcursion.vkUrl ?? "");
  const [maxUrl, setMaxUrl] = useState(initialExcursion.maxUrl ?? "");
  const [okUrl, setOkUrl] = useState(initialExcursion.okUrl ?? "");
  const [showContactEmail, setShowContactEmail] = useState(Boolean(initialExcursion.contactEmail));
  const [showWebsite, setShowWebsite] = useState(Boolean(initialExcursion.websiteUrl));
  const [showWhatsapp, setShowWhatsapp] = useState(Boolean(initialExcursion.whatsappUrl));
  const [showTelegram, setShowTelegram] = useState(Boolean(initialExcursion.telegramUrl));
  const [showVk, setShowVk] = useState(Boolean(initialExcursion.vkUrl));
  const [showMax, setShowMax] = useState(Boolean(initialExcursion.maxUrl));
  const [showOk, setShowOk] = useState(Boolean(initialExcursion.okUrl));
  const [failedWebsiteFaviconUrl, setFailedWebsiteFaviconUrl] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState(initialExcursion.photoUrls);
  const [sectionPhotoGroups, setSectionPhotoGroups] = useState<ExcursionSectionPhotoGroups>(() =>
    normalizeExcursionSectionPhotoGroups(initialExcursion.sectionPhotoGroups),
  );
  const [programPhotoUploadKey, setProgramPhotoUploadKey] = useState<string | null>(null);
  const [sectionPhotoUploadKey, setSectionPhotoUploadKey] =
    useState<ExcursionSectionPhotoGroupKey | null>(null);
  const [videoUrls, setVideoUrls] = useState(initialExcursion.videoUrls);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  // --- Wizard state ---
  const [currentStep, setCurrentStep] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // --- New fields ---
  const [tags, setTags] = useState<string[]>(initialExcursion.tags ?? []);
  const [tagOptions, setTagOptions] = useState<string[]>(() => {
    const next = [...EXCURSION_CATEGORY_TAGS];
    for (const tag of initialExcursion.tags ?? []) {
      if (!next.some((item) => item.toLowerCase() === tag.toLowerCase())) {
        next.push(tag);
      }
    }
    return next;
  });
  const [newTagDraft, setNewTagDraft] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const normalizedInitialFormat = normalizeExcursionFormat(initialExcursion.format);
  const [excursionFormat, setExcursionFormat] = useState<ExcursionFormat>(normalizedInitialFormat);
  const [formatOptions, setFormatOptions] = useState<FormatOption[]>(() => [
    ...defaultFormatOptions,
  ]);
  const [selectedFormatOptionId, setSelectedFormatOptionId] = useState<string>(() => {
    const matched = defaultFormatOptions.find((item) => item.value === normalizedInitialFormat);
    return matched?.id ?? defaultFormatOptions[0]?.id ?? "";
  });
  const [newFormatDraft, setNewFormatDraft] = useState("");
  const [isAddingFormat, setIsAddingFormat] = useState(false);
  const [languageCodes, setLanguageCodes] = useState<string[]>(
    initialExcursion.languageCodes?.length
      ? initialExcursion.languageCodes.map((item) => normalizeLanguageCode(item)).filter(Boolean)
      : ["ru"],
  );
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(() => {
    const next = [...defaultLanguageOptions];
    const source = initialExcursion.languageCodes?.length ? initialExcursion.languageCodes : ["ru"];
    for (const codeValue of source) {
      const code = normalizeLanguageCode(codeValue);
      if (!code) {
        continue;
      }
      if (!next.some((item) => item.code === code)) {
        next.push({ code, label: code.toUpperCase() });
      }
    }
    return next;
  });
  const [newLanguageCodeDraft, setNewLanguageCodeDraft] = useState("");
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);
  const [difficulty, setDifficulty] = useState<ExcursionDifficulty | null>(
    initialExcursion.difficulty,
  );
  const [minBookingNoticeHours, setMinBookingNoticeHours] = useState(
    initialExcursion.minBookingNoticeHours === null
      ? ""
      : String(initialExcursion.minBookingNoticeHours),
  );
  const [maxParticipants, setMaxParticipants] = useState(
    initialExcursion.groupSizeMax === null ? "" : String(initialExcursion.groupSizeMax),
  );
  const [minParticipants, setMinParticipants] = useState(
    initialExcursion.groupSizeMin === null ? "" : String(initialExcursion.groupSizeMin),
  );
  const [minAge, setMinAge] = useState(
    initialExcursion.ageLimit === null ? "" : String(initialExcursion.ageLimit),
  );
  const [physicalRequirements, setPhysicalRequirements] = useState<string[]>(
    initialExcursion.physicalRequirements ?? [],
  );
  const [whatToBring, setWhatToBring] = useState<string[]>(initialExcursion.whatToBring ?? []);
  const [hasGuideLicense, setHasGuideLicense] = useState(initialExcursion.hasGuideLicense ?? false);
  const [timeline, setTimeline] = useState<TimelineStep[]>(initialExcursion.timeline ?? []);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(
    initialExcursion.pricingTiers ?? [],
  );
  const [includedItems, setIncludedItems] = useState<string[]>(
    initialExcursion.includedItems ?? [],
  );
  const [excludedItems, setExcludedItems] = useState<string[]>(
    initialExcursion.excludedItems ?? [],
  );
  const [transferDetails, setTransferDetails] = useState(initialExcursion.transferDetails ?? "");
  const [transferEnabled, setTransferEnabled] = useState(
    Boolean(initialExcursion.transferDetails || initialExcursion.pickupAvailable),
  );
  const [cancellationPolicyType, setCancellationPolicyType] = useState(
    initialExcursion.cancellationPolicyType ?? "",
  );
  const [cancellationPolicyText, setCancellationPolicyText] = useState(
    initialExcursion.cancellationPolicy ?? "",
  );
  const [faqItems, setFaqItems] = useState<FaqItem[]>(initialExcursion.faqItems ?? []);
  const [extraOptions, setExtraOptions] = useState<ExcursionExtraOption[]>(
    initialExcursion.extraOptions ?? [],
  );
  const [priceUnitLabel, setPriceUnitLabel] = useState(initialExcursion.priceUnitLabel ?? "");
  const [accommodationProvided, setAccommodationProvided] = useState<boolean | null>(
    initialExcursion.accommodationProvided,
  );
  const [accommodationType, setAccommodationType] = useState(
    initialExcursion.accommodationType ?? "",
  );
  const [accommodationNights, setAccommodationNights] = useState(
    initialExcursion.accommodationNights === null
      ? ""
      : String(initialExcursion.accommodationNights),
  );
  const [accommodationFormat, setAccommodationFormat] = useState(
    initialExcursion.accommodationFormat ?? "",
  );
  const [mealPlan, setMealPlan] = useState(initialExcursion.mealPlan ?? "");
  const [accommodationComment, setAccommodationComment] = useState(
    initialExcursion.accommodationComment ?? "",
  );
  const [accommodationStars, setAccommodationStars] = useState(
    initialExcursion.accommodationStars ?? "",
  );
  const [roomTypes, setRoomTypes] = useState<string[]>(initialExcursion.roomTypes ?? []);
  const [singleSupplementAvailable, setSingleSupplementAvailable] = useState<boolean | null>(
    initialExcursion.singleSupplementAvailable ?? null,
  );
  const [singleSupplementPrice, setSingleSupplementPrice] = useState(
    initialExcursion.singleSupplementPrice === null
      ? ""
      : String(initialExcursion.singleSupplementPrice),
  );
  const [mealDetails, setMealDetails] = useState(initialExcursion.mealDetails ?? "");
  // Tour logistics
  const [tourKind, setTourKind] = useState<string | null>(initialExcursion.tourKind ?? null);
  const [transportModes, setTransportModes] = useState<string[]>(
    initialExcursion.transportModes ?? [],
  );
  const [departureMode, setDepartureMode] = useState<string | null>(
    initialExcursion.departureMode ?? null,
  );
  const [arrivalInfo, setArrivalInfo] = useState(initialExcursion.arrivalInfo ?? "");
  const [departureInfo, setDepartureInfo] = useState(initialExcursion.departureInfo ?? "");
  // Safety & documents
  const [documentsRequired, setDocumentsRequired] = useState<string[]>(
    initialExcursion.documentsRequired ?? [],
  );
  const [insuranceIncluded, setInsuranceIncluded] = useState<boolean | null>(
    initialExcursion.insuranceIncluded ?? null,
  );
  const [insuranceComment, setInsuranceComment] = useState(initialExcursion.insuranceComment ?? "");
  const [equipmentProvided, setEquipmentProvided] = useState<string[]>(
    initialExcursion.equipmentProvided ?? [],
  );
  const [safetyInfo, setSafetyInfo] = useState(initialExcursion.safetyInfo ?? "");
  const [routeConditions, setRouteConditions] = useState(initialExcursion.routeConditions ?? "");
  const [departureDates, setDepartureDates] = useState<DepartureDateItem[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSaveInitRef = useRef(false);
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const newFormatInputRef = useRef<HTMLInputElement | null>(null);
  const newLanguageInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isResolvingLocationFromMap, setIsResolvingLocationFromMap] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isTour = isTourOffer(offerType);
  const showAccommodationBlock = requiresAccommodationBlock({
    offerType,
    durationNights:
      isTour && tourDurationMode === "days" && durationNights.trim()
        ? Number(durationNights)
        : null,
    accommodationProvided,
  });
  const showSafetyBlock = requiresSafetyBlock({ tourKind, transportModes });
  const showTourLogistics = isTour;
  const sectionPhotoFieldConfigs = useMemo(
    () => getSectionPhotoFieldConfigs({ isTour, showAccommodationBlock }),
    [isTour, showAccommodationBlock],
  );
  const reusableSectionPhotoLibrary = useMemo(
    () =>
      Array.from(
        new Set([
          ...photoUrls,
          ...collectExcursionSectionPhotoUrls(sectionPhotoGroups),
          ...normalizedItineraryDays.flatMap((day) => getItineraryDayPhotoUrls(day)),
          ...timeline.flatMap((step) => getTimelineStepPhotoUrls(step)),
        ]),
      ),
    [normalizedItineraryDays, photoUrls, sectionPhotoGroups, timeline],
  );
  const publicCardPhotoCount = reusableSectionPhotoLibrary.length;

  const activeScheduleDays = useMemo(
    () => weekdayOrder.filter((day) => daySchedule[day].enabled),
    [daySchedule],
  );

  const isScheduleConfigValid = useMemo(() => {
    if (activeScheduleDays.length === 0) {
      return false;
    }

    if (!isYearRound) {
      if (!seasonDateFrom || !seasonDateTo || seasonDateTo < seasonDateFrom) {
        return false;
      }
    }

    return activeScheduleDays.every((day) => {
      const item = daySchedule[day];
      const fromMinutes = timeToMinutes(item.from);
      const toMinutes = timeToMinutes(item.to);
      return fromMinutes !== null && toMinutes !== null && toMinutes > fromMinutes;
    });
  }, [activeScheduleDays, daySchedule, isYearRound, seasonDateFrom, seasonDateTo]);

  const websiteFaviconUrl = useMemo(() => buildWebsiteFaviconUrl(websiteUrl), [websiteUrl]);
  const shouldShowWebsiteFavicon = Boolean(
    websiteFaviconUrl && websiteFaviconUrl !== failedWebsiteFaviconUrl,
  );

  useEffect(() => {
    setTagOptions((prev) => {
      const next = [...prev];
      for (const tag of tags) {
        if (!next.some((item) => item.toLowerCase() === tag.toLowerCase())) {
          next.push(tag);
        }
      }
      return next;
    });
  }, [tags]);

  useEffect(() => {
    if (!isAddingTag) {
      return;
    }
    newTagInputRef.current?.focus();
  }, [isAddingTag]);

  useEffect(() => {
    if (!isAddingFormat) {
      return;
    }
    newFormatInputRef.current?.focus();
  }, [isAddingFormat]);

  useEffect(() => {
    if (!isAddingLanguage) {
      return;
    }
    newLanguageInputRef.current?.focus();
  }, [isAddingLanguage]);

  useEffect(() => {
    setLanguageOptions((prev) => {
      const next = [...prev];
      for (const codeValue of languageCodes) {
        const code = normalizeLanguageCode(codeValue);
        if (!code) {
          continue;
        }
        if (!next.some((item) => item.code === code)) {
          next.push({ code, label: code.toUpperCase() });
        }
      }
      return next;
    });
  }, [languageCodes]);

  useEffect(() => {
    const current = formatOptions.find((item) => item.id === selectedFormatOptionId);
    if (current && current.value === excursionFormat) {
      return;
    }

    const fallback =
      formatOptions.find((item) => item.value === excursionFormat) ?? formatOptions[0];
    if (fallback && fallback.id !== selectedFormatOptionId) {
      setSelectedFormatOptionId(fallback.id);
    }
  }, [excursionFormat, formatOptions, selectedFormatOptionId]);

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoadingScheduleRules(true);

    const loadScheduleRules = async () => {
      try {
        const response = await fetch(`/api/excursions/${initialExcursion.id}/schedule-rules`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as ScheduleRulesResponse;
        const nextClosedDates = new Set<string>();
        let nextScheduleComment = "";

        for (const exception of body.exceptions ?? []) {
          if (exception.isClosed) {
            nextClosedDates.add(exception.date);
          }

          const normalizedNote = exception.notes?.trim();
          if (!nextScheduleComment && normalizedNote) {
            nextScheduleComment = normalizedNote;
          }
        }

        setAdditionalClosedDates(normalizeIsoDateList([...nextClosedDates]));
        setScheduleComment(nextScheduleComment);

        if (!body.rules || body.rules.length === 0) {
          return;
        }

        const nextDaySchedule = createDefaultDaySchedule();
        let nextSeasonDateFrom = "";
        let nextSeasonDateTo = "";
        let hasSeason = false;

        for (const rule of body.rules) {
          if (rule.dateFrom) {
            nextSeasonDateFrom = nextSeasonDateFrom || rule.dateFrom;
            hasSeason = true;
          }
          if (rule.dateTo) {
            nextSeasonDateTo = nextSeasonDateTo || rule.dateTo;
            hasSeason = true;
          }

          const firstStartTime = rule.timeStarts[0] ?? "10:00";
          const endTime = addMinutesToTime(firstStartTime, rule.durationMinutes);
          for (const dayValue of rule.weekdays) {
            const day = normalizeWeekday(dayValue);
            if (day === null) {
              continue;
            }

            nextDaySchedule[day] = {
              enabled: true,
              from: firstStartTime,
              to: endTime,
            };
          }
        }

        setDaySchedule(nextDaySchedule);
        setIsYearRound(!hasSeason);
        setSeasonDateFrom(nextSeasonDateFrom);
        setSeasonDateTo(nextSeasonDateTo);
        const firstActiveDay = weekdayOrder.find((day) => nextDaySchedule[day].enabled);
        if (firstActiveDay !== undefined) {
          setBulkTimeFrom(nextDaySchedule[firstActiveDay].from);
          setBulkTimeTo(nextDaySchedule[firstActiveDay].to);
        }
        const summary = buildScheduleSummary({
          isYearRound: !hasSeason,
          seasonDateFrom: nextSeasonDateFrom,
          seasonDateTo: nextSeasonDateTo,
          daySchedule: nextDaySchedule,
          additionalClosedDates: normalizeIsoDateList([...nextClosedDates]),
          scheduleComment: nextScheduleComment,
        });
        if (summary) {
          setScheduleText(summary);
        }
      } catch {
        // Keep editor usable if rules endpoint is temporarily unavailable.
      } finally {
        setIsLoadingScheduleRules(false);
      }
    };

    void loadScheduleRules();

    return () => {
      abortController.abort();
    };
  }, [initialExcursion.id]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadSessions = async () => {
      try {
        const response = await fetch(`/api/excursions/${initialExcursion.id}/sessions`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as SessionsResponse;
        setDepartureDates((body.items ?? []).map(toDepartureDateItem));
      } catch {
        // Keep the editor responsive if session loading fails temporarily.
      }
    };

    void loadSessions();

    return () => {
      abortController.abort();
    };
  }, [initialExcursion.id]);

  // --- Autosave (debounced, 2s) ---
  const buildAutoSavePayload = useCallback((): Record<string, unknown> => {
    const selectedLocation = crimeaLocations.find((loc) => loc.id === locationId);
    const resolvedLocationName = selectedLocation?.name ?? locationInput.trim();
    const regularScheduleSummary = buildScheduleSummary({
      isYearRound,
      seasonDateFrom,
      seasonDateTo,
      daySchedule,
      additionalClosedDates,
      scheduleComment,
    });
    const normalizedDescription = normalizeNullableText(description);
    const normalizedShortDescription = buildShortDescription(description);
    const parsedDurationMinutes = durationMinutes.trim()
      ? Number.parseInt(durationMinutes.trim(), 10) || null
      : null;
    const parsedDurationDays = durationDays.trim()
      ? Number.parseInt(durationDays.trim(), 10) || null
      : null;
    const parsedDurationNights = durationNights.trim()
      ? Number.parseInt(durationNights.trim(), 10) || null
      : null;
    const useTourDayDuration = isTour && tourDurationMode === "days";

    return {
      offerType,
      subtypeLabel: normalizeNullableText(subtypeLabel),
      title: normalizeNullableText(title),
      locationId: locationId || undefined,
      locationName: resolvedLocationName || undefined,
      mainLocationId: locationId || undefined,
      anchorLocationId: locationId || undefined,
      address: normalizeNullableText(address),
      latitude,
      longitude,
      startPoint: normalizeNullableText(startPoint),
      finishPoint: normalizeNullableText(finishPoint),
      meetingPointText: normalizeNullableText(startPoint),
      meetingLocationId: locationId || undefined,
      meetingPointLat: latitude,
      meetingPointLng: longitude,
      pickupAvailable: transferEnabled,
      description: normalizedDescription,
      shortDescription: normalizedShortDescription,
      fullDescription: normalizedDescription,
      routeDescription: normalizeNullableText(routeDescription),
      highlights,
      durationMinutes: useTourDayDuration ? null : parsedDurationMinutes,
      durationDays: useTourDayDuration ? parsedDurationDays : null,
      durationNights: useTourDayDuration ? parsedDurationNights : null,
      itineraryDays: normalizedItineraryDays,
      availabilityMode,
      availabilityNote: normalizeNullableText(availabilityNote),
      scheduleText:
        availabilityMode === ExcursionAvailabilityMode.REGULAR
          ? regularScheduleSummary
          : availabilityMode === ExcursionAvailabilityMode.ON_REQUEST
            ? normalizeNullableText(availabilityNote)
            : normalizeNullableText(scheduleText),
      priceFrom: priceFrom.trim() ? Number.parseFloat(priceFrom) || null : null,
      currency: "RUB",
      priceUnitLabel: normalizeNullableText(priceUnitLabel),
      tags,
      format: excursionFormat,
      languageCodes,
      difficulty,
      groupSizeMax: maxParticipants.trim() ? Number.parseInt(maxParticipants, 10) || null : null,
      groupSizeMin: minParticipants.trim() ? Number.parseInt(minParticipants, 10) || null : null,
      ageLimit: minAge.trim() ? Number.parseInt(minAge, 10) || null : null,
      physicalRequirements,
      whatToBring,
      instantConfirmation: false,
      minBookingNoticeHours: minBookingNoticeHours.trim()
        ? Number.parseInt(minBookingNoticeHours, 10) || null
        : null,
      hasGuideLicense,
      timeline,
      extraOptions,
      pricingTiers,
      includedItems,
      excludedItems,
      accommodationProvided,
      accommodationType: normalizeNullableText(accommodationType),
      accommodationNights: accommodationNights.trim()
        ? Number.parseInt(accommodationNights, 10) || null
        : null,
      accommodationFormat: normalizeNullableText(accommodationFormat),
      accommodationStars: normalizeNullableText(accommodationStars),
      roomTypes,
      singleSupplementAvailable,
      singleSupplementPrice: singleSupplementPrice.trim()
        ? Number.parseFloat(singleSupplementPrice) || null
        : null,
      mealPlan: normalizeNullableText(mealPlan),
      mealDetails: normalizeNullableText(mealDetails),
      accommodationComment: normalizeNullableText(accommodationComment),
      // Tour logistics
      tourKind: tourKind || null,
      transportModes,
      departureMode: departureMode || null,
      arrivalInfo: normalizeNullableText(arrivalInfo),
      departureInfo: normalizeNullableText(departureInfo),
      // Safety & documents
      documentsRequired,
      insuranceIncluded,
      insuranceComment: normalizeNullableText(insuranceComment),
      equipmentProvided,
      safetyInfo: normalizeNullableText(safetyInfo),
      routeConditions: normalizeNullableText(routeConditions),
      transferDetails: transferEnabled ? normalizeNullableText(transferDetails) : null,
      cancellationPolicyType: cancellationPolicyType || null,
      cancellationPolicy: normalizeNullableText(cancellationPolicyText),
      faqItems,
      contactFirstName: normalizeNullableText(contactFirstName),
      contactLastName: normalizeNullableText(contactLastName),
      contactPhone: normalizeNullableText(contactPhone),
      contactPhone2: normalizeNullableText(contactPhone2),
      contactEmail: normalizeNullableText(contactEmail),
      websiteUrl: normalizeNullableText(websiteUrl),
      whatsappUrl: normalizeWhatsappUrl(whatsappUrl),
      telegramUrl: normalizeTelegramProfileUrl(telegramUrl),
      vkUrl: normalizeVkProfileUrl(vkUrl),
      maxUrl: normalizeMaxProfileUrl(maxUrl),
      okUrl: normalizeOkProfileUrl(okUrl),
      photoUrls,
      sectionPhotoGroups,
      videoUrls,
    };
  }, [
    accommodationComment,
    accommodationFormat,
    accommodationNights,
    accommodationProvided,
    accommodationType,
    additionalClosedDates,
    title,
    availabilityMode,
    availabilityNote,
    daySchedule,
    durationDays,
    durationNights,
    locationId,
    locationInput,
    address,
    latitude,
    longitude,
    startPoint,
    finishPoint,
    description,
    highlights,
    normalizedItineraryDays,
    routeDescription,
    isTour,
    isYearRound,
    seasonDateFrom,
    seasonDateTo,
    scheduleComment,
    scheduleText,
    durationMinutes,
    priceFrom,
    priceUnitLabel,
    tags,
    excursionFormat,
    languageCodes,
    difficulty,
    maxParticipants,
    minParticipants,
    minAge,
    physicalRequirements,
    whatToBring,
    minBookingNoticeHours,
    hasGuideLicense,
    timeline,
    extraOptions,
    pricingTiers,
    includedItems,
    excludedItems,
    mealPlan,
    transferEnabled,
    transferDetails,
    cancellationPolicyType,
    cancellationPolicyText,
    faqItems,
    contactFirstName,
    contactLastName,
    contactPhone,
    contactPhone2,
    contactEmail,
    websiteUrl,
    whatsappUrl,
    telegramUrl,
    vkUrl,
    maxUrl,
    okUrl,
    offerType,
    photoUrls,
    sectionPhotoGroups,
    subtypeLabel,
    videoUrls,
    tourKind,
    transportModes,
    departureMode,
    arrivalInfo,
    departureInfo,
    accommodationStars,
    roomTypes,
    singleSupplementAvailable,
    singleSupplementPrice,
    mealDetails,
    documentsRequired,
    insuranceIncluded,
    insuranceComment,
    equipmentProvided,
    safetyInfo,
    routeConditions,
    tourDurationMode,
  ]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const payload = buildAutoSavePayload();
        const response = await fetch(`/api/excursions/${excursion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildAutoSavePayload]);

  // Auto-save schedule rules when schedule fields change
  useEffect(() => {
    if (!scheduleAutoSaveInitRef.current) {
      scheduleAutoSaveInitRef.current = true;
      return;
    }

    if (availabilityMode !== ExcursionAvailabilityMode.REGULAR || !isScheduleConfigValid) {
      return;
    }

    if (scheduleAutoSaveTimerRef.current) {
      clearTimeout(scheduleAutoSaveTimerRef.current);
    }

    scheduleAutoSaveTimerRef.current = setTimeout(async () => {
      const activeDays = weekdayOrder.filter((day) => daySchedule[day].enabled);
      if (activeDays.length === 0) return;

      const rules = [];
      for (const day of activeDays) {
        const item = daySchedule[day];
        const fromMinutes = timeToMinutes(item.from);
        const toMinutes = timeToMinutes(item.to);
        if (fromMinutes === null || toMinutes === null || toMinutes <= fromMinutes) return;
        rules.push({
          dateFrom: isYearRound ? null : seasonDateFrom,
          dateTo: isYearRound ? null : seasonDateTo,
          weekdays: [day],
          timeStarts: [item.from],
          durationMinutes: toMinutes - fromMinutes,
        });
      }

      const normalizedComment = normalizeNullableText(scheduleComment);
      const exceptions = normalizeIsoDateList(additionalClosedDates).map((date) => ({
        date,
        isClosed: true,
        notes: normalizedComment,
      }));

      try {
        await fetch(`/api/excursions/${excursion.id}/schedule-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleMode: "RULES", rules, exceptions }),
        });
      } catch {
        // silent - non-critical auto-save
      }
    }, 3000);

    return () => {
      if (scheduleAutoSaveTimerRef.current) {
        clearTimeout(scheduleAutoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    daySchedule,
    isYearRound,
    seasonDateFrom,
    seasonDateTo,
    additionalClosedDates,
    scheduleComment,
    availabilityMode,
    isScheduleConfigValid,
  ]);

  const isSeasonLimited = !isYearRound;

  type StepStatus = "incomplete" | "partial" | "complete";
  type StepFieldCheck = {
    label: string;
    done: boolean;
    required?: boolean;
  };
  type WizardStepState = {
    label: string;
    status: StepStatus;
    missingRequired: string[];
  };

  function getStepStatus(checks: StepFieldCheck[]): StepStatus {
    const requiredChecks = checks.filter((item) => item.required !== false);
    const completedRequired = requiredChecks.every((item) => item.done);
    const anyDone = checks.some((item) => item.done);
    if (completedRequired && anyDone) return "complete";
    if (anyDone) return "partial";
    return "incomplete";
  }

  function getMissingRequired(checks: StepFieldCheck[]): string[] {
    return checks.filter((item) => item.required !== false && !item.done).map((item) => item.label);
  }

  function buildWizardStepState(label: string, checks: StepFieldCheck[]): WizardStepState {
    return {
      label,
      status: getStepStatus(checks),
      missingRequired: getMissingRequired(checks),
    };
  }

  // Step 0: Тип и описание
  const step0Checks: StepFieldCheck[] = [
    { label: "Тип предложения", done: Boolean(offerType) },
    { label: "Название (минимум 2 символа)", done: title.trim().length >= 2 },
    { label: "Краткое описание (минимум 20 символов)", done: description.trim().length >= 20 },
    {
      label: "Категория или теги",
      done: tags.length > 0 || Boolean(subtypeLabel.trim()),
      required: false,
    },
    { label: "Вид тура", done: !isTour || Boolean(tourKind), required: false },
  ];
  // Step 1: География и маршрут
  const step1Checks: StepFieldCheck[] = [
    { label: "Выбор локации", done: Boolean(locationId) },
    { label: "Точка старта", done: Boolean(startPoint.trim()) },
    {
      label: "Адрес или координаты",
      done: Boolean(address.trim()) || (latitude !== null && longitude !== null),
      required: false,
    },
  ];
  // Step 2: Программа
  const step2Checks: StepFieldCheck[] = [
    {
      label: isTour ? "Программа тура или маршрут" : "Таймлайн или маршрут",
      done: isTour
        ? itineraryDays.length > 0 || routeDescription.trim().length >= 10
        : routeDescription.trim().length >= 10 || timeline.length >= 1,
    },
    { label: "Хайлайты", done: highlights.length > 0, required: false },
  ];
  // Step 3: Расписание и группа (merged old steps 3+4)
  const step3Checks: StepFieldCheck[] = [
    {
      label: isTour ? "Длительность тура (дни или время)" : "Длительность (от 15 минут)",
      done: isTour
        ? tourDurationMode === "days"
          ? Number(durationDays || 0) >= 1
          : Number(durationMinutes || 0) >= 15
        : Number(durationMinutes || 0) >= 15,
    },
    { label: "Режим доступности", done: Boolean(availabilityMode) },
    {
      label: "Валидная доступность",
      done:
        availabilityMode === ExcursionAvailabilityMode.REGULAR
          ? isScheduleConfigValid
          : availabilityMode === ExcursionAvailabilityMode.DATED
            ? departureDates.length > 0
            : availabilityNote.trim().length >= 2,
    },
    { label: "Формат", done: Boolean(excursionFormat), required: false },
    { label: "Язык", done: languageCodes.length > 0, required: false },
  ];
  // Step 4: Цена и условия (merged old steps 5+6)
  const step4Checks: StepFieldCheck[] = [
    { label: "Цена от (больше 0)", done: Number(priceFrom || 0) > 0 },
    { label: "Единица цены", done: isTour ? priceUnitLabel.trim().length >= 2 : true },
    { label: "Что включено", done: includedItems.length > 0, required: false },
  ];
  // Step 5: Медиа и контакты (merged old steps 7+8)
  const step5Checks: StepFieldCheck[] = [
    {
      label: `Фотографии (минимум ${excursionPhotoMinForModeration})`,
      done: publicCardPhotoCount >= excursionPhotoMinForModeration,
    },
    {
      label: "Контакты (имя, фамилия, телефон)",
      done:
        contactFirstName.trim().length >= 2 &&
        contactLastName.trim().length >= 2 &&
        contactPhone.trim().length >= 10,
    },
    {
      label: "Отправка на модерацию",
      done:
        excursion.status === ExcursionStatus.PENDING_MODERATION ||
        excursion.status === ExcursionStatus.PUBLISHED,
      required: false,
    },
  ];

  const wizardStepStates: WizardStepState[] = [
    buildWizardStepState("Тип и описание", step0Checks),
    buildWizardStepState("География", step1Checks),
    buildWizardStepState("Программа", step2Checks),
    buildWizardStepState("Расписание и группа", step3Checks),
    buildWizardStepState("Цена и условия", step4Checks),
    buildWizardStepState("Медиа и контакты", step5Checks),
  ];

  const wizardSteps = wizardStepStates.map((step) => ({
    label: step.label,
    status: step.status,
  }));

  const missingRequiredByStep = wizardStepStates
    .map((step, index) => ({
      index,
      label: step.label,
      items: step.missingRequired,
    }))
    .filter((step) => step.items.length > 0);

  function openMapDialog() {
    setMapDraftLatitude(latitude);
    setMapDraftLongitude(longitude);
    setMapDraftAddress(address);
    setMapDraftLocationName(locationInput);
    setMapDraftLocationId(locationId);
    setIsMapDialogOpen(true);
    setError("");
    setSuccess("");
  }

  function closeMapDialog() {
    setIsMapDialogOpen(false);
  }

  function saveMapSelection() {
    if (mapDraftLatitude === null || mapDraftLongitude === null) {
      setError("Выберите точку на карте, затем сохраните изменения.");
      setSuccess("");
      return;
    }

    setLatitude(mapDraftLatitude);
    setLongitude(mapDraftLongitude);
    setAddress(mapDraftAddress.trim());

    const normalizedLocationName = mapDraftLocationName.trim();
    const normalizedLocationId = mapDraftLocationId.trim();

    if (normalizedLocationName) {
      setLocationInput(normalizedLocationName);
    }

    if (normalizedLocationId) {
      setLocationId(normalizedLocationId);
    }

    if (!startPoint.trim() && mapDraftAddress.trim()) {
      setStartPoint(mapDraftAddress.trim());
    }

    setIsMapDialogOpen(false);
    setError("");
    setSuccess("");
  }

  function updateTourDurationHours(value: string) {
    setTourDurationMode("time");
    setDurationHours(value);
    setDurationMinutes(buildDurationMinutesFromInputs(value, durationClockMinutes));
  }

  function updateTourDurationClockMinutes(value: string) {
    setTourDurationMode("time");
    setDurationClockMinutes(value);
    setDurationMinutes(buildDurationMinutesFromInputs(durationHours, value));
  }

  function applyExcursion(item: SerializedExcursion) {
    setExcursion(item);
    setOfferType(item.offerType);
    setSubtypeLabel(item.subtypeLabel ?? "");
    setTitle(item.title ?? "");
    setLocationId(item.locationId ?? "");
    setLocationInput(item.locationName ?? "");
    setAddress(item.address ?? "");
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setMapDraftLatitude(item.latitude);
    setMapDraftLongitude(item.longitude);
    setMapDraftAddress(item.address ?? "");
    setMapDraftLocationName(item.locationName ?? "");
    setMapDraftLocationId(item.locationId ?? "");
    setStartPoint(item.startPoint ?? "");
    setFinishPoint(item.finishPoint ?? "");
    setDescription(item.description ?? item.fullDescription ?? item.shortDescription ?? "");
    setRouteDescription(item.routeDescription ?? "");
    setHighlights(item.highlights ?? []);
    setTourDurationMode(resolveTourDurationMode(item));
    setDurationMinutes(item.durationMinutes === null ? "" : String(item.durationMinutes));
    const nextDurationParts = splitDurationMinutesForInputs(item.durationMinutes);
    setDurationHours(nextDurationParts.hours);
    setDurationClockMinutes(nextDurationParts.minutes);
    setDurationDays(item.durationDays === null ? "" : String(item.durationDays));
    setDurationNights(item.durationNights === null ? "" : String(item.durationNights));
    setItineraryDays(item.itineraryDays ?? []);
    setItineraryItemLabel(resolveItineraryItemLabel(item.itineraryDays?.[0]?.itemLabel));
    setScheduleText(item.scheduleText ?? "");
    setAvailabilityMode(item.availabilityMode);
    setAvailabilityNote(item.availabilityNote ?? "");
    setPriceFrom(item.priceFrom === null ? "" : String(item.priceFrom));
    setContactFirstName(item.contactFirstName ?? "");
    setContactLastName(item.contactLastName ?? "");
    setContactPhone(item.contactPhone ?? "");
    setContactPhone2(item.contactPhone2 ?? "");
    setContactEmail(item.contactEmail ?? "");
    setWebsiteUrl(item.websiteUrl ?? "");
    setWhatsappUrl(item.whatsappUrl ?? "");
    setTelegramUrl(item.telegramUrl ?? "");
    setVkUrl(item.vkUrl ?? "");
    setMaxUrl(item.maxUrl ?? "");
    setOkUrl(item.okUrl ?? "");
    setShowContactEmail(Boolean(item.contactEmail));
    setShowWebsite(Boolean(item.websiteUrl));
    setShowWhatsapp(Boolean(item.whatsappUrl));
    setShowTelegram(Boolean(item.telegramUrl));
    setShowVk(Boolean(item.vkUrl));
    setShowMax(Boolean(item.maxUrl));
    setShowOk(Boolean(item.okUrl));
    setPhotoUrls(item.photoUrls);
    setSectionPhotoGroups(normalizeExcursionSectionPhotoGroups(item.sectionPhotoGroups));
    setVideoUrls(item.videoUrls);
    setTags(item.tags ?? []);
    setExcursionFormat(normalizeExcursionFormat(item.format));
    setLanguageCodes(
      item.languageCodes?.length
        ? item.languageCodes.map((code) => normalizeLanguageCode(code)).filter(Boolean)
        : ["ru"],
    );
    setDifficulty(item.difficulty);
    setMaxParticipants(item.groupSizeMax === null ? "" : String(item.groupSizeMax));
    setMinAge(item.ageLimit === null ? "" : String(item.ageLimit));
    setMinBookingNoticeHours(
      item.minBookingNoticeHours === null ? "" : String(item.minBookingNoticeHours),
    );
    setTimeline(item.timeline ?? []);
    setExtraOptions(item.extraOptions ?? []);
    setPricingTiers(item.pricingTiers ?? []);
    setIncludedItems(item.includedItems ?? []);
    setExcludedItems(item.excludedItems ?? []);
    setTransferDetails(item.transferDetails ?? "");
    setTransferEnabled(Boolean(item.transferDetails || item.pickupAvailable));
    setPriceUnitLabel(item.priceUnitLabel ?? "");
    setAccommodationProvided(item.accommodationProvided);
    setAccommodationType(item.accommodationType ?? "");
    setAccommodationNights(
      item.accommodationNights === null ? "" : String(item.accommodationNights),
    );
    setAccommodationFormat(item.accommodationFormat ?? "");
    setAccommodationStars(item.accommodationStars ?? "");
    setRoomTypes(item.roomTypes ?? []);
    setSingleSupplementAvailable(item.singleSupplementAvailable ?? null);
    setSingleSupplementPrice(
      item.singleSupplementPrice === null ? "" : String(item.singleSupplementPrice),
    );
    setMealPlan(item.mealPlan ?? "");
    setMealDetails(item.mealDetails ?? "");
    setAccommodationComment(item.accommodationComment ?? "");
    setTourKind(item.tourKind ?? null);
    setTransportModes(item.transportModes ?? []);
    setDepartureMode(item.departureMode ?? null);
    setArrivalInfo(item.arrivalInfo ?? "");
    setDepartureInfo(item.departureInfo ?? "");
    setDocumentsRequired(item.documentsRequired ?? []);
    setInsuranceIncluded(item.insuranceIncluded ?? null);
    setInsuranceComment(item.insuranceComment ?? "");
    setEquipmentProvided(item.equipmentProvided ?? []);
    setSafetyInfo(item.safetyInfo ?? "");
    setRouteConditions(item.routeConditions ?? "");
    setCancellationPolicyType(item.cancellationPolicyType ?? "");
    setCancellationPolicyText(item.cancellationPolicy ?? "");
    setFaqItems(item.faqItems ?? []);
  }

  async function patchExcursion(
    payload: Record<string, unknown>,
    options: { applyResponse?: boolean } = {},
  ): Promise<SerializedExcursion | null> {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/excursions/${excursion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as UpdateExcursionResponse;
      if (!response.ok || !body.item) {
        setError(body.error ?? "Не удалось сохранить программу");
        return null;
      }

      if (options.applyResponse === false) {
        setExcursion(body.item);
      } else {
        applyExcursion(body.item);
      }
      return body.item;
    } finally {
      setIsSaving(false);
    }
  }

  function updateWeekdaySchedule(day: WeekdayId, patch: Partial<WeekdaySchedule>) {
    setDaySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        ...patch,
      },
    }));
  }

  function setScheduleDaysEnabled(days: WeekdayId[]) {
    const daySet = new Set<WeekdayId>(days);
    setDaySchedule((prev) => {
      const next = { ...prev };
      for (const day of weekdayOrder) {
        next[day] = {
          ...next[day],
          enabled: daySet.has(day),
        };
      }
      return next;
    });
    setError("");
  }

  function clearScheduleDays() {
    setDaySchedule((prev) => {
      const next = { ...prev };
      for (const day of weekdayOrder) {
        next[day] = {
          ...next[day],
          enabled: false,
        };
      }
      return next;
    });
    setError("");
  }

  function isSchedulePresetActive(days: WeekdayId[]): boolean {
    const daySet = new Set<WeekdayId>(days);
    return weekdayOrder.every((day) => daySchedule[day].enabled === daySet.has(day));
  }

  function removeClosedDate(value: string) {
    setAdditionalClosedDates((prev) => prev.filter((item) => item !== value));
  }

  function buildScheduleRulesPayload(): Record<string, unknown> | null {
    const activeDays = weekdayOrder.filter((day) => daySchedule[day].enabled);
    if (activeDays.length === 0) {
      setError("Выберите минимум один день недели в расписании");
      return null;
    }

    if (!isYearRound) {
      if (!seasonDateFrom || !seasonDateTo) {
        setError("Для сезонного расписания укажите диапазон дат");
        return null;
      }
      if (seasonDateTo < seasonDateFrom) {
        setError("Дата окончания сезона не может быть раньше даты начала");
        return null;
      }
    }

    const rules: Array<{
      dateFrom: string | null;
      dateTo: string | null;
      weekdays: number[];
      timeStarts: string[];
      durationMinutes: number;
    }> = [];

    for (const day of activeDays) {
      const item = daySchedule[day];
      const fromMinutes = timeToMinutes(item.from);
      const toMinutes = timeToMinutes(item.to);
      if (fromMinutes === null || toMinutes === null || toMinutes <= fromMinutes) {
        setError(`Проверьте время в строке «${weekdayLabels[day]}»`);
        return null;
      }

      rules.push({
        dateFrom: isYearRound ? null : seasonDateFrom,
        dateTo: isYearRound ? null : seasonDateTo,
        weekdays: [day],
        timeStarts: [item.from],
        durationMinutes: toMinutes - fromMinutes,
      });
    }

    const normalizedComment = normalizeNullableText(scheduleComment);
    const exceptions = normalizeIsoDateList(additionalClosedDates).map((date) => ({
      date,
      isClosed: true,
      notes: normalizedComment,
    }));

    return {
      scheduleMode: "RULES",
      rules,
      exceptions,
    };
  }

  function buildSessionsPayload(): Record<string, unknown> | null {
    if (departureDates.length === 0) {
      setError("Добавьте хотя бы один заезд");
      return null;
    }

    const sessions = departureDates.map((item, index) => {
      const startAt = buildSessionStartIso(item);
      if (!startAt) {
        setError(`Заполните дату и время старта для заезда ${index + 1}`);
        return null;
      }

      const endAt = buildSessionEndIso(item);
      const capacity = item.capacity.trim() ? Number.parseInt(item.capacity, 10) : null;
      if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) {
        setError(`Количество мест в заезде ${index + 1} должно быть больше 0`);
        return null;
      }

      const priceOverride = item.priceOverride.trim()
        ? Number.parseFloat(item.priceOverride)
        : null;
      if (priceOverride !== null && (!Number.isFinite(priceOverride) || priceOverride < 0)) {
        setError(`Цена в заезде ${index + 1} указана некорректно`);
        return null;
      }

      return {
        startAt,
        endAt,
        capacity,
        priceOverride,
      };
    });

    if (sessions.some((item) => item === null)) {
      return null;
    }

    return {
      sessions,
    };
  }

  async function saveSessions(): Promise<boolean> {
    const payload = buildSessionsPayload();
    if (!payload) {
      return false;
    }

    setError("");
    setIsSavingSchedule(true);

    try {
      const response = await fetch(`/api/excursions/${excursion.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось сохранить заезды");
        return false;
      }

      const firstStart = departureDates
        .map((item) => item.startDate)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))[0];
      if (firstStart) {
        setScheduleText(`Ближайший заезд ${formatIsoToDayMonthYear(firstStart)}`);
      }

      return true;
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function saveScheduleRules(): Promise<boolean> {
    if (availabilityMode === ExcursionAvailabilityMode.DATED) {
      return saveSessions();
    }

    if (availabilityMode === ExcursionAvailabilityMode.ON_REQUEST) {
      setScheduleText(availabilityNote.trim() || "По запросу");
      return true;
    }

    const payload = buildScheduleRulesPayload();
    if (!payload) {
      return false;
    }

    setError("");
    setIsSavingSchedule(true);

    try {
      const response = await fetch(`/api/excursions/${excursion.id}/schedule-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось сохранить правила расписания");
        return false;
      }

      const summary = buildScheduleSummary({
        isYearRound,
        seasonDateFrom,
        seasonDateTo,
        daySchedule,
        additionalClosedDates,
        scheduleComment,
      });
      if (summary) {
        setScheduleText(summary);
      }

      return true;
    } finally {
      setIsSavingSchedule(false);
    }
  }

  function buildFormPayload(): Record<string, unknown> | null {
    const normalizedTitle = title.trim();
    if (normalizedTitle.length < 2) {
      setError("Название программы должно содержать минимум 2 символа");
      return null;
    }

    if (!locationId) {
      setError("Выберите локацию Крыма из подсказок");
      return null;
    }

    const parsedDuration = durationMinutes.trim()
      ? Number.parseInt(durationMinutes.trim(), 10)
      : null;
    const parsedDurationDays = durationDays.trim()
      ? Number.parseInt(durationDays.trim(), 10)
      : null;
    const parsedDurationNights = durationNights.trim()
      ? Number.parseInt(durationNights.trim(), 10)
      : null;

    if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration < 15)) {
      setError(
        isTour
          ? "Если указываете время тура, оно должно быть минимум 15 минут"
          : "Длительность экскурсии должна быть минимум 15 минут",
      );
      return null;
    }

    if (isTour && tourDurationMode === "time" && parsedDuration === null) {
      setError("Для почасового тура укажите длительность в часах и минутах");
      return null;
    }

    if (isTour && tourDurationMode === "days") {
      if (
        parsedDurationDays !== null &&
        (!Number.isFinite(parsedDurationDays) || parsedDurationDays < 1)
      ) {
        setError("Количество дней тура указано некорректно");
        return null;
      }
      if (parsedDurationDays === null) {
        setError("Для многодневного тура укажите количество дней");
        return null;
      }
      if (
        parsedDurationNights !== null &&
        (!Number.isFinite(parsedDurationNights) || parsedDurationNights < 0)
      ) {
        setError("Количество ночей указано некорректно");
        return null;
      }
      if (
        parsedDurationNights !== null &&
        parsedDurationNights > 0 &&
        parsedDurationDays === null
      ) {
        setError("Если указываете ночи, добавьте количество дней тура");
        return null;
      }
      if (
        parsedDurationNights !== null &&
        parsedDurationDays !== null &&
        parsedDurationNights > parsedDurationDays
      ) {
        setError("Ночей не может быть больше, чем дней");
        return null;
      }
    }

    const parsedPrice = priceFrom.trim() ? Number.parseFloat(priceFrom.trim()) : null;
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setError("Цена должна быть больше 0");
      return null;
    }

    if (isTour && !priceUnitLabel.trim()) {
      setError("Для тура укажите единицу цены, например «чел» или «тур»");
      return null;
    }

    if ((latitude === null) !== (longitude === null)) {
      setError("Для карты нужно указать и широту, и долготу");
      return null;
    }

    const selectedLocation = crimeaLocations.find((location) => location.id === locationId);
    const resolvedLocationName = selectedLocation?.name ?? locationInput.trim();
    const scheduleSummary = buildScheduleSummary({
      isYearRound,
      seasonDateFrom,
      seasonDateTo,
      daySchedule,
      additionalClosedDates,
      scheduleComment,
    });

    if (availabilityMode === ExcursionAvailabilityMode.REGULAR) {
      if (!scheduleSummary || !isScheduleConfigValid) {
        setError("Заполните блок расписания: дни, время, период и корректные дополнительные даты");
        return null;
      }
    }

    if (availabilityMode === ExcursionAvailabilityMode.DATED && departureDates.length === 0) {
      setError("Добавьте хотя бы один заезд");
      return null;
    }

    if (
      availabilityMode === ExcursionAvailabilityMode.ON_REQUEST &&
      availabilityNote.trim().length < 2
    ) {
      setError("Добавьте комментарий для режима «по запросу»");
      return null;
    }

    const normalizedAddress = normalizeNullableText(address);
    const normalizedStartPoint = normalizeNullableText(startPoint);
    const normalizedFinishPoint = normalizeNullableText(finishPoint);
    const normalizedDescription = normalizeNullableText(description);
    const normalizedRouteDescription = normalizeNullableText(routeDescription);
    const normalizedSubtypeLabel = normalizeNullableText(subtypeLabel);
    const normalizedPriceUnitLabel = normalizeNullableText(priceUnitLabel);
    const normalizedAvailabilityNote = normalizeNullableText(availabilityNote);
    const normalizedAccommodationType = normalizeNullableText(accommodationType);
    const normalizedAccommodationFormat = normalizeNullableText(accommodationFormat);
    const normalizedMealPlan = normalizeNullableText(mealPlan);
    const normalizedAccommodationComment = normalizeNullableText(accommodationComment);
    const parsedAccommodationNights = accommodationNights.trim()
      ? Number.parseInt(accommodationNights, 10)
      : null;

    if (normalizedDescription && normalizedDescription.length < 20) {
      setError("Описание должно содержать минимум 20 символов");
      return null;
    }

    if (normalizedRouteDescription && normalizedRouteDescription.length < 10) {
      setError("Маршрут должен содержать минимум 10 символов");
      return null;
    }

    const normalizedShortDescription = buildShortDescription(description);

    if (isTour && itineraryDays.length === 0 && routeDescription.trim().length < 10) {
      setError("Для тура заполните программу по пунктам или опишите маршрут");
      return null;
    }

    if (!isTour && timeline.length === 0 && routeDescription.trim().length < 10) {
      setError("Для экскурсии добавьте таймлайн или текстовый маршрут");
      return null;
    }

    if (highlights.some((item) => item.trim().length < 2)) {
      setError("В блоке «Что вас ждёт» все пункты должны быть осмысленными");
      return null;
    }

    const useTourDayDuration = isTour && tourDurationMode === "days";
    const payloadDurationMinutes = useTourDayDuration ? null : parsedDuration;
    const payloadDurationDays = useTourDayDuration ? parsedDurationDays : null;
    const payloadDurationNights = useTourDayDuration ? parsedDurationNights : null;

    return {
      offerType,
      subtypeLabel: normalizedSubtypeLabel,
      title: normalizedTitle,
      locationId,
      locationName: resolvedLocationName,
      mainLocationId: locationId,
      anchorLocationId: locationId,
      address: normalizedAddress,
      latitude,
      longitude,
      startPoint: normalizedStartPoint,
      finishPoint: normalizedFinishPoint,
      meetingPointText: normalizedStartPoint,
      meetingLocationId: locationId || null,
      meetingPointLat: latitude,
      meetingPointLng: longitude,
      pickupAvailable: transferEnabled,
      description: normalizedDescription,
      shortDescription: normalizedShortDescription,
      fullDescription: normalizedDescription,
      routeDescription: normalizedRouteDescription,
      highlights,
      durationMinutes: payloadDurationMinutes,
      durationDays: payloadDurationDays,
      durationNights: payloadDurationNights,
      itineraryDays: isTour ? normalizedItineraryDays : [],
      scheduleText:
        availabilityMode === ExcursionAvailabilityMode.REGULAR
          ? scheduleSummary
          : availabilityMode === ExcursionAvailabilityMode.DATED
            ? normalizeNullableText(scheduleText)
            : normalizedAvailabilityNote,
      availabilityMode,
      availabilityNote: normalizedAvailabilityNote,
      priceFrom: parsedPrice,
      currency: "RUB",
      priceUnitLabel: normalizedPriceUnitLabel,
      tags,
      format: excursionFormat,
      languageCodes,
      difficulty,
      groupSizeMax: maxParticipants.trim() ? Number.parseInt(maxParticipants, 10) || null : null,
      groupSizeMin: minParticipants.trim() ? Number.parseInt(minParticipants, 10) || null : null,
      ageLimit: minAge.trim() ? Number.parseInt(minAge, 10) || null : null,
      physicalRequirements,
      whatToBring,
      instantConfirmation: false,
      minBookingNoticeHours: minBookingNoticeHours.trim()
        ? Number.parseInt(minBookingNoticeHours, 10) || null
        : null,
      hasGuideLicense,
      timeline: isTour ? [] : timeline,
      extraOptions,
      pricingTiers,
      includedItems,
      excludedItems,
      accommodationProvided,
      accommodationType: normalizedAccommodationType,
      accommodationNights: parsedAccommodationNights,
      accommodationFormat: normalizedAccommodationFormat,
      mealPlan: normalizedMealPlan,
      accommodationComment: normalizedAccommodationComment,
      transferDetails: transferEnabled ? normalizeNullableText(transferDetails) : null,
      cancellationPolicyType: cancellationPolicyType || null,
      cancellationPolicy: normalizeNullableText(cancellationPolicyText),
      faqItems,
      contactFirstName: normalizeNullableText(contactFirstName),
      contactLastName: normalizeNullableText(contactLastName),
      contactPhone: normalizeNullableText(contactPhone),
      contactPhone2: normalizeNullableText(contactPhone2),
      contactEmail: normalizeNullableText(contactEmail),
      websiteUrl: normalizeNullableText(websiteUrl),
      whatsappUrl: normalizeWhatsappUrl(whatsappUrl),
      telegramUrl: normalizeTelegramProfileUrl(telegramUrl),
      vkUrl: normalizeVkProfileUrl(vkUrl),
      maxUrl: normalizeMaxProfileUrl(maxUrl),
      okUrl: normalizeOkProfileUrl(okUrl),
      photoUrls,
      sectionPhotoGroups,
      videoUrls,
      // Tour logistics
      tourKind: isTour && tourKind ? normalizeNullableText(tourKind) : null,
      transportModes: isTour ? transportModes : [],
      departureMode: isTour && departureMode ? normalizeNullableText(departureMode) : null,
      arrivalInfo: isTour ? normalizeNullableText(arrivalInfo) : null,
      departureInfo: isTour ? normalizeNullableText(departureInfo) : null,
      // Accommodation (enhanced)
      accommodationStars: accommodationProvided ? normalizeNullableText(accommodationStars) : null,
      roomTypes: accommodationProvided ? roomTypes : [],
      singleSupplementAvailable: accommodationProvided ? singleSupplementAvailable : null,
      singleSupplementPrice:
        accommodationProvided && singleSupplementAvailable && singleSupplementPrice.trim()
          ? Number.parseFloat(singleSupplementPrice) || null
          : null,
      // Meals
      mealDetails: isTour ? normalizeNullableText(mealDetails) : null,
      // Safety & documents
      documentsRequired: isTour ? documentsRequired : [],
      insuranceIncluded: isTour ? insuranceIncluded : null,
      insuranceComment:
        isTour && insuranceIncluded ? normalizeNullableText(insuranceComment) : null,
      equipmentProvided: showSafetyBlock ? equipmentProvided : [],
      safetyInfo: showSafetyBlock ? normalizeNullableText(safetyInfo) : null,
      routeConditions: showSafetyBlock ? normalizeNullableText(routeConditions) : null,
    };
  }

  async function submitForModerationFromPayment(): Promise<boolean> {
    if (publicCardPhotoCount < excursionPhotoMinForModeration) {
      setError(
        `Добавьте минимум ${excursionPhotoMinForModeration} фото перед отправкой на модерацию`,
      );
      setSuccess("");
      return false;
    }

    const payload = buildFormPayload();
    if (!payload) {
      return false;
    }

    const scheduleSaved = await saveScheduleRules();
    if (!scheduleSaved) {
      return false;
    }

    const ok = await patchExcursion({
      ...payload,
      status: ExcursionStatus.PENDING_MODERATION,
    });

    if (!ok) {
      return false;
    }

    setSuccess("Программа отправлена на модерацию");
    router.refresh();
    return true;
  }

  async function prepareExcursionForPayment(): Promise<boolean> {
    const payload = buildFormPayload();
    if (!payload) {
      return false;
    }

    const scheduleSaved = await saveScheduleRules();
    if (!scheduleSaved) {
      return false;
    }

    const saved = await patchExcursion(payload);
    return saved !== null;
  }

  async function deleteExcursion() {
    if (!window.confirm("Удалить программу? Это действие нельзя отменить.")) {
      return;
    }

    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/excursions/${excursion.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось удалить программу");
        return;
      }

      router.push(listHref);
    } finally {
      setIsDeleting(false);
    }
  }

  async function uploadPhotos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setIsUploadingPhotos(true);

    try {
      let currentPhotoCount = photoUrls.length;

      for (const file of Array.from(fileList)) {
        const uploadType = detectSupportedPhotoUploadType({
          mimeType: file.type,
          fileName: file.name,
        });
        if (!uploadType) {
          setError(getUnsupportedAccommodationPhotoFormatError());
          continue;
        }

        if (
          file.size >
          getAccommodationPhotoUploadSizeLimitBytes({
            mimeType: file.type,
            fileName: file.name,
          })
        ) {
          setError(getAccommodationPhotoUploadSizeError());
          continue;
        }

        if (currentPhotoCount >= excursionPhotoLimit) {
          setError(`Максимум ${excursionPhotoLimit} фото для программы`);
          break;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/excursions/${excursion.id}/photos`, {
          method: "POST",
          body: formData,
        });

        const body = (await response.json()) as UpdateExcursionResponse;

        if (!response.ok || !body.item) {
          setError(body.error ?? "Не удалось загрузить фото");
          continue;
        }

        applyExcursion(body.item);
        currentPhotoCount = body.item.photoUrls.length;
      }

      router.refresh();
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  async function removePhoto(photoIndex: number) {
    const nextPhotoUrls = photoUrls.filter((_, index) => index !== photoIndex);
    if (nextPhotoUrls.length === photoUrls.length) {
      return;
    }

    const ok = await patchExcursion({ photoUrls: nextPhotoUrls });
    if (ok) {
      setSuccess("Фото удалено");
    }
  }

  async function movePhoto(photoIndex: number, direction: -1 | 1) {
    const nextPhotoIndex = photoIndex + direction;
    if (nextPhotoIndex < 0 || nextPhotoIndex >= photoUrls.length) {
      return;
    }

    const previousPhotoUrls = photoUrls;
    const nextPhotoUrls = [...photoUrls];
    [nextPhotoUrls[photoIndex], nextPhotoUrls[nextPhotoIndex]] = [
      nextPhotoUrls[nextPhotoIndex],
      nextPhotoUrls[photoIndex],
    ];

    setPhotoUrls(nextPhotoUrls);
    const saved = await patchExcursion({ photoUrls: nextPhotoUrls }, { applyResponse: false });
    if (!saved) {
      setPhotoUrls(previousPhotoUrls);
      return;
    }

    setSuccess("Порядок фото в верхней галерее обновлён");
  }

  async function makePhotoCover(photoIndex: number) {
    const previousPhotoUrls = photoUrls;
    const nextPhotoUrls = movePhotoUrlToFirst(photoUrls, photoIndex);
    if (nextPhotoUrls === photoUrls) {
      return;
    }

    setPhotoUrls(nextPhotoUrls);
    const saved = await patchExcursion({ photoUrls: nextPhotoUrls }, { applyResponse: false });
    if (!saved) {
      setPhotoUrls(previousPhotoUrls);
      return;
    }

    setSuccess("Обложка верхней галереи обновлена");
  }

  function buildProgramPhotoTargetKey(kind: "day" | "step", index: number): string {
    return `${kind}-${index}`;
  }

  async function cleanupUploadedContentPhoto(url: string) {
    await fetch(`/api/excursions/${excursion.id}/content-photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);
  }

  async function persistSectionPhotoGroupChange(
    key: ExcursionSectionPhotoGroupKey,
    nextPhotoUrls: string[],
    successMessage: string,
  ): Promise<boolean> {
    const previousGroups = sectionPhotoGroups;
    const nextGroups: ExcursionSectionPhotoGroups = {
      ...sectionPhotoGroups,
      [key]: nextPhotoUrls,
    };

    setSectionPhotoGroups(nextGroups);
    const saved = await patchExcursion(
      { sectionPhotoGroups: nextGroups },
      { applyResponse: false },
    );
    if (!saved) {
      setSectionPhotoGroups(previousGroups);
      return false;
    }

    setSuccess(successMessage);
    return true;
  }

  async function uploadSectionPhotos(
    key: ExcursionSectionPhotoGroupKey,
    fileList: FileList | null,
  ) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setSectionPhotoUploadKey(key);

    try {
      let currentPhotoUrls = sectionPhotoGroups[key];

      for (const file of Array.from(fileList)) {
        const uploadType = detectSupportedPhotoUploadType({
          mimeType: file.type,
          fileName: file.name,
        });
        if (!uploadType) {
          setError(getUnsupportedAccommodationPhotoFormatError());
          continue;
        }

        if (
          file.size >
          getAccommodationPhotoUploadSizeLimitBytes({
            mimeType: file.type,
            fileName: file.name,
          })
        ) {
          setError(getAccommodationPhotoUploadSizeError());
          continue;
        }

        if (currentPhotoUrls.length >= EXCURSION_SECTION_PHOTO_LIMIT) {
          setError(`Для одного раздела доступно не более ${EXCURSION_SECTION_PHOTO_LIMIT} фото.`);
          break;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/excursions/${excursion.id}/content-photos`, {
          method: "POST",
          body: formData,
        });
        const body = (await response.json()) as { error?: string; url?: string };

        if (!response.ok || !body.url) {
          setError(body.error ?? "Не удалось загрузить фото для раздела");
          continue;
        }

        const nextPhotoUrls = [...currentPhotoUrls, body.url];
        const saved = await persistSectionPhotoGroupChange(
          key,
          nextPhotoUrls,
          "Фото раздела добавлено",
        );
        if (!saved) {
          await cleanupUploadedContentPhoto(body.url);
          continue;
        }

        currentPhotoUrls = nextPhotoUrls;
      }
    } finally {
      setSectionPhotoUploadKey(null);
    }
  }

  async function moveSectionPhoto(
    key: ExcursionSectionPhotoGroupKey,
    photoIndex: number,
    direction: -1 | 1,
  ) {
    const currentPhotoUrls = sectionPhotoGroups[key];
    const nextPhotoIndex = photoIndex + direction;
    if (nextPhotoIndex < 0 || nextPhotoIndex >= currentPhotoUrls.length) {
      return;
    }

    const nextPhotoUrls = [...currentPhotoUrls];
    [nextPhotoUrls[photoIndex], nextPhotoUrls[nextPhotoIndex]] = [
      nextPhotoUrls[nextPhotoIndex],
      nextPhotoUrls[photoIndex],
    ];

    await persistSectionPhotoGroupChange(key, nextPhotoUrls, "Порядок фото раздела обновлён");
  }

  async function makeSectionPhotoFirst(key: ExcursionSectionPhotoGroupKey, photoIndex: number) {
    const currentPhotoUrls = sectionPhotoGroups[key];
    const nextPhotoUrls = movePhotoUrlToFirst(currentPhotoUrls, photoIndex);
    if (nextPhotoUrls === currentPhotoUrls) {
      return;
    }

    await persistSectionPhotoGroupChange(key, nextPhotoUrls, "Первое фото раздела обновлено");
  }

  async function removeSectionPhoto(key: ExcursionSectionPhotoGroupKey, photoIndex: number) {
    const currentPhotoUrls = sectionPhotoGroups[key];
    const nextPhotoUrls = currentPhotoUrls.filter((_, index) => index !== photoIndex);
    if (nextPhotoUrls.length === currentPhotoUrls.length) {
      return;
    }

    await persistSectionPhotoGroupChange(key, nextPhotoUrls, "Фото раздела удалено");
  }

  async function addExistingPhotoToSection(
    key: ExcursionSectionPhotoGroupKey,
    photoUrl: string,
  ): Promise<void> {
    const currentPhotoUrls = sectionPhotoGroups[key];
    if (currentPhotoUrls.includes(photoUrl)) {
      return;
    }
    if (currentPhotoUrls.length >= EXCURSION_SECTION_PHOTO_LIMIT) {
      setError(`Для одного раздела доступно не более ${EXCURSION_SECTION_PHOTO_LIMIT} фото.`);
      return;
    }

    await persistSectionPhotoGroupChange(
      key,
      [...currentPhotoUrls, photoUrl],
      "Фото добавлено в раздел",
    );
  }

  async function persistItineraryDayPhotoChange(
    nextDays: ItineraryDay[],
    previousDays: ItineraryDay[],
    successMessage: string,
  ): Promise<boolean> {
    setItineraryDays(nextDays);
    const saved = await patchExcursion({ itineraryDays: nextDays }, { applyResponse: false });
    if (!saved) {
      setItineraryDays(previousDays);
      return false;
    }

    setSuccess(successMessage);
    return true;
  }

  async function persistTimelinePhotoChange(
    nextTimeline: TimelineStep[],
    previousTimeline: TimelineStep[],
    successMessage: string,
  ): Promise<boolean> {
    setTimeline(nextTimeline);
    const saved = await patchExcursion({ timeline: nextTimeline }, { applyResponse: false });
    if (!saved) {
      setTimeline(previousTimeline);
      return false;
    }

    setSuccess(successMessage);
    return true;
  }

  async function uploadProgramPhotos(
    kind: "day" | "step",
    targetIndex: number,
    fileList: FileList | null,
  ) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setProgramPhotoUploadKey(buildProgramPhotoTargetKey(kind, targetIndex));

    try {
      let currentDays = itineraryDays;
      let currentTimeline = timeline;

      for (const file of Array.from(fileList)) {
        const uploadType = detectSupportedPhotoUploadType({
          mimeType: file.type,
          fileName: file.name,
        });
        if (!uploadType) {
          setError(getUnsupportedAccommodationPhotoFormatError());
          continue;
        }

        if (
          file.size >
          getAccommodationPhotoUploadSizeLimitBytes({
            mimeType: file.type,
            fileName: file.name,
          })
        ) {
          setError(getAccommodationPhotoUploadSizeError());
          continue;
        }

        const currentPhotoCount =
          kind === "day"
            ? getItineraryDayPhotoUrls(currentDays[targetIndex]).length
            : getTimelineStepPhotoUrls(currentTimeline[targetIndex]).length;

        if (currentPhotoCount >= EXCURSION_PROGRAM_PHOTO_LIMIT) {
          setError(`Для одного блока доступно не более ${EXCURSION_PROGRAM_PHOTO_LIMIT} фото.`);
          break;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/excursions/${excursion.id}/content-photos`, {
          method: "POST",
          body: formData,
        });
        const body = (await response.json()) as { error?: string; url?: string };

        if (!response.ok || !body.url) {
          setError(body.error ?? "Не удалось загрузить фото программы");
          continue;
        }

        if (kind === "day") {
          const previousDays = currentDays;
          const nextDays = currentDays.map((day, index) =>
            index === targetIndex
              ? {
                  ...day,
                  photoUrls: [...getItineraryDayPhotoUrls(day), body.url!],
                }
              : day,
          );
          const saved = await persistItineraryDayPhotoChange(
            nextDays,
            previousDays,
            "Фото дня программы добавлено",
          );
          if (!saved) {
            await cleanupUploadedContentPhoto(body.url);
            continue;
          }
          currentDays = nextDays;
        } else {
          const previousTimeline = currentTimeline;
          const nextTimeline = currentTimeline.map((step, index) =>
            index === targetIndex
              ? {
                  ...step,
                  photoUrls: [...getTimelineStepPhotoUrls(step), body.url!],
                }
              : step,
          );
          const saved = await persistTimelinePhotoChange(
            nextTimeline,
            previousTimeline,
            "Фото шага маршрута добавлено",
          );
          if (!saved) {
            await cleanupUploadedContentPhoto(body.url);
            continue;
          }
          currentTimeline = nextTimeline;
        }
      }
    } finally {
      setProgramPhotoUploadKey(null);
    }
  }

  async function moveItineraryDayPhoto(dayIndex: number, photoIndex: number, direction: -1 | 1) {
    const currentPhotoUrls = getItineraryDayPhotoUrls(itineraryDays[dayIndex]);
    const nextPhotoIndex = photoIndex + direction;
    if (nextPhotoIndex < 0 || nextPhotoIndex >= currentPhotoUrls.length) {
      return;
    }

    const nextPhotoUrls = [...currentPhotoUrls];
    [nextPhotoUrls[photoIndex], nextPhotoUrls[nextPhotoIndex]] = [
      nextPhotoUrls[nextPhotoIndex],
      nextPhotoUrls[photoIndex],
    ];

    const previousDays = itineraryDays;
    const nextDays = itineraryDays.map((day, index) =>
      index === dayIndex ? { ...day, photoUrls: nextPhotoUrls } : day,
    );

    await persistItineraryDayPhotoChange(nextDays, previousDays, "Порядок фото дня обновлён");
  }

  async function makeItineraryDayPhotoFirst(dayIndex: number, photoIndex: number) {
    const currentPhotoUrls = getItineraryDayPhotoUrls(itineraryDays[dayIndex]);
    const nextPhotoUrls = movePhotoUrlToFirst(currentPhotoUrls, photoIndex);
    if (nextPhotoUrls === currentPhotoUrls) {
      return;
    }

    const previousDays = itineraryDays;
    const nextDays = itineraryDays.map((day, index) =>
      index === dayIndex ? { ...day, photoUrls: nextPhotoUrls } : day,
    );

    await persistItineraryDayPhotoChange(nextDays, previousDays, "Первое фото дня обновлено");
  }

  async function removeItineraryDayPhoto(dayIndex: number, photoIndex: number) {
    const currentPhotoUrls = getItineraryDayPhotoUrls(itineraryDays[dayIndex]);
    const nextPhotoUrls = currentPhotoUrls.filter((_, index) => index !== photoIndex);
    if (nextPhotoUrls.length === currentPhotoUrls.length) {
      return;
    }

    const previousDays = itineraryDays;
    const nextDays = itineraryDays.map((day, index) =>
      index === dayIndex ? { ...day, photoUrls: nextPhotoUrls } : day,
    );

    await persistItineraryDayPhotoChange(nextDays, previousDays, "Фото дня удалено");
  }

  async function moveTimelinePhoto(stepIndex: number, photoIndex: number, direction: -1 | 1) {
    const currentPhotoUrls = getTimelineStepPhotoUrls(timeline[stepIndex]);
    const nextPhotoIndex = photoIndex + direction;
    if (nextPhotoIndex < 0 || nextPhotoIndex >= currentPhotoUrls.length) {
      return;
    }

    const nextPhotoUrls = [...currentPhotoUrls];
    [nextPhotoUrls[photoIndex], nextPhotoUrls[nextPhotoIndex]] = [
      nextPhotoUrls[nextPhotoIndex],
      nextPhotoUrls[photoIndex],
    ];

    const previousTimeline = timeline;
    const nextTimeline = timeline.map((step, index) =>
      index === stepIndex ? { ...step, photoUrls: nextPhotoUrls } : step,
    );

    await persistTimelinePhotoChange(nextTimeline, previousTimeline, "Порядок фото шага обновлён");
  }

  async function makeTimelinePhotoFirst(stepIndex: number, photoIndex: number) {
    const currentPhotoUrls = getTimelineStepPhotoUrls(timeline[stepIndex]);
    const nextPhotoUrls = movePhotoUrlToFirst(currentPhotoUrls, photoIndex);
    if (nextPhotoUrls === currentPhotoUrls) {
      return;
    }

    const previousTimeline = timeline;
    const nextTimeline = timeline.map((step, index) =>
      index === stepIndex ? { ...step, photoUrls: nextPhotoUrls } : step,
    );

    await persistTimelinePhotoChange(nextTimeline, previousTimeline, "Первое фото шага обновлено");
  }

  async function removeTimelinePhoto(stepIndex: number, photoIndex: number) {
    const currentPhotoUrls = getTimelineStepPhotoUrls(timeline[stepIndex]);
    const nextPhotoUrls = currentPhotoUrls.filter((_, index) => index !== photoIndex);
    if (nextPhotoUrls.length === currentPhotoUrls.length) {
      return;
    }

    const previousTimeline = timeline;
    const nextTimeline = timeline.map((step, index) =>
      index === stepIndex ? { ...step, photoUrls: nextPhotoUrls } : step,
    );

    await persistTimelinePhotoChange(nextTimeline, previousTimeline, "Фото шага удалено");
  }

  function addVideoUrl() {
    const value = videoUrlInput.trim();
    if (!value) {
      return;
    }

    if (!isValidUrl(value)) {
      setError("Укажите корректный URL для видео (http/https)");
      return;
    }

    if (videoUrls.length >= 2) {
      setError("Можно добавить не более 2 видео");
      return;
    }

    if (videoUrls.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setVideoUrlInput("");
      return;
    }

    setVideoUrls((prev) => [...prev, value]);
    setVideoUrlInput("");
    setError("");
  }

  function toggleTag(tag: string) {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      return;
    }

    setTags((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.toLowerCase() === normalizedTag.toLowerCase(),
      );
      if (existingIndex >= 0) {
        return prev.filter((_, index) => index !== existingIndex);
      }
      if (prev.length >= 30) {
        setError("Можно добавить не более 30 категорий");
        return prev;
      }
      setError("");
      return [...prev, normalizedTag];
    });
  }

  function removeTagOption(tag: string) {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag || defaultCategoryTagSet.has(normalizedTag)) {
      return;
    }

    setTagOptions((prev) => prev.filter((item) => item.toLowerCase() !== normalizedTag));
    setTags((prev) => prev.filter((item) => item.toLowerCase() !== normalizedTag));
    setError("");
  }

  function toggleLanguage(code: string) {
    const normalizedCode = normalizeLanguageCode(code);
    if (!normalizedCode) {
      return;
    }

    setLanguageCodes((prev) =>
      prev.includes(normalizedCode)
        ? prev.length > 1
          ? prev.filter((item) => item !== normalizedCode)
          : prev
        : prev.length >= 12
          ? prev
          : [...prev, normalizedCode],
    );
  }

  function removeLanguageOption(code: string) {
    const normalizedCode = normalizeLanguageCode(code);
    if (!normalizedCode || defaultLanguageCodeSet.has(normalizedCode)) {
      return;
    }

    setLanguageOptions((prev) => prev.filter((item) => item.code !== normalizedCode));
    setLanguageCodes((prev) => {
      const next = prev.filter((item) => item !== normalizedCode);
      if (next.length > 0) {
        return next;
      }
      return [defaultLanguageOptions[0]?.code ?? "ru"];
    });
    setError("");
  }

  function addTagOption() {
    const value = newTagDraft.trim();
    if (!value) {
      return;
    }
    if (value.length < 2) {
      setError("Категория должна содержать минимум 2 символа");
      return;
    }
    if (value.length > 60) {
      setError("Категория не должна превышать 60 символов");
      return;
    }

    setTagOptions((prev) =>
      prev.some((item) => item.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value],
    );
    setTags((prev) =>
      prev.some((item) => item.toLowerCase() === value.toLowerCase())
        ? prev
        : prev.length >= 30
          ? prev
          : [...prev, value],
    );
    setNewTagDraft("");
    setIsAddingTag(false);
    setError("");
  }

  function addFormatOption() {
    const label = newFormatDraft.trim();
    if (!label) {
      return;
    }
    if (label.length < 2) {
      setError("Тип должен содержать минимум 2 символа");
      return;
    }
    if (label.length > 40) {
      setError("Тип не должен превышать 40 символов");
      return;
    }

    const existing = formatOptions.find((item) => item.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      setExcursionFormat(existing.value);
      setSelectedFormatOptionId(existing.id);
      setNewFormatDraft("");
      setIsAddingFormat(false);
      setError("");
      return;
    }

    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextOption: FormatOption = {
      id,
      value: excursionFormat,
      label,
    };

    setFormatOptions((prev) => [...prev, nextOption]);
    setSelectedFormatOptionId(id);
    setNewFormatDraft("");
    setIsAddingFormat(false);
    setError("");
  }

  function removeFormatOption(optionId: string) {
    if (!optionId || defaultFormatOptionIdSet.has(optionId)) {
      return;
    }

    setFormatOptions((prev) => prev.filter((item) => item.id !== optionId));
    setError("");
  }

  function addLanguageOption() {
    const code = normalizeLanguageCode(newLanguageCodeDraft);
    if (!code) {
      return;
    }
    if (!languageCodeRegex.test(code)) {
      setError("Код языка должен быть в формате ru/en/es/pt-br");
      return;
    }

    setLanguageOptions((prev) =>
      prev.some((item) => item.code === code)
        ? prev
        : [...prev, { code, label: code.toUpperCase() }],
    );
    setLanguageCodes((prev) => (prev.includes(code) || prev.length >= 12 ? prev : [...prev, code]));
    setNewLanguageCodeDraft("");
    setIsAddingLanguage(false);
    setError("");
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {excursion.moderationNotes ? (
        <section className="rounded-[28px] border border-olive/8 bg-white/95 p-2.5 shadow-[0_18px_36px_-28px_rgba(15,74,64,0.35)] sm:p-4">
          <div className="flex gap-2 rounded-xl bg-terra/8 p-3">
            <AppIcon icon={TriangleAlert} className="mt-0.5 h-4 w-4 shrink-0 text-terra" />
            <div className="text-sm text-olive/85">
              <p className="font-semibold text-olive">Комментарий модератора</p>
              <p className="mt-0.5 whitespace-pre-line">{excursion.moderationNotes}</p>
            </div>
          </div>
        </section>
      ) : null}

      <WizardStepper
        steps={wizardSteps}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        saveStatus={saveStatus}
        backHref={backHref}
        backLabel={backLabel}
      />

      {/* ===== STEP 0: ОПИСАНИЕ ===== */}
      {currentStep === 0 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">Описание программы</h2>
            <p className="mt-1 text-sm text-olive/55">
              Заполните основные поля — они помогут туристам найти и понять вашу экскурсию.
            </p>
          </div>

          {/* ── Группа 1: Основное ── */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Тип и название</p>
                <p className="text-xs text-olive/50">
                  Выберите тип, укажите название и опишите программу
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
              <section className="rounded-xl border border-olive/15 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-olive/70">
                  Тип предложения
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {OFFER_TYPE_OPTIONS.map((option) => {
                    const isActive = offerType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOfferType(option.value)}
                        className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                          isActive
                            ? "border-primary bg-primary text-white"
                            : "border-olive/20 bg-white text-olive hover:border-olive/40"
                        }`}
                      >
                        <span className="block font-semibold">{option.label}</span>
                        <span
                          className={`mt-1 block text-xs ${isActive ? "text-white/75" : "text-olive/60"}`}
                        >
                          {option.value === "TOUR"
                            ? "Заезды, программа по дням, проживание и туровая цена."
                            : "Короткий маршрут, почасовая длительность и расписание."}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <label className="block space-y-1.5 rounded-xl border border-olive/15 bg-white p-3">
                <span className="text-sm font-medium text-olive">Подтип / вид программы</span>
                <Input
                  value={subtypeLabel}
                  onChange={(event) => setSubtypeLabel(event.target.value)}
                  placeholder={
                    isTour
                      ? "Авторский, многодневный, джип-тур..."
                      : "Пешеходная, морская, индивидуальная..."
                  }
                  list="offer-subtype-presets"
                  maxLength={120}
                />
                <datalist id="offer-subtype-presets">
                  {(isTour ? OFFER_SUBTYPE_PRESETS.TOUR : OFFER_SUBTYPE_PRESETS.EXCURSION).map(
                    (item) => (
                      <option key={item} value={item} />
                    ),
                  )}
                </datalist>
                <p className="text-xs text-olive/50">
                  Подтип показывает характер программы, но не заменяет теги и тематику.
                </p>
              </label>
            </div>

            {/* Название */}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-olive">
                Название <span className="text-terra">*</span>
              </span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder={
                  isTour ? "Авторский тур по Южному берегу" : "Обзорная экскурсия по Ялте"
                }
              />
              <p className="text-xs text-olive/50">
                Коротко и по делу, без эмодзи — до 120 символов
              </p>
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-olive">
                  Описание <span className="text-terra">*</span>
                </span>
                <span className="tabular-nums text-xs text-olive/50">
                  {description.length}/5000
                </span>
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={5000}
                className="w-full resize-none rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={
                  isTour
                    ? "Опишите тур: маршрут, формат, длительность, ключевые точки программы и организационные детали."
                    : "Опишите экскурсию: маршрут, формат, продолжительность, что входит в программу и как проходит выезд."
                }
              />
              <p className="text-xs text-olive/50">
                Краткое превью для карточек сформируется автоматически из этого текста.
              </p>
              <p className="mt-2 rounded-2xl border border-primary/10 bg-primary/5 px-3.5 py-3 text-xs leading-6 text-olive/72">
                Основные фото используются в верхней галерее карточки. Для разделов страницы можно
                назначить отдельные подборки в блоке «Медиа» ниже. Фото для программы по дням и
                шагам маршрута по-прежнему добавляются прямо внутри соответствующего дня или шага.
              </p>
            </div>
          </div>

          {/* ── Группа 2: Особенности ── */}
          <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Преимущества и особенности</p>
                <p className="text-xs text-olive/50">
                  Укажите ключевые особенности программы без рекламных формулировок
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">Что вас ждёт</h3>
                <p className="text-xs text-olive/55">
                  3–6 коротких и конкретных пунктов. Выберите из готовых или добавьте свои. Этот
                  блок показывается на публичной карточке отдельным списком.
                </p>
              </div>
              <IncludedEditor
                items={highlights}
                onChange={setHighlights}
                presets={HIGHLIGHT_PRESETS}
                placeholder="Например: старт из Ялты, мини-группа до 8 человек"
              />
            </div>
          </div>

          {/* ── Группа 3: Категория и формат ── */}
          <div className="space-y-5 rounded-2xl border border-olive/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-xs font-bold text-white">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Категория и формат</p>
                <p className="text-xs text-olive/50">
                  Нажимайте на подходящие кнопки — это поможет туристам находить вас в поиске
                </p>
              </div>
            </div>

            {/* Теги */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-olive">Дополнительные теги</span>
                {tags.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {tags.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-olive/45">
                Нажмите на тег, чтобы выбрать его. Выбранные теги подсветятся.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tagOptions.map((tag) => {
                  const isSelected = tags.some((item) => item.toLowerCase() === tag.toLowerCase());
                  const isRemovable = !defaultCategoryTagSet.has(tag.toLowerCase());
                  return (
                    <div key={tag} className="relative">
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-primary bg-primary/8 text-primary shadow-sm"
                            : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                        }`}
                      >
                        {isSelected ? (
                          <AppIcon icon={Check} className="h-3 w-3" />
                        ) : (
                          <AppIcon icon={Plus} className="h-3 w-3 opacity-50" />
                        )}
                        {tag}
                      </button>
                      {isSelected && isRemovable && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeTagOption(tag);
                          }}
                          className="absolute -right-1.5 -top-1.5 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-olive/20 bg-white text-olive/60 shadow-sm transition hover:border-terra/40 hover:text-terra"
                          aria-label={`Удалить категорию ${tag}`}
                          title="Удалить категорию"
                        >
                          <AppIcon icon={X} className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {isAddingTag ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    ref={newTagInputRef}
                    value={newTagDraft}
                    onChange={(event) => setNewTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTagOption();
                      }
                      if (event.key === "Escape") {
                        setIsAddingTag(false);
                        setNewTagDraft("");
                      }
                    }}
                    placeholder="Добавить тег"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addTagOption}
                    disabled={!newTagDraft.trim()}
                  >
                    Добавить
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingTag(false);
                      setNewTagDraft("");
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <AddActionButton
                  label="Добавить тег"
                  onClick={() => {
                    setIsAddingTag(true);
                    setError("");
                  }}
                />
              )}
            </div>

            <div className="border-t border-olive/8" />

            {/* Формат участия */}
            <div className="space-y-2.5">
              <span className="text-sm font-medium text-olive">Формат участия</span>
              <p className="text-xs text-olive/45">
                Выберите один формат. Активный вариант выделен цветом.
              </p>
              <div className="flex flex-wrap gap-2">
                {formatOptions.map(({ id, value, label }) => (
                  <div key={id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setExcursionFormat(value);
                        setSelectedFormatOptionId(id);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                        selectedFormatOptionId === id
                          ? "border-primary bg-primary/8 text-primary shadow-sm"
                          : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                      }`}
                    >
                      {label}
                    </button>
                    {selectedFormatOptionId === id && !defaultFormatOptionIdSet.has(id) && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFormatOption(id);
                        }}
                        className="absolute -right-1.5 -top-1.5 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-olive/20 bg-white text-olive/60 shadow-sm transition hover:border-terra/40 hover:text-terra"
                        aria-label={`Удалить тип ${label}`}
                        title="Удалить тип"
                      >
                        <AppIcon icon={X} className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isAddingFormat ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    ref={newFormatInputRef}
                    value={newFormatDraft}
                    onChange={(event) => setNewFormatDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addFormatOption();
                      }
                      if (event.key === "Escape") {
                        setIsAddingFormat(false);
                        setNewFormatDraft("");
                      }
                    }}
                    placeholder="Добавить тип"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addFormatOption}
                    disabled={!newFormatDraft.trim()}
                  >
                    Добавить
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingFormat(false);
                      setNewFormatDraft("");
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <AddActionButton
                  label="Добавить тип"
                  onClick={() => {
                    setIsAddingFormat(true);
                    setError("");
                  }}
                />
              )}
            </div>

            <div className="border-t border-olive/8" />

            {/* Язык проведения */}
            <div className="space-y-2.5">
              <span className="text-sm font-medium text-olive">Язык проведения</span>
              <p className="text-xs text-olive/45">
                Нажмите на язык, чтобы добавить или убрать его из списка.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {languageOptions.map(({ code, label }) => {
                  const isSelected = languageCodes.includes(code);
                  const isRemovable = !defaultLanguageCodeSet.has(code);
                  return (
                    <div key={code} className="relative">
                      <button
                        type="button"
                        onClick={() => toggleLanguage(code)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-primary bg-primary/8 text-primary shadow-sm"
                            : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                        }`}
                      >
                        {isSelected && <AppIcon icon={Check} className="h-3 w-3" />}
                        {label}
                      </button>
                      {isSelected && isRemovable && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeLanguageOption(code);
                          }}
                          className="absolute -right-1.5 -top-1.5 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-olive/20 bg-white text-olive/60 shadow-sm transition hover:border-terra/40 hover:text-terra"
                          aria-label={`Удалить язык ${label}`}
                          title="Удалить язык"
                        >
                          <AppIcon icon={X} className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {isAddingLanguage ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    ref={newLanguageInputRef}
                    value={newLanguageCodeDraft}
                    onChange={(event) => setNewLanguageCodeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addLanguageOption();
                      }
                      if (event.key === "Escape") {
                        setIsAddingLanguage(false);
                        setNewLanguageCodeDraft("");
                      }
                    }}
                    placeholder="Код языка: ru, en, es, pt-br"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addLanguageOption}
                    disabled={!newLanguageCodeDraft.trim()}
                  >
                    Добавить
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingLanguage(false);
                      setNewLanguageCodeDraft("");
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <AddActionButton
                  label="Добавить язык"
                  onClick={() => {
                    setIsAddingLanguage(true);
                    setError("");
                  }}
                />
              )}
            </div>
          </div>

          {/* ── Tour-specific: вид тура, транспорт, режим заездов ── */}
          {showTourLogistics && (
            <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                  T
                </span>
                <div>
                  <p className="text-sm font-semibold text-olive">Параметры тура</p>
                  <p className="text-xs text-olive/50">
                    Укажите вид тура, транспорт и режим заездов
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Вид тура</span>
                <div className="flex flex-wrap gap-2">
                  {TOUR_KIND_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTourKind(tourKind === option.value ? null : option.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        tourKind === option.value
                          ? "border-primary bg-primary/8 text-primary shadow-sm"
                          : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Транспорт</span>
                <p className="text-xs text-olive/50">Выберите все подходящие варианты</p>
                <div className="flex flex-wrap gap-2">
                  {TRANSPORT_MODE_OPTIONS.map((option) => {
                    const isSelected = transportModes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setTransportModes((prev) =>
                            isSelected
                              ? prev.filter((m) => m !== option.value)
                              : [...prev, option.value],
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          isSelected
                            ? "border-primary bg-primary/8 text-primary shadow-sm"
                            : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Режим заездов</span>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {DEPARTURE_MODE_OPTIONS.map((option) => {
                    const isActive = departureMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDepartureMode(isActive ? null : option.value)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          isActive
                            ? "border-primary bg-primary text-white"
                            : "border-olive/20 bg-white text-olive hover:border-olive/40"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== STEP 1: ГЕОГРАФИЯ И МАРШРУТ ===== */}
      {currentStep === 1 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">География и маршрут</h2>
            <p className="mt-1 text-sm text-olive/55">
              Укажите, где проходит {isTour ? "тур" : "экскурсия"}, место сбора и точки маршрута.
            </p>
          </div>

          {/* ── Группа 1: Район проведения ── */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Район проведения</p>
                <p className="text-xs text-olive/50">
                  Выберите город, отметьте точку на карте и укажите место сбора
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium text-olive">
                Населённый пункт <span className="text-terra">*</span>
              </span>
              <div className="space-y-1">
                <Input
                  value={locationInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const exactMatch = findExactCrimeaLocationByName(nextValue);
                    setLocationInput(nextValue);
                    setLocationId(exactMatch?.id ?? "");
                  }}
                  list={`excursion-location-suggestions-${excursion.id}`}
                  placeholder="Ялта, Судак, с. Добровское..."
                  autoComplete="off"
                />
                <datalist id={`excursion-location-suggestions-${excursion.id}`}>
                  {crimeaLocations.map((location) => (
                    <option key={location.id} value={location.name} />
                  ))}
                </datalist>
                <p className="text-xs text-olive/45">
                  Начните вводить название — появится список городов
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-olive/12 bg-cream/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-olive/55 shadow-sm">
                    <AppIcon icon={MapPin} className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-olive">Точка на карте</p>
                    <p className="text-xs text-olive/50">Необязательно, но повышает доверие</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={openMapDialog}
                  className="shrink-0"
                >
                  Открыть карту
                </Button>
              </div>

              <div
                className="relative overflow-hidden rounded-xl border border-olive/12 bg-cream"
                style={{ height: 152 }}
              >
                <Image
                  src="/crimea-map-preview.svg"
                  alt="Превью карты Крыма"
                  fill
                  sizes="100vw"
                  className="scale-110 object-cover object-center"
                  priority={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-midnight/55 via-midnight/15 to-transparent" />
                <div className="absolute inset-x-3 bottom-3">
                  <p className="text-xs text-white/75">
                    {latitude !== null && longitude !== null
                      ? "Точка выбрана. Откройте карту, чтобы скорректировать координаты."
                      : "Нажмите «Открыть карту», чтобы выбрать точку на карте Крыма"}
                  </p>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-olive/60">Адрес или ориентир</span>
                <Input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="ул. Ленина 1, рядом с набережной..."
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-olive">Стартовая точка</span>
              <Input
                value={startPoint}
                onChange={(event) => setStartPoint(event.target.value)}
                placeholder="Набережная, автовокзал, у входа в парк..."
              />
              <p className="flex items-center gap-1 text-xs text-olive/45">
                <AppIcon icon={Info} className="h-3 w-3 shrink-0" />
                Где именно собираются участники перед началом экскурсии
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-olive">Точка завершения</span>
              <Input
                value={finishPoint}
                onChange={(event) => setFinishPoint(event.target.value)}
                placeholder="Если финиш отличается от старта, укажите это здесь"
              />
              <p className="text-xs text-olive/45">
                Этот текст показывается в блоке логистики на публичной карточке.
              </p>
            </label>

            <div className="space-y-3 rounded-xl border border-olive/15 bg-cream/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-olive">Трансфер включён</span>
                  <p className="text-xs text-olive/50">
                    Необязательно{" "}
                    <span className="text-olive/35">— только если вы организуете доставку</span>
                  </p>
                </div>
                <SeaToggle
                  size="sm"
                  pressed={transferEnabled}
                  onPressedChange={setTransferEnabled}
                  aria-label="Трансфер включён"
                />
              </div>

              {transferEnabled ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Детали трансфера</span>
                  <Input
                    value={transferDetails}
                    onChange={(event) => setTransferDetails(event.target.value)}
                    placeholder="Откуда забираете, входит ли это в цену, нужна ли доплата..."
                    maxLength={300}
                  />
                </label>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ===== STEP 2: ПРОГРАММА ===== */}
      {currentStep === 2 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">Программа</h2>
            <p className="mt-1 text-sm text-olive/55">
              {isTour
                ? "Опишите маршрут, программу по пунктам и дополнительные опции."
                : "Опишите маршрут, таймлайн и дополнительные опции."}
            </p>
          </div>

          {/* Highlight chips */}
          <div className="space-y-3 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <p className="text-sm font-semibold text-olive">Хайлайты</p>
            <p className="text-xs text-olive/50">Ключевые фишки, которые зацепят туриста (до 6)</p>
            <div className="flex flex-wrap gap-2">
              {HIGHLIGHT_PRESETS.map((preset) => {
                const isSelected = highlights.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setHighlights((prev) =>
                        isSelected
                          ? prev.filter((h) => h !== preset)
                          : prev.length < 6
                            ? [...prev, preset]
                            : prev,
                      )
                    }
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      isSelected
                        ? "border-primary bg-primary/8 text-primary shadow-sm"
                        : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Маршрут и программа (duration/participants/physical moved to steps 3-4) ── */}
          <div className="space-y-5 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                4
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Маршрут и программа</p>
                <p className="text-xs text-olive/50">
                  Составьте пошаговый план или опишите маршрут текстом
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/10 text-terra">
                    <AppIcon icon={ListChecks} className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-olive">
                      {isTour
                        ? getItineraryProgramTitle(itineraryItemLabel)
                        : "Пошаговый план (таймлайн)"}
                    </h3>
                    <p className="mt-0.5 text-xs text-olive/60">
                      {isTour
                        ? "Разложите программу по пунктам: это может быть план по дням, этапам, шагам или любым логичным блокам маршрута."
                        : "Добавляйте шаги по порядку — укажите время и описание. Если пусто — на карточке отображается текстовый маршрут."}
                    </p>
                  </div>
                </div>
                {(isTour ? itineraryDays.length : timeline.length) > 0 && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {isTour
                      ? formatItineraryItemCount(itineraryItemLabel, itineraryDays.length)
                      : `${timeline.length} ${timeline.length === 1 ? "шаг" : timeline.length < 5 ? "шага" : "шагов"}`}
                  </span>
                )}
              </div>
              {isTour ? (
                <TourDaysEditor
                  days={itineraryDays}
                  itemLabel={itineraryItemLabel}
                  onChange={setItineraryDays}
                  onItemLabelChange={setItineraryItemLabel}
                  onUploadPhotos={(dayIndex, files) =>
                    void uploadProgramPhotos("day", dayIndex, files)
                  }
                  onMovePhoto={(dayIndex, photoIndex, direction) =>
                    void moveItineraryDayPhoto(dayIndex, photoIndex, direction)
                  }
                  onMakePhotoFirst={(dayIndex, photoIndex) =>
                    void makeItineraryDayPhotoFirst(dayIndex, photoIndex)
                  }
                  onRemovePhoto={(dayIndex, photoIndex) =>
                    void removeItineraryDayPhoto(dayIndex, photoIndex)
                  }
                  disabled={
                    Boolean(programPhotoUploadKey) ||
                    isUploadingPhotos ||
                    isSaving ||
                    isSavingSchedule ||
                    isDeleting
                  }
                  uploadingDayIndex={
                    programPhotoUploadKey?.startsWith("day-")
                      ? Number.parseInt(programPhotoUploadKey.slice(4), 10)
                      : null
                  }
                />
              ) : (
                <TimelineEditor
                  steps={timeline}
                  onChange={setTimeline}
                  onUploadPhotos={(stepIndex, files) =>
                    void uploadProgramPhotos("step", stepIndex, files)
                  }
                  onMovePhoto={(stepIndex, photoIndex, direction) =>
                    void moveTimelinePhoto(stepIndex, photoIndex, direction)
                  }
                  onMakePhotoFirst={(stepIndex, photoIndex) =>
                    void makeTimelinePhotoFirst(stepIndex, photoIndex)
                  }
                  onRemovePhoto={(stepIndex, photoIndex) =>
                    void removeTimelinePhoto(stepIndex, photoIndex)
                  }
                  disabled={
                    Boolean(programPhotoUploadKey) ||
                    isUploadingPhotos ||
                    isSaving ||
                    isSavingSchedule ||
                    isDeleting
                  }
                  uploadingStepIndex={
                    programPhotoUploadKey?.startsWith("step-")
                      ? Number.parseInt(programPhotoUploadKey.slice(5), 10)
                      : null
                  }
                />
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">Текстовый маршрут</h3>
                <p className="text-xs text-olive/55">
                  Опишите маршрут своими словами — это будет видно на карточке и на публичной
                  странице.
                </p>
              </div>
              <textarea
                value={routeDescription}
                onChange={(event) => setRouteDescription(event.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={
                  isTour
                    ? "Симферополь — Бахчисарай — Севастополь — Ялта. Коротко опишите маршрут и его ценность."
                    : "Опишите маршрут экскурсии простым человеческим языком"
                }
              />
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">
                  Дополнительные активности / опции
                </h3>
                <p className="text-xs text-olive/55">
                  {isTour
                    ? "Например: дегустация, СПА, фотосопровождение, одноместное размещение."
                    : "Можно добавить морскую прогулку, фотосопровождение или другие опции."}
                </p>
              </div>
              <ExtraOptionsEditor items={extraOptions} onChange={setExtraOptions} />
            </div>
          </div>
        </section>
      )}

      {/* ===== STEP 3: ДЛИТЕЛЬНОСТЬ И ДОСТУПНОСТЬ ===== */}
      {currentStep === 3 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">
              Длительность и доступность
            </h2>
            <p className="mt-1 text-sm text-olive/55">
              Укажите длительность и настройте, когда туристы смогут записаться.
            </p>
          </div>

          {/* Duration block */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-olive">Длительность</p>
              <p className="mt-1 text-xs text-olive/55">
                {isTour
                  ? "Для многодневного тура заполните дни и ночи. Для джип-тура, прогулки или короткого выезда можно указать только время в минутах."
                  : "Укажите общую продолжительность экскурсии в минутах."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {isTour ? (
                <div className="space-y-3 sm:col-span-2 md:col-span-3">
                  <div
                    className="inline-grid w-full grid-cols-2 gap-1 rounded-xl border border-olive/15 bg-cream/45 p-1 sm:w-auto"
                    aria-label="Формат длительности тура"
                  >
                    <button
                      type="button"
                      onClick={() => setTourDurationMode("days")}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        tourDurationMode === "days"
                          ? "bg-white text-primary shadow-sm"
                          : "text-olive/65 hover:text-olive"
                      }`}
                    >
                      Дни и ночи
                    </button>
                    <button
                      type="button"
                      onClick={() => setTourDurationMode("time")}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        tourDurationMode === "time"
                          ? "bg-white text-primary shadow-sm"
                          : "text-olive/65 hover:text-olive"
                      }`}
                    >
                      Часы и минуты
                    </button>
                  </div>

                  {tourDurationMode === "days" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                        <div className="flex items-center gap-1.5">
                          <AppIcon icon={Clock3} className="h-4 w-4" />
                          <span className="text-sm font-medium text-olive">
                            Дней <span className="text-terra">*</span>
                          </span>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={durationDays}
                          onChange={(event) => {
                            setTourDurationMode("days");
                            setDurationDays(event.target.value);
                          }}
                          placeholder="3"
                        />
                        <p className="text-xs text-olive/40">для туров с ночёвками</p>
                      </label>
                      <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                        <div className="flex items-center gap-1.5">
                          <AppIcon icon={Clock3} className="h-4 w-4" />
                          <span className="text-sm font-medium text-olive">Ночей</span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={364}
                          value={durationNights}
                          onChange={(event) => {
                            setTourDurationMode("days");
                            setDurationNights(event.target.value);
                          }}
                          placeholder="2"
                        />
                        <p className="text-xs text-olive/40">0 - без ночёвок</p>
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                        <div className="flex items-center gap-1.5">
                          <AppIcon icon={Clock3} className="h-4 w-4" />
                          <span className="text-sm font-medium text-olive">
                            Часов <span className="text-terra">*</span>
                          </span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={168}
                          value={durationHours}
                          onChange={(event) => updateTourDurationHours(event.target.value)}
                          placeholder="4"
                        />
                      </label>
                      <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                        <div className="flex items-center gap-1.5">
                          <AppIcon icon={Clock3} className="h-4 w-4" />
                          <span className="text-sm font-medium text-olive">Минут</span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={durationClockMinutes}
                          onChange={(event) => updateTourDurationClockMinutes(event.target.value)}
                          placeholder="30"
                        />
                        {durationMinutes ? (
                          <p className="text-xs font-medium text-primary">
                            {formatDuration(Number(durationMinutes) || null)}
                          </p>
                        ) : (
                          <p className="text-xs text-olive/40">например 4 часа для джип-тура</p>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                  <div className="flex items-center gap-1.5">
                    <AppIcon icon={Clock3} className="h-4 w-4" />
                    <span className="text-sm font-medium text-olive">
                      Длительность (мин) <span className="text-terra">*</span>
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={15}
                    max={10080}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="90"
                  />
                  {durationMinutes ? (
                    <p className="text-xs font-medium text-primary">
                      {formatDuration(Number(durationMinutes) || null)}
                    </p>
                  ) : (
                    <p className="text-xs text-olive/40">в минутах</p>
                  )}
                </label>
              )}
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <div className="flex items-center gap-1.5">
                  <AppIcon icon={Clock3} className="h-4 w-4" />
                  <span className="text-sm font-medium text-olive">Мин. бронирование</span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={minBookingNoticeHours}
                  onChange={(e) => setMinBookingNoticeHours(e.target.value)}
                  placeholder="24"
                />
                <p className="text-xs text-olive/40">часов до старта</p>
              </label>
            </div>
          </div>

          {/* ── Группа 1: Режим доступности ── */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Режим доступности</p>
                <p className="text-xs text-olive/50">
                  Выберите один из трёх вариантов — от него зависят настройки ниже
                </p>
              </div>
            </div>

            <p className="text-xs text-olive/60">
              {isTour
                ? "Для туров обычно подходят конкретные заезды или режим по запросу."
                : "Для экскурсий чаще всего подходит регулярное расписание."}
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {[
                {
                  value: ExcursionAvailabilityMode.REGULAR,
                  label: "Регулярно по расписанию",
                  description: "Дни недели, время, сезонность и исключения.",
                },
                {
                  value: ExcursionAvailabilityMode.DATED,
                  label: "Конкретные даты / заезды",
                  description: "Подходит для туров с фиксированными стартами.",
                },
                {
                  value: ExcursionAvailabilityMode.ON_REQUEST,
                  label: "По запросу",
                  description: "Дату согласовываете после обращения туриста.",
                },
              ].map((option) => {
                const isActive = availabilityMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAvailabilityMode(option.value)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-primary bg-primary text-white"
                        : "border-olive/20 bg-white text-olive hover:border-olive/40"
                    }`}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span
                      className={`mt-1 block text-xs ${isActive ? "text-white/75" : "text-olive/60"}`}
                    >
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {availabilityMode === ExcursionAvailabilityMode.REGULAR ? (
            <>
              {/* ── Группа 2: Расписание (Regular) ── */}
              <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-olive">Дни и время работы</p>
                    <p className="text-xs text-olive/50">
                      Выберите сезон, рабочие дни и укажите время для каждого дня
                    </p>
                  </div>
                </div>

                {/* Year-round vs season toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-olive/12 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Период доступности</p>
                    <p className="text-xs text-olive/55 mt-0.5">
                      {isYearRound
                        ? "Экскурсия проводится круглый год"
                        : "Укажите начало и конец сезона"}
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl border border-olive/15 bg-cream/60 p-1">
                    <button
                      type="button"
                      onClick={() => setIsYearRound(true)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                        isYearRound
                          ? "bg-primary text-white shadow-sm"
                          : "text-olive/60 hover:bg-cream"
                      }`}
                      aria-pressed={isYearRound}
                    >
                      Круглый год
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsYearRound(false)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                        isSeasonLimited
                          ? "bg-primary text-white shadow-sm"
                          : "text-olive/60 hover:bg-cream"
                      }`}
                      aria-pressed={isSeasonLimited}
                    >
                      По сезону
                    </button>
                  </div>
                </div>

                {/* Season date pickers */}
                {isSeasonLimited ? (
                  <div className="grid gap-3 rounded-xl border border-primary/18 bg-primary/5 p-4 md:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-olive/60">
                        Начало сезона
                      </span>
                      <SingleDatePopoverField
                        value={seasonDateFrom}
                        onChange={setSeasonDateFrom}
                        placeholder="Выберите дату"
                        helperText="Выберите дату начала сезона"
                        maxDate={seasonDateTo || undefined}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-olive/60">
                        Конец сезона
                      </span>
                      <SingleDatePopoverField
                        value={seasonDateTo}
                        onChange={setSeasonDateTo}
                        placeholder="Выберите дату"
                        helperText="Выберите дату окончания сезона"
                        minDate={seasonDateFrom || undefined}
                      />
                    </label>
                  </div>
                ) : null}

                {/* Days of week */}
                <div className="rounded-xl border border-olive/12 bg-white p-4 space-y-4">
                  {/* Header with presets */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-olive">Рабочие дни</p>
                      <p className="text-xs text-olive/45">
                        Нажмите на день недели, чтобы включить или выключить его
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {scheduleDayPresets.map((preset) => {
                        const isPresetActive = isSchedulePresetActive(preset.days);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setScheduleDaysEnabled(preset.days)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                              isPresetActive
                                ? "border-sage/45 bg-sage/20 text-olive"
                                : "border-olive/15 bg-white text-olive/60 hover:border-primary/30 hover:bg-primary/6 hover:text-primary"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={clearScheduleDays}
                        className="rounded-lg border border-olive/15 bg-white px-2.5 py-1 text-xs font-semibold text-olive/55 transition hover:border-primary/30 hover:bg-primary/6 hover:text-primary"
                      >
                        Сброс
                      </button>
                    </div>
                  </div>

                  {/* Compact 7-pill day bar */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekdayOrder.map((day) => {
                      const dayItem = daySchedule[day];
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => updateWeekdaySchedule(day, { enabled: !dayItem.enabled })}
                          className={`flex flex-col items-center rounded-xl border py-2.5 px-1 transition ${
                            dayItem.enabled
                              ? "border-sage bg-sage/15 text-olive ring-1 ring-sage/30 shadow-sm"
                              : "border-olive/12 bg-cream/50 text-olive/45 hover:border-olive/28 hover:bg-cream hover:text-olive/70"
                          }`}
                          aria-pressed={dayItem.enabled}
                          title={weekdayLabels[day]}
                        >
                          <span className="text-xs font-bold">{weekdayShortLabels[day]}</span>
                          {dayItem.enabled ? (
                            <span className="mt-0.5 text-[9px] leading-tight text-olive/50 tabular-nums">
                              {dayItem.from.slice(0, 5)}
                            </span>
                          ) : (
                            <span className="mt-0.5 h-3" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time settings - shown when at least one day is active */}
                {activeScheduleDays.length > 0 ? (
                  <div className="rounded-xl border border-olive/12 bg-white p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-olive">Время работы</p>
                        <p className="text-xs text-olive/45">
                          Задайте время для всех дней сразу или настройте каждый отдельно
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {activeScheduleDays.map((day) => (
                          <span
                            key={`chip-${day}`}
                            className="inline-flex rounded-full border border-sage/35 bg-sage/15 px-2 py-0.5 text-[10px] font-semibold text-olive"
                          >
                            {weekdayShortLabels[day]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bulk time row */}
                    <div className="flex items-center gap-3 rounded-lg border border-olive/10 bg-cream/50 px-3 py-2">
                      <span className="text-xs font-medium text-olive/55 shrink-0">Для всех</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          step={60}
                          value={bulkTimeFrom}
                          aria-label="Начало рабочего времени"
                          onChange={(e) => {
                            setBulkTimeFrom(e.target.value);
                            setDaySchedule((prev) => {
                              const next = { ...prev };
                              for (const day of weekdayOrder) {
                                if (prev[day].enabled)
                                  next[day] = { ...next[day], from: e.target.value };
                              }
                              return next;
                            });
                          }}
                          className="h-8 rounded-lg border border-olive/18 bg-white px-2 text-sm font-semibold text-olive [color-scheme:light] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
                        />
                        <span className="text-sm text-olive/40">-</span>
                        <input
                          type="time"
                          step={60}
                          value={bulkTimeTo}
                          aria-label="Конец рабочего времени"
                          onChange={(e) => {
                            setBulkTimeTo(e.target.value);
                            setDaySchedule((prev) => {
                              const next = { ...prev };
                              for (const day of weekdayOrder) {
                                if (prev[day].enabled)
                                  next[day] = { ...next[day], to: e.target.value };
                              }
                              return next;
                            });
                          }}
                          className="h-8 rounded-lg border border-olive/18 bg-white px-2 text-sm font-semibold text-olive [color-scheme:light] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
                        />
                      </div>
                    </div>

                    {/* Per-day compact list */}
                    <div className="overflow-hidden rounded-xl border border-olive/10 divide-y divide-olive/8">
                      {activeScheduleDays.map((day) => {
                        const dayItem = daySchedule[day];
                        return (
                          <div
                            key={`time-${day}`}
                            className="flex items-center gap-3 bg-white px-3 py-2 transition-colors hover:bg-sage/5"
                          >
                            <span className="w-24 shrink-0 text-sm font-semibold text-olive">
                              {weekdayLabels[day]}
                            </span>
                            <div className="flex items-center gap-2 ml-auto">
                              <input
                                type="time"
                                step={60}
                                value={dayItem.from}
                                aria-label={`Начало для ${weekdayLabels[day]}`}
                                onChange={(e) =>
                                  updateWeekdaySchedule(day, { from: e.target.value })
                                }
                                className="h-8 rounded-lg border border-olive/18 bg-white px-2 text-sm font-semibold text-olive [color-scheme:light] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
                              />
                              <span className="text-sm text-olive/40">-</span>
                              <input
                                type="time"
                                step={60}
                                value={dayItem.to}
                                aria-label={`Конец для ${weekdayLabels[day]}`}
                                onChange={(e) => updateWeekdaySchedule(day, { to: e.target.value })}
                                className="h-8 rounded-lg border border-olive/18 bg-white px-2 text-sm font-semibold text-olive [color-scheme:light] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-olive/20 bg-white px-4 py-3.5">
                    <AppIcon icon={Clock3} className="h-4.5 w-4.5 shrink-0 opacity-55" />
                    <p className="text-sm text-olive/45">
                      Включите рабочие дни выше, чтобы задать время работы
                    </p>
                  </div>
                )}
              </div>

              {/* ── Группа 3: Исключения и дополнительно ── */}
              <div className="space-y-4 rounded-2xl border border-olive/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-xs font-bold text-white">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-olive">Исключения и дополнительно</p>
                    <p className="text-xs text-olive/50">
                      Нерабочие даты, комментарий и минимальный срок записи
                    </p>
                  </div>
                </div>

                {/* Closed dates / exceptions */}
                <div className="rounded-xl border border-olive/12 bg-white p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Нерабочие даты</p>
                    <p className="text-xs text-olive/50 mt-0.5">
                      Выберите конкретные дни, когда экскурсия не проводится (праздники, перерыв)
                    </p>
                  </div>
                  <SingleDatePopoverField
                    value=""
                    onChange={(nextValue) => {
                      if (nextValue) {
                        setAdditionalClosedDates((prev) =>
                          normalizeIsoDateList([...prev, nextValue]),
                        );
                      }
                    }}
                    placeholder="Выберите дату"
                    helperText="Кликните по дате, чтобы добавить её как нерабочую"
                  />
                  <div className="flex flex-wrap gap-2">
                    {additionalClosedDates.length === 0 ? (
                      <span className="text-xs text-olive/40">Нет исключений</span>
                    ) : (
                      additionalClosedDates.map((dateValue) => (
                        <span
                          key={dateValue}
                          className="inline-flex items-center gap-1.5 rounded-full border border-olive/15 bg-cream px-3 py-1 text-xs text-olive"
                        >
                          {formatIsoToDayMonthYear(dateValue)}
                          <button
                            type="button"
                            className="text-olive/50 transition hover:text-red-600"
                            onClick={() => removeClosedDate(dateValue)}
                            aria-label={`Удалить дату ${formatIsoToDayMonthYear(dateValue)}`}
                          >
                            Г—
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Schedule comment */}
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-olive">Комментарий к расписанию</span>
                  <textarea
                    value={scheduleComment}
                    onChange={(event) => setScheduleComment(event.target.value)}
                    rows={3}
                    maxLength={400}
                    className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Например: не работаем в государственные праздники..."
                  />
                </label>

                {/* Schedule summary */}
                <div className="flex items-start gap-2.5 rounded-xl border border-olive/12 bg-cream/50 px-4 py-3">
                  <AppIcon icon={Info} className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                  <p className="text-xs text-olive/60">
                    {isLoadingScheduleRules
                      ? "Загружаем сохраненные правила расписания..."
                      : `Сводка: ${
                          buildScheduleSummary({
                            isYearRound,
                            seasonDateFrom,
                            seasonDateTo,
                            daySchedule,
                            additionalClosedDates,
                            scheduleComment,
                          }) ??
                          (scheduleText || "не заполнено")
                        }`}
                  </p>
                </div>

                {/* Min booking notice */}
                <div className="space-y-2 rounded-xl border border-olive/12 bg-cream/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">
                      Минимальный срок записи{" "}
                      <span className="text-xs font-normal text-olive/40">(необязательно)</span>
                    </p>
                    <p className="text-xs text-olive/55 mt-0.5">
                      Нажмите на подходящий вариант — за сколько часов нужно записаться заранее
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "", label: "Не указано" },
                      { value: "0", label: "Сегодня" },
                      { value: "24", label: "За 24 ч" },
                      { value: "48", label: "За 48 ч" },
                      { value: "72", label: "За 3 дня" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMinBookingNoticeHours(opt.value)}
                        className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
                          minBookingNoticeHours === opt.value
                            ? "border-primary bg-primary/8 text-primary shadow-sm"
                            : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : availabilityMode === ExcursionAvailabilityMode.DATED ? (
            /* ── Группа 2: Заезды (Dated) ── */
            <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-olive">Заезды и конкретные даты</p>
                  <p className="text-xs text-olive/50">
                    Добавьте даты старта, укажите количество мест и, если нужно, отдельную цену
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-olive/15 bg-white p-3">
                <DepartureDatesEditor items={departureDates} onChange={setDepartureDates} />
              </div>

              <div className="space-y-2 rounded-xl border border-olive/12 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-olive">
                    Минимальный срок записи{" "}
                    <span className="text-xs font-normal text-olive/40">(необязательно)</span>
                  </p>
                  <p className="text-xs text-olive/55 mt-0.5">
                    За сколько часов или дней до старта нужно успеть записаться
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={minBookingNoticeHours}
                  onChange={(event) => setMinBookingNoticeHours(event.target.value)}
                  placeholder="24"
                />
              </div>
            </div>
          ) : (
            /* ── Группа 2: По запросу ── */
            <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-olive">Режим «по запросу»</p>
                  <p className="text-xs text-olive/50">
                    Объясните, как согласовывается дата и сколько времени нужно на подтверждение
                  </p>
                </div>
              </div>

              <textarea
                value={availabilityNote}
                onChange={(event) => setAvailabilityNote(event.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Например: дату согласуем после обращения, подтверждаем в течение 24 часов."
              />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-olive">Минимальный срок до заявки</span>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={minBookingNoticeHours}
                  onChange={(event) => setMinBookingNoticeHours(event.target.value)}
                  placeholder="48"
                />
              </label>
            </div>
          )}
          {/* ── Группа и требования (inline in step 3) ── */}
          <div className="mt-2 border-t border-olive/8 pt-6">
            <h3 className="text-base font-semibold text-olive">Группа и требования</h3>
            <p className="mt-1 text-sm text-olive/55">
              Формат проведения, размер группы, язык и физические требования.
            </p>
          </div>

          {/* Format, participants, age */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <p className="text-sm font-semibold text-olive">Формат и размер группы</p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <span className="text-sm font-medium text-olive">Мин. участников</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={minParticipants}
                  onChange={(e) => setMinParticipants(e.target.value)}
                  placeholder="1"
                />
              </label>
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <span className="text-sm font-medium text-olive">Макс. участников</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="20"
                />
              </label>
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <span className="text-sm font-medium text-olive">Мин. возраст</span>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-olive/40">0 — без ограничений</p>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-olive">Сложность</p>
              <div className="flex gap-2">
                {(["EASY", "MEDIUM", "HARD"] as ExcursionDifficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(difficulty === level ? null : level)}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                      difficulty === level
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-olive/18 bg-white text-olive/65 hover:border-primary/40"
                    }`}
                  >
                    {level === "EASY" ? "Лёгкая" : level === "MEDIUM" ? "Средняя" : "Сложная"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Physical requirements & what to bring */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <p className="text-sm font-semibold text-olive">Физические требования</p>
            <p className="text-xs text-olive/55">
              Укажите, если есть ограничения по здоровью или физической форме.
            </p>
            <IncludedEditor
              items={physicalRequirements}
              onChange={setPhysicalRequirements}
              presets={PHYSICAL_REQUIREMENTS_PRESETS}
              placeholder="Хорошая физическая форма"
            />
          </div>

          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <p className="text-sm font-semibold text-olive">Что взять с собой</p>
            <p className="text-xs text-olive/55">
              Подскажите участникам, что пригодится в поездке.
            </p>
            <IncludedEditor
              items={whatToBring}
              onChange={setWhatToBring}
              presets={WHAT_TO_BRING_PRESETS}
              placeholder="Удобная обувь"
            />
          </div>

          {/* Safety block for active tours */}
          {showSafetyBlock && (
            <div className="space-y-4 rounded-2xl border border-terra/20 bg-terra/5 p-4 shadow-sm sm:p-5">
              <p className="text-sm font-semibold text-olive">Безопасность и условия маршрута</p>
              <p className="text-xs text-olive/55">
                Для активных туров важно указать условия маршрута, снаряжение и правила
                безопасности.
              </p>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Условия маршрута</span>
                <textarea
                  value={routeConditions}
                  onChange={(e) => setRouteConditions(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Горная местность, грунтовые дороги, броды..."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Информация о безопасности</span>
                <textarea
                  value={safetyInfo}
                  onChange={(e) => setSafetyInfo(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Обязательно наличие спасательного жилета, инструктаж перед выездом..."
                />
              </label>
              <div className="space-y-2">
                <span className="text-sm font-medium text-olive">Предоставляемое снаряжение</span>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_PROVIDED_PRESETS.map((item) => {
                    const isSelected = equipmentProvided.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setEquipmentProvided((prev) =>
                            isSelected ? prev.filter((e) => e !== item) : [...prev, item],
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-sm transition ${isSelected ? "border-primary bg-primary/8 text-primary" : "border-olive/18 bg-white text-olive/65 hover:border-primary/40"}`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Documents & insurance for tours */}
          {isTour && (
            <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm sm:p-5">
              <p className="text-sm font-semibold text-olive">Документы и страховка</p>
              <div className="space-y-2">
                <span className="text-sm font-medium text-olive">Необходимые документы</span>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENTS_REQUIRED_PRESETS.map((item) => {
                    const isSelected = documentsRequired.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setDocumentsRequired((prev) =>
                            isSelected ? prev.filter((d) => d !== item) : [...prev, item],
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-sm transition ${isSelected ? "border-primary bg-primary/8 text-primary" : "border-olive/18 bg-white text-olive/65 hover:border-primary/40"}`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SeaToggle
                  pressed={insuranceIncluded === true}
                  onPressedChange={(val) => setInsuranceIncluded(val)}
                />
                <span className="text-sm font-medium text-olive">
                  Страховка включена в стоимость
                </span>
              </div>
              {insuranceIncluded && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Комментарий к страховке</span>
                  <Input
                    value={insuranceComment}
                    onChange={(e) => setInsuranceComment(e.target.value)}
                    placeholder="Базовая медицинская, покрывает несчастные случаи..."
                    maxLength={500}
                  />
                </label>
              )}
            </div>
          )}

          {/* Accommodation block for multi-day tours */}
          {showAccommodationBlock && (
            <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm sm:p-5">
              <p className="text-sm font-semibold text-olive">Проживание</p>
              <div className="flex items-center gap-3">
                <SeaToggle
                  pressed={accommodationProvided === true}
                  onPressedChange={(val) => setAccommodationProvided(val)}
                />
                <span className="text-sm font-medium text-olive">Проживание включено</span>
              </div>
              {accommodationProvided && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Тип размещения</span>
                    <div className="flex flex-wrap gap-2">
                      {ACCOMMODATION_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setAccommodationType(accommodationType === opt.value ? "" : opt.value)
                          }
                          className={`rounded-xl border px-3 py-2 text-sm transition ${accommodationType === opt.value ? "border-primary bg-primary/8 text-primary" : "border-olive/18 bg-white text-olive/65 hover:border-primary/40"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-olive">Количество ночей</span>
                    <Input
                      type="number"
                      min={0}
                      max={364}
                      value={accommodationNights}
                      onChange={(e) => setAccommodationNights(e.target.value)}
                      placeholder="2"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-olive">Уровень / звёзды</span>
                    <Input
                      value={accommodationStars}
                      onChange={(e) => setAccommodationStars(e.target.value)}
                      placeholder="3*, комфорт"
                      maxLength={20}
                    />
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Типы номеров</span>
                    <div className="flex flex-wrap gap-2">
                      {ROOM_TYPE_OPTIONS.map((opt) => {
                        const sel = roomTypes.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setRoomTypes((prev) =>
                                sel ? prev.filter((r) => r !== opt.value) : [...prev, opt.value],
                              )
                            }
                            className={`rounded-xl border px-3 py-2 text-sm transition ${sel ? "border-primary bg-primary/8 text-primary" : "border-olive/18 bg-white text-olive/65 hover:border-primary/40"}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {accommodationProvided && (
                <>
                  <div className="flex items-center gap-3">
                    <SeaToggle
                      pressed={singleSupplementAvailable === true}
                      onPressedChange={(val) => setSingleSupplementAvailable(val)}
                    />
                    <span className="text-sm text-olive">Доплата за одноместное размещение</span>
                  </div>
                  {singleSupplementAvailable && (
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-olive/60">Сумма доплаты (RUB)</span>
                      <Input
                        type="number"
                        min={0}
                        value={singleSupplementPrice}
                        onChange={(e) => setSingleSupplementPrice(e.target.value)}
                        placeholder="3000"
                      />
                    </label>
                  )}
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-olive/60">
                      Комментарий к проживанию
                    </span>
                    <Input
                      value={accommodationComment}
                      onChange={(e) => setAccommodationComment(e.target.value)}
                      placeholder="Размещение в гостевых домах Южного берега"
                      maxLength={1000}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {/* Meal plan */}
          {isTour && (
            <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm sm:p-5">
              <p className="text-sm font-semibold text-olive">Питание</p>
              <div className="flex flex-wrap gap-2">
                {MEAL_PLAN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMealPlan(mealPlan === opt.value ? "" : opt.value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${mealPlan === opt.value ? "border-primary bg-primary/8 text-primary" : "border-olive/18 bg-white text-olive/65 hover:border-primary/40"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {mealPlan === "CUSTOM" && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Подробности о питании</span>
                  <textarea
                    value={mealDetails}
                    onChange={(e) => setMealDetails(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Пункт 1 — обед в ресторане, пункт 2 — завтрак в отеле + пикник..."
                  />
                </label>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===== STEP 4: ЦЕНА И УСЛОВИЯ (merged old steps 5+6) ===== */}
      {currentStep === 4 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">Цена и условия</h2>
            <p className="mt-1 text-sm text-olive/55">
              Укажите стоимость, что входит в цену, а что нет.
            </p>
          </div>

          {/* ── Группа 1: Стоимость ── */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Стоимость</p>
                <p className="text-xs text-olive/50">
                  Введите минимальную цену и выберите, за что она указана
                </p>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-olive">
                Цена от (RUB) <span className="text-terra">*</span>
              </span>
              <Input
                type="number"
                min={1}
                max={1000000}
                value={priceFrom}
                onChange={(event) => setPriceFrom(event.target.value)}
                placeholder="2500"
              />
            </label>

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">Единица цены</h3>
                <p className="text-xs text-olive/65">
                  Нажмите на подходящий вариант или введите свой. Цена показывается вместе с
                  единицей: «за чел», «за группу» и т.д.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRICE_UNIT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPriceUnitLabel(preset)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      priceUnitLabel === preset
                        ? "border-primary bg-primary/8 text-primary shadow-sm"
                        : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                value={priceUnitLabel}
                onChange={(event) => setPriceUnitLabel(event.target.value)}
                placeholder={isTour ? "Например: тур" : "Например: чел"}
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">Ценовые категории</h3>
                <p className="text-xs text-olive/65">
                  Добавьте разные цены для категорий: взрослые, дети, группы и т.д.
                </p>
              </div>
              <PricingTiersEditor tiers={pricingTiers} onChange={setPricingTiers} />
            </div>
          </div>

          {/* ── Группа 2: Условия отмены ── */}
          <div className="space-y-4 rounded-2xl border border-olive/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-xs font-bold text-white">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Условия отмены</p>
                <p className="text-xs text-olive/50">
                  Необязательно — выберите политику из списка или опишите свою
                </p>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-olive">Условия отмены и возврата</span>
              <select
                value={cancellationPolicyType}
                onChange={(e) => setCancellationPolicyType(e.target.value)}
                className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Не указана</option>
                {CANCELLATION_POLICY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {(cancellationPolicyType === "CUSTOM" || cancellationPolicyText) && (
              <textarea
                value={cancellationPolicyText}
                onChange={(e) => setCancellationPolicyText(e.target.value)}
                placeholder="Опишите условия отмены и возврата..."
                maxLength={1000}
                rows={3}
                className="w-full resize-none rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>

          {/* ── Что включено (inline in step 4) ── */}
          <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Включено в стоимость</p>
                <p className="text-xs text-olive/50">
                  Что турист получает по умолчанию: гид, билеты, трансфер и т.д.
                </p>
              </div>
            </div>
            <IncludedEditor
              items={includedItems}
              onChange={setIncludedItems}
              presets={INCLUDED_PRESETS}
              placeholder="Добавить услугу..."
            />
          </div>

          <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                4
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Не включено</p>
                <p className="text-xs text-olive/50">
                  Что оплачивается дополнительно: питание, сувениры, личные расходы
                </p>
              </div>
            </div>
            <IncludedEditor
              items={excludedItems}
              onChange={setExcludedItems}
              presets={EXCLUDED_PRESETS}
              placeholder="Добавить пункт..."
            />
          </div>
        </section>
      )}

      {/* ===== STEP 5: МЕДИА И КОНТАКТЫ (merged old steps 7+8) ===== */}
      {currentStep === 5 && (
        <section className="wizard-section-enter space-y-5 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <h2 className="text-lg font-semibold text-olive md:text-xl">Медиа и контакты</h2>

          {/* Contacts block */}
          <div className="space-y-6 rounded-3xl border border-olive/10 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <AppIcon icon={Phone} className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-olive">Контакты</h3>
                <p className="mt-0.5 text-sm text-olive/55">
                  Как гости и модерация смогут с вами связаться
                </p>
              </div>
            </div>

            <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive/70">
              Имя, фамилия и основной телефон нужны для модерации. Добавьте второй номер,
              мессенджеры и соцсети, чтобы гостям было удобнее связаться с вами.
            </p>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Основные данные (обязательно)
              </p>
              <div className="space-y-2.5">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                    <AppIcon icon={UserRound} className="h-4 w-4" />
                  </span>
                  <Input
                    value={contactFirstName}
                    onChange={(event) => setContactFirstName(event.target.value)}
                    placeholder="Имя *"
                    aria-label="Имя"
                    className="pl-10"
                  />
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                    <AppIcon icon={UserRound} className="h-4 w-4" />
                  </span>
                  <Input
                    value={contactLastName}
                    onChange={(event) => setContactLastName(event.target.value)}
                    placeholder="Фамилия *"
                    aria-label="Фамилия"
                    className="pl-10"
                  />
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                    <AppIcon icon={Phone} className="h-4 w-4" />
                  </span>
                  <Input
                    type="tel"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder="Телефон *"
                    aria-label="Телефон"
                    className="pl-10"
                  />
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                    <AppIcon icon={Phone} className="h-4 w-4" />
                  </span>
                  <Input
                    type="tel"
                    value={contactPhone2}
                    onChange={(event) => setContactPhone2(event.target.value)}
                    placeholder="Телефон 2"
                    aria-label="Телефон 2"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Дополнительно
              </p>
              <div className="space-y-2.5">
                {showContactEmail ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                      <AppIcon icon={Mail} className="h-4 w-4" />
                    </span>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="Email"
                      aria-label="Email"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setContactEmail("");
                        setShowContactEmail(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Email"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowContactEmail(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-3 py-1.5 text-xs font-medium text-olive/60 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none"
                    >
                      <AppIcon icon={Mail} className="h-4 w-4" />
                      Email
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Мессенджеры и соцсети
              </p>
              <div className="space-y-2.5">
                {showWebsite ? (
                  <div className="relative">
                    <span
                      className={cn(
                        "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2",
                        shouldShowWebsiteFavicon ? "" : "text-[color:var(--icon-muted)]",
                      )}
                    >
                      {shouldShowWebsiteFavicon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={websiteFaviconUrl!}
                          alt=""
                          aria-hidden="true"
                          className="h-4 w-4 rounded-sm object-contain"
                          onError={() => setFailedWebsiteFaviconUrl(websiteFaviconUrl)}
                        />
                      ) : (
                        <AppIcon icon={Globe} className="h-4 w-4" />
                      )}
                    </span>
                    <Input
                      type="url"
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="Сайт экскурсии"
                      aria-label="Сайт экскурсии"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setWebsiteUrl("");
                        setShowWebsite(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить сайт экскурсии"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showWhatsapp ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                    </span>
                    <Input
                      type="text"
                      value={whatsappUrl}
                      onChange={(event) => setWhatsappUrl(event.target.value)}
                      onBlur={() =>
                        setWhatsappUrl((value) => normalizeWhatsappUrl(value) ?? value.trim())
                      }
                      placeholder="WhatsApp: номер или ссылка"
                      aria-label="WhatsApp"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setWhatsappUrl("");
                        setShowWhatsapp(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить WhatsApp"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showTelegram ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                    </span>
                    <Input
                      type="text"
                      value={telegramUrl}
                      onChange={(event) => setTelegramUrl(event.target.value)}
                      onBlur={() =>
                        setTelegramUrl(
                          (value) => normalizeTelegramProfileUrl(value) ?? value.trim(),
                        )
                      }
                      placeholder="Telegram: @username или username"
                      aria-label="Telegram"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTelegramUrl("");
                        setShowTelegram(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Telegram"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showVk ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="vk" bare className="h-4 w-4" />
                    </span>
                    <Input
                      type="url"
                      value={vkUrl}
                      onChange={(event) => setVkUrl(event.target.value)}
                      placeholder="ВКонтакте URL"
                      aria-label="ВКонтакте"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setVkUrl("");
                        setShowVk(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить ВКонтакте"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showMax ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="max" bare className="h-4 w-4" />
                    </span>
                    <Input
                      type="url"
                      value={maxUrl}
                      onChange={(event) => setMaxUrl(event.target.value)}
                      placeholder="Max URL"
                      aria-label="Max"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMaxUrl("");
                        setShowMax(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Max"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showOk ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="ok" bare className="h-4 w-4" />
                    </span>
                    <Input
                      type="url"
                      value={okUrl}
                      onChange={(event) => setOkUrl(event.target.value)}
                      placeholder="Одноклассники URL"
                      aria-label="Одноклассники"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOkUrl("");
                        setShowOk(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Одноклассники"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {(!showWebsite ||
                  !showWhatsapp ||
                  !showTelegram ||
                  !showVk ||
                  !showMax ||
                  !showOk) && (
                  <div className="flex flex-wrap gap-2">
                    {!showWebsite && (
                      <button
                        type="button"
                        onClick={() => setShowWebsite(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-3 py-1.5 text-xs font-medium text-olive/60 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none"
                      >
                        <AppIcon icon={Globe} className="h-4 w-4" />
                        Сайт
                      </button>
                    )}
                    {!showWhatsapp && (
                      <button
                        type="button"
                        onClick={() => setShowWhatsapp(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#25D366]/35 bg-[#25D366]/5 px-3 py-1.5 text-xs font-medium text-[#25D366] transition hover:border-[#25D366]/60 hover:bg-[#25D366]/10 focus:outline-none"
                      >
                        <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                        WhatsApp
                      </button>
                    )}
                    {!showTelegram && (
                      <button
                        type="button"
                        onClick={() => setShowTelegram(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#2AABEE]/35 bg-[#2AABEE]/5 px-3 py-1.5 text-xs font-medium text-[#2AABEE] transition hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/10 focus:outline-none"
                      >
                        <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                        Telegram
                      </button>
                    )}
                    {!showVk && (
                      <button
                        type="button"
                        onClick={() => setShowVk(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#0077FF]/35 bg-[#0077FF]/5 px-3 py-1.5 text-xs font-medium text-[#0077FF] transition hover:border-[#0077FF]/60 hover:bg-[#0077FF]/10 focus:outline-none"
                      >
                        <ContactBrandMark brand="vk" bare className="h-4 w-4" />
                        ВКонтакте
                      </button>
                    )}
                    {!showMax && (
                      <button
                        type="button"
                        onClick={() => setShowMax(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#FF6600]/35 bg-[#FF6600]/5 px-3 py-1.5 text-xs font-medium text-[#FF6600] transition hover:border-[#FF6600]/60 hover:bg-[#FF6600]/10 focus:outline-none"
                      >
                        <ContactBrandMark brand="max" bare className="h-4 w-4" />
                        Max
                      </button>
                    )}
                    {!showOk && (
                      <button
                        type="button"
                        onClick={() => setShowOk(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#EE8208]/35 bg-[#EE8208]/5 px-3 py-1.5 text-xs font-medium text-[#EE8208] transition hover:border-[#EE8208]/60 hover:bg-[#EE8208]/10 focus:outline-none"
                      >
                        <ContactBrandMark brand="ok" bare className="h-4 w-4" />
                        Одноклассники
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guide credentials */}
          <div className="space-y-3 rounded-xl border border-olive/15 bg-cream/30 p-4">
            <h3 className="text-sm font-semibold text-olive">
              Квалификация{" "}
              <span className="text-xs font-normal text-olive/40">(необязательно)</span>
            </h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-olive">Есть удостоверение гида</span>
                <p className="text-xs text-olive/55">
                  Официальная лицензия экскурсовода — повышает доверие к карточке
                </p>
              </div>
              <SeaToggle
                size="sm"
                pressed={hasGuideLicense}
                onPressedChange={setHasGuideLicense}
                aria-label="Есть удостоверение гида"
              />
            </div>
          </div>

          {/* ── БЛОК: МЕДИА ── */}
          <div className="border-t border-olive/8" />

          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-olive">Медиа</h3>
              <p className="text-sm text-olive/70">
                Основные фото используются в верхней галерее карточки. Фото из программы, шагов и
                разделов тоже сохраняются в карточке и могут стать обложкой, если верхняя галерея
                пустая. Поддерживаются {accommodationPhotoUploadFormatsLabel}. Ограничения по
                размеру: {accommodationPhotoUploadLimitsLabel}.
              </p>
            </div>

            <div className="space-y-3">
              <ContentPhotoManager
                title="Верхняя галерея карточки"
                description="Первое фото используется как обложка. Порядок фото сохраняется."
                photoUrls={photoUrls}
                limit={excursionPhotoLimit}
                addLabel="Добавить в галерею"
                emptyText="Фото для верхней галереи пока не загружены."
                disabled={isUploadingPhotos || isSaving || isSavingSchedule || isDeleting}
                isUploading={isUploadingPhotos}
                onUpload={(files) => void uploadPhotos(files)}
                onMove={(photoIndex, direction) => void movePhoto(photoIndex, direction)}
                onMakeFirst={(photoIndex) => void makePhotoCover(photoIndex)}
                onRemove={(photoIndex) => void removePhoto(photoIndex)}
                makeFirstLabel="Сделать обложкой"
                firstBadgeLabel="Обложка"
              />

              <p className="text-xs text-olive/65">
                В верхней галерее {photoUrls.length}/{excursionPhotoLimit}. Всего в карточке
                учитывается {publicCardPhotoCount} фото. Для модерации нужно минимум{" "}
                {excursionPhotoMinForModeration}.
              </p>
              {publicCardPhotoCount < excursionPhotoMinForModeration ? (
                <p className="text-xs text-terra">
                  Добавьте ещё {excursionPhotoMinForModeration - publicCardPhotoCount} фото в
                  галерею, программу или разделы, чтобы отправить карточку на модерацию.
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-olive">Фото по разделам</h4>
                <p className="text-xs text-olive/60">
                  Для каждого раздела можно загрузить отдельные фото или добавить их из уже
                  загруженных.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {sectionPhotoFieldConfigs.map((sectionConfig) => {
                  const selectedUrls = sectionPhotoGroups[sectionConfig.key];
                  const reusablePhotos = reusableSectionPhotoLibrary.filter(
                    (url) => !selectedUrls.includes(url),
                  );

                  return (
                    <div
                      key={sectionConfig.key}
                      className="space-y-3 rounded-2xl border border-olive/10 bg-white/70 p-4"
                    >
                      <ContentPhotoManager
                        title={sectionConfig.title}
                        description={sectionConfig.description}
                        photoUrls={selectedUrls}
                        limit={EXCURSION_SECTION_PHOTO_LIMIT}
                        addLabel={sectionConfig.addLabel}
                        emptyText={sectionConfig.emptyText}
                        disabled={
                          Boolean(programPhotoUploadKey) ||
                          Boolean(sectionPhotoUploadKey) ||
                          isUploadingPhotos ||
                          isSaving ||
                          isSavingSchedule ||
                          isDeleting
                        }
                        isUploading={sectionPhotoUploadKey === sectionConfig.key}
                        onUpload={(files) => void uploadSectionPhotos(sectionConfig.key, files)}
                        onMove={(photoIndex, direction) =>
                          void moveSectionPhoto(sectionConfig.key, photoIndex, direction)
                        }
                        onMakeFirst={(photoIndex) =>
                          void makeSectionPhotoFirst(sectionConfig.key, photoIndex)
                        }
                        onRemove={(photoIndex) =>
                          void removeSectionPhoto(sectionConfig.key, photoIndex)
                        }
                      />

                      {reusablePhotos.length > 0 ? (
                        <div className="rounded-2xl border border-dashed border-olive/15 bg-cream/25 p-3">
                          <p className="text-xs font-medium text-olive/65">
                            Использовать уже загруженные фото
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {reusablePhotos.slice(0, 6).map((url, index) => (
                              <button
                                key={`${sectionConfig.key}-${url}-${index}`}
                                type="button"
                                onClick={() =>
                                  void addExistingPhotoToSection(sectionConfig.key, url)
                                }
                                disabled={
                                  Boolean(sectionPhotoUploadKey) ||
                                  isUploadingPhotos ||
                                  isSaving ||
                                  isSavingSchedule ||
                                  isDeleting
                                }
                                className="flex items-center gap-3 rounded-xl border border-olive/12 bg-white px-2.5 py-2 text-left transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt=""
                                  className="h-12 w-12 rounded-lg object-cover"
                                />
                                <span className="text-xs font-medium text-olive/70">
                                  Добавить фото
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-olive">
              Видео (URL) <span className="text-xs font-normal text-olive/40">(необязательно)</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={videoUrlInput}
                onChange={(event) => setVideoUrlInput(event.target.value)}
                placeholder="https://..."
              />
              <Button
                variant="secondary"
                onClick={addVideoUrl}
                disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
              >
                Добавить
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {videoUrls.map((url, index) => (
                <span
                  key={url}
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs text-olive"
                >
                  <span className="truncate">Видео {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => setVideoUrls((prev) => prev.filter((item) => item !== url))}
                    disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
                    className="text-olive/70 hover:text-olive"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-olive">
                Часто задаваемые вопросы{" "}
                <span className="text-xs font-normal text-olive/40">(необязательно)</span>
              </h3>
              <p className="text-xs text-olive/65">
                FAQ отображается на публичной странице программы.
              </p>
            </div>
            <FaqEditor items={faqItems} onChange={setFaqItems} />
          </div>
        </section>
      )}

      {/* ===== STEP 5 (continued): ПУБЛИКАЦИЯ ===== */}
      {currentStep === 5 && (
        <ExcursionPaymentPanel
          excursionId={excursion.id}
          offerType={offerType}
          excursionTitle={title || excursion.title || ""}
          status={
            excursion.status as
              | "DRAFT"
              | "PENDING_MODERATION"
              | "PUBLISHED"
              | "NEEDS_FIX"
              | "REJECTED"
          }
          pendingEditStatus={
            excursion.pendingEditStatus as
              | "DRAFT"
              | "PENDING_MODERATION"
              | "PUBLISHED"
              | "NEEDS_FIX"
              | "REJECTED"
              | null
          }
          isReady={wizardSteps.slice(0, 5).every((s) => s.status === "complete")}
          readinessReasons={missingRequiredByStep
            .filter((step) => step.index < 5)
            .map((step) => `Раздел «${step.label}»: ${step.items.join(", ")}`)}
          adminMode={adminMode}
          moderationHref={moderationHref}
          listHref={adminMode ? listHref : undefined}
          listLabel={adminMode ? "К списку экскурсий" : undefined}
          previewHref={previewHref}
          onBeforePay={prepareExcursionForPayment}
          onSubmitModeration={submitForModerationFromPayment}
          onStatusChange={() => {
            router.refresh();
          }}
        />
      )}

      {/* Delete action */}
      <div className="flex justify-end px-1">
        <button
          type="button"
          onClick={() => void deleteExcursion()}
          disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-red-500/70 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {isDeleting ? "Удаление..." : "Удалить программу"}
        </button>
      </div>

      {isMapDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/55 sm:items-center sm:p-4">
          <div className="w-full max-h-[95vh] overflow-y-auto rounded-t-2xl border border-olive/15 bg-white p-4 shadow-2xl sm:max-w-4xl sm:rounded-2xl md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-olive">Выбор точки на карте</h3>
              <button
                type="button"
                onClick={closeMapDialog}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/15 text-olive/60 transition hover:bg-cream hover:text-olive"
                aria-label="Закрыть карту"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <YandexMapPicker
                latitude={mapDraftLatitude}
                longitude={mapDraftLongitude}
                onCoordinatesChange={(nextLat, nextLng) => {
                  setMapDraftLatitude(nextLat);
                  setMapDraftLongitude(nextLng);
                }}
                initialSearchValue={mapDraftLocationName || locationInput}
                onLocationSearchResolved={(item) => {
                  const exactMatch = findExactCrimeaLocationByName(item.name);
                  setMapDraftLocationName(exactMatch?.name ?? item.name);
                  setMapDraftLocationId(exactMatch?.id ?? "");
                }}
                onAddressResolved={(resolvedItem: ReverseGeocodeItem) => {
                  setMapDraftAddress(resolvedItem.address);
                  const localityFromGeocode =
                    resolvedItem.localityDisplayName?.trim() ??
                    resolvedItem.localityName?.trim() ??
                    "";

                  if (localityFromGeocode) {
                    setMapDraftLocationName(localityFromGeocode);
                    setMapDraftLocationId("");
                  }

                  setIsResolvingLocationFromMap(true);
                  const resolvedLocation = resolveCrimeaLocationFromAddress(
                    resolvedItem.address,
                    localityFromGeocode,
                  );

                  if (resolvedLocation) {
                    setMapDraftLocationName(resolvedLocation.name);
                    setMapDraftLocationId(resolvedLocation.id);
                  }

                  setIsResolvingLocationFromMap(false);
                }}
              />
            </div>

            <div className="mt-3 space-y-1 rounded-xl bg-cream p-3 text-sm text-olive/80">
              <p>
                Локация Крыма:{" "}
                <span className="font-semibold text-olive">
                  {mapDraftLocationName ||
                    (isResolvingLocationFromMap ? "Определяем..." : "Не определена")}
                </span>
              </p>
              <p>Адрес: {mapDraftAddress || "Не определен"}</p>
              <p className="text-xs text-olive/65">
                Координаты:{" "}
                {mapDraftLatitude !== null && mapDraftLongitude !== null
                  ? `${mapDraftLatitude.toFixed(6)}, ${mapDraftLongitude.toFixed(6)}`
                  : "точка не выбрана"}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={closeMapDialog}>
                Закрыть
              </Button>
              <Button onClick={saveMapSelection}>Сохранить точку</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error/success messages */}
      {error ? (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5">
          <AppIcon icon={CircleX} className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : null}
      {success ? (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-primary/8 px-3 py-2.5">
          <AppIcon icon={CircleCheckBig} className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-olive">{success}</p>
        </div>
      ) : null}

      {/* Footer info */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-olive/45">
        <span>Обновлено {new Date(excursion.updatedAt).toLocaleString("ru-RU")}</span>
        <span className="hidden sm:inline">|</span>
        <span>
          Галерея {photoUrls.length}/{excursionPhotoLimit}
        </span>
        <span>Фото в карточке {publicCardPhotoCount}</span>
        <span>Видео {videoUrls.length}/2</span>
      </div>
    </div>
  );
}
