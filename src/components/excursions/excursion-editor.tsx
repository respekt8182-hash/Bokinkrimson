"use client";

import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionStatus,
} from "@prisma/client";
import {
  CakeSlice,
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
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DepartureDatesEditor,
  type DepartureDateItem,
} from "@/components/excursions/editor/departure-dates-editor";
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
import { crimeaLocations, imageSizeLimitBytes } from "@/lib/constants";
import { isTourOffer } from "@/lib/excursion-offers";
import type { SerializedExcursion } from "@/lib/excursions";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { buildWebsiteFaviconUrl } from "@/lib/website-favicon";
import {
  type ExcursionExtraOption,
  type TimelineStep,
  type ItineraryDay,
  type PricingTier,
  type FaqItem,
  EXCURSION_CATEGORY_TAGS,
  INCLUDED_PRESETS,
  EXCLUDED_PRESETS,
  CANCELLATION_POLICY_OPTIONS,
  HIGHLIGHT_PRESETS,
  OFFER_SUBTYPE_PRESETS,
  OFFER_TYPE_OPTIONS,
  PRICE_UNIT_PRESETS,
  PHYSICAL_REQUIREMENTS_PRESETS,
  TOUR_MEAL_PLAN_OPTIONS,
  WHAT_TO_BRING_PRESETS,
} from "@/types/excursions";

type ExcursionEditorProps = {
  initialExcursion: SerializedExcursion;
  displayExcursionNumber: number;
  adminMode?: boolean;
  backHref?: string;
  backLabel?: string;
  listHref?: string;
  moderationHref?: string | null;
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
const excursionPhotoAccept = "image/jpeg,image/png,image/heic,image/heif";
type SupportedExcursionPhotoUploadType = "jpeg" | "png" | "heic" | "heif";
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

function normalizeMimeType(value: string): string {
  return value.toLowerCase().split(";")[0]?.trim() ?? "";
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }

  return fileName
    .slice(lastDot + 1)
    .toLowerCase()
    .trim();
}

function detectSupportedExcursionPhotoUploadType(
  file: File,
): SupportedExcursionPhotoUploadType | null {
  const mime = normalizeMimeType(file.type);
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";

  const extension = getFileExtension(file.name);
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  if (extension === "png") return "png";
  if (extension === "heic") return "heic";
  if (extension === "heif") return "heif";

  return null;
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
  const [durationMinutes, setDurationMinutes] = useState(
    initialExcursion.durationMinutes === null ? "" : String(initialExcursion.durationMinutes),
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
  const [contactEmail, setContactEmail] = useState(initialExcursion.contactEmail ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialExcursion.websiteUrl ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(initialExcursion.whatsappUrl ?? "");
  const [telegramUrl, setTelegramUrl] = useState(initialExcursion.telegramUrl ?? "");
  const [vkUrl, setVkUrl] = useState(initialExcursion.vkUrl ?? "");
  const [maxUrl, setMaxUrl] = useState(initialExcursion.maxUrl ?? "");
  const [okUrl, setOkUrl] = useState(initialExcursion.okUrl ?? "");
  const [failedWebsiteFaviconUrl, setFailedWebsiteFaviconUrl] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState(initialExcursion.photoUrls);
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
  const [departureDates, setDepartureDates] = useState<DepartureDateItem[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSaveInitRef = useRef(false);
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const newFormatInputRef = useRef<HTMLInputElement | null>(null);
  const newLanguageInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isResolvingLocationFromMap, setIsResolvingLocationFromMap] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isTour = isTourOffer(offerType);

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
      durationMinutes: durationMinutes.trim() ? Number.parseInt(durationMinutes, 10) || null : null,
      durationDays: durationDays.trim() ? Number.parseInt(durationDays, 10) || null : null,
      durationNights: durationNights.trim() ? Number.parseInt(durationNights, 10) || null : null,
      itineraryDays,
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
      mealPlan: normalizeNullableText(mealPlan),
      accommodationComment: normalizeNullableText(accommodationComment),
      transferDetails: transferEnabled ? normalizeNullableText(transferDetails) : null,
      cancellationPolicyType: cancellationPolicyType || null,
      cancellationPolicy: normalizeNullableText(cancellationPolicyText),
      faqItems,
      contactFirstName: normalizeNullableText(contactFirstName),
      contactLastName: normalizeNullableText(contactLastName),
      contactPhone: normalizeNullableText(contactPhone),
      contactEmail: normalizeNullableText(contactEmail),
      websiteUrl: normalizeNullableText(websiteUrl),
      whatsappUrl: normalizeNullableText(whatsappUrl),
      telegramUrl: normalizeTelegramProfileUrl(telegramUrl),
      vkUrl: normalizeNullableText(vkUrl),
      maxUrl: normalizeNullableText(maxUrl),
      okUrl: normalizeNullableText(okUrl),
      photoUrls,
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
    itineraryDays,
    routeDescription,
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
    contactEmail,
    websiteUrl,
    whatsappUrl,
    telegramUrl,
    vkUrl,
    maxUrl,
    okUrl,
    offerType,
    photoUrls,
    subtypeLabel,
    videoUrls,
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
          router.refresh();
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
        // silent — non-critical auto-save
      }
    }, 3000);

    return () => {
      if (scheduleAutoSaveTimerRef.current) {
        clearTimeout(scheduleAutoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daySchedule, isYearRound, seasonDateFrom, seasonDateTo, additionalClosedDates, scheduleComment, availabilityMode, isScheduleConfigValid]);

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

  // Step 0: Описание
  const generalChecks: StepFieldCheck[] = [
    { label: "Тип предложения", done: Boolean(offerType) },
    { label: "Название (минимум 2 символа)", done: title.trim().length >= 2 },
    {
      label: "Общее описание (минимум 20 символов)",
      done: description.trim().length >= 20,
    },
    {
      label: "Основная категория",
      done: tags.length > 0 || Boolean(subtypeLabel.trim()),
      required: false,
    },
  ];
  // Step 1: Программа и маршрут (includes logistics)
  const programChecks: StepFieldCheck[] = [
    {
      label: isTour ? "Длительность в днях" : "Длительность (от 15 минут)",
      done: isTour ? Number(durationDays || 0) >= 1 : Number(durationMinutes || 0) >= 15,
    },
    {
      label: isTour ? "Программа по дням или маршрут" : "Таймлайн или маршрут",
      done: isTour
        ? itineraryDays.length > 0 || routeDescription.trim().length >= 10
        : routeDescription.trim().length >= 10 || timeline.length >= 1,
    },
    { label: "Выбор локации", done: Boolean(locationId) },
    {
      label: "Точка старта",
      done: Boolean(startPoint.trim()),
    },
  ];
  // Step 2: Расписание
  const scheduleChecks: StepFieldCheck[] = [
    {
      label: "Режим доступности",
      done: Boolean(availabilityMode),
    },
    {
      label: "Валидная доступность",
      done:
        availabilityMode === ExcursionAvailabilityMode.REGULAR
          ? isScheduleConfigValid
          : availabilityMode === ExcursionAvailabilityMode.DATED
            ? departureDates.length > 0
            : availabilityNote.trim().length >= 2,
    },
  ];
  // Step 3: Цены и условия
  const pricingChecks: StepFieldCheck[] = [
    { label: "Цена от (больше 0)", done: Number(priceFrom || 0) > 0 },
    {
      label: "Единица цены",
      done: isTour ? priceUnitLabel.trim().length >= 2 : true,
    },
  ];
  // Step 4: Контакты и медиа
  const contactsMediaChecks: StepFieldCheck[] = [
    {
      label: "Контакты (имя, фамилия, телефон)",
      done:
        contactFirstName.trim().length >= 2 &&
        contactLastName.trim().length >= 2 &&
        contactPhone.trim().length >= 10,
    },
    {
      label: `Фотографии (минимум ${excursionPhotoMinForModeration})`,
      done: photoUrls.length >= excursionPhotoMinForModeration,
    },
  ];
  // Step 5: Публикация
  const publishChecks: StepFieldCheck[] = [
    {
      label: "Отправка на модерацию",
      done:
        excursion.status === ExcursionStatus.PENDING_MODERATION ||
        excursion.status === ExcursionStatus.PUBLISHED,
      required: false,
    },
  ];

  const wizardStepStates: WizardStepState[] = [
    buildWizardStepState("Описание", generalChecks),
    buildWizardStepState("Программа и маршрут", programChecks),
    buildWizardStepState("Расписание", scheduleChecks),
    buildWizardStepState("Цены и условия", pricingChecks),
    buildWizardStepState("Контакты и медиа", contactsMediaChecks),
    buildWizardStepState("Публикация", publishChecks),
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

    if (normalizedLocationName && !locationInput.trim()) {
      setLocationInput(normalizedLocationName);
    }

    if (normalizedLocationId && !locationId.trim()) {
      setLocationId(normalizedLocationId);
    }

    if (!startPoint.trim() && mapDraftAddress.trim()) {
      setStartPoint(mapDraftAddress.trim());
    }

    setIsMapDialogOpen(false);
    setError("");
    setSuccess("");
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
    setDurationMinutes(item.durationMinutes === null ? "" : String(item.durationMinutes));
    setDurationDays(item.durationDays === null ? "" : String(item.durationDays));
    setDurationNights(item.durationNights === null ? "" : String(item.durationNights));
    setItineraryDays(item.itineraryDays ?? []);
    setScheduleText(item.scheduleText ?? "");
    setAvailabilityMode(item.availabilityMode);
    setAvailabilityNote(item.availabilityNote ?? "");
    setPriceFrom(item.priceFrom === null ? "" : String(item.priceFrom));
    setContactFirstName(item.contactFirstName ?? "");
    setContactLastName(item.contactLastName ?? "");
    setContactPhone(item.contactPhone ?? "");
    setContactEmail(item.contactEmail ?? "");
    setWebsiteUrl(item.websiteUrl ?? "");
    setWhatsappUrl(item.whatsappUrl ?? "");
    setTelegramUrl(item.telegramUrl ?? "");
    setVkUrl(item.vkUrl ?? "");
    setMaxUrl(item.maxUrl ?? "");
    setOkUrl(item.okUrl ?? "");
    setPhotoUrls(item.photoUrls);
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
    setMealPlan(item.mealPlan ?? "");
    setAccommodationComment(item.accommodationComment ?? "");
    setCancellationPolicyType(item.cancellationPolicyType ?? "");
    setCancellationPolicyText(item.cancellationPolicy ?? "");
    setFaqItems(item.faqItems ?? []);
  }

  async function patchExcursion(payload: Record<string, unknown>): Promise<boolean> {
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
        return false;
      }

      applyExcursion(body.item);
      return true;
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

    if (
      !isTour &&
      parsedDuration !== null &&
      (!Number.isFinite(parsedDuration) || parsedDuration < 15)
    ) {
      setError("Длительность экскурсии должна быть минимум 15 минут");
      return null;
    }

    if (isTour) {
      if (
        parsedDurationDays === null ||
        !Number.isFinite(parsedDurationDays) ||
        parsedDurationDays < 1
      ) {
        setError("Для тура укажите количество дней");
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
      setError("Для тура заполните программу по дням или опишите маршрут");
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
      durationMinutes: isTour ? null : parsedDuration,
      durationDays: isTour ? parsedDurationDays : null,
      durationNights: isTour ? parsedDurationNights : null,
      itineraryDays: isTour ? itineraryDays : [],
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
      contactEmail: normalizeNullableText(contactEmail),
      websiteUrl: normalizeNullableText(websiteUrl),
      whatsappUrl: normalizeNullableText(whatsappUrl),
      telegramUrl: normalizeTelegramProfileUrl(telegramUrl),
      vkUrl: normalizeNullableText(vkUrl),
      maxUrl: normalizeNullableText(maxUrl),
      okUrl: normalizeNullableText(okUrl),
      photoUrls,
      videoUrls,
    };
  }

  async function submitForModerationFromPayment(): Promise<boolean> {
    if (photoUrls.length < excursionPhotoMinForModeration) {
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
      router.refresh();
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
        const uploadType = detectSupportedExcursionPhotoUploadType(file);
        if (!uploadType) {
          setError("Формат не поддерживается. Загрузите JPG, PNG или HEIC.");
          continue;
        }

        if ((uploadType === "jpeg" || uploadType === "png") && file.size > imageSizeLimitBytes) {
          setError(
            "Фотография превышает допустимый размер. Зайдите на сайт для сжатия фотографий, сожмите файл и загрузите его сюда повторно",
          );
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
      router.refresh();
    }
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
                    ? "Опишите тур целиком: маршрут, формат, атмосферу, кому он подойдёт, как проходят дни и что в нём особенного."
                    : "Опишите экскурсию целиком: суть программы, маршрут, что увидят туристы, чем она запомнится и какие эмоции подарит."
                }
              />
              <p className="text-xs text-olive/50">
                Краткое превью для карточек сформируется автоматически из этого текста.
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
                  Расскажите, чем ваша экскурсия запомнится туристу
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">Что вас ждёт</h3>
                <p className="text-xs text-olive/55">
                  3–6 коротких впечатлений и преимуществ. Выберите из готовых или добавьте свои.
                  Этот блок показывается отдельно на публичной странице.
                </p>
              </div>
              <IncludedEditor
                items={highlights}
                onChange={setHighlights}
                presets={HIGHLIGHT_PRESETS}
                placeholder="Например: видовые остановки без спешки"
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
        </section>
      )}

      {/* ===== STEP 1: ПРОГРАММА И УСЛОВИЯ ===== */}
      {currentStep === 1 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">Программа и маршрут</h2>
            <p className="mt-1 text-sm text-olive/55">
              Укажите, где проходит экскурсия, сколько она длится и что в неё входит.
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
                На публичной карточке этот блок помогает честно показать маршрут и возврат.
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

          {/* ── Группа 2: Параметры экскурсии ── */}
          <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Параметры экскурсии</p>
                <p className="text-xs text-olive/50">
                  Длительность, количество участников и возраст — заполните числовые поля
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {isTour ? (
                <>
                  <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                    <div className="flex items-center gap-1.5">
                      <AppIcon icon={Clock3} className="h-4 w-4" />
                      <span className="text-sm font-medium text-olive">Дней</span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={durationDays}
                      onChange={(event) => setDurationDays(event.target.value)}
                      placeholder="3"
                    />
                    <p className="text-xs text-olive/40">Например: 3 дня</p>
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
                      onChange={(event) => setDurationNights(event.target.value)}
                      placeholder="2"
                    />
                    <p className="text-xs text-olive/40">0 — если тур без ночёвки</p>
                  </label>
                </>
              ) : (
                <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                  <div className="flex items-center gap-1.5">
                    <AppIcon icon={Clock3} className="h-4 w-4" />
                    <span className="text-sm font-medium text-olive">Длительность</span>
                  </div>
                  <Input
                    type="number"
                    min={15}
                    max={10080}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
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

              {/* Min participants */}
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <div className="flex items-center gap-1.5">
                  <AppIcon icon={UserRound} className="h-4 w-4" />
                  <span className="text-sm font-medium text-olive">Мин. участников</span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={minParticipants}
                  onChange={(event) => setMinParticipants(event.target.value)}
                  placeholder="1"
                />
                <p className="text-xs text-olive/40">для старта группы</p>
              </label>

              {/* Max participants */}
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <div className="flex items-center gap-1.5">
                  <AppIcon icon={Users} className="h-4 w-4" />
                  <span className="text-sm font-medium text-olive">Макс. участников</span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxParticipants}
                  onChange={(event) => setMaxParticipants(event.target.value)}
                  placeholder="20"
                />
                <p className="text-xs text-olive/40">человек в группе</p>
              </label>

              {/* Min age */}
              <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/15 bg-white p-3 transition hover:border-olive/40">
                <div className="flex items-center gap-1.5">
                  <AppIcon icon={CakeSlice} className="h-4 w-4" />
                  <span className="text-sm font-medium text-olive">Мин. возраст</span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={minAge}
                  onChange={(event) => setMinAge(event.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-olive/40">0 — без ограничений</p>
              </label>
            </div>
          </div>

          {/* ── Группа 3: Физическая подготовка ── */}
          <div className="space-y-5 rounded-2xl border border-olive/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-xs font-bold text-white">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Физическая подготовка</p>
                <p className="text-xs text-olive/50">
                  Необязательно — но помогает туристу заранее оценить нагрузку
                </p>
              </div>
            </div>

            {/* Difficulty level */}
            <div className="space-y-2.5">
              <div>
                <h3 className="text-base font-semibold text-olive">Уровень нагрузки</h3>
                <p className="text-xs text-olive/65">
                  Нажмите на подходящий вариант — активный выделится цветом
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: null, label: "Не указано" },
                    { value: ExcursionDifficulty.EASY, label: "Лёгкая — прогулочный темп" },
                    { value: ExcursionDifficulty.MEDIUM, label: "Умеренная — средний темп" },
                    { value: ExcursionDifficulty.HARD, label: "Активная — высокая нагрузка" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setDifficulty(opt.value)}
                    className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-all ${
                      difficulty === opt.value
                        ? "border-primary bg-primary/8 text-primary shadow-sm"
                        : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

            {/* Physical requirements */}
            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">
                  Физические ограничения
                </h3>
                <p className="text-xs text-olive/65">
                  Нажмите на подходящие пункты или добавьте свой.
                  Укажите, кому экскурсия может не подойти.
                </p>
              </div>
              <IncludedEditor
                items={physicalRequirements}
                onChange={setPhysicalRequirements}
                presets={PHYSICAL_REQUIREMENTS_PRESETS}
                placeholder="Добавить ограничение..."
              />
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

            {/* What to bring */}
            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">
                  Что взять с собой
                </h3>
                <p className="text-xs text-olive/65">
                  Нажмите на пункты из списка или добавьте свои рекомендации.
                </p>
              </div>
              <IncludedEditor
                items={whatToBring}
                onChange={setWhatToBring}
                presets={WHAT_TO_BRING_PRESETS}
                placeholder="Добавить пункт..."
              />
            </div>
          </div>

          {/* ── Группа 4: Маршрут и программа ── */}
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
                      {isTour ? "Программа по дням" : "Пошаговый план (таймлайн)"}
                    </h3>
                    <p className="mt-0.5 text-xs text-olive/60">
                      {isTour
                        ? "Для тура лучше разложить программу по дням: так маршрут выглядит понятнее и убедительнее."
                        : "Добавляйте шаги по порядку — укажите время и описание. Если пусто — на карточке отображается текстовый маршрут."}
                    </p>
                  </div>
                </div>
                {(isTour ? itineraryDays.length : timeline.length) > 0 && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {isTour
                      ? `${itineraryDays.length} ${itineraryDays.length === 1 ? "день" : itineraryDays.length < 5 ? "дня" : "дней"}`
                      : `${timeline.length} ${timeline.length === 1 ? "шаг" : timeline.length < 5 ? "шага" : "шагов"}`}
                  </span>
                )}
              </div>
              {isTour ? (
                <TourDaysEditor days={itineraryDays} onChange={setItineraryDays} />
              ) : (
                <TimelineEditor steps={timeline} onChange={setTimeline} />
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-semibold text-olive">Текстовый маршрут</h3>
                <p className="text-xs text-olive/55">
                  Опишите маршрут своими словами — это будет видно на карточке и на публичной странице.
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

      {/* ===== STEP 2: РАСПИСАНИЕ ===== */}
      {currentStep === 2 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">Расписание</h2>
            <p className="mt-1 text-sm text-olive/55">
              Настройте, когда туристы смогут записаться на вашу экскурсию.
            </p>
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
                          onClick={() =>
                            updateWeekdaySchedule(day, { enabled: !dayItem.enabled })
                          }
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

                {/* Time settings — shown when at least one day is active */}
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
                        <span className="text-sm text-olive/40">–</span>
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
                              <span className="text-sm text-olive/40">–</span>
                              <input
                                type="time"
                                step={60}
                                value={dayItem.to}
                                aria-label={`Конец для ${weekdayLabels[day]}`}
                                onChange={(e) =>
                                  updateWeekdaySchedule(day, { to: e.target.value })
                                }
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
                            ×
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
        </section>
      )}

      {/* ===== STEP 3: ЦЕНЫ И УСЛОВИЯ ===== */}
      {currentStep === 3 && (
        <section className="wizard-section-enter space-y-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-olive md:text-xl">Цены и условия</h2>
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
                  Нажмите на подходящий вариант или введите свой. Цена показывается вместе с единицей: «за чел», «за группу» и т.д.
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

          {/* ── Группа 2: Что входит ── */}
          <div className="space-y-4 rounded-2xl border border-sage/25 bg-[#fffcf3]/60 p-4 shadow-sm shadow-olive/5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-olive">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-olive">Что входит и не входит</p>
                <p className="text-xs text-olive/50">
                  Нажимайте на готовые варианты или добавьте свои — турист сразу увидит, за что платит
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-olive">Включено в стоимость</h3>
              <IncludedEditor
                items={includedItems}
                onChange={setIncludedItems}
                presets={INCLUDED_PRESETS}
                placeholder="Добавить услугу..."
              />
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-olive">Не включено</h3>
              <IncludedEditor
                items={excludedItems}
                onChange={setExcludedItems}
                presets={EXCLUDED_PRESETS}
                placeholder="Добавить пункт..."
              />
            </div>
          </div>

          {/* ── Группа 3: Условия отмены ── */}
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
              <span className="text-sm font-medium text-olive">
                Условия отмены и возврата
              </span>
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

          {/* ── Группа 4: Проживание и питание (для туров) ── */}
          {(isTour || accommodationProvided !== null || accommodationComment.trim()) && (
            <div className="space-y-4 rounded-2xl border border-primary/12 bg-white/80 p-4 shadow-sm shadow-olive/5 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  4
                </span>
                <div>
                  <p className="text-sm font-semibold text-olive">Проживание и питание</p>
                  <p className="text-xs text-olive/50">
                    Для туров — укажите тип размещения и формат питания. Скрывается, если не заполнено.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <p className="w-full text-xs text-olive/45">Нажмите на подходящий вариант:</p>
                {[
                  { value: true, label: "Проживание включено" },
                  { value: false, label: "Без проживания" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setAccommodationProvided(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      accommodationProvided === option.value
                        ? "border-primary bg-primary/8 text-primary shadow-sm"
                        : "border-olive/18 bg-white text-olive/65 hover:border-primary/40 hover:text-olive"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Тип проживания</span>
                  <Input
                    value={accommodationType}
                    onChange={(event) => setAccommodationType(event.target.value)}
                    placeholder="Гостевой дом, отель, кемпинг"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Ночей проживания</span>
                  <Input
                    type="number"
                    min={0}
                    max={364}
                    value={accommodationNights}
                    onChange={(event) => setAccommodationNights(event.target.value)}
                    placeholder="2"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Формат размещения</span>
                  <Input
                    value={accommodationFormat}
                    onChange={(event) => setAccommodationFormat(event.target.value)}
                    placeholder="2-местные номера, single по запросу"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Питание</span>
                  <Input
                    value={mealPlan}
                    onChange={(event) => setMealPlan(event.target.value)}
                    list="meal-plan-presets"
                    placeholder="Выберите или впишите вариант"
                  />
                  <datalist id="meal-plan-presets">
                    {TOUR_MEAL_PLAN_OPTIONS.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-olive">
                  Комментарий по проживанию и питанию
                </span>
                <textarea
                  value={accommodationComment}
                  onChange={(event) => setAccommodationComment(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Например: размещение по 2 человека, завтрак включён, одноместный номер за доплату."
                />
              </label>
            </div>
          )}
        </section>
      )}

      {/* ===== STEP 4: КОНТАКТЫ И МЕДИА ===== */}
      {currentStep === 4 && (
        <section className="wizard-section-enter space-y-5 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)] sm:p-5">
          <h2 className="text-lg font-semibold text-olive md:text-xl">Контакты и медиа</h2>

          <div className="space-y-6 rounded-3xl border border-olive/10 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <AppIcon icon={Phone} className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-olive">Контакты</h3>
                <p className="text-sm text-olive/65">
                  Имя, фамилия и телефон нужны для модерации. Укажите хотя бы один публичный канал
                  связи: телефон, WhatsApp или Telegram.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Основные данные
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
                  {contactEmail ? (
                    <button
                      type="button"
                      onClick={() => setContactEmail("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить email"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Мессенджеры и соцсети
              </p>
              <div className="space-y-2.5">
                <div className="relative">
                  <span
                    className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      shouldShowWebsiteFavicon ? "" : "text-[color:var(--icon-muted)]"
                    }`}
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
                  {websiteUrl ? (
                    <button
                      type="button"
                      onClick={() => setWebsiteUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить сайт экскурсии"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                    <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                  </span>
                  <Input
                    type="url"
                    value={whatsappUrl}
                    onChange={(event) => setWhatsappUrl(event.target.value)}
                    placeholder="WhatsApp URL"
                    aria-label="WhatsApp"
                    className="pl-10 pr-10"
                  />
                  {whatsappUrl ? (
                    <button
                      type="button"
                      onClick={() => setWhatsappUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить WhatsApp"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                    <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                  </span>
                  <Input
                    type="text"
                    value={telegramUrl}
                    onChange={(event) => setTelegramUrl(event.target.value)}
                    placeholder="Telegram: @username или username"
                    aria-label="Telegram"
                    className="pl-10 pr-10"
                  />
                  {telegramUrl ? (
                    <button
                      type="button"
                      onClick={() => setTelegramUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Telegram"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

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
                  {vkUrl ? (
                    <button
                      type="button"
                      onClick={() => setVkUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить ВКонтакте"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

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
                  {maxUrl ? (
                    <button
                      type="button"
                      onClick={() => setMaxUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Max"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

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
                  {okUrl ? (
                    <button
                      type="button"
                      onClick={() => setOkUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Очистить Одноклассники"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
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

          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-olive">Фотографии</h3>
              <p className="text-sm text-olive/70">
                Загрузите от {excursionPhotoMinForModeration} до {excursionPhotoLimit} фото.
                Поддерживаются JPEG, PNG и HEIC.
              </p>
            </div>
            <button
              type="button"
              onClick={() => photoFileInputRef.current?.click()}
              className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-olive/20 bg-white px-4 text-sm font-semibold text-olive transition hover:border-olive/40 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
              disabled={isUploadingPhotos || isSaving || isSavingSchedule || isDeleting}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-2xl leading-none text-primary">
                +
              </span>
              <span>{isUploadingPhotos ? "Загрузка..." : "Добавить"}</span>
            </button>
            <input
              ref={photoFileInputRef}
              type="file"
              multiple
              accept={excursionPhotoAccept}
              onChange={(event) => {
                void uploadPhotos(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
              className="sr-only"
              disabled={isUploadingPhotos || isSaving || isSavingSchedule || isDeleting}
            />
            <p className="text-xs text-olive/65">
              Сейчас загружено {photoUrls.length}/{excursionPhotoLimit}. Для модерации нужно минимум{" "}
              {excursionPhotoMinForModeration} фото.
            </p>
            {photoUrls.length < excursionPhotoMinForModeration ? (
              <p className="text-xs text-terra">
                Добавьте ещё {excursionPhotoMinForModeration - photoUrls.length} фото, чтобы
                отправить программу на модерацию.
              </p>
            ) : null}

            {photoUrls.length === 0 ? (
              <p className="rounded-xl border border-dashed border-olive/25 px-3 py-4 text-sm text-olive/65">
                Фото пока не загружены.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {photoUrls.map((url, index) => (
                  <article
                    key={`${url}-${index}`}
                    className="overflow-hidden rounded-xl border border-olive/15 bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Фото экскурсии ${index + 1}`}
                      className="h-40 w-full object-cover"
                    />
                    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-olive/70">
                      <span>Фото {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void removePhoto(index)}
                        disabled={isUploadingPhotos || isSaving || isSavingSchedule || isDeleting}
                      >
                        Удалить
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
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

      {/* ===== STEP 5: ПУБЛИКАЦИЯ ===== */}
      {currentStep === 5 && (
        <ExcursionPaymentPanel
          excursionId={excursion.id}
          excursionTitle={title || excursion.title || ""}
          status={
            excursion.status as
              | "DRAFT"
              | "PENDING_MODERATION"
              | "PUBLISHED"
              | "NEEDS_FIX"
              | "REJECTED"
          }
          isReady={wizardSteps.slice(0, 5).every((s) => s.status === "complete")}
          readinessReasons={missingRequiredByStep
            .filter((step) => step.index < 5)
            .map((step) => `Раздел «${step.label}»: ${step.items.join(", ")}`)}
          adminMode={adminMode}
          moderationHref={moderationHref}
          listHref={adminMode ? listHref : undefined}
          listLabel={adminMode ? "К списку экскурсий" : undefined}
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
          Фото {photoUrls.length}/{excursionPhotoLimit}
        </span>
        <span>Видео {videoUrls.length}/2</span>
      </div>
    </div>
  );
}
