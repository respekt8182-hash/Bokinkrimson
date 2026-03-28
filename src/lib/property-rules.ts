// Helpers for encoding and decoding structured property rules stored in compact string fields.
export type RulePresetOption<T extends string> = {
  id: T;
  label: string;
};

export const parkingPresetOptions = [
  { id: "on_site", label: "На территории" },
  { id: "nearby", label: "Рядом с объектом" },
  { id: "free", label: "Бесплатная" },
  { id: "guarded", label: "Охраняемая" },
  { id: "reservation", label: "Нужна бронь" },
] as const satisfies ReadonlyArray<RulePresetOption<string>>;

export type ParkingPresetId = (typeof parkingPresetOptions)[number]["id"];

export const mealPresetOptions = [
  { id: "breakfast", label: "Завтрак" },
  { id: "half_board", label: "Полупансион" },
  { id: "full_board", label: "Полный пансион" },
  { id: "all_inclusive", label: "Все включено" },
  { id: "shared_kitchen", label: "Общая кухня" },
] as const satisfies ReadonlyArray<RulePresetOption<string>>;

export type MealPresetId = (typeof mealPresetOptions)[number]["id"];

export const prepaymentTimingOptions = [
  { id: "booking", label: "при бронировании" },
  { id: "same_day", label: "в день бронирования" },
  { id: "before_arrival", label: "до заезда" },
] as const satisfies ReadonlyArray<RulePresetOption<string>>;

export type PrepaymentTimingId = (typeof prepaymentTimingOptions)[number]["id"];

export const prepaymentBasisOptions = [
  {
    id: "total",
    label: "от общей стоимости бронирования",
    chipLabel: "от общей стоимости",
  },
  {
    id: "first_night",
    label: "от стоимости первой ночи",
    chipLabel: "от первой ночи",
  },
] as const satisfies ReadonlyArray<
  RulePresetOption<string> & {
    chipLabel: string;
  }
>;

export type PrepaymentBasisId = (typeof prepaymentBasisOptions)[number]["id"];

type ParsedPresetList<T extends string> = {
  selectedIds: T[];
  labels: string[];
  legacyText: string | null;
};

type ParsedPrepaymentPolicy = {
  timingId: PrepaymentTimingId | null;
  basisId: PrepaymentBasisId;
  percent: number;
  timingLabel: string | null;
  basisLabel: string;
  displayValue: string | null;
  legacyText: string | null;
};

const MULTI_PRESET_PREFIX = "preset-multi:";
const PREPAYMENT_PRESET_PREFIX = "preset-prepayment:";
const VALUE_SEPARATOR = "|";
const DEFAULT_PREPAYMENT_BASIS: PrepaymentBasisId = "total";
const DEFAULT_PREPAYMENT_PERCENT = 10;

function parsePresetListValue<T extends string>(
  value: string | null | undefined,
  options: readonly RulePresetOption<T>[],
): ParsedPresetList<T> {
  const normalizedValue = value?.trim() ?? "";
  if (!normalizedValue) {
    return { selectedIds: [], labels: [], legacyText: null };
  }

  if (!normalizedValue.startsWith(MULTI_PRESET_PREFIX)) {
    return { selectedIds: [], labels: [], legacyText: normalizedValue };
  }

  const optionById = new Map(options.map((option) => [option.id, option.label] as const));
  const selectedIds = normalizedValue
    .slice(MULTI_PRESET_PREFIX.length)
    .split(VALUE_SEPARATOR)
    .map((item) => item.trim())
    .filter((item): item is T => optionById.has(item as T))
    .filter((item, index, source) => source.indexOf(item) === index);

  return {
    selectedIds,
    labels: selectedIds.map((id) => optionById.get(id) ?? id),
    legacyText: null,
  };
}

function buildPresetListValue<T extends string>(selectedIds: readonly T[]): string | null {
  const normalizedIds = selectedIds
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, source) => source.indexOf(item) === index);

  if (normalizedIds.length === 0) {
    return null;
  }

  return `${MULTI_PRESET_PREFIX}${normalizedIds.join(VALUE_SEPARATOR)}`;
}

export function parseParkingInfoValue(
  value: string | null | undefined,
): ParsedPresetList<ParkingPresetId> {
  return parsePresetListValue(value, parkingPresetOptions);
}

export function buildParkingInfoValue(selectedIds: readonly ParkingPresetId[]): string | null {
  return buildPresetListValue(selectedIds);
}

export function parseMealOptionsValue(
  value: string | null | undefined,
): ParsedPresetList<MealPresetId> {
  return parsePresetListValue(value, mealPresetOptions);
}

export function buildMealOptionsValue(selectedIds: readonly MealPresetId[]): string | null {
  return buildPresetListValue(selectedIds);
}

export function clampPrepaymentPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREPAYMENT_PERCENT;
  }

  const rounded = Math.round(value / 5) * 5;
  return Math.min(100, Math.max(DEFAULT_PREPAYMENT_PERCENT, rounded));
}

function getPrepaymentBasisOption(basisId: string | null | undefined) {
  return (
    prepaymentBasisOptions.find((option) => option.id === basisId) ?? prepaymentBasisOptions[0]
  );
}

function formatPrepaymentAmountLabel(percent: number, basisId: PrepaymentBasisId): string {
  if (basisId === "total" && percent === 100) {
    return "полной стоимости бронирования";
  }

  if (basisId === "first_night" && percent === 100) {
    return "стоимости первой ночи";
  }

  return `${percent}% ${getPrepaymentBasisOption(basisId).label}`;
}

export function buildPrepaymentPolicyValue(
  timingId: PrepaymentTimingId | null,
  percent: number,
  basisId: PrepaymentBasisId = DEFAULT_PREPAYMENT_BASIS,
): string | null {
  if (!timingId) {
    return null;
  }

  return `${PREPAYMENT_PRESET_PREFIX}${timingId}${VALUE_SEPARATOR}${basisId}${VALUE_SEPARATOR}${clampPrepaymentPercent(percent)}`;
}

export function parsePrepaymentPolicyValue(
  value: string | null | undefined,
): ParsedPrepaymentPolicy {
  const normalizedValue = value?.trim() ?? "";
  const defaultBasis = getPrepaymentBasisOption(DEFAULT_PREPAYMENT_BASIS);
  if (!normalizedValue) {
    return {
      timingId: null,
      basisId: defaultBasis.id,
      percent: DEFAULT_PREPAYMENT_PERCENT,
      timingLabel: null,
      basisLabel: defaultBasis.label,
      displayValue: null,
      legacyText: null,
    };
  }

  if (!normalizedValue.startsWith(PREPAYMENT_PRESET_PREFIX)) {
    return {
      timingId: null,
      basisId: defaultBasis.id,
      percent: DEFAULT_PREPAYMENT_PERCENT,
      timingLabel: null,
      basisLabel: defaultBasis.label,
      displayValue: normalizedValue,
      legacyText: normalizedValue,
    };
  }

  const payload = normalizedValue.slice(PREPAYMENT_PRESET_PREFIX.length);
  const [rawTimingId = "", rawBasisOrPercent = "", rawPercent = ""] =
    payload.split(VALUE_SEPARATOR);
  const timing = prepaymentTimingOptions.find((option) => option.id === rawTimingId) ?? null;
  if (!timing) {
    return {
      timingId: null,
      basisId: defaultBasis.id,
      percent: DEFAULT_PREPAYMENT_PERCENT,
      timingLabel: null,
      basisLabel: defaultBasis.label,
      displayValue: null,
      legacyText: null,
    };
  }

  const hasExplicitBasis = rawPercent.length > 0;
  const basis = hasExplicitBasis ? getPrepaymentBasisOption(rawBasisOrPercent) : defaultBasis;
  const percent = clampPrepaymentPercent(Number(hasExplicitBasis ? rawPercent : rawBasisOrPercent));

  return {
    timingId: timing.id,
    basisId: basis.id,
    percent,
    timingLabel: timing.label,
    basisLabel: basis.label,
    displayValue: formatPrepaymentAmountLabel(percent, basis.id),
    legacyText: null,
  };
}
