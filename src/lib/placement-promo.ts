export const PLACEMENT_PROMO_CODE = "launch-free-placement-2026";
export const PLACEMENT_PROMO_DISCOUNT_PERCENT = 100;
export const PLACEMENT_PROMO_RENEWAL_DISCOUNT_PERCENT = 20;
export const PLACEMENT_PROMO_ENDS_AT_ISO = "2026-06-21T00:00:00.000+03:00";
export const PLACEMENT_PROMO_END_LABEL = "20 июня 2026 включительно";
export const PLACEMENT_PROMO_SHORT_END_LABEL = "20 июня";
export const PLACEMENT_PROMO_BADGE_LABEL = "0 ₽ до 20 июня";
export const PLACEMENT_PROMO_NOTICE =
  "До 20 июня 2026 включительно размещение объектов, экскурсий, туров и трансферов бесплатно. Участники, которые разместятся в этот период, получат скидку 20% на дальнейшее продление размещения.";
export const PLACEMENT_PROMO_DEMO_MODE = "demo";
export const PLACEMENT_PROMO_DEMO_LABEL = "Демо-режим";
export const PLACEMENT_PROMO_DEMO_ENDS_AT_ISO = PLACEMENT_PROMO_ENDS_AT_ISO;
export const PLACEMENT_PROMO_DEMO_RENEWAL_LOOKAHEAD_DAYS = 7;

const LEGACY_PLACEMENT_PROMO_CODES = new Map<string, number>([["season-start-2026-20", 20]]);

export type PlacementPromoPrice = {
  code: string;
  discountPercent: number;
  originalAmountRub: number;
  finalAmountRub: number;
  discountAmountRub: number;
  isDiscounted: boolean;
  endsAtIso: string;
  endsLabel: string;
  shortEndsLabel: string;
};

export type PlacementPromoPayload = {
  code: string;
  discountPercent: number;
  originalAmountRub: number;
  discountedAmountRub: number;
  discountAmountRub: number;
  endsAtIso: string;
  createdAtIso: string;
};

const promoEndsAtMs = Date.parse(PLACEMENT_PROMO_ENDS_AT_ISO);

function isKnownPlacementPromo(code: string | null, discountPercent: number | null): boolean {
  if (code === PLACEMENT_PROMO_CODE && discountPercent === PLACEMENT_PROMO_DISCOUNT_PERCENT) {
    return true;
  }

  if (!code || discountPercent === null) {
    return false;
  }

  return LEGACY_PLACEMENT_PROMO_CODES.get(code) === discountPercent;
}

function normalizeRubAmount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPlacementPromoActive(now = new Date()): boolean {
  return now.getTime() < promoEndsAtMs;
}

export function getPlacementPromoDemoValidUntil(): Date {
  return new Date(PLACEMENT_PROMO_DEMO_ENDS_AT_ISO);
}

export function getPlacementPromoPrice(
  originalAmountRub: number,
  now = new Date(),
): PlacementPromoPrice {
  const originalAmount = normalizeRubAmount(originalAmountRub);
  const isDiscounted = isPlacementPromoActive(now) && originalAmount > 0;
  const finalAmount = isDiscounted
    ? Math.round((originalAmount * (100 - PLACEMENT_PROMO_DISCOUNT_PERCENT)) / 100)
    : originalAmount;

  return {
    code: PLACEMENT_PROMO_CODE,
    discountPercent: PLACEMENT_PROMO_DISCOUNT_PERCENT,
    originalAmountRub: originalAmount,
    finalAmountRub: finalAmount,
    discountAmountRub: Math.max(0, originalAmount - finalAmount),
    isDiscounted,
    endsAtIso: PLACEMENT_PROMO_ENDS_AT_ISO,
    endsLabel: PLACEMENT_PROMO_END_LABEL,
    shortEndsLabel: PLACEMENT_PROMO_SHORT_END_LABEL,
  };
}

export function buildPlacementPromoPayload(input: {
  originalAmountRub: number;
  discountedAmountRub: number;
  now?: Date;
}): PlacementPromoPayload | null {
  const originalAmountRub = normalizeRubAmount(input.originalAmountRub);
  const discountedAmountRub = normalizeRubAmount(input.discountedAmountRub);

  if (
    !isPlacementPromoActive(input.now) ||
    originalAmountRub <= 0 ||
    discountedAmountRub >= originalAmountRub
  ) {
    return null;
  }

  return {
    code: PLACEMENT_PROMO_CODE,
    discountPercent: PLACEMENT_PROMO_DISCOUNT_PERCENT,
    originalAmountRub,
    discountedAmountRub,
    discountAmountRub: originalAmountRub - discountedAmountRub,
    endsAtIso: PLACEMENT_PROMO_ENDS_AT_ISO,
    createdAtIso: (input.now ?? new Date()).toISOString(),
  };
}

export function buildPlacementPromoMetadata(input: {
  originalAmountRub: number;
  discountedAmountRub: number;
  now?: Date;
}): Record<string, string> {
  const payload = buildPlacementPromoPayload(input);

  if (!payload) {
    return {};
  }

  return {
    placementPromoCode: payload.code,
    placementPromoDiscountPercent: String(payload.discountPercent),
    placementPromoOriginalAmountRub: String(payload.originalAmountRub),
    placementPromoDiscountedAmountRub: String(payload.discountedAmountRub),
    placementPromoDiscountAmountRub: String(payload.discountAmountRub),
    placementPromoEndsAtIso: payload.endsAtIso,
  };
}

function parsePlacementPromoRecord(value: Record<string, unknown>): PlacementPromoPayload | null {
  const code = typeof value.code === "string" ? value.code : null;
  const discountPercent = toNumber(value.discountPercent);
  const originalAmountRub = toNumber(value.originalAmountRub);
  const discountedAmountRub = toNumber(value.discountedAmountRub);
  const discountAmountRub = toNumber(value.discountAmountRub);
  const endsAtIso = typeof value.endsAtIso === "string" ? value.endsAtIso : null;

  if (
    !code ||
    discountPercent === null ||
    !isKnownPlacementPromo(code, discountPercent) ||
    originalAmountRub === null ||
    discountedAmountRub === null ||
    discountAmountRub === null ||
    !endsAtIso
  ) {
    return null;
  }

  return {
    code,
    discountPercent,
    originalAmountRub,
    discountedAmountRub,
    discountAmountRub,
    endsAtIso,
    createdAtIso:
      typeof value.createdAtIso === "string" ? value.createdAtIso : new Date(0).toISOString(),
  };
}

function parsePlacementPromoMetadata(value: Record<string, unknown>): PlacementPromoPayload | null {
  const code = typeof value.placementPromoCode === "string" ? value.placementPromoCode : null;
  const discountPercent = toNumber(value.placementPromoDiscountPercent);
  const originalAmountRub = toNumber(value.placementPromoOriginalAmountRub);
  const discountedAmountRub = toNumber(value.placementPromoDiscountedAmountRub);
  const discountAmountRub = toNumber(value.placementPromoDiscountAmountRub);
  const endsAtIso =
    typeof value.placementPromoEndsAtIso === "string" ? value.placementPromoEndsAtIso : null;

  if (
    !code ||
    discountPercent === null ||
    !isKnownPlacementPromo(code, discountPercent) ||
    originalAmountRub === null ||
    discountedAmountRub === null ||
    discountAmountRub === null ||
    !endsAtIso
  ) {
    return null;
  }

  return {
    code,
    discountPercent,
    originalAmountRub,
    discountedAmountRub,
    discountAmountRub,
    endsAtIso,
    createdAtIso: new Date(0).toISOString(),
  };
}

export function getPlacementPromoPayload(value: unknown): PlacementPromoPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const directPayload = isRecord(value.placementPromo)
    ? parsePlacementPromoRecord(value.placementPromo)
    : null;
  if (directPayload) {
    return directPayload;
  }

  return isRecord(value.metadata) ? parsePlacementPromoMetadata(value.metadata) : null;
}

export function isFreePlacementDemoPayload(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value.placementMode === PLACEMENT_PROMO_DEMO_MODE) {
    return true;
  }

  if (value.placementCampaignType === "free_placement_until_2026_06_20") {
    return true;
  }

  const promoPayload = getPlacementPromoPayload(value);
  return (
    promoPayload?.code === PLACEMENT_PROMO_CODE &&
    promoPayload.discountPercent === PLACEMENT_PROMO_DISCOUNT_PERCENT &&
    promoPayload.discountedAmountRub === 0
  );
}

export function getPlacementPromoOriginalCoverageAmount(
  providerPayload: unknown,
  fallbackAmountRub: number,
): number {
  const fallbackAmount = normalizeRubAmount(fallbackAmountRub);
  const promoPayload = getPlacementPromoPayload(providerPayload);

  if (!promoPayload) {
    return fallbackAmount;
  }

  return Math.max(fallbackAmount, normalizeRubAmount(promoPayload.originalAmountRub));
}
