"use client";

import { ExcursionDifficulty, ExcursionFormat, ExcursionStatus } from "@prisma/client";
import { CakeSlice, Check, ChevronLeft, ChevronRight, CircleCheckBig, CircleX, Clock3, Info, ListChecks, Map, MapPin, PenLine, Plus, TriangleAlert, UserRound, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import { Input } from "@/components/ui/input";
import { SingleDatePopoverField } from "@/components/ui/single-date-popover-field";
import { SeaToggle } from "@/components/ui/sea-toggle";
import { TimePicker } from "@/components/ui/time-picker";
import { WizardStepper } from "@/components/excursions/editor/wizard-stepper";
import { TimelineEditor } from "@/components/excursions/editor/timeline-editor";
import { PricingTiersEditor } from "@/components/excursions/editor/pricing-tiers-editor";
import { IncludedEditor } from "@/components/excursions/editor/included-editor";
import { FaqEditor } from "@/components/excursions/editor/faq-editor";
import { ExcursionPaymentPanel } from "@/components/payments/excursion-payment-panel";
import { crimeaLocations, imageSizeLimitBytes } from "@/lib/constants";
import type { SerializedExcursion } from "@/lib/excursions";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  type TimelineStep,
  type PricingTier,
  type FaqItem,
  EXCURSION_CATEGORY_TAGS,
  INCLUDED_PRESETS,
  EXCLUDED_PRESETS,
  CANCELLATION_POLICY_OPTIONS,
  PHYSICAL_REQUIREMENTS_PRESETS,
  WHAT_TO_BRING_PRESETS,
} from "@/types/excursions";

type ExcursionEditorProps = {
  initialExcursion: SerializedExcursion;
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

const excursionPhotoLimit = 6;
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

function formatMegabytes(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} МБ`;
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

function getSubmitButtonLabel(status: ExcursionStatus): string {
  if (status === ExcursionStatus.PUBLISHED) {
    return "Снять с публикации";
  }

  if (status === ExcursionStatus.PENDING_MODERATION) {
    return "Вернуть в черновик";
  }

  return "Отправить на модерацию";
}

export function ExcursionEditor({ initialExcursion }: ExcursionEditorProps) {
  const router = useRouter();
  const [excursion, setExcursion] = useState(initialExcursion);
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
  const [description, setDescription] = useState(initialExcursion.description ?? "");
  const [routeDescription, setRouteDescription] = useState(initialExcursion.routeDescription ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    initialExcursion.durationMinutes === null ? "" : String(initialExcursion.durationMinutes),
  );
  const [scheduleText, setScheduleText] = useState(initialExcursion.scheduleText ?? "");
  const [isYearRound, setIsYearRound] = useState(true);
  const [seasonDateFrom, setSeasonDateFrom] = useState("");
  const [seasonDateTo, setSeasonDateTo] = useState("");
  const [daySchedule, setDaySchedule] = useState<DayScheduleState>(createDefaultDaySchedule);
  const [bulkTimeFrom, setBulkTimeFrom] = useState("10:00");
  const [bulkTimeTo, setBulkTimeTo] = useState("14:00");
  const [additionalClosedDateDraft, setAdditionalClosedDateDraft] = useState("");
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
  const [photoUrls, setPhotoUrls] = useState(initialExcursion.photoUrls);
  const [videoUrls, setVideoUrls] = useState(initialExcursion.videoUrls);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  // --- Wizard state ---
  const [currentStep, setCurrentStep] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // --- New fields ---
  const [shortDescription, setShortDescription] = useState(initialExcursion.shortDescription ?? "");
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
  const [hasGuideLicense, setHasGuideLicense] = useState(
    initialExcursion.hasGuideLicense ?? false,
  );
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
  const [transferEnabled, setTransferEnabled] = useState(Boolean(initialExcursion.transferDetails));
  const [cancellationPolicyType, setCancellationPolicyType] = useState(
    initialExcursion.cancellationPolicyType ?? "",
  );
  const [cancellationPolicyText, setCancellationPolicyText] = useState(
    initialExcursion.cancellationPolicy ?? "",
  );
  const [faqItems, setFaqItems] = useState<FaqItem[]>(initialExcursion.faqItems ?? []);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const newFormatInputRef = useRef<HTMLInputElement | null>(null);
  const newLanguageInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isResolvingLocationFromMap, setIsResolvingLocationFromMap] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    setIsClientReady(true);
  }, []);

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
        setAdditionalClosedDateDraft("");
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

  // --- Autosave (debounced, 2s) ---
  const buildAutoSavePayload = useCallback((): Record<string, unknown> => {
    const selectedLocation = crimeaLocations.find((loc) => loc.id === locationId);
    const resolvedLocationName = selectedLocation?.name ?? locationInput.trim();
    return {
      title: normalizeNullableText(title),
      locationId: locationId || undefined,
      locationName: resolvedLocationName || undefined,
      mainLocationId: locationId || undefined,
      anchorLocationId: locationId || undefined,
      address: normalizeNullableText(address),
      latitude,
      longitude,
      startPoint: normalizeNullableText(startPoint),
      meetingPointText: normalizeNullableText(startPoint),
      description: normalizeNullableText(description),
      shortDescription: normalizeNullableText(shortDescription),
      fullDescription: normalizeNullableText(description),
      routeDescription: normalizeNullableText(routeDescription),
      durationMinutes: durationMinutes.trim() ? Number.parseInt(durationMinutes, 10) || null : null,
      priceFrom: priceFrom.trim() ? Number.parseFloat(priceFrom) || null : null,
      currency: "RUB",
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
      pricingTiers,
      includedItems,
      excludedItems,
      transferDetails: normalizeNullableText(transferDetails),
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
    title,
    shortDescription,
    locationId,
    locationInput,
    address,
    latitude,
    longitude,
    startPoint,
    description,
    routeDescription,
    durationMinutes,
    priceFrom,
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
    pricingTiers,
    includedItems,
    excludedItems,
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
    photoUrls,
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
    return checks
      .filter((item) => item.required !== false && !item.done)
      .map((item) => item.label);
  }

  function buildWizardStepState(label: string, checks: StepFieldCheck[]): WizardStepState {
    return {
      label,
      status: getStepStatus(checks),
      missingRequired: getMissingRequired(checks),
    };
  }

  // Step 0: Об экскурсии
  const generalChecks: StepFieldCheck[] = [
    { label: "Название (минимум 2 символа)", done: title.trim().length >= 2 },
    {
      label: "Короткое описание (минимум 20 символов)",
      done: shortDescription.trim().length >= 20,
    },
    {
      label: "Полное описание (минимум 20 символов)",
      done: description.trim().length >= 20,
    },
  ];
  // Step 1: Программа и условия
  const programChecks: StepFieldCheck[] = [
    { label: "Длительность (от 15 минут)", done: Number(durationMinutes || 0) >= 15 },
    {
      label: "Маршрут или таймлайн",
      done: routeDescription.trim().length >= 10 || timeline.length >= 2,
      required: false,
    },
  ];
  // Step 2: Место встречи
  const locationChecks: StepFieldCheck[] = [
    { label: "Выбор локации", done: Boolean(locationId) },
  ];
  // Step 3: Доступность и расписание
  const scheduleChecks: StepFieldCheck[] = [
    { label: "Расписание (дни и корректное время)", done: isScheduleConfigValid },
  ];
  // Step 4: Стоимость
  const pricingChecks: StepFieldCheck[] = [
    { label: "Цена от (больше 0)", done: Number(priceFrom || 0) > 0 },
  ];
  // Step 5: Организатор и контакты
  const organizerChecks: StepFieldCheck[] = [
    {
      label: "Контакты (имя, фамилия, телефон)",
      done:
        contactFirstName.trim().length >= 2 &&
        contactLastName.trim().length >= 2 &&
        contactPhone.trim().length >= 10,
    },
  ];
  // Step 6: Медиа и FAQ
  const mediaChecks: StepFieldCheck[] = [
    {
      label: `Фотографии (минимум ${excursionPhotoMinForModeration})`,
      done: photoUrls.length >= excursionPhotoMinForModeration,
    },
  ];
  // Step 7: Проверка и публикация
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
    buildWizardStepState("Об экскурсии", generalChecks),
    buildWizardStepState("Программа", programChecks),
    buildWizardStepState("Место встречи", locationChecks),
    buildWizardStepState("Расписание", scheduleChecks),
    buildWizardStepState("Стоимость", pricingChecks),
    buildWizardStepState("Организатор", organizerChecks),
    buildWizardStepState("Медиа и FAQ", mediaChecks),
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
    setDescription(item.description ?? "");
    setRouteDescription(item.routeDescription ?? "");
    setDurationMinutes(item.durationMinutes === null ? "" : String(item.durationMinutes));
    setScheduleText(item.scheduleText ?? "");
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
    setShortDescription(item.shortDescription ?? "");
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
    setPricingTiers(item.pricingTiers ?? []);
    setIncludedItems(item.includedItems ?? []);
    setExcludedItems(item.excludedItems ?? []);
    setTransferDetails(item.transferDetails ?? "");
    setTransferEnabled(Boolean(item.transferDetails));
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
        setError(body.error ?? "Не удалось сохранить экскурсию");
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

  function applyTimeToActiveDays() {
    if (activeScheduleDays.length === 0) {
      setError("Сначала включите хотя бы один день работы");
      return;
    }

    const fromMinutes = timeToMinutes(bulkTimeFrom);
    const toMinutes = timeToMinutes(bulkTimeTo);
    if (fromMinutes === null || toMinutes === null || toMinutes <= fromMinutes) {
      setError("Проверьте шаблон времени: «До» должно быть позже «С»");
      return;
    }

    setDaySchedule((prev) => {
      const next = { ...prev };
      for (const day of activeScheduleDays) {
        next[day] = {
          ...next[day],
          from: bulkTimeFrom,
          to: bulkTimeTo,
        };
      }
      return next;
    });

    setError("");
  }

  function addClosedDate() {
    if (!additionalClosedDateDraft) {
      return;
    }

    setAdditionalClosedDates((prev) => normalizeIsoDateList([...prev, additionalClosedDateDraft]));
    setAdditionalClosedDateDraft("");
    setError("");
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

  async function saveScheduleRules(): Promise<boolean> {
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
      setError("Название экскурсии должно содержать минимум 2 символа");
      return null;
    }

    if (!locationId) {
      setError("Выберите локацию Крыма из подсказок");
      return null;
    }

    const parsedDuration = durationMinutes.trim()
      ? Number.parseInt(durationMinutes.trim(), 10)
      : null;
    if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration < 15)) {
      setError("Длительность должна быть минимум 15 минут");
      return null;
    }

    const parsedPrice = priceFrom.trim() ? Number.parseFloat(priceFrom.trim()) : null;
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setError("Цена должна быть больше 0");
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

    if (!scheduleSummary || !isScheduleConfigValid) {
      setError("Заполните блок расписания: дни, время, период и корректные дополнительные даты");
      return null;
    }

    const normalizedAddress = normalizeNullableText(address);
    const normalizedStartPoint = normalizeNullableText(startPoint);
    const normalizedDescription = normalizeNullableText(description);
    const normalizedRouteDescription = normalizeNullableText(routeDescription);

    if (normalizedDescription && normalizedDescription.length < 20) {
      setError("Описание должно содержать минимум 20 символов");
      return null;
    }

    if (normalizedRouteDescription && normalizedRouteDescription.length < 10) {
      setError("Маршрут должен содержать минимум 10 символов");
      return null;
    }

    const normalizedShortDescription = normalizeNullableText(shortDescription);
    if (normalizedShortDescription && normalizedShortDescription.length < 20) {
      setError("Короткое описание должно содержать минимум 20 символов");
      return null;
    }

    return {
      title: normalizedTitle,
      locationId,
      locationName: resolvedLocationName,
      mainLocationId: locationId,
      anchorLocationId: locationId,
      address: normalizedAddress,
      latitude,
      longitude,
      startPoint: normalizedStartPoint,
      meetingPointText: normalizedStartPoint,
      description: normalizedDescription,
      shortDescription: normalizedShortDescription,
      fullDescription: normalizedDescription,
      routeDescription: normalizedRouteDescription,
      durationMinutes: parsedDuration,
      scheduleText: scheduleSummary,
      priceFrom: parsedPrice,
      currency: "RUB",
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
      pricingTiers,
      includedItems,
      excludedItems,
      transferDetails: normalizeNullableText(transferDetails),
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

  async function saveDraft() {
    const payload = buildFormPayload();
    if (!payload) {
      return;
    }

    const scheduleSaved = await saveScheduleRules();
    if (!scheduleSaved) {
      return;
    }

    const ok = await patchExcursion(payload);
    if (ok) {
      setSuccess("Черновик экскурсии сохранен");
      router.refresh();
    }
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

    setSuccess("Экскурсия отправлена на модерацию");
    router.refresh();
    return true;
  }

  async function togglePublish() {
    const nextStatus =
      excursion.status === ExcursionStatus.PUBLISHED
        ? ExcursionStatus.DRAFT
        : excursion.status === ExcursionStatus.PENDING_MODERATION
          ? ExcursionStatus.DRAFT
          : ExcursionStatus.PENDING_MODERATION;

    if (
      nextStatus === ExcursionStatus.PENDING_MODERATION &&
      photoUrls.length < excursionPhotoMinForModeration
    ) {
      setError(
        `Добавьте минимум ${excursionPhotoMinForModeration} фото перед отправкой на модерацию`,
      );
      setSuccess("");
      return;
    }

    const payload = buildFormPayload();
    if (!payload) {
      return;
    }

    const scheduleSaved = await saveScheduleRules();
    if (!scheduleSaved) {
      return;
    }

    const ok = await patchExcursion({
      ...payload,
      status: nextStatus,
    });

    if (ok) {
      setSuccess(
        nextStatus === ExcursionStatus.PENDING_MODERATION
          ? "Экскурсия отправлена на модерацию"
          : "Экскурсия переведена в черновик",
      );
      router.refresh();
    }
  }

  async function deleteExcursion() {
    if (!window.confirm("Удалить экскурсию? Это действие нельзя отменить.")) {
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
        setError(body.error ?? "Не удалось удалить экскурсию");
        return;
      }

      router.push("/dashboard/excursions");
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
          setError(`Максимум ${excursionPhotoLimit} фото для экскурсии`);
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
    <div className="space-y-4">
      {/* Wizard Stepper */}
      <WizardStepper
        steps={wizardSteps}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        saveStatus={saveStatus}
      />

      {/* Header - compact and mobile-friendly */}
      <div className="rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/excursions"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-olive/15 text-olive/60 transition hover:bg-cream hover:text-olive"
                title="Назад к списку"
              >
                <AppIcon icon={ChevronLeft} className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-xl font-semibold text-olive md:text-2xl">
                {excursion.title || "Новая экскурсия"}
              </h1>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-olive/60">
              <span>{formatDuration(excursion.durationMinutes)}</span>
              {excursion.avgRating > 0 && (
                <span>
                  {excursion.avgRating.toFixed(1)} ({excursion.reviewsCount})
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-sage/25 px-2.5 py-1 text-[11px] font-semibold uppercase text-olive">
            {excursion.statusLabel}
          </span>
        </div>

        {excursion.moderationNotes ? (
          <div className="mt-3 flex gap-2 rounded-xl bg-terra/8 p-3">
            <AppIcon icon={TriangleAlert} className="mt-0.5 h-4 w-4 shrink-0 text-terra" />
            <p className="text-sm text-olive/85">{excursion.moderationNotes}</p>
          </div>
        ) : null}
      </div>

      {/* ===== STEP 0: ОСНОВНОЕ ===== */}
      {currentStep === 0 && (
        <section className="wizard-section-enter overflow-hidden rounded-2xl border border-olive/10 bg-white shadow-sm">
          {/* Section header */}
          <div className="border-b border-olive/8 bg-gradient-to-r from-primary/6 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <AppIcon icon={PenLine} className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-olive md:text-lg">Об экскурсии</h2>
                <p className="text-xs text-olive/50">
                  Название, аннотация, описание, категории и язык проведения
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            {/* Название */}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-olive">Название</span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Обзорная экскурсия по Ялте"
              />
              <p className="text-xs text-olive/50">
                Коротко и по делу, без эмодзи — до 120 символов
              </p>
            </label>

            {/* Короткое описание (аннотация) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-olive">Короткое описание</span>
                <span className="tabular-nums text-xs text-olive/50">
                  {shortDescription.length}/300
                </span>
              </div>
              <textarea
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="1–2 предложения: суть экскурсии и главное впечатление. Показывается в карточке-превью."
              />
            </div>

            {/* Полное описание */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-olive">Полное описание</span>
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
                placeholder="Подробно опишите экскурсию: маршрут, что увидят туристы, чем запомнится, какие эмоции получат"
              />
            </div>

            <div className="border-t border-olive/8" />

            {/* Категории */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-olive">Категории</span>
                {tags.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {tags.length}
                  </span>
                )}
              </div>
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
                    placeholder="Добавить категорию"
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
                  label="Добавить категорию"
                  onClick={() => {
                    setIsAddingTag(true);
                    setError("");
                  }}
                />
              )}
            </div>

            <div className="border-t border-olive/8" />

            {/* Тип экскурсии */}
            <div className="space-y-2.5">
              <span className="text-sm font-medium text-olive">Тип экскурсии</span>
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
                        {isSelected && (
                          <AppIcon icon={Check} className="h-3 w-3" />
                        )}
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
        <section className="wizard-section-enter space-y-6 rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-6">
          {/* Section header */}
          <div className="flex items-center gap-3 border-b border-olive/8 pb-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <AppIcon icon={Map} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-olive md:text-xl">
                Программа и условия участия
              </h2>
              <p className="text-xs text-olive/55">
                Длительность, число участников, уровень нагрузки и маршрут
              </p>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {/* Duration */}
            <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/12 bg-olive/[3%] p-3.5 transition hover:border-primary/30 hover:bg-primary/5">
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

            {/* Min participants */}
            <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/12 bg-olive/[3%] p-3.5 transition hover:border-primary/30 hover:bg-primary/5">
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
            <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/12 bg-olive/[3%] p-3.5 transition hover:border-primary/30 hover:bg-primary/5">
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
            <label className="block cursor-pointer space-y-1.5 rounded-xl border border-olive/12 bg-olive/[3%] p-3.5 transition hover:border-primary/30 hover:bg-primary/5">
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

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

          {/* Difficulty level */}
          <div className="space-y-2.5">
            <div>
              <h3 className="text-base font-semibold text-olive">Уровень нагрузки</h3>
              <p className="text-xs text-olive/65">
                Помогает туристам понять, подойдёт ли им эта экскурсия физически{" "}
                <span className="text-olive/40">(необязательно)</span>
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

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

          {/* Physical requirements */}
          <div className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-olive">
                Физические ограничения{" "}
                <span className="text-xs font-normal text-olive/40">(необязательно)</span>
              </h3>
              <p className="text-xs text-olive/65">
                Укажите, кому экскурсия может не подойти по здоровью или физической форме.
              </p>
            </div>
            <IncludedEditor
              items={physicalRequirements}
              onChange={setPhysicalRequirements}
              presets={PHYSICAL_REQUIREMENTS_PRESETS}
              placeholder="Добавить ограничение..."
            />
          </div>

          {/* What to bring */}
          <div className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-olive">
                Что взять с собой{" "}
                <span className="text-xs font-normal text-olive/40">(необязательно)</span>
              </h3>
              <p className="text-xs text-olive/65">
                Рекомендации по снаряжению, одежде и личным вещам.
              </p>
            </div>
            <IncludedEditor
              items={whatToBring}
              onChange={setWhatToBring}
              presets={WHAT_TO_BRING_PRESETS}
              placeholder="Добавить пункт..."
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-olive/10 to-transparent" />

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/10 text-terra">
                  <AppIcon icon={ListChecks} className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-olive">Пошаговый план (таймлайн)</h3>
                  <p className="mt-0.5 text-xs text-olive/60">
                    Наглядный план с временем и описанием каждого шага. Если пусто — на карточке
                    отображается текстовый маршрут.
                  </p>
                </div>
              </div>
              {timeline.length > 0 && (
                <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {timeline.length}{" "}
                  {timeline.length === 1 ? "шаг" : timeline.length < 5 ? "шага" : "шагов"}
                </span>
              )}
            </div>
            <TimelineEditor steps={timeline} onChange={setTimeline} />
          </div>
        </section>
      )}

      {/* ===== STEP 2: МЕСТО ВСТРЕЧИ ===== */}
      {currentStep === 2 && (
        <section className="wizard-section-enter overflow-hidden rounded-2xl border border-olive/8 bg-white shadow-sm">
          {/* Section header */}
          <div className="border-b border-olive/8 bg-gradient-to-r from-primary/6 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <AppIcon icon={MapPin} className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-olive md:text-lg">
                  Место встречи и логистика
                </h2>
                <p className="text-xs text-olive/50">
                  Регион, точка на карте, где собираются участники и условия трансфера
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-7 p-5">
            {/* ── БЛОК: ЛОКАЦИЯ ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-olive/8" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-olive/35">
                  Район проведения
                </span>
                <div className="h-px flex-1 bg-olive/8" />
              </div>

              {/* Location picker */}
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-olive">
                  Населённый пункт <span className="text-terra">*</span>
                </span>
                <div className="space-y-1">
                  <Input
                    value={locationInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setLocationInput(nextValue);

                      const normalized = nextValue.trim().toLowerCase();
                      const exactMatch = crimeaLocations.find(
                        (location) => location.name.toLowerCase() === normalized,
                      );
                      setLocationId(exactMatch?.id ?? "");
                    }}
                    placeholder="Ялта, Судак, с. Добровское..."
                  />
                  <p className="text-xs text-olive/45">
                    Заполнится автоматически при выборе точки на карте
                  </p>
                </div>
              </div>

              {/* Map point */}
              <div className="space-y-3 rounded-xl border border-olive/12 bg-cream/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm text-olive/55">
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
                    {latitude && longitude ? "Изменить точку" : "Открыть карту"}
                  </Button>
                </div>

                <div
                  className="relative overflow-hidden rounded-xl border border-olive/12 bg-cream"
                  style={{ height: "152px" }}
                >
                  <Image
                    src="/crimea-map-preview.svg"
                    alt="Превью карты Крыма"
                    fill
                    sizes="100vw"
                    className="object-cover object-center scale-110"
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight/55 via-midnight/15 to-transparent" />
                  {latitude && longitude ? (
                    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/92 px-2.5 py-1.5 text-xs font-semibold text-olive shadow-sm backdrop-blur-sm">
                        <AppIcon icon={CircleCheckBig} className="h-3 w-3 text-sage" />
                        Точка выбрана
                      </span>
                      <span className="text-xs text-white/70">
                        {latitude.toFixed(4)}, {longitude.toFixed(4)}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-x-3 bottom-3">
                      <p className="text-xs text-white/75">
                        Нажмите «Открыть карту», чтобы выбрать точку на карте Крыма
                      </p>
                    </div>
                  )}
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

              {/* Start point */}
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

              {/* Transfer */}
              <div className="space-y-2 rounded-xl border border-olive/15 bg-cream/30 p-3">
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
                {transferEnabled && (
                  <textarea
                    value={transferDetails}
                    onChange={(e) => setTransferDetails(e.target.value)}
                    placeholder="Откуда, куда, во сколько, стоимость или бесплатно..."
                    maxLength={300}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== STEP 3: ДОСТУПНОСТЬ И РАСПИСАНИЕ ===== */}
      {currentStep === 3 && (
        <section className="wizard-section-enter overflow-hidden rounded-2xl border border-olive/8 bg-white shadow-sm">
          {/* Section header */}
          <div className="border-b border-olive/8 bg-gradient-to-r from-primary/6 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <AppIcon icon={Clock3} className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-olive md:text-lg">
                  Доступность и расписание
                </h2>
                <p className="text-xs text-olive/50">
                  Рабочие дни, время, сезонность и минимальный срок записи
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-7 p-5">
            {/* ── БЛОК: РАСПИСАНИЕ ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-olive/8" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-olive/35">
                  Расписание
                </span>
                <div className="h-px flex-1 bg-olive/8" />
              </div>

              {/* Year-round vs season toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-olive/12 bg-cream/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-olive">Период доступности</p>
                  <p className="text-xs text-olive/55 mt-0.5">
                    {isYearRound
                      ? "Экскурсия проводится круглый год"
                      : "Укажите начало и конец сезона"}
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-olive/15 bg-white p-1">
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
                  <p className="text-sm font-semibold text-olive">Рабочие дни</p>
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

              {/* Time settings — shown when at least one day is active */}
              {activeScheduleDays.length > 0 ? (
                <div className="rounded-xl border border-olive/12 bg-white p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-olive">Время работы</p>
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
                              if (prev[day].enabled) next[day] = { ...next[day], from: e.target.value };
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
                              if (prev[day].enabled) next[day] = { ...next[day], to: e.target.value };
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
                              onChange={(e) => updateWeekdaySchedule(day, { from: e.target.value })}
                              className="h-8 rounded-lg border border-olive/18 bg-white px-2 text-sm font-semibold text-olive [color-scheme:light] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
                            />
                            <span className="text-sm text-olive/40">–</span>
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
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-olive/20 bg-cream/30 px-4 py-3.5">
                  <AppIcon icon={Clock3} className="h-4.5 w-4.5 shrink-0 opacity-55" />
                  <p className="text-sm text-olive/45">
                    Включите рабочие дни выше, чтобы задать время работы
                  </p>
                </div>
              )}

              {/* Closed dates / exceptions */}
              <div className="rounded-xl border border-olive/12 bg-white p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-olive">Нерабочие даты</p>
                  <p className="text-xs text-olive/50 mt-0.5">
                    Конкретные дни, когда экскурсия не проводится (праздники, перерыв)
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
                    За сколько часов нужно записаться заранее
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
          </div>
        </section>
      )}

      {/* ===== STEP 4: СТОИМОСТЬ ===== */}
      {currentStep === 4 && (
        <section className="wizard-section-enter space-y-4 rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-5">
          <div className="border-b border-olive/8 pb-4">
            <h2 className="text-lg font-semibold text-olive md:text-xl">Стоимость и условия записи</h2>
            <p className="mt-0.5 text-xs text-olive/50">Цена, тарифы, что включено и условия отмены</p>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-olive">Цена от (RUB)</span>
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
              <h3 className="text-lg text-olive">Ценовые категории</h3>
              <p className="text-xs text-olive/65">
                Укажите разные цены для категорий участников (взрослые, дети, группы).
              </p>
            </div>
            <PricingTiersEditor tiers={pricingTiers} onChange={setPricingTiers} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg text-olive">Включено в стоимость</h3>
            <IncludedEditor
              items={includedItems}
              onChange={setIncludedItems}
              presets={INCLUDED_PRESETS}
              placeholder="Добавить услугу..."
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg text-olive">Не включено</h3>
            <IncludedEditor
              items={excludedItems}
              onChange={setExcludedItems}
              presets={EXCLUDED_PRESETS}
              placeholder="Добавить пункт..."
            />
          </div>

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-olive">
                Условия отмены и возврата{" "}
                <span className="text-xs font-normal text-olive/40">(необязательно)</span>
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
        </section>
      )}

      {/* ===== STEP 5: ОРГАНИЗАТОР ===== */}
      {currentStep === 5 && (
        <section className="wizard-section-enter space-y-4 rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-5">
          <div className="border-b border-olive/8 pb-4">
            <h2 className="text-lg font-semibold text-olive md:text-xl">Организатор и контакты</h2>
            <p className="mt-0.5 text-xs text-olive/50">
              Хотя бы один прямой канал связи обязателен для публикации
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-olive">Контакты</h3>
              <p className="text-xs text-olive/65">
                Имя, фамилия и телефон нужны для модерации. Укажите хотя бы один публичный канал
                связи — телефон, WhatsApp или Telegram.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Имя</span>
                <Input
                  value={contactFirstName}
                  onChange={(event) => setContactFirstName(event.target.value)}
                  placeholder="Иван"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Фамилия</span>
                <Input
                  value={contactLastName}
                  onChange={(event) => setContactLastName(event.target.value)}
                  placeholder="Иванов"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Телефон</span>
                <Input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="+7 (999) 123-45-67"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Email (необязательно)</span>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="mail@example.com"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">
                  Сайт экскурсии (необязательно)
                </span>
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://example.com"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">WhatsApp (необязательно)</span>
                <Input
                  type="url"
                  value={whatsappUrl}
                  onChange={(event) => setWhatsappUrl(event.target.value)}
                  placeholder="https://wa.me/79991234567"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">Telegram (необязательно)</span>
                <Input
                  type="text"
                  value={telegramUrl}
                  onChange={(event) => setTelegramUrl(event.target.value)}
                  placeholder="@username или username"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-olive">VK (необязательно)</span>
                <Input
                  type="url"
                  value={vkUrl}
                  onChange={(event) => setVkUrl(event.target.value)}
                  placeholder="https://vk.com/username"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-olive">
                  Одноклассники (необязательно)
                </span>
                <Input
                  type="url"
                  value={okUrl}
                  onChange={(event) => setOkUrl(event.target.value)}
                  placeholder="https://ok.ru/profile/..."
                />
              </label>
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
        </section>
      )}

      {/* ===== STEP 6: МЕДИА И FAQ ===== */}
      {currentStep === 6 && (
        <section className="wizard-section-enter space-y-4 rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-5">
          <div className="border-b border-olive/8 pb-4">
            <h2 className="text-lg font-semibold text-olive md:text-xl">Медиа и FAQ</h2>
            <p className="mt-0.5 text-xs text-olive/50">
              Минимум 3 фото для публикации, видео и ответы на частые вопросы — необязательно
            </p>
          </div>

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
              className="inline-flex h-[62px] w-full items-center justify-center gap-3 rounded-2xl border border-sand bg-white px-4 text-base font-semibold text-olive transition hover:border-olive/32 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
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
                отправить экскурсию на модерацию.
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
              Видео (URL){" "}
              <span className="text-xs font-normal text-olive/40">(необязательно)</span>
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
                FAQ отображается на публичной странице экскурсии.
              </p>
            </div>
            <FaqEditor items={faqItems} onChange={setFaqItems} />
          </div>
        </section>
      )}

      {/* ===== STEP 7: ПРОВЕРКА И ПУБЛИКАЦИЯ ===== */}
      {currentStep === 7 && (
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
          isReady={wizardSteps.slice(0, 7).every((s) => s.status === "complete")}
          readinessReasons={missingRequiredByStep
            .filter((step) => step.index < 7)
            .map((step) => `Раздел «${step.label}»: ${step.items.join(", ")}`)}
          onSubmitModeration={submitForModerationFromPayment}
          onStatusChange={() => {
            router.refresh();
          }}
        />
      )}

      {/* Sticky bottom navigation bar */}
      <div className="sticky-bottom-enter sticky bottom-0 z-30 -mx-4 border-t border-olive/10 bg-white/95 px-4 py-3 backdrop-blur-sm md:static md:mx-0 md:rounded-2xl md:border md:border-olive/8 md:px-5 md:py-4 md:shadow-sm md:backdrop-blur-none">
        {/* Step navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-olive/15 px-3 py-2 text-sm font-medium text-olive/70 transition hover:bg-cream hover:text-olive"
              >
                <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                <span className="hidden sm:inline">Назад</span>
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => void saveDraft()}
              disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
            >
              {isSaving || isSavingSchedule ? "Сохранение..." : "Сохранить"}
            </Button>

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s + 1)}
                className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/15"
              >
                <span>{currentStep === 6 ? "К публикации" : "Далее"}</span>
                <AppIcon icon={ChevronRight} className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Publish/Delete actions */}
        {(currentStep === 7 || isClientReady) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-olive/8 pt-2 md:mt-3 md:pt-3">
            {excursion.status === ExcursionStatus.PUBLISHED ||
            excursion.status === ExcursionStatus.PENDING_MODERATION ? (
              <Button
                variant="secondary"
                onClick={() => void togglePublish()}
                disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
              >
                {getSubmitButtonLabel(excursion.status)}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(7)}
                disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
              >
                К публикации
              </Button>
            )}
            <button
              type="button"
              onClick={() => void deleteExcursion()}
              disabled={isSaving || isSavingSchedule || isDeleting || isUploadingPhotos}
              className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-red-500/70 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </button>
          </div>
        )}
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
