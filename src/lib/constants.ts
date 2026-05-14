// Domain/service module for constants.
export type PlacementPricingGroup = "MULTI_ROOM" | "SINGLE_UNIT";

export const propertyTypes = [
  {
    id: "hotel",
    name: "Гостиница",
    classificationDefault: true,
    placementPricingGroup: "MULTI_ROOM",
    examples: ["городская гостиница", "курортная гостиница", "семейная гостиница у моря"],
  },
  {
    id: "hostel",
    name: "Хостел",
    classificationDefault: true,
    placementPricingGroup: "MULTI_ROOM",
    examples: ["молодежный хостел", "капсульный хостел", "хостел с общими зонами"],
  },
  {
    id: "camping",
    name: "Кемпинг",
    classificationDefault: true,
    placementPricingGroup: "MULTI_ROOM",
    examples: ["кемпинг с домиками", "автокемпинг", "кемпинг с площадками для палаток"],
  },
  {
    id: "apartment",
    name: "Квартира",
    classificationDefault: true,
    placementPricingGroup: "SINGLE_UNIT",
    examples: ["квартира в центре", "апартаменты у моря", "студия с кухней"],
  },
  {
    id: "house",
    name: "Дом",
    classificationDefault: true,
    placementPricingGroup: "SINGLE_UNIT",
    examples: ["частный дом целиком", "семейный дом у моря", "дом с двором"],
  },
  {
    id: "private_sector",
    name: "Частный сектор",
    classificationDefault: true,
    placementPricingGroup: "SINGLE_UNIT",
    examples: [
      "комнаты в частном доме",
      "мини-объект в жилом секторе",
      "частный двор с размещением",
    ],
  },
  {
    id: "tour_base",
    name: "Турбаза",
    classificationDefault: true,
    placementPricingGroup: "MULTI_ROOM",
    examples: ["туристическая база", "база отдыха", "турбаза с несколькими корпусами"],
  },
  {
    id: "sanatorium",
    name: "Санаторий",
    classificationDefault: true,
    placementPricingGroup: "MULTI_ROOM",
    examples: ["санаторий с лечебными программами", "курортный санаторий"],
  },
  {
    id: "guest_house",
    name: "Гостевой дом",
    classificationDefault: true,
    placementPricingGroup: "MULTI_ROOM",
    examples: ["гостевой дом на несколько номеров", "мини-гостиница", "дом с гостевыми комнатами"],
  },
] as const;

export const crimeaLocations = [
  { id: "alupka", name: "Алупка" },
  { id: "alushta", name: "Алушта" },
  { id: "evpatoria", name: "Евпатория" },
  { id: "kerch", name: "Керчь" },
  { id: "sevastopol", name: "Севастополь" },
  { id: "sudak", name: "Судак" },
  { id: "koktebel", name: "Коктебель" },
  { id: "feodosiya", name: "Феодосия" },
  { id: "schelkino", name: "Щёлкино" },
  { id: "yalta", name: "Ялта" },
] as const;

export const petsPolicyOptions = [
  { id: "FORBIDDEN", label: "Запрещено" },
  { id: "ON_REQUEST", label: "По согласованию" },
  { id: "ALLOWED", label: "Можно с животными" },
] as const;

export const smokingPolicyOptions = [
  { id: "FORBIDDEN", label: "Запрещено" },
  { id: "ON_REQUEST", label: "Разрешено в специальных местах" },
  { id: "ALLOWED", label: "Разрешено" },
] as const;

export const applicationStatusOptions = [
  { id: "NEW", label: "Новая" },
  { id: "IN_PROGRESS", label: "В работе" },
  { id: "CLOSED", label: "Закрыта" },
] as const;

export const paymentStatusOptions = [
  { id: "CREATED", label: "Создан" },
  { id: "PENDING", label: "Ожидает оплату" },
  { id: "SUCCEEDED", label: "Оплачен" },
  { id: "CANCELED", label: "Отменен" },
] as const;

export const placementTariffsByGroup = {
  MULTI_ROOM: [
    {
      code: "MULTI_ROOM_SMALL",
      roomCountMin: 1,
      roomCountMax: 6,
      amountRub: 4990,
      title: "Гостиничный формат · 1–6 номеров",
    },
    {
      code: "MULTI_ROOM_MEDIUM",
      roomCountMin: 7,
      roomCountMax: 16,
      amountRub: 7490,
      title: "Гостиничный формат · 7–16 номеров",
    },
    {
      code: "MULTI_ROOM_LARGE",
      roomCountMin: 17,
      roomCountMax: 25,
      amountRub: 9990,
      title: "Гостиничный формат · 17–25 номеров",
    },
    {
      code: "MULTI_ROOM_XL",
      roomCountMin: 26,
      roomCountMax: null,
      amountRub: 13990,
      title: "Гостиничный формат · 26+ номеров",
    },
  ],
  SINGLE_UNIT: [
    {
      code: "UNIT_SINGLE",
      roomCountMin: 1,
      roomCountMax: null,
      amountRub: 3990,
      title: "Отдельный объект · квартира / дом / коттедж",
    },
  ],
} as const satisfies Record<
  PlacementPricingGroup,
  ReadonlyArray<{
    code: string;
    roomCountMin: number;
    roomCountMax: number | null;
    amountRub: number;
    title: string;
  }>
>;

export const placementPricingGroupInfo = {
  MULTI_ROOM: {
    title: "Гостиничный формат",
    summary: "Подходит для объектов с несколькими номерами/юнитами.",
    details:
      "Количество номеров внутри одного объекта не влияет на стоимость. Оплачивается только период размещения карточки: сезон, межсезонье или год.",
  },
  SINGLE_UNIT: {
    title: "Отдельный объект",
    summary: "Одна квартира, один дом, один коттедж или одна комната.",
    details:
      "Стоимость не зависит от типа объекта и количества вариантов проживания. Карточка создается бесплатно, оплачивается только период размещения.",
  },
} as const;

export const applicationRateLimit = {
  windowMinutes: 10,
  maxRequestsPerWindow: 5,
} as const;

export const reviewRateLimit = {
  // Global anti-spam limit: one review per user in a rolling 24h window.
  windowHours: 24,
  maxReviewsPerUser: 1,
} as const;

export const authRateLimit = {
  login: {
    windowMinutes: 1,
    maxRequestsPerWindow: 8,
  },
  register: {
    windowMinutes: 10,
    maxRequestsPerWindow: 3,
  },
  forgotPassword: {
    windowMinutes: 30,
    maxRequestsPerWindow: 8,
  },
} as const;

export const propertyAboutLimits = {
  description: {
    min: 20,
    max: 2000,
  },
  faq: {
    maxItems: 5,
    questionMax: 160,
    answerMax: 600,
  },
} as const;

export const mediaLimits = {
  property: {
    images: 20,
    videos: 2,
  },
  room: {
    images: 6,
    videos: 1,
  },
} as const;

export const imageSizeLimitBytes = 5 * 1024 * 1024;

export const propertyTypeIds = propertyTypes.map((item) => item.id) as readonly string[];
export const crimeaLocationIds = crimeaLocations.map((item) => item.id) as readonly string[];
export const crimeaLocationNames = crimeaLocations.map((item) => item.name) as readonly string[];

const propertyTypeAliasToId: Record<string, (typeof propertyTypes)[number]["id"]> = {
  glamping: "apartment",
  holiday_home: "house",
  farm_stay: "private_sector",
};

const propertyTypeByCanonicalId = Object.fromEntries(
  propertyTypes.map((item) => [item.id, item]),
) as Record<(typeof propertyTypes)[number]["id"], (typeof propertyTypes)[number]>;

export const propertyTypeById = {
  ...propertyTypeByCanonicalId,
  ...Object.fromEntries(
    Object.entries(propertyTypeAliasToId).map(([legacyId, canonicalId]) => [
      legacyId,
      propertyTypeByCanonicalId[canonicalId],
    ]),
  ),
} as Record<string, (typeof propertyTypes)[number]>;

export function normalizePropertyTypeId(typeId: string | null): string | null {
  if (!typeId) {
    return null;
  }

  const normalized = typeId.trim().toLowerCase();
  return propertyTypeAliasToId[normalized] ?? normalized;
}

export const crimeaLocationById = Object.fromEntries(
  crimeaLocations.map((item) => [item.id, item]),
) as Record<string, (typeof crimeaLocations)[number]>;

export function isClassificationApplicableByType(typeId: string | null): boolean {
  const normalizedTypeId = normalizePropertyTypeId(typeId);
  if (!normalizedTypeId) {
    return false;
  }

  return propertyTypeById[normalizedTypeId]?.classificationDefault ?? false;
}

const multiRoomTypeKeywords = [
  "hotel",
  "hostel",
  "resort",
  "sanatorium",
  "boarding",
  "гост",
  "отел",
  "курорт",
  "апарт",
  "санатор",
  "пансион",
];

export function getPlacementPricingGroupByType(typeId: string | null): PlacementPricingGroup {
  const normalizedTypeId = normalizePropertyTypeId(typeId);
  if (!normalizedTypeId) {
    return "MULTI_ROOM";
  }

  const byDirectory = propertyTypeById[normalizedTypeId]?.placementPricingGroup;
  if (byDirectory) {
    return byDirectory;
  }

  if (multiRoomTypeKeywords.some((token) => normalizedTypeId.includes(token))) {
    return "MULTI_ROOM";
  }

  return "SINGLE_UNIT";
}

export type PropertyTypeId = (typeof propertyTypes)[number]["id"];
export type CrimeaLocationId = (typeof crimeaLocations)[number]["id"];
