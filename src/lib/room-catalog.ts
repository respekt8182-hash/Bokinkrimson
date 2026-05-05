// Domain/service module for room catalog.
export const roomTypeOptions = [
  { id: "single", label: "Одноместный" },
  { id: "double_one_bed", label: "Двухместный с 1 кроватью" },
  { id: "double_two_beds", label: "Двухместный с 2 отдельными кроватями" },
  {
    id: "double_flexible",
    label: "Двухместный с 1 кроватью или 2 отдельными кроватями",
  },
  { id: "triple", label: "Трехместный номер" },
  { id: "quadruple", label: "Четырехместный" },
  { id: "family", label: "Семейный" },
  { id: "suite", label: "Люкс" },
  { id: "studio", label: "Номер-студия" },
  { id: "penthouse", label: "Пентхаус" },
  { id: "loft", label: "Лофт" },
  { id: "apartments", label: "Апартаменты" },
  { id: "dormitory", label: "Общий номер" },
  { id: "dorm_bed", label: "Кровать в общем номере" },
  { id: "chalet", label: "Шале" },
  { id: "villa", label: "Вилла" },
  { id: "holiday_home", label: "Дом для отпуска" },
  { id: "house", label: "Дом" },
  { id: "mobile_home", label: "Дом на колесах" },
  { id: "cottage", label: "Коттедж" },
  { id: "townhouse", label: "Таунхаус" },
  { id: "tent_hut", label: "Шатер" },
  { id: "tent", label: "Палатка" },
  { id: "sphere", label: "Сфера" },
  { id: "dome", label: "Купол" },
  { id: "capsule", label: "Капсула" },
  { id: "bungalow", label: "Бунгало" },
] as const;

export type RoomTypeId = (typeof roomTypeOptions)[number]["id"];

export const roomTypeLabelById = Object.fromEntries(
  roomTypeOptions.map((item) => [item.id, item.label]),
) as Record<RoomTypeId, string>;

export const roomNameSuggestionsByType: Record<RoomTypeId, string[]> = {
  single: [
    "Бюджетный одноместный номер",
    "Одноместный номер",
    "Одноместный номер Делюкс",
    "Одноместный номер с балконом",
    "Одноместный номер с видом на море",
    "Одноместный номер эконом-класса",
    "Стандартный одноместный номер",
    "Улучшенный одноместный номер",
    "Свое название",
  ],
  double_one_bed: [
    "Двухместный номер с 1 кроватью",
    "Большой двухместный номер с 1 кроватью",
    "Двухместный номер Делюкс с 1 кроватью",
    "Двухместный номер с 1 кроватью и балконом",
    "Двухместный номер с 1 кроватью и видом на море",
    "Стандартный двухместный номер с 1 кроватью",
    "Улучшенный двухместный номер с 1 кроватью",
    "Свое название",
  ],
  double_two_beds: [
    "Двухместный номер с 2 отдельными кроватями",
    "Двухместный номер Делюкс с 2 отдельными кроватями",
    "Двухместный номер с 2 отдельными кроватями и балконом",
    "Двухместный номер с 2 отдельными кроватями, вид на море",
    "Стандартный двухместный номер с 2 отдельными кроватями",
    "Улучшенный двухместный номер с 2 отдельными кроватями",
    "Свое название",
  ],
  double_flexible: [
    "Двухместный номер с 1 кроватью или 2 отдельными кроватями",
    "Двухместный номер Делюкс с 1 кроватью или 2 отдельными кроватями",
    "Двухместный номер с 1 кроватью или 2 отдельными кроватями и балконом",
    "Стандартный двухместный номер с 1 кроватью или 2 отдельными кроватями",
    "Улучшенный двухместный номер с 1 кроватью или 2 отдельными кроватями",
    "Свое название",
  ],
  triple: [
    "Трехместный номер",
    "Трехместный номер Комфорт",
    "Трехместный номер Делюкс",
    "Трехместный номер с видом на море",
    "Трехместный номер с балконом",
    "Улучшенный трехместный номер",
    "Свое название",
  ],
  quadruple: [
    "Четырехместный номер",
    "Четырехместный номер Комфорт",
    "Четырехместный номер Делюкс",
    "Стандартный четырехместный номер",
    "Улучшенный четырехместный номер",
    "Свое название",
  ],
  family: [
    "Семейный номер",
    "Семейный номер Делюкс",
    "Семейный номер с балконом",
    "Семейный номер с видом на море",
    "Семейный люкс",
    "Семейный номер-студия",
    "Свое название",
  ],
  suite: [
    "Люкс",
    "Полулюкс",
    "Люкс с балконом",
    "Люкс с видом на море",
    "Представительский люкс",
    "Президентский люкс",
    "Улучшенный люкс",
    "Свое название",
  ],
  studio: [
    "Номер-студия",
    "Номер-студия Делюкс",
    "Номер-студия с балконом",
    "Номер-студия с видом на море",
    "Семейный номер-студия",
    "Улучшенный номер-студия",
    "Свое название",
  ],
  penthouse: [
    "Пентхаус",
    "Пентхаус двухуровневый",
    "Пентхаус с террасой",
    "Пентхаус с видом на море",
    "Пентхаус с собственным бассейном",
    "Свое название",
  ],
  loft: [
    "Лофт",
    "Лофт Люкс",
    "Лофт Делюкс",
    "Семейный лофт",
    "Дизайнерский лофт",
    "Свое название",
  ],
  apartments: [
    "Апартаменты",
    "Апартаменты Делюкс",
    "Апартаменты с 1 спальней",
    "Апартаменты с 2 спальнями",
    "Апартаменты с балконом",
    "Апартаменты-студия",
    "Улучшенные апартаменты",
    "Свое название",
  ],
  dormitory: [
    "Общий номер для мужчин и женщин",
    "Общий номер для женщин",
    "Общий номер для мужчин",
    "Общий 8-местный номер для мужчин и женщин",
    "Общий 10-местный номер для мужчин и женщин",
    "Свое название",
  ],
  dorm_bed: [
    "Кровать в общем номере",
    "Кровать в общем 6-местном номере",
    "Кровать в общем 8-местном номере",
    "Односпальная кровать в общем номере",
    "Спальное место на двухъярусной кровати",
    "Свое название",
  ],
  chalet: [
    "Шале",
    "Шале с 1 спальней",
    "Шале с 2 спальнями",
    "Шале с 3 спальнями",
    "Улучшенное шале",
    "Свое название",
  ],
  villa: [
    "Вилла",
    "Вилла Делюкс",
    "Вилла с 1 спальней",
    "Вилла с 2 спальнями",
    "Вилла с 3 спальнями",
    "Вилла с собственным бассейном",
    "Свое название",
  ],
  holiday_home: [
    "Дом для отпуска",
    "Дом с 1 спальней",
    "Дом с 2 спальнями",
    "Дом с 3 спальнями",
    "Дом с 4 спальнями",
    "Свое название",
  ],
  house: [
    "Дом",
    "Дом Делюкс",
    "Дом с видом на море",
    "Дом с видом на горы",
    "Дом для семейного отдыха",
    "Дом с собственным бассейном",
    "Свое название",
  ],
  mobile_home: ["Дом на колесах", "Свое название"],
  cottage: [
    "Коттедж",
    "Коттедж Делюкс",
    "Коттедж с видом на море",
    "Коттедж для семейного отдыха",
    "Коттедж с собственным бассейном",
    "Свое название",
  ],
  townhouse: [
    "Таунхаус",
    "Таунхаус с отдельным входом",
    "Таунхаус с выходом во двор",
    "Таунхаус с собственным бассейном",
    "Свое название",
  ],
  tent_hut: ["Шатер", "Свое название"],
  tent: ["Палатка", "Свое название"],
  sphere: ["Сфера", "Свое название"],
  dome: ["Купол", "Свое название"],
  capsule: [
    "Капсула",
    "Одноместная капсула",
    "Двухместная капсула",
    "Капсула эконом-класса",
    "Улучшенная капсула",
    "Свое название",
  ],
  bungalow: [
    "Бунгало",
    "Бунгало Люкс",
    "Бунгало Делюкс",
    "Семейное бунгало",
    "Бунгало с видом на море",
    "Свое название",
  ],
};

export const bedTypeOptions = [
  { id: "single", label: "Односпальная кровать", places: 1, maxCount: 20 },
  { id: "semi_double", label: "Полутороспальная кровать", places: 1, maxCount: 20 },
  { id: "double_king", label: "Двуспальная кровать (king-size)", places: 2, maxCount: 20 },
  { id: "double_queen", label: "Двуспальная кровать (queen-size)", places: 2, maxCount: 20 },
  {
    id: "double_super_king",
    label: "Большая двуспальная кровать (super king-size)",
    places: 2,
    maxCount: 20,
  },
  { id: "bunk", label: "Двухъярусная кровать", places: 2, maxCount: 20 },
  { id: "sofa_bed", label: "Диван-кровать", places: 2, maxCount: 20 },
  { id: "chair_bed", label: "Кресло-кровать", places: 1, maxCount: 20 },
  { id: "no_bed", label: "Кровать не предусмотрена", places: 0, maxCount: 1 },
] as const;

export type BedTypeId = (typeof bedTypeOptions)[number]["id"];
export type RoomBedConfiguration = {
  type: BedTypeId;
  count: number;
};

export const bedTypePlacesById = Object.fromEntries(
  bedTypeOptions.map((item) => [item.id, item.places]),
) as Record<BedTypeId, number>;

export const bedTypeMaxCountById = Object.fromEntries(
  bedTypeOptions.map((item) => [item.id, item.maxCount]),
) as Record<BedTypeId, number>;

// Constraints for each room type: which bed types are allowed and what defaults to apply.
// allowedBedTypeIds = null means no restriction (any bed type is fine).
export type RoomTypeConstraint = {
  /** Default main places count when room type is first selected */
  defaultMainPlaces: number;
  /** Fixed main places for strict room categories. null = user can edit manually */
  fixedMainPlaces?: number | null;
  /** Allowed bed type IDs. null = all types allowed */
  allowedBedTypeIds: BedTypeId[] | null;
  /** Default bed set(s) auto-applied when room type is selected */
  defaultBedSets: Array<Array<{ type: BedTypeId; count: number }>>;
};

export const roomTypeConstraints: Record<RoomTypeId, RoomTypeConstraint> = {
  // Standard room types — strict bed-type logic
  single: {
    defaultMainPlaces: 1,
    fixedMainPlaces: 1,
    allowedBedTypeIds: ["single", "semi_double"],
    defaultBedSets: [[{ type: "single", count: 1 }]],
  },
  double_one_bed: {
    defaultMainPlaces: 2,
    fixedMainPlaces: 2,
    allowedBedTypeIds: ["double_king", "double_queen", "double_super_king"],
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  double_two_beds: {
    defaultMainPlaces: 2,
    fixedMainPlaces: 2,
    allowedBedTypeIds: ["single", "semi_double"],
    defaultBedSets: [[{ type: "single", count: 2 }]],
  },
  // flexible: two named configurations — 1 double OR 2 singles
  double_flexible: {
    defaultMainPlaces: 2,
    fixedMainPlaces: 2,
    allowedBedTypeIds: ["single", "semi_double", "double_king", "double_queen", "double_super_king"],
    defaultBedSets: [
      [{ type: "double_queen", count: 1 }],
      [{ type: "single", count: 2 }],
    ],
  },
  triple: {
    defaultMainPlaces: 3,
    fixedMainPlaces: 3,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }, { type: "single", count: 1 }]],
  },
  quadruple: {
    defaultMainPlaces: 4,
    fixedMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  family: {
    defaultMainPlaces: 3,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }, { type: "single", count: 1 }]],
  },
  // Premium / specialty — no bed restriction, sensible defaults
  suite: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_king", count: 1 }]],
  },
  studio: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  penthouse: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_king", count: 1 }]],
  },
  loft: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  apartments: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  // Hostel / dorm
  dormitory: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "bunk", count: 2 }]],
  },
  dorm_bed: {
    defaultMainPlaces: 1,
    fixedMainPlaces: 1,
    allowedBedTypeIds: ["single", "semi_double"],
    defaultBedSets: [[{ type: "single", count: 1 }]],
  },
  // Large property types
  chalet: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  villa: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  holiday_home: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  house: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  mobile_home: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  cottage: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  townhouse: {
    defaultMainPlaces: 4,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 2 }]],
  },
  // Glamping / unique
  tent_hut: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  tent: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "single", count: 2 }]],
  },
  sphere: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  dome: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
  capsule: {
    defaultMainPlaces: 1,
    allowedBedTypeIds: ["single", "semi_double"],
    defaultBedSets: [[{ type: "single", count: 1 }]],
  },
  bungalow: {
    defaultMainPlaces: 2,
    allowedBedTypeIds: null,
    defaultBedSets: [[{ type: "double_queen", count: 1 }]],
  },
};

export function getRoomTypeConstraint(roomType: RoomTypeId): RoomTypeConstraint {
  return roomTypeConstraints[roomType];
}

export function getAllowedBedTypeIdsForRoomType(roomType: RoomTypeId): BedTypeId[] | null {
  const allowedBedTypeIds = getRoomTypeConstraint(roomType).allowedBedTypeIds;
  return allowedBedTypeIds === null ? null : [...allowedBedTypeIds];
}

export function getFixedMainPlacesForRoomType(roomType: RoomTypeId): number | null {
  return getRoomTypeConstraint(roomType).fixedMainPlaces ?? null;
}

export function resolveMainPlacesForRoomType(
  roomType: RoomTypeId,
  currentValue?: number | null,
): number {
  const fixedMainPlaces = getFixedMainPlacesForRoomType(roomType);
  if (fixedMainPlaces !== null) {
    return fixedMainPlaces;
  }

  if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) {
    return getRoomTypeConstraint(roomType).defaultMainPlaces;
  }

  return Math.max(1, Math.min(20, Math.floor(currentValue)));
}

export function getDefaultBedTypeForRoomType(roomType: RoomTypeId): BedTypeId {
  const defaultBedType = roomTypeConstraints[roomType].defaultBedSets[0]?.[0]?.type;
  if (defaultBedType) {
    return defaultBedType;
  }

  const allowedBedTypeIds = getAllowedBedTypeIdsForRoomType(roomType);
  return allowedBedTypeIds?.[0] ?? "double_queen";
}

export function cloneDefaultBedSetsForRoomType(roomType: RoomTypeId): RoomBedConfiguration[][] {
  return roomTypeConstraints[roomType].defaultBedSets.map((set) =>
    set.map((item) => ({ type: item.type, count: item.count })),
  );
}

export function isBedTypeAllowedForRoomType(roomType: RoomTypeId, bedType: BedTypeId): boolean {
  const allowedBedTypeIds = getAllowedBedTypeIdsForRoomType(roomType);
  return allowedBedTypeIds === null || allowedBedTypeIds.includes(bedType);
}

export const additionalPlaceTypeOptions = [
  { id: "single_bed", label: "Односпальная кровать" },
  { id: "folding_bed", label: "Раскладушка" },
  { id: "sofa_bed", label: "Раскладной диван" },
  { id: "armchair_bed", label: "Раскладное кресло" },
  { id: "mattress", label: "Матрас" },
] as const;

export type AdditionalPlaceTypeId = (typeof additionalPlaceTypeOptions)[number]["id"];

export const bathroomLocationOptions = [
  { id: "in_bathroom", label: "В ванной комнате" },
  { id: "in_room", label: "Отдельно в номере" },
  { id: "near_room", label: "Рядом с номером" },
  { id: "in_block", label: "В блоке" },
  { id: "on_floor", label: "На этаже" },
  { id: "in_building", label: "В здании" },
  { id: "outside", label: "На улице" },
] as const;

export type BathroomLocationId = (typeof bathroomLocationOptions)[number]["id"];

export const bathroomToiletOptions = [
  { id: "in_bathroom", label: "Туалет в ванной комнате" },
  { id: "in_room", label: "Туалет отдельно в номере" },
  { id: "near_room", label: "Туалет рядом с номером" },
  { id: "in_block", label: "Туалет в блоке" },
  { id: "on_floor", label: "Туалет на этаже" },
  { id: "in_building", label: "Туалет в здании" },
  { id: "outside", label: "Туалет на улице" },
] as const;

export type BathroomToiletId = (typeof bathroomToiletOptions)[number]["id"];

export type RoomMeta = {
  roomType: RoomTypeId;
  roomName: string;
  floor: number | null;
  nameInExtranet: string | null;
  bedConfiguration: RoomBedConfiguration[];
  bedSets: RoomBedConfiguration[][];
  hasAdditionalPlaces: boolean;
  additionalPlaceTypes: AdditionalPlaceTypeId[];
  hasPrivateBathroom: boolean;
  privateBathroomLocations: BathroomLocationId[];
  privateToiletLocations: BathroomToiletId[];
  hasSharedBathroom: boolean;
  sharedBathroomLocations: BathroomLocationId[];
  sharedToiletLocations: BathroomToiletId[];
  privateBathroomCount: number | null;
};

export const defaultRoomTypeId: RoomTypeId = "double_one_bed";

export const defaultRoomMeta: RoomMeta = {
  roomType: defaultRoomTypeId,
  roomName: roomNameSuggestionsByType[defaultRoomTypeId][0] ?? "Двухместный номер с 1 кроватью",
  floor: null,
  nameInExtranet: null,
  bedConfiguration: [],
  bedSets: [],
  hasAdditionalPlaces: false,
  additionalPlaceTypes: [],
  hasPrivateBathroom: false,
  privateBathroomLocations: [],
  privateToiletLocations: [],
  hasSharedBathroom: false,
  sharedBathroomLocations: [],
  sharedToiletLocations: [],
  privateBathroomCount: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowedSet = new Set<string>(allowed);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .filter((item) => allowedSet.has(item)),
    ),
  ) as T[];
}

function normalizeBedConfiguration(
  value: unknown,
  bedTypeIds: readonly BedTypeId[],
): RoomBedConfiguration[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const type =
        typeof item.type === "string" && bedTypeIds.includes(item.type as BedTypeId)
          ? (item.type as BedTypeId)
          : null;
      const count =
        typeof item.count === "number" && Number.isInteger(item.count) && item.count > 0
          ? item.count
          : null;
      if (!type || count === null) {
        return null;
      }
      return { type, count };
    })
    .filter((item): item is RoomBedConfiguration => item !== null);

  const limited: RoomBedConfiguration[] = [];
  let usedBeds = 0;
  for (const item of normalized) {
    if (usedBeds >= 20) {
      break;
    }
    const nextCount = Math.min(item.count, 20 - usedBeds);
    if (nextCount <= 0) {
      continue;
    }
    limited.push({ type: item.type, count: nextCount });
    usedBeds += nextCount;
  }

  return limited;
}

export function calculateBedCapacity(configuration: RoomBedConfiguration[]): number {
  return configuration.reduce((sum, item) => {
    const places = bedTypePlacesById[item.type] ?? 0;
    return sum + item.count * places;
  }, 0);
}

export function normalizeRoomMeta(value: unknown): RoomMeta | null {
  if (!isRecord(value)) {
    return null;
  }

  const roomTypeSet = new Set<string>(roomTypeOptions.map((item) => item.id));
  const bedTypeIds = bedTypeOptions.map((item) => item.id);
  const additionalTypeIds = additionalPlaceTypeOptions.map((item) => item.id);
  const bathroomLocationIds = bathroomLocationOptions.map((item) => item.id);
  const bathroomToiletIds = bathroomToiletOptions.map((item) => item.id);

  const roomType =
    typeof value.roomType === "string" && roomTypeSet.has(value.roomType)
      ? (value.roomType as RoomTypeId)
      : defaultRoomMeta.roomType;

  const normalizedRoomName =
    typeof value.roomName === "string" && value.roomName.trim()
      ? value.roomName.trim().slice(0, 120)
      : roomNameSuggestionsByType[roomType][0] ?? defaultRoomMeta.roomName;

  const normalizedNameInExtranet =
    typeof value.nameInExtranet === "string" && value.nameInExtranet.trim().length > 0
      ? value.nameInExtranet.trim().slice(0, 120)
      : null;
  const normalizedFloor =
    typeof value.floor === "number" && Number.isInteger(value.floor)
      ? Math.min(99, Math.max(1, value.floor))
      : null;

  const bedConfiguration = normalizeBedConfiguration(value.bedConfiguration, bedTypeIds);
  const parsedBedSets = Array.isArray(value.bedSets)
    ? value.bedSets
        .map((item) => normalizeBedConfiguration(item, bedTypeIds).slice(0, 10))
        .filter((item) => item.length > 0)
        .slice(0, 10)
    : [];
  const bedSets = parsedBedSets.length > 0 ? parsedBedSets : bedConfiguration.length > 0 ? [bedConfiguration] : [];
  const primaryBedConfiguration = bedSets[0] ?? bedConfiguration;

  const hasAdditionalPlaces = Boolean(value.hasAdditionalPlaces);
  const additionalPlaceTypes = hasAdditionalPlaces
    ? asStringArray(value.additionalPlaceTypes, additionalTypeIds)
    : [];

  const hasPrivateBathroom = Boolean(value.hasPrivateBathroom);
  const privateBathroomLocations = hasPrivateBathroom
    ? asStringArray(value.privateBathroomLocations, bathroomLocationIds)
    : [];
  const privateToiletLocations = hasPrivateBathroom
    ? asStringArray(value.privateToiletLocations, bathroomToiletIds)
    : [];

  const hasSharedBathroom = Boolean(value.hasSharedBathroom);
  const sharedBathroomLocations = hasSharedBathroom
    ? asStringArray(value.sharedBathroomLocations, bathroomLocationIds)
    : [];
  const sharedToiletLocations = hasSharedBathroom
    ? asStringArray(value.sharedToiletLocations, bathroomToiletIds)
    : [];

  const privateBathroomCount =
    hasPrivateBathroom && typeof value.privateBathroomCount === "number" && Number.isInteger(value.privateBathroomCount)
      ? Math.min(10, Math.max(1, value.privateBathroomCount))
      : null;

  return {
    roomType,
    roomName: normalizedRoomName,
    floor: normalizedFloor,
    nameInExtranet: normalizedNameInExtranet,
    bedConfiguration: primaryBedConfiguration,
    bedSets,
    hasAdditionalPlaces,
    additionalPlaceTypes,
    hasPrivateBathroom,
    privateBathroomLocations,
    privateToiletLocations,
    hasSharedBathroom,
    sharedBathroomLocations,
    sharedToiletLocations,
    privateBathroomCount,
  };
}
