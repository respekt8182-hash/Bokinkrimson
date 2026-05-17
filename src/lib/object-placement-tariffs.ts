export const OBJECT_SEASON_FULL_PRICE_RUB = 3900;
export const OBJECT_OFFSEASON_PRICE_RUB = 2800;
export const OBJECT_YEARLY_PRICE_RUB = 4500;
export const OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB =
  OBJECT_SEASON_FULL_PRICE_RUB + OBJECT_OFFSEASON_PRICE_RUB;
export const OBJECT_YEARLY_SAVINGS_RUB =
  OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB - OBJECT_YEARLY_PRICE_RUB;

export const OBJECT_TARIFF_TYPES = ["season", "offseason", "yearly"] as const;
export type ObjectPlacementTariffType = (typeof OBJECT_TARIFF_TYPES)[number];
export type ObjectPlacementPaymentTariffType = ObjectPlacementTariffType | "demo";

export type ObjectPlacementTariffOption = {
  type: ObjectPlacementTariffType;
  code: string;
  title: string;
  shortTitle: string;
  amountRub: number;
  priceLabel: string;
  periodLabel: string;
  paidFrom: Date;
  paidUntil: Date;
  monthlyLabel: string;
  description: string;
  buttonLabel: string;
  recommended: boolean;
  savingsRub: number | null;
  unavailableReason: string | null;
};

export type SerializedObjectPlacementTariffOption = Omit<
  ObjectPlacementTariffOption,
  "paidFrom" | "paidUntil"
> & {
  paidFrom: string;
  paidUntil: string;
};

export const OBJECT_TARIFF_LABELS: Record<ObjectPlacementPaymentTariffType, string> = {
  season: "Сезон",
  offseason: "Межсезонье",
  yearly: "Годовой",
  demo: "Демо до 20 июня",
};

export const OBJECT_TARIFF_CODES: Record<ObjectPlacementTariffType, string> = {
  season: "object_season",
  offseason: "object_offseason",
  yearly: "object_yearly",
};

export const OBJECT_TARIFF_PRICE_TABLE = [
  { label: "Январь", amountRub: 3900 },
  { label: "Февраль", amountRub: 3700 },
  { label: "Март", amountRub: 3500 },
  { label: "Апрель", amountRub: 3300 },
  { label: "Май-июнь", amountRub: 3000 },
  { label: "Июль", amountRub: 2800 },
  { label: "Август", amountRub: 2500 },
  { label: "Сентябрь", amountRub: 1900 },
  { label: "Октябрь", amountRub: 990 },
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function startOfLocalDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function endOfLocalDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 23, 59, 59, 999);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeCurrentDate(now: Date): Date {
  return new Date(now.getTime());
}

function getInclusiveMonthCount(from: Date, until: Date): number {
  return Math.max(
    1,
    (until.getFullYear() - from.getFullYear()) * 12 + until.getMonth() - from.getMonth() + 1,
  );
}

function getSeasonPriceByMonth(monthIndex: number): number | null {
  if (monthIndex === 0) return 3900;
  if (monthIndex === 1) return 3700;
  if (monthIndex === 2) return 3500;
  if (monthIndex === 3) return 3300;
  if (monthIndex === 4 || monthIndex === 5) return 3000;
  if (monthIndex === 6) return 2800;
  if (monthIndex === 7) return 2500;
  if (monthIndex === 8) return 1900;
  if (monthIndex === 9) return 990;
  return null;
}

export function isObjectPlacementTariffType(
  value: string | null | undefined,
): value is ObjectPlacementTariffType {
  return OBJECT_TARIFF_TYPES.includes(value as ObjectPlacementTariffType);
}

export function getObjectTariffTypeFromPaymentTariffCode(
  tariffCode: string | null | undefined,
): ObjectPlacementPaymentTariffType | null {
  const normalized = tariffCode?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return null;
  }

  if (normalized === "object_demo" || normalized === "demo") return "demo";
  if (normalized === OBJECT_TARIFF_CODES.season || normalized === "season") return "season";
  if (normalized === OBJECT_TARIFF_CODES.offseason || normalized === "offseason") {
    return "offseason";
  }
  if (normalized === OBJECT_TARIFF_CODES.yearly || normalized === "yearly") return "yearly";

  return null;
}

export function getObjectTariffLabel(
  tariffType: ObjectPlacementPaymentTariffType | null | undefined,
  fallbackCode?: string | null,
): string {
  if (tariffType && tariffType in OBJECT_TARIFF_LABELS) {
    return OBJECT_TARIFF_LABELS[tariffType];
  }

  const fromCode = getObjectTariffTypeFromPaymentTariffCode(fallbackCode);
  return fromCode ? OBJECT_TARIFF_LABELS[fromCode] : (fallbackCode ?? "Не указан");
}

export function getCurrentSeasonTariffPriceRub(now = new Date()): number | null {
  return getSeasonPriceByMonth(now.getMonth());
}

export function getDefaultObjectPlacementTariffType(now = new Date()): ObjectPlacementTariffType {
  const month = now.getMonth();
  return month >= 0 && month <= 9 ? "season" : "yearly";
}

export function getSeasonPlacementPeriod(now = new Date()): {
  paidFrom: Date;
  paidUntil: Date;
} | null {
  const current = normalizeCurrentDate(now);
  const price = getSeasonPriceByMonth(current.getMonth());

  if (price === null) {
    return null;
  }

  return {
    paidFrom: current,
    paidUntil: endOfLocalDay(current.getFullYear(), 9, 31),
  };
}

export function getOffseasonPlacementPeriod(now = new Date()): {
  paidFrom: Date;
  paidUntil: Date;
  labelFrom: Date;
} {
  const current = normalizeCurrentDate(now);
  const year = current.getFullYear();
  const month = current.getMonth();
  const startYear = month <= 3 ? year - 1 : year;
  const labelFrom = startOfLocalDay(startYear, 10, 1);
  const paidUntil = endOfLocalDay(startYear + 1, 3, 30);
  const paidFrom = current.getTime() > labelFrom.getTime() ? current : labelFrom;

  return {
    paidFrom,
    paidUntil,
    labelFrom,
  };
}

export function getYearlyPlacementPeriod(now = new Date()): {
  paidFrom: Date;
  paidUntil: Date;
} {
  const current = normalizeCurrentDate(now);
  const paidUntil = addMonths(current, 12);
  paidUntil.setMilliseconds(paidUntil.getMilliseconds() - 1);

  return {
    paidFrom: current,
    paidUntil,
  };
}

function buildSeasonOption(now: Date): ObjectPlacementTariffOption | null {
  const amountRub = getCurrentSeasonTariffPriceRub(now);
  const period = getSeasonPlacementPeriod(now);

  if (amountRub === null || !period) {
    return null;
  }

  const monthCount = getInclusiveMonthCount(period.paidFrom, period.paidUntil);
  const monthly = Math.round(amountRub / monthCount);

  return {
    type: "season",
    code: OBJECT_TARIFF_CODES.season,
    title: "Сезонное размещение",
    shortTitle: "Сезонное размещение",
    amountRub,
    priceLabel: `${formatMoney(amountRub)}`,
    periodLabel: `С даты оплаты до ${formatDate(period.paidUntil)}`,
    paidFrom: period.paidFrom,
    paidUntil: period.paidUntil,
    monthlyLabel: `примерно ${formatMoney(monthly)} в месяц`,
    description:
      "Размещение объекта с момента оплаты до 31 октября. Сезонное размещение можно подключить заранее — с января, чтобы карточка уже показывалась туристам в период раннего бронирования на лето.",
    buttonLabel: "Выбрать сезон",
    recommended: false,
    savingsRub: null,
    unavailableReason: null,
  };
}

function buildOffseasonOption(now: Date): ObjectPlacementTariffOption {
  const period = getOffseasonPlacementPeriod(now);

  return {
    type: "offseason",
    code: OBJECT_TARIFF_CODES.offseason,
    title: "Межсезонное размещение",
    shortTitle: "Межсезонье",
    amountRub: OBJECT_OFFSEASON_PRICE_RUB,
    priceLabel: formatMoney(OBJECT_OFFSEASON_PRICE_RUB),
    periodLabel: `С ${formatDate(period.labelFrom)} до ${formatDate(period.paidUntil)}`,
    paidFrom: period.paidFrom,
    paidUntil: period.paidUntil,
    monthlyLabel: "около 467 ₽ в месяц",
    description: "Размещение с ноября по апрель.",
    buttonLabel: "Выбрать межсезонье",
    recommended: false,
    savingsRub: null,
    unavailableReason: null,
  };
}

function buildYearlyOption(now: Date): ObjectPlacementTariffOption {
  const period = getYearlyPlacementPeriod(now);

  return {
    type: "yearly",
    code: OBJECT_TARIFF_CODES.yearly,
    title: "Годовое размещение",
    shortTitle: "Годовой",
    amountRub: OBJECT_YEARLY_PRICE_RUB,
    priceLabel: formatMoney(OBJECT_YEARLY_PRICE_RUB),
    periodLabel: "12 месяцев с даты оплаты",
    paidFrom: period.paidFrom,
    paidUntil: period.paidUntil,
    monthlyLabel: "375 ₽ в месяц",
    description:
      "Размещение объекта на 12 месяцев с даты оплаты. Подходит для тех, кто хочет быть на сайте круглый год: в сезон, в период раннего бронирования, осенью, зимой и весной.",
    buttonLabel: "Выбрать годовой тариф",
    recommended: true,
    savingsRub: null,
    unavailableReason: null,
  };
}

export function getObjectPlacementTariffOptions(now = new Date()): ObjectPlacementTariffOption[] {
  const season = buildSeasonOption(now);
  return [season, buildYearlyOption(now)].filter(
    (item): item is ObjectPlacementTariffOption => item !== null,
  );
}

export function getLegacyOffseasonPlacementTariffOption(
  now = new Date(),
): ObjectPlacementTariffOption {
  return buildOffseasonOption(now);
}

export function getObjectPlacementTariffOption(
  tariffType: ObjectPlacementTariffType,
  now = new Date(),
): ObjectPlacementTariffOption | null {
  return getObjectPlacementTariffOptions(now).find((option) => option.type === tariffType) ?? null;
}

export function serializeObjectPlacementTariffOption(
  option: ObjectPlacementTariffOption,
): SerializedObjectPlacementTariffOption {
  return {
    ...option,
    paidFrom: option.paidFrom.toISOString(),
    paidUntil: option.paidUntil.toISOString(),
  };
}

export function getDaysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);
}
