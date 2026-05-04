// Shared domain types for excursion timeline, pricing, and FAQ structures.

// ─── TOUR-SPECIFIC ENUMS & TYPES ────────────────────────────────────────────

export const TOUR_KIND_OPTIONS = [
  { value: "ONE_DAY", label: "Однодневный" },
  { value: "WEEKEND", label: "Выходного дня" },
  { value: "MULTI_DAY", label: "Многодневный" },
  { value: "JEEP", label: "Джип-тур" },
  { value: "BOAT", label: "Водный / морской" },
  { value: "HIKING", label: "Пеший / треккинг" },
  { value: "BUS", label: "Автобусный" },
  { value: "COMBINED", label: "Комбинированный" },
  { value: "EXPEDITION", label: "Экспедиция" },
  { value: "CRUISE", label: "Круиз" },
  { value: "OTHER", label: "Другое" },
] as const;

export type TourKind = (typeof TOUR_KIND_OPTIONS)[number]["value"];

export const TRANSPORT_MODE_OPTIONS = [
  { value: "WALKING", label: "Пешком" },
  { value: "BUS", label: "Автобус" },
  { value: "MINIVAN", label: "Микроавтобус" },
  { value: "CAR", label: "Легковой автомобиль" },
  { value: "JEEP", label: "Внедорожник / джип" },
  { value: "ATV", label: "Квадроцикл" },
  { value: "BOAT", label: "Катер / лодка" },
  { value: "TRAIN", label: "Поезд" },
  { value: "FLIGHT", label: "Самолёт" },
  { value: "MIXED", label: "Смешанный" },
] as const;

export type TransportMode = (typeof TRANSPORT_MODE_OPTIONS)[number]["value"];

export const DEPARTURE_MODE_OPTIONS = [
  { value: "FIXED_DATES", label: "Фиксированные даты заездов" },
  { value: "ON_REQUEST", label: "По запросу" },
  { value: "DAILY", label: "Ежедневно" },
  { value: "SEASONAL", label: "Сезонно" },
  { value: "PRIVATE_ONLY", label: "Только индивидуально" },
] as const;

export type DepartureMode = (typeof DEPARTURE_MODE_OPTIONS)[number]["value"];

export const ROOM_TYPE_OPTIONS = [
  { value: "SINGLE", label: "Одноместный" },
  { value: "DOUBLE", label: "Двухместный (double)" },
  { value: "TWIN", label: "Двухместный (twin)" },
  { value: "TRIPLE", label: "Трёхместный" },
  { value: "SHARED", label: "Общий номер / хостел" },
  { value: "CAMPING", label: "Палатка / кемпинг" },
] as const;

export type RoomType = (typeof ROOM_TYPE_OPTIONS)[number]["value"];

export const MEAL_PLAN_OPTIONS = [
  { value: "NONE", label: "Не включено" },
  { value: "BREAKFAST", label: "Завтрак" },
  { value: "HALF_BOARD", label: "Завтрак + ужин" },
  { value: "FULL_BOARD", label: "Полный пансион" },
  { value: "ALL_INCLUSIVE", label: "Всё включено" },
  { value: "CUSTOM", label: "По программе / частично" },
] as const;

export type MealPlanType = (typeof MEAL_PLAN_OPTIONS)[number]["value"];

export const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "HOTEL", label: "Отель" },
  { value: "GUESTHOUSE", label: "Гостевой дом" },
  { value: "HOSTEL", label: "Хостел" },
  { value: "CAMPING", label: "Кемпинг / палатка" },
  { value: "APARTMENT", label: "Апартаменты / квартира" },
  { value: "VILLA", label: "Вилла / коттедж" },
  { value: "MIXED", label: "Разные по программе" },
] as const;

export const EQUIPMENT_PROVIDED_PRESETS = [
  "Палатка",
  "Спальный мешок",
  "Коврик",
  "Рюкзак",
  "Трекинговые палки",
  "Каска",
  "Спасательный жилет",
  "Фонарик",
  "Аптечка",
  "Рация",
];

export const DOCUMENTS_REQUIRED_PRESETS = [
  "Паспорт РФ",
  "Загранпаспорт",
  "Медицинская справка",
  "Страховой полис",
  "Водительское удостоверение",
  "Согласие родителей (для несовершеннолетних)",
];

// ─── Optional activity / extra (enhanced) ───────────────────────────────────

export type OptionalActivity = {
  title: string;
  description?: string;
  price?: number | null;
  currency?: string;
  isPerPerson?: boolean;
};

// ─── Enhanced Pricing Tier ──────────────────────────────────────────────────

export type PricingTierV2 = {
  code?: string;
  label: string;
  price: number;
  currency?: string;
  ageFrom?: number | null;
  ageTo?: number | null;
  minPeople?: number | null;
  maxPeople?: number | null;
  isDefault?: boolean;
  comment?: string;
};

export const ITINERARY_ITEM_LABEL_VALUES = ["day", "stage", "step", "point"] as const;

export type ItineraryItemLabel = (typeof ITINERARY_ITEM_LABEL_VALUES)[number];

export const ITINERARY_ITEM_LABEL_OPTIONS = [
  { value: "day", label: "День" },
  { value: "stage", label: "Этап" },
  { value: "step", label: "Шаг" },
  { value: "point", label: "Пункт" },
] as const;

type ItineraryItemLabelMeta = {
  label: string;
  one: string;
  few: string;
  many: string;
  programTitle: string;
};

const ITINERARY_ITEM_LABEL_META: Record<ItineraryItemLabel, ItineraryItemLabelMeta> = {
  day: {
    label: "День",
    one: "день",
    few: "дня",
    many: "дней",
    programTitle: "Программа по дням",
  },
  stage: {
    label: "Этап",
    one: "этап",
    few: "этапа",
    many: "этапов",
    programTitle: "Программа по этапам",
  },
  step: {
    label: "Шаг",
    one: "шаг",
    few: "шага",
    many: "шагов",
    programTitle: "Программа по шагам",
  },
  point: {
    label: "Пункт",
    one: "пункт",
    few: "пункта",
    many: "пунктов",
    programTitle: "Программа по пунктам",
  },
};

export const DEFAULT_ITINERARY_ITEM_LABEL: ItineraryItemLabel = "day";

export function resolveItineraryItemLabel(value?: string | null): ItineraryItemLabel {
  if (value && Object.prototype.hasOwnProperty.call(ITINERARY_ITEM_LABEL_META, value)) {
    return value as ItineraryItemLabel;
  }

  return DEFAULT_ITINERARY_ITEM_LABEL;
}

export function getItineraryItemDisplayLabel(value?: string | null): string {
  return ITINERARY_ITEM_LABEL_META[resolveItineraryItemLabel(value)].label;
}

export function getItineraryItemNoun(value: string | null | undefined, count: number): string {
  const meta = ITINERARY_ITEM_LABEL_META[resolveItineraryItemLabel(value)];
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return meta.one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return meta.few;
  }

  return meta.many;
}

export function formatItineraryItemCount(value: string | null | undefined, count: number): string {
  return `${count} ${getItineraryItemNoun(value, count)}`;
}

export function formatItineraryItemIndexLabel(
  value: string | null | undefined,
  index: number,
): string {
  return `${getItineraryItemDisplayLabel(value)} ${index}`;
}

export function getItineraryProgramTitle(value?: string | null): string {
  return ITINERARY_ITEM_LABEL_META[resolveItineraryItemLabel(value)].programTitle;
}

// Enhanced itinerary day

export type ItineraryDayV2 = {
  day: number;
  itemLabel?: ItineraryItemLabel;
  title: string;
  teaser?: string;
  description: string;
  locations: string[];
  startTime?: string;
  endTime?: string;
  activities?: string[];
  mealsIncluded?: string[];
  transportModes?: string[];
  overnightLocation?: string;
  accommodationName?: string;
  optionalExtras?: string[];
  notes?: string;
  // backward-compat
  included?: string[];
  meals?: string;
  accommodation?: string;
};

// ─── Visibility helpers ─────────────────────────────────────────────────────

/** Tour kinds that require safety/equipment/route conditions sections */
export const ACTIVE_TOUR_KINDS: TourKind[] = ["JEEP", "BOAT", "HIKING", "EXPEDITION"];
/** Transport modes that trigger safety block */
export const ACTIVE_TRANSPORT_MODES: TransportMode[] = ["JEEP", "ATV", "BOAT"];

export function requiresAccommodationBlock(opts: {
  offerType: string;
  durationNights?: number | null;
  accommodationProvided?: boolean | null;
}): boolean {
  if (opts.offerType !== "TOUR") return false;
  if (opts.accommodationProvided) return true;
  if (opts.durationNights && opts.durationNights > 0) return true;
  return false;
}

export function requiresSafetyBlock(opts: {
  tourKind?: string | null;
  transportModes?: string[];
}): boolean {
  if (opts.tourKind && ACTIVE_TOUR_KINDS.includes(opts.tourKind as TourKind)) return true;
  if (opts.transportModes?.some((m) => ACTIVE_TRANSPORT_MODES.includes(m as TransportMode)))
    return true;
  return false;
}

// ─── ORIGINAL TYPES ─────────────────────────────────────────────────────────

export type TimelineStepIcon =
  | "meeting_point"
  | "bus"
  | "walking"
  | "sightseeing"
  | "viewpoint"
  | "cable_car"
  | "wine_tasting"
  | "food"
  | "photo_stop"
  | "free_time"
  | "museum"
  | "beach"
  | "swimming"
  | "hiking"
  | "boat"
  | "shopping"
  | "sunset"
  | "finish";

export type TimelineStep = {
  step: number;
  time: string;
  duration: string;
  title: string;
  description?: string;
  location?: string;
  icon?: TimelineStepIcon;
  photoUrls?: string[];
};

export type PricingTier = {
  label: string;
  price: number;
  // V2 optional extensions (backward-compatible)
  code?: string;
  currency?: string;
  ageFrom?: number | null;
  ageTo?: number | null;
  minPeople?: number | null;
  maxPeople?: number | null;
  isDefault?: boolean;
  comment?: string;
};

export type FaqItem = {
  q: string;
  a: string;
};

export type ItineraryDay = {
  day: number;
  itemLabel?: ItineraryItemLabel;
  title: string;
  teaser?: string;
  description: string;
  locations: string[];
  startTime?: string;
  endTime?: string;
  included?: string[];
  meals?: string;
  accommodation?: string;
  activities?: string[];
  // V2 extensions (backward-compatible)
  mealsIncluded?: string[];
  transportModes?: string[];
  overnightLocation?: string;
  accommodationName?: string;
  optionalExtras?: string[];
  notes?: string;
  photoUrls?: string[];
};

export const EXCURSION_PROGRAM_PHOTO_LIMIT = 4;
export const EXCURSION_SECTION_PHOTO_LIMIT = 8;

export const EXCURSION_SECTION_PHOTO_GROUP_KEYS = [
  "dates",
  "program",
  "logistics",
  "accommodation",
  "included",
  "requirements",
] as const;

export type ExcursionSectionPhotoGroupKey = (typeof EXCURSION_SECTION_PHOTO_GROUP_KEYS)[number];

export type ExcursionSectionPhotoGroups = Record<ExcursionSectionPhotoGroupKey, string[]>;

const EXCURSION_SECTION_PHOTO_FALLBACK_PREFIX = "__excursion_section_photo__:";
const EXCURSION_SECTION_PHOTO_FALLBACK_SEPARATOR = "::";

function normalizePhotoUrlList(value: string[] | undefined): string[] {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function isExcursionSectionPhotoGroupKey(value: string): value is ExcursionSectionPhotoGroupKey {
  return EXCURSION_SECTION_PHOTO_GROUP_KEYS.some((key) => key === value);
}

function decodeExcursionSectionPhotoFallbackEntry(
  value: string,
): { key: ExcursionSectionPhotoGroupKey; url: string } | null {
  if (!value.startsWith(EXCURSION_SECTION_PHOTO_FALLBACK_PREFIX)) {
    return null;
  }

  const encodedValue = value.slice(EXCURSION_SECTION_PHOTO_FALLBACK_PREFIX.length);
  const separatorIndex = encodedValue.indexOf(EXCURSION_SECTION_PHOTO_FALLBACK_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }

  const key = encodedValue.slice(0, separatorIndex);
  const url = encodedValue
    .slice(separatorIndex + EXCURSION_SECTION_PHOTO_FALLBACK_SEPARATOR.length)
    .trim();
  if (!isExcursionSectionPhotoGroupKey(key) || !url) {
    return null;
  }

  return { key, url };
}

export function normalizeExcursionSectionPhotoGroups(
  value:
    | Partial<Record<ExcursionSectionPhotoGroupKey, string[] | null | undefined>>
    | null
    | undefined,
): ExcursionSectionPhotoGroups {
  return {
    dates: normalizePhotoUrlList(value?.dates ?? undefined),
    program: normalizePhotoUrlList(value?.program ?? undefined),
    logistics: normalizePhotoUrlList(value?.logistics ?? undefined),
    accommodation: normalizePhotoUrlList(value?.accommodation ?? undefined),
    included: normalizePhotoUrlList(value?.included ?? undefined),
    requirements: normalizePhotoUrlList(value?.requirements ?? undefined),
  };
}

export function getExcursionSectionPhotoUrls(
  groups:
    | Partial<Record<ExcursionSectionPhotoGroupKey, string[] | null | undefined>>
    | null
    | undefined,
  key: ExcursionSectionPhotoGroupKey,
): string[] {
  return normalizeExcursionSectionPhotoGroups(groups)[key];
}

export function collectExcursionSectionPhotoUrls(
  groups:
    | Partial<Record<ExcursionSectionPhotoGroupKey, string[] | null | undefined>>
    | null
    | undefined,
): string[] {
  const normalized = normalizeExcursionSectionPhotoGroups(groups);
  return Array.from(
    new Set(EXCURSION_SECTION_PHOTO_GROUP_KEYS.flatMap((key) => normalized[key]).filter(Boolean)),
  );
}

export function resolveExcursionSectionPhotoState(input: {
  photoUrls?: string[] | null | undefined;
  sectionPhotoGroups?:
    | Partial<Record<ExcursionSectionPhotoGroupKey, string[] | null | undefined>>
    | null
    | undefined;
}): { photoUrls: string[]; sectionPhotoGroups: ExcursionSectionPhotoGroups } {
  const photoUrls: string[] = [];
  const fallbackGroups = normalizeExcursionSectionPhotoGroups(undefined);

  for (const rawUrl of input.photoUrls ?? []) {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) {
      continue;
    }

    const decoded = decodeExcursionSectionPhotoFallbackEntry(trimmedUrl);
    if (decoded) {
      fallbackGroups[decoded.key] = [...fallbackGroups[decoded.key], decoded.url];
      continue;
    }

    photoUrls.push(trimmedUrl);
  }

  const explicitGroups = normalizeExcursionSectionPhotoGroups(input.sectionPhotoGroups);
  return {
    photoUrls: normalizePhotoUrlList(photoUrls),
    sectionPhotoGroups: normalizeExcursionSectionPhotoGroups({
      dates: [...explicitGroups.dates, ...fallbackGroups.dates],
      program: [...explicitGroups.program, ...fallbackGroups.program],
      logistics: [...explicitGroups.logistics, ...fallbackGroups.logistics],
      accommodation: [...explicitGroups.accommodation, ...fallbackGroups.accommodation],
      included: [...explicitGroups.included, ...fallbackGroups.included],
      requirements: [...explicitGroups.requirements, ...fallbackGroups.requirements],
    }),
  };
}

export function buildExcursionPhotoStorageWithSectionFallback(
  photoUrls: string[] | null | undefined,
  sectionPhotoGroups:
    | Partial<Record<ExcursionSectionPhotoGroupKey, string[] | null | undefined>>
    | null
    | undefined,
): string[] {
  const normalizedPhotoUrls = normalizePhotoUrlList(photoUrls ?? undefined);
  const normalizedGroups = normalizeExcursionSectionPhotoGroups(sectionPhotoGroups);
  return [
    ...normalizedPhotoUrls,
    ...EXCURSION_SECTION_PHOTO_GROUP_KEYS.flatMap((key) =>
      normalizedGroups[key].map(
        (url) =>
          `${EXCURSION_SECTION_PHOTO_FALLBACK_PREFIX}${key}${EXCURSION_SECTION_PHOTO_FALLBACK_SEPARATOR}${url}`,
      ),
    ),
  ];
}

export function getTimelineStepPhotoUrls(step?: Partial<TimelineStep> | null): string[] {
  return normalizePhotoUrlList(step?.photoUrls);
}

export function getItineraryDayPhotoUrls(day?: Partial<ItineraryDay> | null): string[] {
  return normalizePhotoUrlList(day?.photoUrls);
}

export type ExcursionExtraOption = {
  title: string;
  description?: string;
  included: boolean;
  price?: number | null;
};

export const OFFER_TYPE_OPTIONS = [
  { value: "EXCURSION", label: "Экскурсия" },
  { value: "TOUR", label: "Тур" },
] as const;

export const OFFER_SUBTYPE_PRESETS = {
  EXCURSION: ["Пешеходная", "Автомобильная", "Морская", "Индивидуальная", "Групповая"],
  TOUR: [
    "Авторский",
    "Однодневный",
    "Многодневный",
    "Джип-тур",
    "Автобусный",
    "Гастро-тур",
    "Паломнический",
  ],
} as const;

/** @deprecated Use MEAL_PLAN_OPTIONS enum instead */
export const TOUR_MEAL_PLAN_OPTIONS = [
  "Не включено",
  "Завтрак",
  "Завтрак + ужин",
  "Полный пансион",
  "По программе / частично",
] as const;

export const PRICE_UNIT_PRESETS = ["чел", "группу", "место", "семью", "тур", "пакет"] as const;

export const TIMELINE_ICON_LABELS: Record<TimelineStepIcon, string> = {
  meeting_point: "Встреча",
  bus: "Автобус",
  walking: "Пешком",
  sightseeing: "Осмотр",
  viewpoint: "Смотровая",
  cable_car: "Канатка",
  wine_tasting: "Дегустация",
  food: "Еда",
  photo_stop: "Фото",
  free_time: "Свободное время",
  museum: "Музей",
  beach: "Пляж",
  swimming: "Купание",
  hiking: "Поход",
  boat: "Лодка",
  shopping: "Шопинг",
  sunset: "Закат",
  finish: "Финиш",
};

export const TIMELINE_ICONS: TimelineStepIcon[] = [
  "meeting_point",
  "bus",
  "walking",
  "sightseeing",
  "viewpoint",
  "cable_car",
  "wine_tasting",
  "food",
  "photo_stop",
  "free_time",
  "museum",
  "beach",
  "swimming",
  "hiking",
  "boat",
  "shopping",
  "sunset",
  "finish",
];

export const INCLUDED_PRESETS = [
  "Гид",
  "Входные билеты",
  "Транспорт",
  "Питание",
  "Страховка",
  "Аудиогид",
  "Трансфер",
  "Снаряжение",
];

export const EXCLUDED_PRESETS = [
  "Обед",
  "Сувениры",
  "Личные расходы",
  "Страховка",
  "Транспорт",
  "Входные билеты",
];

export const EXCURSION_CATEGORY_TAGS = [
  "Обзорная",
  "Морская",
  "Горная",
  "Винная",
  "Историческая",
  "Детская",
  "Активная",
  "Ночная",
  "Гастрономическая",
  "Фото-тур",
];

export const CANCELLATION_POLICY_OPTIONS = [
  { value: "FLEXIBLE", label: "Гибкая", description: "Бесплатная отмена за 24 часа" },
  { value: "MODERATE", label: "Умеренная", description: "Бесплатная отмена за 48 часов" },
  { value: "STRICT", label: "Строгая", description: "Отмена без возврата" },
  { value: "CUSTOM", label: "Своя политика", description: "Укажите условия вручную" },
] as const;

export const PHYSICAL_REQUIREMENTS_PRESETS = [
  "Не подходит беременным",
  "Требуется физическая подготовка",
  "Не рекомендуется при болезнях сердца",
  "Нужна удобная обувь для ходьбы",
  "Не подходит для инвалидных колясок",
  "Ограниченная мобильность - недоступно",
];

export const WHAT_TO_BRING_PRESETS = [
  "Вода (0.5-1 л)",
  "Удобная обувь",
  "Солнцезащитный крем",
  "Головной убор",
  "Паспорт/документы",
  "Наличные деньги",
  "Купальник",
  "Легкая куртка",
];

export const TIMELINE_DURATION_OPTIONS = [
  { value: "15 мин", label: "15 мин" },
  { value: "30 мин", label: "30 мин" },
  { value: "45 мин", label: "45 мин" },
  { value: "1 ч", label: "1 ч" },
  { value: "1.5 ч", label: "1.5 ч" },
  { value: "2 ч", label: "2 ч" },
  { value: "3 ч", label: "3 ч" },
];

export const HIGHLIGHT_PRESETS = [
  "Красивые виды и фотостопы",
  "Продуманный маршрут без спешки",
  "Локальные истории и факты",
  "Комфортная логистика",
  "Подходит для всей семьи",
  "Авторская программа",
];
