import {
  ExcursionAvailabilityMode,
  ExcursionOfferType,
  ExcursionPriceType,
  ExcursionScheduleMode,
} from "@prisma/client";

type DurationInput = {
  offerType: ExcursionOfferType;
  durationMinutes?: number | null;
  durationDays?: number | null;
  durationNights?: number | null;
};

type PriceInput = {
  priceFrom?: number | null;
  currency?: string | null;
  priceType?: ExcursionPriceType | null;
  priceUnitLabel?: string | null;
};

type AvailabilityInput = {
  availabilityMode?: ExcursionAvailabilityMode | null;
  scheduleMode?: ExcursionScheduleMode | null;
  scheduleText?: string | null;
  availabilityNote?: string | null;
  nextSessionStartAt?: string | Date | null;
};

export function getOfferTypeLabel(value: ExcursionOfferType | null | undefined): string {
  return value === ExcursionOfferType.TOUR ? "Тур" : "Экскурсия";
}

export function isTourOffer(value: ExcursionOfferType | null | undefined): boolean {
  return value === ExcursionOfferType.TOUR;
}

export function getResolvedAvailabilityMode(
  availabilityMode: ExcursionAvailabilityMode | null | undefined,
  scheduleMode?: ExcursionScheduleMode | null,
): ExcursionAvailabilityMode {
  if (availabilityMode) {
    if (
      availabilityMode === ExcursionAvailabilityMode.REGULAR &&
      scheduleMode === ExcursionScheduleMode.SESSIONS
    ) {
      return ExcursionAvailabilityMode.DATED;
    }
    return availabilityMode;
  }

  return scheduleMode === ExcursionScheduleMode.SESSIONS
    ? ExcursionAvailabilityMode.DATED
    : ExcursionAvailabilityMode.REGULAR;
}

export function formatProgramDuration(input: DurationInput): string {
  if (isTourOffer(input.offerType)) {
    const days = input.durationDays ?? 0;
    const nights = input.durationNights ?? 0;

    if (days > 0 && nights > 0) {
      return `${days} дн. / ${nights} ноч.`; 
    }
    if (days > 0) {
      return `${days} дн.`;
    }
    if (nights > 0) {
      return `${nights} ноч.`;
    }
  }

  const minutes = input.durationMinutes ?? 0;
  if (minutes <= 0) {
    return "Не указана";
  }

  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} дн.`;
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

export function getPriceUnitLabel(input: Pick<PriceInput, "priceType" | "priceUnitLabel">): string {
  if (input.priceUnitLabel?.trim()) {
    return input.priceUnitLabel.trim();
  }
  if (input.priceType === ExcursionPriceType.PER_GROUP) {
    return "группу";
  }
  return "чел";
}

export function formatProgramPrice(input: PriceInput): string {
  if (input.priceFrom === null || input.priceFrom === undefined) {
    return "Цена по запросу";
  }

  const currency = input.currency ?? "RUB";
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(input.priceFrom);

  const currencyLabel = currency === "RUB" ? "₽" : currency;
  return `от ${formatted} ${currencyLabel} / ${getPriceUnitLabel(input)}`;
}

export function buildProgramRouteSummary(input: {
  routePoints?: string[];
  startPoint?: string | null;
  finishPoint?: string | null;
  mainLocationName?: string | null;
  anchorLocationName?: string | null;
  locationName?: string | null;
  maxPoints?: number;
}): string {
  const maxPoints = input.maxPoints ?? 3;
  const points = [
    input.startPoint?.trim() ?? "",
    ...(input.routePoints ?? []).map((item) => item.trim()),
    input.finishPoint?.trim() ?? "",
  ].filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);

  if (points.length === 0) {
    return (
      input.mainLocationName ??
      input.anchorLocationName ??
      input.locationName ??
      "Крым"
    );
  }

  if (points.length <= maxPoints) {
    return points.join(" — ");
  }

  const visible = points.slice(0, maxPoints);
  return `${visible.join(" — ")} + ещё ${points.length - visible.length} точк.`;
}

export function formatAvailabilitySummary(input: AvailabilityInput): string {
  const availabilityMode = getResolvedAvailabilityMode(input.availabilityMode, input.scheduleMode);

  if (availabilityMode === ExcursionAvailabilityMode.ON_REQUEST) {
    return input.availabilityNote?.trim() || "По запросу";
  }

  if (availabilityMode === ExcursionAvailabilityMode.DATED && input.nextSessionStartAt) {
    const date =
      input.nextSessionStartAt instanceof Date
        ? input.nextSessionStartAt
        : new Date(input.nextSessionStartAt);

    if (!Number.isNaN(date.getTime())) {
      return `Ближайший заезд ${date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      })}`;
    }
  }

  if (input.scheduleText?.trim()) {
    return input.scheduleText.trim();
  }

  return availabilityMode === ExcursionAvailabilityMode.DATED ? "Даты уточняются" : "По расписанию";
}
