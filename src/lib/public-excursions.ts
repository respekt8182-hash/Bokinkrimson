// Domain/service module for public excursions.
import { existsSync } from "fs";
import path from "path";
import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionScheduleMode,
  ExcursionSessionStatus,
  ExcursionStatus,
  ReviewEntityType,
  ReviewStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  parsePublishedExcursionSnapshot,
  shouldUsePublishedExcursionSnapshot,
  type PublishedExcursionSnapshot,
} from "@/lib/excursion-public-snapshot";
import {
  buildProgramRouteSummary,
  formatAvailabilitySummary,
  getResolvedAvailabilityMode,
} from "@/lib/excursion-offers";
import {
  resolveExcursionLocation,
  type ExcursionLocationDirectoryItem,
} from "@/lib/excursion-directory";
import { calculateDistanceKm, isWithinRadiusKm, roundDistanceKm } from "@/lib/catalog-radius";
import { resolveCrimeaLocationCenter } from "@/lib/crimea-location-centers";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import { cleanFaqItems, cleanPublicText, cleanPublicTextList } from "@/lib/public-content-quality";
import { serializeReview } from "@/lib/reviews";
import { extractPropertyId, isPublicEntityId, slugify } from "@/lib/public-properties";
import { buildPublishedExcursionVisibilityWhere } from "@/lib/public-visibility";
import type {
  ExcursionExtraOption,
  ExcursionSectionPhotoGroups,
  FaqItem,
  ItineraryDay,
  PricingTier,
  TimelineStep,
} from "@/types/excursions";
import {
  collectExcursionSectionPhotoUrls,
  getItineraryDayPhotoUrls,
  getTimelineStepPhotoUrls,
  normalizeExcursionSectionPhotoGroups,
} from "@/types/excursions";

type ResolvedDistrict = {
  id: string;
  slug: string;
  name: string;
};

type ResolvedCategory = {
  id: string;
  slug: string;
  name: string;
};

type DateRangeFilter = {
  dateFrom: Date;
  dateTo: Date;
};

export type PublicExcursionCatalogQuery = {
  offerType?: "excursion" | "tour";
  location?: string;
  locationId?: string;
  district?: string;
  districtId?: string;
  category?: string;
  categoryId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  allowLargePageSize?: boolean;
  dateFrom?: string;
  dateTo?: string;
  people?: number;
  format?: string;
  pickup?: boolean;
  kids?: boolean;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  durationBucket?: "up_to_3h" | "between_3h_6h" | "more_6h";
  language?: string;
  difficulty?: "easy" | "medium" | "hard";
  sort?:
    | "relevance"
    | "price_asc"
    | "price_desc"
    | "rating_desc"
    | "popular_desc"
    | "distance_asc"
    | "duration_asc";
};

export type PublicExcursionCatalogItem = {
  id: string;
  slug: string;
  path: string;
  title: string;
  offerType: ExcursionOfferType;
  subtypeLabel: string | null;
  locationId: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  mainLocationName: string | null;
  anchorCityName: string | null;
  districtName: string | null;
  categoryName: string | null;
  startPoint: string | null;
  finishPoint: string | null;
  routeSummary: string;
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  priceUnitLabel: string | null;
  coverImageUrl: string | null;
  avgRating: number;
  reviewsCount: number;
  distanceKm: number | null;
  hasAvailableSession: boolean;
  pickupAvailable: boolean;
  availabilityMode: ExcursionAvailabilityMode;
  availabilitySummary: string;
  hasAccommodation: boolean;
  owner: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

export type PublicExcursionCatalogResult = {
  items: PublicExcursionCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    locationId: string | null;
    locationName: string | null;
    centerLat: number | null;
    centerLng: number | null;
    districtId: string | null;
    districtSlug: string | null;
    districtName: string | null;
    categoryId: string | null;
    categorySlug: string | null;
    categoryName: string | null;
    offerType: "excursion" | "tour" | null;
    query: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    people: number | null;
    radiusKm: number;
    minPrice: number | null;
    maxPrice: number | null;
    durationBucket: "up_to_3h" | "between_3h_6h" | "more_6h" | null;
    language: string | null;
    difficulty: "easy" | "medium" | "hard" | null;
    format: string | null;
    pickup: boolean;
    kids: boolean;
    sort:
      | "relevance"
      | "price_asc"
      | "price_desc"
      | "rating_desc"
      | "popular_desc"
      | "distance_asc"
      | "duration_asc";
  };
};

export type PublicExcursionCard = {
  id: string;
  slug: string;
  path: string;
  offerType: ExcursionOfferType;
  subtypeLabel: string | null;
  title: string | null;
  locationId: string | null;
  locationName: string | null;
  mainLocationName: string | null;
  anchorCityName: string | null;
  districtName: string | null;
  categoryName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  startPoint: string | null;
  finishPoint: string | null;
  meetingPointText: string | null;
  description: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  routeDescription: string | null;
  highlights: string[];
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  itineraryDays: ItineraryDay[];
  scheduleText: string | null;
  scheduleMode: ExcursionScheduleMode;
  availabilityMode: ExcursionAvailabilityMode;
  availabilityNote: string | null;
  format: ExcursionFormat | null;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  languageCodes: string[];
  ageLimit: number | null;
  isKidFriendly: boolean | null;
  difficulty: ExcursionDifficulty | null;
  pickupAvailable: boolean;
  tags: string[];
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  includedText: string | null;
  notIncludedText: string | null;
  includedItems: string[];
  excludedItems: string[];
  cancellationPolicy: string | null;
  cancellationPolicyType: string | null;
  physicalRequirements: string[];
  whatToBring: string[];
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  minBookingNoticeHours: number | null;
  hasGuideLicense: boolean;
  transferDetails: string | null;
  timeline: TimelineStep[];
  extraOptions: ExcursionExtraOption[];
  pricingTiers: PricingTier[];
  faqItems: FaqItem[];
  photoUrls: string[];
  sectionPhotoGroups: ExcursionSectionPhotoGroups;
  videoUrls: string[];
  priceUnitLabel: string | null;
  receiveRequests: boolean;
  instantConfirmation: boolean;
  accommodationProvided: boolean | null;
  accommodationType: string | null;
  accommodationNights: number | null;
  accommodationFormat: string | null;
  accommodationStars: string | null;
  roomTypes: string[];
  singleSupplementAvailable: boolean | null;
  singleSupplementPrice: number | null;
  mealPlan: string | null;
  mealDetails: string | null;
  accommodationComment: string | null;
  tourKind: string | null;
  transportModes: string[];
  departureMode: string | null;
  arrivalInfo: string | null;
  departureInfo: string | null;
  documentsRequired: string[];
  insuranceIncluded: boolean | null;
  insuranceComment: string | null;
  equipmentProvided: string[];
  safetyInfo: string | null;
  routeConditions: string | null;
  availabilitySummary: string;
  avgRating: number;
  reviewsCount: number;
  contacts: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    phone2: string | null;
    email: string | null;
    websiteUrl: string | null;
    whatsappUrl: string | null;
    telegramUrl: string | null;
    vkUrl: string | null;
    maxUrl: string | null;
    okUrl: string | null;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  sessions: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    capacity: number | null;
    priceOverride: number | null;
    status: ExcursionSessionStatus;
    bookingDeadlineMinutes: number | null;
  }>;
  scheduleRules: Array<{
    id: string;
    dateFrom: string | null;
    dateTo: string | null;
    weekdays: number[];
    timeStarts: string[];
    durationMinutes: number | null;
    capacityDefault: number | null;
    priceOverride: number | null;
  }>;
  scheduleExceptions: Array<{
    id: string;
    date: string;
    isClosed: boolean;
    overrideTimeStarts: string[];
    overrideCapacity: number | null;
    overridePrice: number | null;
    notes: string | null;
  }>;
  pickupLocations: Array<{ id: string; name: string; slug: string }>;
  routeLocations: Array<{ id: string; name: string; slug: string; sortOrder: number }>;
  reviews: ReturnType<typeof serializeReview>[];
};

function sanitizePublicTimelineSteps(value: Prisma.JsonValue): TimelineStep[] {
  return Array.isArray(value)
    ? (value as TimelineStep[]).flatMap((step): TimelineStep[] => {
        const title = cleanPublicText(step.title, { minLength: 2, maxLength: 140 });
        const description = cleanPublicText(step.description, {
          minLength: 8,
          maxLength: 900,
          preserveLineBreaks: true,
        });
        const location = cleanPublicText(step.location, { minLength: 2, maxLength: 120 });

        if (!title && !description) {
          return [];
        }

        return [
          {
            ...step,
            title: title ?? "Этап маршрута",
            ...(description ? { description } : {}),
            ...(location ? { location } : {}),
            duration:
              cleanPublicText(step.duration, { minLength: 1, maxLength: 60 }) ?? step.duration,
            time: cleanPublicText(step.time, { minLength: 1, maxLength: 40 }) ?? step.time,
            photoUrls: filterExistingPublicAssetUrls(getTimelineStepPhotoUrls(step)),
          },
        ];
      })
    : [];
}

function sanitizePublicItineraryDays(value: Prisma.JsonValue): ItineraryDay[] {
  return Array.isArray(value)
    ? (value as ItineraryDay[]).flatMap((day): ItineraryDay[] => {
        const title = cleanPublicText(day.title, { minLength: 2, maxLength: 140 });
        const description = cleanPublicText(day.description, {
          minLength: 10,
          maxLength: 1400,
          preserveLineBreaks: true,
        });
        const teaser = cleanPublicText(day.teaser, { minLength: 8, maxLength: 240 });
        const meals = cleanPublicText(day.meals, { minLength: 2, maxLength: 160 });
        const accommodation = cleanPublicText(day.accommodation, {
          minLength: 2,
          maxLength: 180,
        });
        const overnightLocation = cleanPublicText(day.overnightLocation, {
          minLength: 2,
          maxLength: 120,
        });
        const accommodationName = cleanPublicText(day.accommodationName, {
          minLength: 2,
          maxLength: 140,
        });
        const notes = cleanPublicText(day.notes, { minLength: 4, maxLength: 400 });

        if (!title && !description && !teaser) {
          return [];
        }

        return [
          {
            ...day,
            title: title ?? `День ${day.day}`,
            ...(teaser ? { teaser } : {}),
            description: description ?? "",
            locations: cleanPublicTextList(day.locations, { minLength: 2, maxLength: 80 }),
            included: cleanPublicTextList(day.included, { minLength: 2, maxLength: 120 }),
            ...(meals ? { meals } : {}),
            ...(accommodation ? { accommodation } : {}),
            activities: cleanPublicTextList(day.activities, { minLength: 2, maxLength: 120 }),
            mealsIncluded: cleanPublicTextList(day.mealsIncluded, {
              minLength: 2,
              maxLength: 80,
            }),
            ...(overnightLocation ? { overnightLocation } : {}),
            ...(accommodationName ? { accommodationName } : {}),
            optionalExtras: cleanPublicTextList(day.optionalExtras, {
              minLength: 2,
              maxLength: 120,
            }),
            ...(notes ? { notes } : {}),
            photoUrls: filterExistingPublicAssetUrls(getItineraryDayPhotoUrls(day)),
          },
        ];
      })
    : [];
}

function toNumberOrNull(value: Prisma.Decimal | number | null): number | null {
  return value === null ? null : Number(value);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoDateString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function getPublicExcursionSnapshot(input: {
  status: ExcursionStatus;
  pendingEditStatus: ExcursionStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
}): PublishedExcursionSnapshot | null {
  return shouldUsePublishedExcursionSnapshot(input)
    ? parsePublishedExcursionSnapshot(input.publishedSnapshot)
    : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizePublicPhotoUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

function filterExistingPublicAssetUrls(urls: string[]): string[] {
  return normalizePublicPhotoUrls(urls).filter((url) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith("/uploads/")) {
      return true;
    }

    const relativePath = decodeURIComponent(trimmed.slice(1));
    const absolutePath = path.join(process.cwd(), "public", ...relativePath.split("/"));
    return existsSync(absolutePath);
  });
}

function collectRawPublicExcursionGalleryPhotoUrls(input: {
  photoUrls?: unknown;
  sectionPhotoGroups?: unknown;
  itineraryDays?: Prisma.JsonValue | ItineraryDay[];
  timeline?: Prisma.JsonValue | TimelineStep[];
}): string[] {
  const sectionPhotoUrls = collectExcursionSectionPhotoUrls(
    input.sectionPhotoGroups as Partial<Record<string, string[] | null | undefined>>,
  );
  const itineraryPhotoUrls = Array.isArray(input.itineraryDays)
    ? input.itineraryDays.flatMap((day) => getItineraryDayPhotoUrls(day as ItineraryDay))
    : [];
  const timelinePhotoUrls = Array.isArray(input.timeline)
    ? input.timeline.flatMap((step) => getTimelineStepPhotoUrls(step as TimelineStep))
    : [];

  return normalizePublicPhotoUrls([
    ...toStringArray(input.photoUrls),
    ...sectionPhotoUrls,
    ...itineraryPhotoUrls,
    ...timelinePhotoUrls,
  ]);
}

function getPublicExcursionGalleryPhotoUrls(input: {
  photoUrls?: unknown;
  sectionPhotoGroups?: unknown;
  itineraryDays?: Prisma.JsonValue | ItineraryDay[];
  timeline?: Prisma.JsonValue | TimelineStep[];
}): string[] {
  return filterExistingPublicAssetUrls(collectRawPublicExcursionGalleryPhotoUrls(input));
}

function getPublicExcursionCoverImageUrl(input: {
  photoUrls?: unknown;
  sectionPhotoGroups?: unknown;
  itineraryDays?: Prisma.JsonValue | ItineraryDay[];
  timeline?: Prisma.JsonValue | TimelineStep[];
}): string | null {
  return getPublicExcursionGalleryPhotoUrls(input)[0] ?? null;
}

function filterPublicSectionPhotoGroups(
  value: Partial<Record<string, string[] | null | undefined>> | null | undefined,
): ExcursionSectionPhotoGroups {
  const normalized = normalizeExcursionSectionPhotoGroups(value);

  return {
    dates: filterExistingPublicAssetUrls(normalized.dates),
    program: filterExistingPublicAssetUrls(normalized.program),
    logistics: filterExistingPublicAssetUrls(normalized.logistics),
    accommodation: filterExistingPublicAssetUrls(normalized.accommodation),
    included: filterExistingPublicAssetUrls(normalized.included),
    requirements: filterExistingPublicAssetUrls(normalized.requirements),
  };
}

export function buildExcursionSlug(title: string | null, _id?: string): string {
  void _id;
  const base = slugify(title ?? "ekskursiya") || "ekskursiya";
  return base;
}

export function buildPublicExcursionPath(excursion: {
  id: string;
  locationId: string | null;
  title: string | null;
  anchorLocationSlug?: string | null;
  anchorLocation?: { slug: string } | null;
}): string {
  const location =
    excursion.anchorLocationSlug ??
    excursion.anchorLocation?.slug ??
    excursion.locationId ??
    "crimea";
  return `/crimea/excursions/${location}/${buildExcursionSlug(excursion.title, excursion.id)}`;
}

const publicExcursionIdentifierSelect = Prisma.validator<Prisma.ExcursionSelect>()({
  id: true,
  title: true,
  locationId: true,
  status: true,
  pendingEditStatus: true,
  publishedSnapshot: true,
  updatedAt: true,
  anchorLocation: {
    select: { slug: true },
  },
});

type PublicExcursionIdentifierRecord = Prisma.ExcursionGetPayload<{
  select: typeof publicExcursionIdentifierSelect;
}>;

function getExcursionIdentifierState(
  excursion: PublicExcursionIdentifierRecord,
): { slug: string; locationId: string } {
  const snapshot = getPublicExcursionSnapshot(excursion);
  const display = snapshot?.excursion ?? excursion;

  return {
    slug: buildExcursionSlug(display.title, excursion.id),
    locationId: display.anchorLocation?.slug ?? display.locationId ?? "crimea",
  };
}

async function findExcursionIdByPublicSlug(input: {
  identifier: string;
  expectedLocationId?: string | null;
  ownerId?: string | null;
}): Promise<string | null> {
  const slug = slugify(input.identifier);
  if (!slug) {
    return null;
  }

  const rows = await db.excursion.findMany({
    where: input.ownerId
      ? {
          ownerId: input.ownerId,
          deletedAt: null,
        }
      : buildPublishedExcursionVisibilityWhere(),
    select: publicExcursionIdentifierSelect,
    orderBy: [{ updatedAt: "desc" }],
  });

  const match = rows.find((excursion) => {
    const state = getExcursionIdentifierState(excursion);
    return (
      state.slug === slug &&
      (!input.expectedLocationId || state.locationId === input.expectedLocationId)
    );
  });

  return match?.id ?? null;
}

async function resolveDistrict(input: {
  districtId?: string;
  district?: string;
}): Promise<ResolvedDistrict | null> {
  if (input.districtId) {
    const byId = await db.excursionDistrict.findFirst({
      where: {
        OR: [{ id: input.districtId }, { slug: input.districtId }],
      },
      select: { id: true, slug: true, name: true },
    });
    if (byId) {
      return byId;
    }
  }

  const value = input.district?.trim();
  if (!value) {
    return null;
  }

  const exactBySlugOrName = await db.excursionDistrict.findFirst({
    where: {
      OR: [{ slug: value.toLowerCase() }, { name: { equals: value, mode: "insensitive" } }],
    },
    select: { id: true, slug: true, name: true },
  });

  if (exactBySlugOrName) {
    return exactBySlugOrName;
  }

  const rows = await db.excursionDistrict.findMany({
    select: { id: true, slug: true, name: true },
  });
  const [best] = rankByTrigramWithScores(value, rows, (item) => [item.name, item.slug], {
    limit: 1,
    minScore: 0.08,
  });
  return best?.item ?? null;
}

async function resolveCategory(input: {
  categoryId?: string;
  category?: string;
}): Promise<ResolvedCategory | null> {
  if (input.categoryId) {
    const byId = await db.excursionCategory.findFirst({
      where: {
        OR: [{ id: input.categoryId }, { slug: input.categoryId }],
      },
      select: { id: true, slug: true, name: true },
    });
    if (byId) {
      return byId;
    }
  }

  const value = input.category?.trim();
  if (!value) {
    return null;
  }

  const exactBySlugOrName = await db.excursionCategory.findFirst({
    where: {
      OR: [{ slug: value.toLowerCase() }, { name: { equals: value, mode: "insensitive" } }],
    },
    select: { id: true, slug: true, name: true },
  });
  if (exactBySlugOrName) {
    return exactBySlugOrName;
  }

  const rows = await db.excursionCategory.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
  });
  const [best] = rankByTrigramWithScores(value, rows, (item) => [item.name, item.slug], {
    limit: 1,
    minScore: 0.08,
  });
  return best?.item ?? null;
}

function getDailyRotationKey(): string {
  const now = new Date();
  const dayIso = now.toISOString().slice(0, 10);
  // 6 rotation windows per day — top results reshuffle every ~4 hours
  const hourBucket = Math.floor(now.getUTCHours() / 4);
  return `${dayIso}:${hourBucket}`;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function parseDateRange(input: { dateFrom?: string; dateTo?: string }): DateRangeFilter | null {
  // Accept partial input (only from/to) and normalize to inclusive UTC bounds.
  const dateFromRaw = input.dateFrom?.trim();
  const dateToRaw = input.dateTo?.trim();
  if (!dateFromRaw && !dateToRaw) {
    return null;
  }

  const today = new Date();
  const fallbackFrom = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const from = dateFromRaw ? new Date(`${dateFromRaw}T00:00:00.000Z`) : fallbackFrom;
  const to = dateToRaw
    ? new Date(`${dateToRaw}T23:59:59.999Z`)
    : new Date(from.getTime() + 86_399_999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  if (to.getTime() < from.getTime()) {
    // Defensive normalization: inverted range collapses to one day instead of dropping the filter.
    return {
      dateFrom: from,
      dateTo: new Date(from.getTime() + 86_399_999),
    };
  }

  return { dateFrom: from, dateTo: to };
}

export function normalizeExcursionSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPrimaryExcursionSearchScore(
  query: string,
  candidates: Array<string | null | undefined>,
): number {
  const normalizedQuery = normalizeExcursionSearchText(query);
  if (normalizedQuery.length < 2) {
    return 0;
  }

  const normalizedCandidates = candidates
    .map((candidate) => (candidate ? normalizeExcursionSearchText(candidate) : ""))
    .filter(Boolean);
  if (normalizedCandidates.length === 0) {
    return 0;
  }

  const queryTokens = normalizedQuery.split(" ");
  let bestScore = 0;

  for (const candidate of normalizedCandidates) {
    if (candidate === normalizedQuery) {
      bestScore = Math.max(bestScore, 1.35);
      continue;
    }

    if (candidate.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 1.18);
      continue;
    }

    if (candidate.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 1);
      continue;
    }

    if (queryTokens.every((token) => candidate.includes(token))) {
      bestScore = Math.max(bestScore, 0.88);
    }
  }

  if (bestScore > 0) {
    return bestScore;
  }

  const combined = normalizedCandidates.join(" ");
  if (combined.includes(normalizedQuery)) {
    return 0.96;
  }

  if (queryTokens.every((token) => combined.includes(token))) {
    return 0.8;
  }

  return 0;
}

function containsExcursionLocationQuery(
  query: string,
  candidates: Array<string | null | undefined>,
): boolean {
  const normalizedQuery = normalizeExcursionSearchText(query);
  if (normalizedQuery.length < 2) {
    return false;
  }

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeExcursionSearchText(candidate ?? "");
    return normalizedCandidate.includes(normalizedQuery);
  });
}

function getSearchScoreMap<T extends { id: string }>(
  query: string,
  rows: T[],
  resolver: (item: T) => Array<string | null | undefined>,
): Map<string, number> {
  // Very short queries generate noisy fuzzy matches, so we skip scoring for < 2 chars.
  if (query.length < 2) {
    return new Map();
  }

  const ranked = rankByTrigramWithScores(query, rows, resolver, {
    limit: rows.length,
    minScore: 0.08,
  });

  return new Map(ranked.map((item) => [item.item.id, item.score]));
}

function parseExcursionSort(
  value: string | undefined,
):
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "popular_desc"
  | "distance_asc"
  | "duration_asc" {
  if (!value) return "relevance";
  switch (value) {
    case "price_asc":
    case "price_desc":
    case "rating_desc":
    case "popular_desc":
    case "distance_asc":
    case "duration_asc":
    case "relevance":
      return value;
    default:
      return "relevance";
  }
}

function parseDurationBucket(
  value: string | undefined,
): "up_to_3h" | "between_3h_6h" | "more_6h" | null {
  if (value === "up_to_3h" || value === "between_3h_6h" || value === "more_6h") {
    return value;
  }
  return null;
}

function parseDifficulty(value: string | undefined): "easy" | "medium" | "hard" | null {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return null;
}

export async function getPublicExcursionCatalog(
  query: PublicExcursionCatalogQuery,
): Promise<PublicExcursionCatalogResult> {
  // Normalize request once so DB fetch and in-memory ranking use the same source of truth.
  const page = Math.max(1, query.page ?? 1);
  const pageSizeCap = query.allowLargePageSize ? 5000 : 30;
  const pageSize = Math.min(pageSizeCap, Math.max(1, query.pageSize ?? 30));
  const rawLocationQuery = query.location?.trim() ?? "";
  const searchQuery = query.query?.trim() ?? "";
  const normalizedSearchQuery = normalizeExcursionSearchText(searchQuery);
  const hasTextSearch = normalizedSearchQuery.length >= 2;
  const sort = parseExcursionSort(query.sort);
  const minPrice =
    typeof query.minPrice === "number" && Number.isFinite(query.minPrice) && query.minPrice > 0
      ? query.minPrice
      : null;
  const maxPrice =
    typeof query.maxPrice === "number" && Number.isFinite(query.maxPrice) && query.maxPrice > 0
      ? query.maxPrice
      : null;
  const durationBucket = parseDurationBucket(query.durationBucket);
  const language = query.language?.trim().toLowerCase() || null;
  const difficulty = parseDifficulty(query.difficulty);
  const dateRange = parseDateRange({ dateFrom: query.dateFrom, dateTo: query.dateTo });
  const people = query.people && Number.isFinite(query.people) ? Math.max(1, query.people) : null;
  const radiusKm = Number.isFinite(query.radiusKm)
    ? Math.max(5, Math.min(100, query.radiusKm ?? 30))
    : 30;

  const [resolvedLocation, resolvedDistrict, resolvedCategory] = await Promise.all([
    resolveExcursionLocation({
      locationId: query.locationId,
      location: query.location,
    }),
    resolveDistrict({
      districtId: query.districtId,
      district: query.district,
    }),
    resolveCategory({
      categoryId: query.categoryId,
      category: query.category,
    }),
  ]);
  const locationCenterQuery =
    resolvedLocation?.name ?? (rawLocationQuery || query.locationId?.trim() || "");
  const resolvedLocationCenter =
    resolvedLocation?.latitude !== null &&
    resolvedLocation?.latitude !== undefined &&
    resolvedLocation?.longitude !== null &&
    resolvedLocation?.longitude !== undefined
      ? {
          name: resolvedLocation.name,
          latitude: Number(resolvedLocation.latitude),
          longitude: Number(resolvedLocation.longitude),
        }
      : await resolveCrimeaLocationCenter(locationCenterQuery);
  const hasLocationFilter = Boolean(rawLocationQuery || query.locationId);
  const locationTextQuery = rawLocationQuery || resolvedLocation?.name || query.locationId || "";

  const formatFilter =
    query.format?.toLowerCase() === "group"
      ? ExcursionFormat.GROUP
      : query.format?.toLowerCase() === "private"
        ? ExcursionFormat.PRIVATE
        : undefined;
  const offerTypeFilter =
    query.offerType?.toLowerCase() === "tour"
      ? ExcursionOfferType.TOUR
      : query.offerType?.toLowerCase() === "excursion"
        ? ExcursionOfferType.EXCURSION
        : undefined;
  const difficultyFilter =
    difficulty === "easy"
      ? ExcursionDifficulty.EASY
      : difficulty === "medium"
        ? ExcursionDifficulty.MEDIUM
        : difficulty === "hard"
          ? ExcursionDifficulty.HARD
          : undefined;

  // Fetch a broad candidate set first; final relevance depends on geo/date/text signals
  // that are easier to combine in application code than in SQL.
  const rows = await db.excursion.findMany({
    where: {
      ...buildPublishedExcursionVisibilityWhere(),
    },
    include: {
      mainLocation: {
        select: { id: true, name: true },
      },
      anchorLocation: {
        select: { id: true, slug: true, name: true },
      },
      district: {
        select: { id: true, slug: true, name: true },
      },
      category: {
        select: { id: true, slug: true, name: true },
      },
      routeLocations: {
        include: {
          location: {
            select: { name: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
      pickupLocations: {
        select: { locationId: true },
      },
      owner: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      sessions: dateRange
        ? {
            where: {
              status: ExcursionSessionStatus.AVAILABLE,
              startAt: {
                gte: dateRange.dateFrom,
                lte: dateRange.dateTo,
              },
            },
            select: {
              startAt: true,
              capacity: true,
            },
            orderBy: [{ startAt: "asc" }],
            take: 20,
          }
        : {
            where: {
              status: ExcursionSessionStatus.AVAILABLE,
              startAt: {
                gte: new Date(),
              },
            },
            select: {
              startAt: true,
              capacity: true,
            },
            orderBy: [{ startAt: "asc" }],
            take: 1,
          },
      _count: {
        select: {
          sessions: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 5000,
  });
  type CatalogRow = (typeof rows)[number];
  type RankedCatalogRow = {
    item: CatalogRow;
    latitude: number | null;
    longitude: number | null;
    distanceKm: number | null;
    hasAvailableSession: boolean;
    nextSessionStartAt: Date | null;
    relevance: number;
    fromPrice: number | null;
  };

  // Similar to housing catalog: broad DB fetch + in-memory relevance, because scoring mixes geo/date/text factors.
  const searchScoreMap = getSearchScoreMap(normalizedSearchQuery, rows, (item) => {
    const snapshot = getPublicExcursionSnapshot(item);
    const display = snapshot?.excursion ?? item;
    const routeLocationNames =
      snapshot?.routeLocations.map((route) => route.name) ??
      item.routeLocations.map((route) => route.location.name);

    return [
      display.title,
      display.locationName,
      display.mainLocation?.name,
      display.anchorLocation?.name,
      display.district?.name,
      display.category?.name,
      display.finishPoint,
      ...routeLocationNames,
      display.shortDescription,
      display.description,
      display.fullDescription,
      display.routeDescription,
      display.startPoint,
      ...display.tags,
    ];
  });

  // Pipeline: hard filters -> relevance scoring payload -> final sort/pagination.
  const filtered: RankedCatalogRow[] = [];

  for (const item of rows) {
    const snapshot = getPublicExcursionSnapshot(item);
    const display = snapshot?.excursion ?? item;
    const routeLocationNames =
      snapshot?.routeLocations.map((route) => route.name) ??
      item.routeLocations.map((route) => route.location.name);
    const pickupLocationIds =
      snapshot?.pickupLocations.map((pickup) => pickup.id) ??
      item.pickupLocations.map((pickup) => pickup.locationId);

    if (offerTypeFilter && display.offerType !== offerTypeFilter) {
      continue;
    }
    if (resolvedDistrict && display.district?.id !== resolvedDistrict.id) {
      continue;
    }
    if (resolvedCategory && display.category?.id !== resolvedCategory.id) {
      continue;
    }
    if (formatFilter && display.format !== formatFilter) {
      continue;
    }
    if (difficultyFilter && display.difficulty !== difficultyFilter) {
      continue;
    }
    if (query.pickup && !display.pickupAvailable) {
      continue;
    }
    if (query.kids && display.isKidFriendly !== true) {
      continue;
    }

    const primarySearchScore = getPrimaryExcursionSearchScore(searchQuery, [
      display.title,
      display.locationName,
      display.mainLocation?.name,
      display.anchorLocation?.name,
      display.district?.name,
      display.category?.name,
      display.startPoint,
      display.finishPoint,
      ...routeLocationNames,
    ]);
    if (hasTextSearch && primarySearchScore <= 0 && !searchScoreMap.has(item.id)) {
      continue;
    }

    // Pins and distance are based strictly on the excursion map point, not on location center.
    const excursionLatitude = toNumberOrNull(display.latitude);
    const excursionLongitude = toNumberOrNull(display.longitude);

    // Excursions with no sessions at all are treated as "always available"
    // (they operate on a request basis). Only filter by date/capacity when
    // the excursion has explicit sessions configured.
    const hasNoSessionsConfigured = item._count.sessions === 0;
    const hasAvailableSession = hasNoSessionsConfigured
      ? true
      : dateRange
        ? item.sessions.some(
            (session) => session.capacity === null || people === null || session.capacity >= people,
          )
        : item.sessions.length > 0;

    let anchorMatch = false;
    let pickupMatch = false;
    let distanceKm: number | null = null;
    let locationMatched = false;

    if (hasLocationFilter) {
      const locationPoint = resolvedLocationCenter
        ? {
            latitude: resolvedLocationCenter.latitude,
            longitude: resolvedLocationCenter.longitude,
          }
        : null;
      anchorMatch = resolvedLocation
        ? display.anchorLocation?.id === resolvedLocation.id ||
          display.locationId === resolvedLocation.slug
        : false;
      pickupMatch = resolvedLocation
        ? pickupLocationIds.some((locationId) => locationId === resolvedLocation.id)
        : false;

      if (locationPoint && excursionLatitude !== null && excursionLongitude !== null) {
        distanceKm = calculateDistanceKm(locationPoint, {
          latitude: excursionLatitude,
          longitude: excursionLongitude,
        });
      }

      if (locationPoint) {
        locationMatched = isWithinRadiusKm(distanceKm, radiusKm);
      } else {
        locationMatched =
          anchorMatch ||
          pickupMatch ||
          // Match by slug (legacy string field) or by ID (CUID stored in locationId)
          Boolean(
            resolvedLocation &&
            display.locationId &&
            (display.locationId === resolvedLocation.slug ||
              display.locationId === resolvedLocation.id),
          ) ||
          containsExcursionLocationQuery(locationTextQuery, [
            display.locationName,
            display.mainLocation?.name,
            display.anchorLocation?.name,
            display.district?.name,
            display.startPoint,
            display.finishPoint,
            ...routeLocationNames,
          ]);
      }
    } else {
      locationMatched = true;
    }

    if (!locationMatched) {
      continue;
    }

    if (dateRange && !hasAvailableSession) {
      continue;
    }

    if (people && display.groupSizeMax !== null && display.groupSizeMax !== undefined) {
      if (people > display.groupSizeMax) {
        continue;
      }
    }

    if (language && !display.languageCodes.some((code) => code.toLowerCase() === language)) {
      continue;
    }

    const fromPrice = toNumberOrNull(display.priceFrom);
    if (minPrice !== null && (fromPrice === null || fromPrice < minPrice)) {
      continue;
    }
    if (maxPrice !== null && (fromPrice === null || fromPrice > maxPrice)) {
      continue;
    }

    if (durationBucket) {
      const duration = display.durationMinutes ?? 0;
      if (durationBucket === "up_to_3h" && duration > 180) {
        continue;
      }
      if (durationBucket === "between_3h_6h" && (duration <= 180 || duration > 360)) {
        continue;
      }
      if (durationBucket === "more_6h" && duration <= 360) {
        continue;
      }
    }

    // ── Bayesian smoothed rating ──────────────────────────────────────────────
    // Gives new excursions a fair starting point instead of 0.
    // C = confidence weight (phantom reviews at the prior); PRIOR = assumed global avg.
    // New (0 reviews) → 4.0; 5★×100 reviews → ~4.95; 3★×50 → ~3.23.
    const BAYESIAN_C = 5;
    const BAYESIAN_PRIOR = 4.0;
    const bayesianRating =
      (Number(item.avgRating) * item.reviewsCount + BAYESIAN_C * BAYESIAN_PRIOR) /
      (item.reviewsCount + BAYESIAN_C);
    // 0–68 pts: quality baseline that is fair to new creators
    const ratingScore = bayesianRating * 10 + Math.log1p(item.reviewsCount) * 4;

    // ── Distance — soft, not dominant ────────────────────────────────────────
    // Linear decay over 2× the haversine radius so excursions just outside
    // the radius aren't penalised too harshly.
    const distanceScore =
      distanceKm === null ? 0 : Math.max(0, (1 - distanceKm / Math.max(radiusKm * 2, 30)) * 20);

    // ── Location affinity ─────────────────────────────────────────────────────
    const anchorScore = anchorMatch ? 50 : 0;
    const pickupScore = pickupMatch ? 15 : 0;

    // ── Availability ──────────────────────────────────────────────────────────
    const dateScore = hasAvailableSession ? 20 : 0;

    // ── Text search relevance ─────────────────────────────────────────────────
    const searchScore = Math.max(searchScoreMap.get(item.id) ?? 0, primarySearchScore) * 45;

    // ── Profile completeness — rewards creator effort, accessible to newcomers ─
    // Having a well-filled profile is achievable from day one, unlike reviews.
    const photoCount = collectRawPublicExcursionGalleryPhotoUrls(display).length;
    const hasTimeline =
      Array.isArray(display.timeline) && (display.timeline as unknown[]).length > 0;
    const hasFaqItems =
      Array.isArray(display.faqItems) && (display.faqItems as unknown[]).length > 0;
    const hasPricingTiers =
      Array.isArray(display.pricingTiers) && (display.pricingTiers as unknown[]).length > 0;
    const completenessScore =
      Math.min(photoCount, 5) * 2 + // up to 10 pts (5+ photos)
      (display.shortDescription || display.description ? 3 : 0) + // has description
      (display.mainLocation ? 2 : 0) + // linked to location
      (display.anchorLocation ? 1.5 : 0) + // linked to anchor city
      (display.startPoint ? 1 : 0) + // meeting point filled
      (hasTimeline ? 3 : 0) + // has itinerary/timeline
      (hasFaqItems ? 2 : 0) + // has FAQ
      (hasPricingTiers ? 1.5 : 0) + // has pricing tiers
      (display.priceFrom !== null ? 1 : 0); // has price

    // ── Freshness — temporary discovery boost for new listings ────────────────
    // Fades linearly over 30 days → levels the field for new creators.
    const daysSinceCreated = (Date.now() - item.createdAt.getTime()) / 86_400_000;
    const freshnessScore =
      daysSinceCreated < 30 ? Math.max(0, (30 - daysSinceCreated) / 30) * 10 : 0;

    // ── Daily rotation ────────────────────────────────────────────────────────
    // Reshuffles similarly-scored excursions every ~4 hours so every listing
    // gets exposure windows, not just the perpetual top slots.
    const rotation = (stableHash(`${getDailyRotationKey()}:${item.id}`) % 1000) / 1000;
    const rotationScore = rotation * 15;

    const relevance =
      ratingScore + // 40–68  quality baseline (Bayesian-fair to newcomers)
      distanceScore + //  0–20  location proximity (soft)
      anchorScore + //  0–50  anchor city / exact location match
      pickupScore + //  0–15  pickup from searched city
      dateScore + //  0–20  has upcoming available sessions
      searchScore + //  0–45  text relevance (when search query present)
      completenessScore + //  0–25  profile quality (achievable from day one)
      freshnessScore + //  0–10  new listing discovery boost (first 30 days)
      rotationScore; //  0–15  daily shuffle for equal-scored listings

    filtered.push({
      item,
      latitude: excursionLatitude,
      longitude: excursionLongitude,
      distanceKm,
      hasAvailableSession,
      nextSessionStartAt: item.sessions[0]?.startAt ?? null,
      relevance,
      fromPrice,
    });
  }

  // Selected sort controls the primary order, but we always keep deterministic
  // fallback ordering via `updatedAt` at the end.
  filtered.sort((left, right) => {
    if (sort === "price_asc") {
      if (left.fromPrice === null && right.fromPrice === null) return 0;
      if (left.fromPrice === null) return 1;
      if (right.fromPrice === null) return -1;
      const byPrice = left.fromPrice - right.fromPrice;
      if (Math.abs(byPrice) > 0.00001) return byPrice;
    } else if (sort === "price_desc") {
      if (left.fromPrice === null && right.fromPrice === null) return 0;
      if (left.fromPrice === null) return 1;
      if (right.fromPrice === null) return -1;
      const byPrice = right.fromPrice - left.fromPrice;
      if (Math.abs(byPrice) > 0.00001) return byPrice;
    } else if (sort === "rating_desc") {
      const byRating = Number(right.item.avgRating) - Number(left.item.avgRating);
      if (Math.abs(byRating) > 0.00001) return byRating;
    } else if (sort === "popular_desc") {
      const byPopularity = right.item.reviewsCount - left.item.reviewsCount;
      if (byPopularity !== 0) return byPopularity;
    } else if (sort === "distance_asc") {
      if (left.distanceKm === null && right.distanceKm === null) return 0;
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      const byDistance = left.distanceKm - right.distanceKm;
      if (Math.abs(byDistance) > 0.00001) return byDistance;
    } else if (sort === "duration_asc") {
      const leftDisplay = getPublicExcursionSnapshot(left.item)?.excursion ?? left.item;
      const rightDisplay = getPublicExcursionSnapshot(right.item)?.excursion ?? right.item;
      const leftDuration = leftDisplay.durationMinutes ?? Number.MAX_SAFE_INTEGER;
      const rightDuration = rightDisplay.durationMinutes ?? Number.MAX_SAFE_INTEGER;
      const byDuration = leftDuration - rightDuration;
      if (byDuration !== 0) return byDuration;
    } else {
      // Default "relevance" sort is based on computed composite score.
      const byRelevance = right.relevance - left.relevance;
      if (Math.abs(byRelevance) > 0.00001) {
        return byRelevance;
      }
    }
    return right.item.updatedAt.getTime() - left.item.updatedAt.getTime();
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    items: pagedRows.map(
      ({ item, latitude, longitude, distanceKm, hasAvailableSession, nextSessionStartAt }) => {
        const snapshot = getPublicExcursionSnapshot(item);
        const display = snapshot?.excursion ?? item;
        const routeLocationNames =
          snapshot?.routeLocations.map((route) => route.name) ??
          item.routeLocations.map((route) => route.location.name);

        return {
        id: item.id,
        slug: buildExcursionSlug(display.title, item.id),
        path: buildPublicExcursionPath({
          id: item.id,
          title: display.title,
          locationId: display.locationId,
          anchorLocation: display.anchorLocation,
        }),
        title: display.title ?? "Экскурсия без названия",
        offerType: display.offerType,
        subtypeLabel: display.subtypeLabel,
        locationId: display.locationId,
        locationName: display.locationName,
        latitude,
        longitude,
        mainLocationName: display.mainLocation?.name ?? null,
        anchorCityName: display.anchorLocation?.name ?? display.locationName,
        districtName: display.district?.name ?? null,
        categoryName: display.category?.name ?? null,
        startPoint: display.startPoint,
        finishPoint: display.finishPoint,
        routeSummary: buildProgramRouteSummary({
          routePoints: routeLocationNames,
          startPoint: display.startPoint,
          finishPoint: display.finishPoint,
          mainLocationName: display.mainLocation?.name ?? null,
          anchorLocationName: display.anchorLocation?.name ?? display.locationName,
          locationName: display.locationName,
        }),
        durationMinutes: display.durationMinutes,
        durationDays: display.durationDays,
        durationNights: display.durationNights,
        priceFrom: toNumberOrNull(display.priceFrom),
        priceTo: toNumberOrNull(display.priceTo),
        currency: display.currency,
        priceUnitLabel: display.priceUnitLabel,
        coverImageUrl: getPublicExcursionCoverImageUrl(display),
        avgRating: Number(item.avgRating),
        reviewsCount: item.reviewsCount,
        distanceKm: roundDistanceKm(distanceKm),
        hasAvailableSession,
        pickupAvailable: display.pickupAvailable,
        availabilityMode: getResolvedAvailabilityMode(
          display.availabilityMode,
          display.scheduleMode,
        ),
        availabilitySummary: formatAvailabilitySummary({
          availabilityMode: display.availabilityMode,
          scheduleMode: display.scheduleMode,
          scheduleText: display.scheduleText,
          availabilityNote: display.availabilityNote,
          nextSessionStartAt,
        }),
        hasAccommodation:
          display.accommodationProvided === true ||
          Boolean(display.accommodationNights && display.accommodationNights > 0),
        owner: {
          firstName: item.owner.firstName,
          lastName: item.owner.lastName,
          avatarUrl: item.owner.avatarUrl,
        },
      };
      },
    ),
    page: safePage,
    pageSize,
    total,
    totalPages,
    filters: {
      // Echo normalized filters back to UI so client state can be restored from server truth.
      locationId: resolvedLocation?.id ?? null,
      // Keep user's raw location text in filters when georesolution fails,
      // so sidebar fields stay in sync with the search form input.
      locationName:
        resolvedLocation?.name ?? resolvedLocationCenter?.name ?? (rawLocationQuery || null),
      centerLat: resolvedLocationCenter?.latitude ?? null,
      centerLng: resolvedLocationCenter?.longitude ?? null,
      districtId: resolvedDistrict?.id ?? null,
      districtSlug: resolvedDistrict?.slug ?? null,
      districtName: resolvedDistrict?.name ?? null,
      categoryId: resolvedCategory?.id ?? null,
      categorySlug: resolvedCategory?.slug ?? null,
      categoryName: resolvedCategory?.name ?? null,
      offerType: query.offerType ?? null,
      query: searchQuery || null,
      dateFrom: dateRange ? dateRange.dateFrom.toISOString().slice(0, 10) : null,
      dateTo: dateRange ? dateRange.dateTo.toISOString().slice(0, 10) : null,
      people,
      radiusKm,
      minPrice,
      maxPrice,
      durationBucket,
      language,
      difficulty,
      format: formatFilter ?? null,
      pickup: query.pickup ?? false,
      kids: query.kids ?? false,
      sort,
    },
  };
}

async function getExcursionCardByIdentifier(input: {
  identifier: string;
  expectedLocationId?: string | null;
  viewerUserId?: string | null;
  ownerId?: string | null;
}): Promise<PublicExcursionCard | null> {
  const extractedId = extractPropertyId(input.identifier);
  const id = isPublicEntityId(extractedId)
    ? extractedId
    : await findExcursionIdByPublicSlug({
        identifier: input.identifier,
        expectedLocationId: input.expectedLocationId,
        ownerId: input.ownerId,
      });
  if (!id) {
    return null;
  }

  const excursion = await db.excursion.findFirst({
    where: input.ownerId
      ? {
          id,
          ownerId: input.ownerId,
          deletedAt: null,
        }
      : {
          id,
          ...buildPublishedExcursionVisibilityWhere(),
        },
    include: {
      mainLocation: {
        select: { id: true, slug: true, name: true },
      },
      anchorLocation: {
        select: { id: true, slug: true, name: true },
      },
      district: {
        select: { id: true, slug: true, name: true },
      },
      category: {
        select: { id: true, slug: true, name: true },
      },
      pickupLocations: {
        include: {
          location: {
            select: { id: true, slug: true, name: true },
          },
        },
      },
      routeLocations: {
        include: {
          location: {
            select: { id: true, slug: true, name: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
      sessions: {
        where: {
          startAt: {
            gte: new Date(),
          },
          status: {
            in: [ExcursionSessionStatus.AVAILABLE, ExcursionSessionStatus.SOLD_OUT],
          },
        },
        orderBy: [{ startAt: "asc" }],
        take: 8,
      },
      scheduleRules: {
        orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
      },
      scheduleExceptions: {
        where: {
          date: {
            gte: new Date(),
          },
        },
        orderBy: [{ date: "asc" }],
        take: 8,
      },
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          avatarUrl: true,
        },
      },
      reviews: {
        where: {
          entityType: ReviewEntityType.EXCURSION,
          status: ReviewStatus.ACTIVE,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 9,
        include: {
          user: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
          ...(input.viewerUserId
            ? {
                reactions: {
                  where: { userId: input.viewerUserId },
                  select: { value: true },
                  take: 1,
                },
              }
            : {}),
        },
      },
    },
  });

  if (!excursion) {
    return null;
  }

  const snapshot = getPublicExcursionSnapshot(excursion);
  const display = snapshot?.excursion ?? excursion;
  const displayPickupLocations =
    snapshot?.pickupLocations ??
    excursion.pickupLocations.map((item) => ({
      id: item.location.id,
      name: item.location.name,
      slug: item.location.slug,
    }));
  const displayRouteLocations =
    snapshot?.routeLocations ??
    excursion.routeLocations.map((item) => ({
      id: item.location.id,
      name: item.location.name,
      slug: item.location.slug,
      sortOrder: item.sortOrder,
    }));
  const displaySessions = snapshot?.sessions ?? excursion.sessions;
  const displayScheduleRules = snapshot?.scheduleRules ?? excursion.scheduleRules;
  const displayScheduleExceptions = snapshot?.scheduleExceptions ?? excursion.scheduleExceptions;
  const nextAvailableSessionStartAt =
    displaySessions.find((session) => session.status === ExcursionSessionStatus.AVAILABLE)
      ?.startAt ?? null;

  return {
    id: excursion.id,
    slug: buildExcursionSlug(display.title, excursion.id),
    path: buildPublicExcursionPath({
      id: excursion.id,
      locationId: display.locationId,
      title: display.title,
      anchorLocation: display.anchorLocation,
    }),
    title: display.title,
    locationId: display.locationId,
    locationName: display.locationName,
    offerType: display.offerType,
    subtypeLabel: display.subtypeLabel,
    mainLocationName: display.mainLocation?.name ?? null,
    anchorCityName: display.anchorLocation?.name ?? display.locationName,
    districtName: display.district?.name ?? null,
    categoryName: display.category?.name ?? null,
    address: display.address,
    latitude: toNumberOrNull(display.latitude),
    longitude: toNumberOrNull(display.longitude),
    startPoint: display.startPoint,
    finishPoint: display.finishPoint,
    meetingPointText: display.meetingPointText,
    description: cleanPublicText(display.description, {
      minLength: 10,
      maxLength: 5000,
      preserveLineBreaks: true,
    }),
    shortDescription: cleanPublicText(display.shortDescription, {
      minLength: 10,
      maxLength: 400,
    }),
    fullDescription: cleanPublicText(display.fullDescription, {
      minLength: 10,
      maxLength: 7000,
      preserveLineBreaks: true,
    }),
    routeDescription: cleanPublicText(display.routeDescription, {
      minLength: 10,
      maxLength: 3000,
      preserveLineBreaks: true,
    }),
    highlights: cleanPublicTextList(toStringArray(display.highlights), {
      minLength: 3,
      maxLength: 120,
      maxItems: 8,
    }),
    durationMinutes: display.durationMinutes,
    durationDays: display.durationDays,
    durationNights: display.durationNights,
    itineraryDays: sanitizePublicItineraryDays(display.itineraryDays),
    scheduleText: cleanPublicText(display.scheduleText, { minLength: 4, maxLength: 500 }),
    scheduleMode: display.scheduleMode,
    availabilityMode: getResolvedAvailabilityMode(
      display.availabilityMode,
      display.scheduleMode,
    ),
    availabilityNote: cleanPublicText(display.availabilityNote, {
      minLength: 4,
      maxLength: 500,
    }),
    format: display.format,
    groupSizeMin: display.groupSizeMin,
    groupSizeMax: display.groupSizeMax,
    languageCodes: toStringArray(display.languageCodes),
    ageLimit: display.ageLimit,
    isKidFriendly: display.isKidFriendly,
    difficulty: display.difficulty,
    pickupAvailable: display.pickupAvailable,
    tags: cleanPublicTextList(toStringArray(display.tags), {
      minLength: 2,
      maxLength: 60,
      maxItems: 12,
    }),
    priceFrom: toNumberOrNull(display.priceFrom),
    priceTo: toNumberOrNull(display.priceTo),
    currency: display.currency,
    includedText: cleanPublicText(display.includedText, {
      minLength: 3,
      maxLength: 1200,
      preserveLineBreaks: true,
    }),
    notIncludedText: cleanPublicText(display.notIncludedText, {
      minLength: 3,
      maxLength: 1200,
      preserveLineBreaks: true,
    }),
    includedItems: cleanPublicTextList(toStringArray(display.includedItems), {
      minLength: 2,
      maxLength: 120,
    }),
    excludedItems: cleanPublicTextList(toStringArray(display.excludedItems), {
      minLength: 2,
      maxLength: 120,
    }),
    cancellationPolicy: cleanPublicText(display.cancellationPolicy, {
      minLength: 8,
      maxLength: 700,
    }),
    cancellationPolicyType: display.cancellationPolicyType,
    physicalRequirements: cleanPublicTextList(toStringArray(display.physicalRequirements), {
      minLength: 3,
      maxLength: 140,
    }),
    whatToBring: cleanPublicTextList(toStringArray(display.whatToBring), {
      minLength: 2,
      maxLength: 100,
    }),
    meetingPointLat: toNumberOrNull(display.meetingPointLat),
    meetingPointLng: toNumberOrNull(display.meetingPointLng),
    minBookingNoticeHours: display.minBookingNoticeHours,
    hasGuideLicense: display.hasGuideLicense,
    transferDetails: cleanPublicText(display.transferDetails, {
      minLength: 8,
      maxLength: 1000,
      preserveLineBreaks: true,
    }),
    timeline: sanitizePublicTimelineSteps(display.timeline),
    extraOptions: Array.isArray(display.extraOptions)
      ? (display.extraOptions as ExcursionExtraOption[]).flatMap(
          (option): ExcursionExtraOption[] => {
            const title = cleanPublicText(option.title, { minLength: 2, maxLength: 120 });
            const description = cleanPublicText(option.description, {
              minLength: 5,
              maxLength: 500,
            });
            return title
              ? [
                  {
                    ...option,
                    title,
                    ...(description ? { description } : {}),
                  },
                ]
              : [];
          },
        )
      : [],
    pricingTiers: Array.isArray(display.pricingTiers)
      ? (display.pricingTiers as PricingTier[])
      : [],
    faqItems: cleanFaqItems(
      Array.isArray(display.faqItems) ? (display.faqItems as FaqItem[]) : [],
    ),
    photoUrls: getPublicExcursionGalleryPhotoUrls(display),
    sectionPhotoGroups: filterPublicSectionPhotoGroups(
      display.sectionPhotoGroups as Partial<Record<string, string[] | null | undefined>>,
    ),
    videoUrls: filterExistingPublicAssetUrls(toStringArray(display.videoUrls)),
    priceUnitLabel: display.priceUnitLabel,
    receiveRequests: display.receiveRequests,
    instantConfirmation: display.instantConfirmation,
    accommodationProvided: display.accommodationProvided,
    accommodationType: display.accommodationType,
    accommodationNights: display.accommodationNights,
    accommodationFormat:
      cleanPublicText(display.accommodationFormat, { minLength: 2, maxLength: 120 }) ?? null,
    accommodationStars: display.accommodationStars ?? null,
    roomTypes: toStringArray(display.roomTypes),
    singleSupplementAvailable: display.singleSupplementAvailable ?? null,
    singleSupplementPrice:
      display.singleSupplementPrice === null ? null : Number(display.singleSupplementPrice),
    mealPlan: display.mealPlan,
    mealDetails:
      cleanPublicText(display.mealDetails, {
        minLength: 4,
        maxLength: 700,
        preserveLineBreaks: true,
      }) ?? null,
    accommodationComment: cleanPublicText(display.accommodationComment, {
      minLength: 6,
      maxLength: 1000,
      preserveLineBreaks: true,
    }),
    tourKind: display.tourKind ?? null,
    transportModes: toStringArray(display.transportModes),
    departureMode: display.departureMode ?? null,
    arrivalInfo: cleanPublicText(display.arrivalInfo, { minLength: 4, maxLength: 700 }) ?? null,
    departureInfo:
      cleanPublicText(display.departureInfo, { minLength: 4, maxLength: 700 }) ?? null,
    documentsRequired: cleanPublicTextList(toStringArray(display.documentsRequired), {
      minLength: 2,
      maxLength: 100,
    }),
    insuranceIncluded: display.insuranceIncluded ?? null,
    insuranceComment:
      cleanPublicText(display.insuranceComment, { minLength: 4, maxLength: 500 }) ?? null,
    equipmentProvided: cleanPublicTextList(toStringArray(display.equipmentProvided), {
      minLength: 2,
      maxLength: 100,
    }),
    safetyInfo:
      cleanPublicText(display.safetyInfo, {
        minLength: 8,
        maxLength: 1200,
        preserveLineBreaks: true,
      }) ?? null,
    routeConditions:
      cleanPublicText(display.routeConditions, {
        minLength: 8,
        maxLength: 1200,
        preserveLineBreaks: true,
      }) ?? null,
    availabilitySummary: formatAvailabilitySummary({
      availabilityMode: display.availabilityMode,
      scheduleMode: display.scheduleMode,
      scheduleText: display.scheduleText,
      availabilityNote: display.availabilityNote,
      nextSessionStartAt: nextAvailableSessionStartAt,
    }),
    avgRating: Number(excursion.avgRating),
    reviewsCount: excursion.reviewsCount,
    contacts: {
      firstName: display.contactFirstName ?? excursion.owner.firstName,
      lastName: display.contactLastName ?? excursion.owner.lastName,
      phone: display.contactPhone ?? excursion.owner.phone,
      phone2: display.contactPhone2,
      email: display.contactEmail ?? excursion.owner.email,
      websiteUrl: display.websiteUrl,
      whatsappUrl: display.whatsappUrl,
      telegramUrl: display.telegramUrl,
      vkUrl: display.vkUrl,
      maxUrl: display.maxUrl,
      okUrl: display.okUrl,
    },
    owner: {
      id: excursion.owner.id,
      firstName: excursion.owner.firstName,
      lastName: excursion.owner.lastName,
      avatarUrl: excursion.owner.avatarUrl,
    },
    sessions: displaySessions.map((session) => ({
      id: session.id,
      startAt: toIsoString(session.startAt),
      endAt: session.endAt ? toIsoString(session.endAt) : null,
      capacity: session.capacity,
      priceOverride: toNumberOrNull(session.priceOverride),
      status: session.status,
      bookingDeadlineMinutes: session.bookingDeadlineMinutes,
    })),
    scheduleRules: displayScheduleRules.map((rule) => ({
      id: rule.id,
      dateFrom: toIsoDateString(rule.dateFrom),
      dateTo: toIsoDateString(rule.dateTo),
      weekdays: rule.weekdays,
      timeStarts: rule.timeStarts,
      durationMinutes: rule.durationMinutes,
      capacityDefault: rule.capacityDefault,
      priceOverride: toNumberOrNull(rule.priceOverride),
    })),
    scheduleExceptions: displayScheduleExceptions.map((exception) => ({
      id: exception.id,
      date: toIsoDateString(exception.date) ?? "",
      isClosed: exception.isClosed,
      overrideTimeStarts: exception.overrideTimeStarts,
      overrideCapacity: exception.overrideCapacity,
      overridePrice: toNumberOrNull(exception.overridePrice),
      notes: exception.notes ?? null,
    })),
    pickupLocations: displayPickupLocations,
    routeLocations: displayRouteLocations,
    reviews: excursion.reviews.map(serializeReview),
  };
}

export async function getPublicExcursionByIdentifier(
  identifier: string,
  expectedLocationId?: string | null,
  viewerUserId?: string | null,
): Promise<PublicExcursionCard | null> {
  return getExcursionCardByIdentifier({
    identifier,
    expectedLocationId,
    viewerUserId,
  });
}

export async function getOwnerPreviewExcursionByIdentifier(
  identifier: string,
  ownerId: string,
  expectedLocationId?: string | null,
  viewerUserId?: string | null,
): Promise<PublicExcursionCard | null> {
  return getExcursionCardByIdentifier({
    identifier,
    expectedLocationId,
    ownerId,
    viewerUserId,
  });
}

export async function getExcursionSeoDirectoryData(): Promise<{
  districts: Array<{ slug: string; name: string }>;
  categories: Array<{ slug: string; name: string }>;
  cities: Array<{ slug: string; name: string }>;
}> {
  try {
    const [districts, categories, cities] = await Promise.all([
      db.excursionDistrict.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { slug: true, name: true },
      }),
      db.excursionCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { slug: true, name: true },
      }),
      db.excursionLocation.findMany({
        where: { isMajor: true },
        orderBy: [{ name: "asc" }],
        select: { slug: true, name: true },
      }),
    ]);

    return { districts, categories, cities };
  } catch {
    return {
      districts: [],
      categories: [],
      cities: [],
    };
  }
}

export async function getResolvedExcursionLocationBySlug(
  slug: string,
): Promise<ExcursionLocationDirectoryItem | null> {
  try {
    return await resolveExcursionLocation({ locationId: slug, location: slug });
  } catch {
    return null;
  }
}
