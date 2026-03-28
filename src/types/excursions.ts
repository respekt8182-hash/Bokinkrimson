// Shared domain types for excursion timeline, pricing, and FAQ structures.

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
};

export type PricingTier = {
  label: string;
  price: number;
};

export type FaqItem = {
  q: string;
  a: string;
};

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
