// Domain/service module for public excursions.
import {
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionSessionStatus,
  ExcursionStatus,
  ReviewEntityType,
  ReviewStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  haversineDistanceKm,
  resolveExcursionLocation,
  type ExcursionLocationDirectoryItem,
} from "@/lib/excursion-directory";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import { serializeReview } from "@/lib/reviews";
import { extractPropertyId, slugify } from "@/lib/public-properties";

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
  location?: string;
  locationId?: string;
  district?: string;
  districtId?: string;
  category?: string;
  categoryId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
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
  locationId: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  mainLocationName: string | null;
  anchorCityName: string | null;
  districtName: string | null;
  categoryName: string | null;
  startPoint: string | null;
  durationMinutes: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  coverImageUrl: string | null;
  avgRating: number;
  reviewsCount: number;
  distanceKm: number | null;
  hasAvailableSession: boolean;
  pickupAvailable: boolean;
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
  meetingPointText: string | null;
  description: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  routeDescription: string | null;
  durationMinutes: number | null;
  scheduleText: string | null;
  format: ExcursionFormat | null;
  languageCodes: string[];
  isKidFriendly: boolean | null;
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
  transferDetails: string | null;
  timeline: import("@/types/excursions").TimelineStep[];
  pricingTiers: import("@/types/excursions").PricingTier[];
  faqItems: import("@/types/excursions").FaqItem[];
  photoUrls: string[];
  videoUrls: string[];
  avgRating: number;
  reviewsCount: number;
  contacts: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
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
  };
  pickupLocations: Array<{ id: string; name: string; slug: string }>;
  routeLocations: Array<{ id: string; name: string; slug: string; sortOrder: number }>;
  reviews: ReturnType<typeof serializeReview>[];
};

function toNumberOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

export function buildExcursionSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "ekskursiya") || "ekskursiya";
  return `${base}-${id}`;
}

export function buildPublicExcursionPath(excursion: {
  id: string;
  locationId: string | null;
  title: string | null;
  anchorLocationSlug?: string | null;
  anchorLocation?: { slug: string } | null;
}): string {
  const location =
    excursion.anchorLocationSlug ?? excursion.anchorLocation?.slug ?? excursion.locationId ?? "crimea";
  return `/crimea/excursions/${location}/${buildExcursionSlug(excursion.title, excursion.id)}`;
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

function parseDateRange(input: {
  dateFrom?: string;
  dateTo?: string;
}): DateRangeFilter | null {
  // Accept partial input (only from/to) and normalize to inclusive UTC bounds.
  const dateFromRaw = input.dateFrom?.trim();
  const dateToRaw = input.dateTo?.trim();
  if (!dateFromRaw && !dateToRaw) {
    return null;
  }

  const today = new Date();
  const fallbackFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = dateFromRaw ? new Date(`${dateFromRaw}T00:00:00.000Z`) : fallbackFrom;
  const to = dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`) : new Date(from.getTime() + 86_399_999);

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

function parseDifficulty(
  value: string | undefined,
): "easy" | "medium" | "hard" | null {
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
  const pageSize = Math.min(30, Math.max(1, query.pageSize ?? 30));
  const rawLocationQuery = query.location?.trim() ?? "";
  const searchQuery = query.query?.trim() ?? "";
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
  const radiusKm = Number.isFinite(query.radiusKm) ? Math.max(5, Math.min(100, query.radiusKm ?? 30)) : 30;
  // Road distance ≈ haversine × 1.3 for Crimea terrain.
  // To find excursions within radiusKm by road, we filter by haversine ≤ radiusKm / 1.3.
  const haversineRadiusKm = radiusKm / 1.3;

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

  const formatFilter =
    query.format?.toLowerCase() === "group"
      ? ExcursionFormat.GROUP
      : query.format?.toLowerCase() === "private"
        ? ExcursionFormat.PRIVATE
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
      status: ExcursionStatus.PUBLISHED,
      ...(resolvedDistrict ? { districtId: resolvedDistrict.id } : {}),
      ...(resolvedCategory ? { categoryId: resolvedCategory.id } : {}),
      ...(formatFilter ? { format: formatFilter } : {}),
      ...(difficultyFilter ? { difficulty: difficultyFilter } : {}),
      ...(query.pickup ? { pickupAvailable: true } : {}),
      ...(query.kids ? { isKidFriendly: true } : {}),
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
      pickupLocations: {
        select: { locationId: true },
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

  // Similar to housing catalog: broad DB fetch + in-memory relevance, because scoring mixes geo/date/text factors.
  const searchScoreMap = getSearchScoreMap(searchQuery, rows, (item) => [
    item.title,
    item.locationName,
    item.mainLocation?.name,
    item.anchorLocation?.name,
    item.district?.name,
    item.category?.name,
    item.shortDescription,
    item.description,
    item.fullDescription,
    item.routeDescription,
    item.startPoint,
    ...item.tags,
  ]);

  // Pipeline: hard filters -> relevance scoring payload -> final sort/pagination.
  const filtered = rows
    .map((item) => {
      if (searchQuery.length >= 2 && !searchScoreMap.has(item.id)) {
        return null;
      }

      // Pins and distance are based strictly on the excursion map point, not on location center.
      const excursionLatitude = item.latitude === null ? null : Number(item.latitude);
      const excursionLongitude = item.longitude === null ? null : Number(item.longitude);

      // Excursions with no sessions at all are treated as "always available"
      // (they operate on a request basis). Only filter by date/capacity when
      // the excursion has explicit sessions configured.
      const hasNoSessionsConfigured = item._count.sessions === 0;
      const hasAvailableSession = hasNoSessionsConfigured
        ? true
        : dateRange
          ? item.sessions.some(
              (session) =>
                session.capacity === null || people === null || session.capacity >= people,
            )
          : item.sessions.length > 0;

      let anchorMatch = false;
      let pickupMatch = false;
      let distanceKm: number | null = null;
      let locationMatched = false;

      if (resolvedLocation) {
        // Location relevance is intentionally broad: anchor city, pickup city,
        // map radius, and legacy locationId all count as a location match.
        const locationPoint = {
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        };
        anchorMatch =
          item.anchorLocationId === resolvedLocation.id || item.locationId === resolvedLocation.slug;
        pickupMatch = item.pickupLocations.some((pickup) => pickup.locationId === resolvedLocation.id);

        if (
          locationPoint.latitude !== null &&
          locationPoint.longitude !== null &&
          excursionLatitude !== null &&
          excursionLongitude !== null
        ) {
          distanceKm = haversineDistanceKm(
            { latitude: locationPoint.latitude, longitude: locationPoint.longitude },
            { latitude: excursionLatitude, longitude: excursionLongitude },
          );
        }

        locationMatched =
          anchorMatch ||
          pickupMatch ||
          (distanceKm !== null && distanceKm <= haversineRadiusKm) ||
          // Match by slug (legacy string field) or by ID (CUID stored in locationId)
          Boolean(
            item.locationId &&
              (item.locationId === resolvedLocation.slug ||
                item.locationId === resolvedLocation.id),
          );
      } else {
        locationMatched = true;
      }

      if (!locationMatched) {
        return null;
      }

      if (dateRange && !hasAvailableSession) {
        return null;
      }

      if (people && item.groupSizeMax !== null && item.groupSizeMax !== undefined) {
        if (people > item.groupSizeMax) {
          return null;
        }
      }

      if (language && !item.languageCodes.some((code) => code.toLowerCase() === language)) {
        return null;
      }

      const fromPrice = toNumberOrNull(item.priceFrom);
      if (minPrice !== null && (fromPrice === null || fromPrice < minPrice)) {
        return null;
      }
      if (maxPrice !== null && (fromPrice === null || fromPrice > maxPrice)) {
        return null;
      }

      if (durationBucket) {
        const duration = item.durationMinutes ?? 0;
        if (durationBucket === "up_to_3h" && duration > 180) {
          return null;
        }
        if (durationBucket === "between_3h_6h" && (duration <= 180 || duration > 360)) {
          return null;
        }
        if (durationBucket === "more_6h" && duration <= 360) {
          return null;
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
        distanceKm === null
          ? 0
          : Math.max(0, (1 - distanceKm / Math.max(haversineRadiusKm * 2, 30)) * 20);

      // ── Location affinity ─────────────────────────────────────────────────────
      const anchorScore = anchorMatch ? 50 : 0;
      const pickupScore = pickupMatch ? 15 : 0;

      // ── Availability ──────────────────────────────────────────────────────────
      const dateScore = hasAvailableSession ? 20 : 0;

      // ── Text search relevance ─────────────────────────────────────────────────
      const searchScore = (searchScoreMap.get(item.id) ?? 0) * 45;

      // ── Profile completeness — rewards creator effort, accessible to newcomers ─
      // Having a well-filled profile is achievable from day one, unlike reviews.
      const photoCount = item.photoUrls.length;
      const hasTimeline = Array.isArray(item.timeline) && (item.timeline as unknown[]).length > 0;
      const hasFaqItems = Array.isArray(item.faqItems) && (item.faqItems as unknown[]).length > 0;
      const hasPricingTiers =
        Array.isArray(item.pricingTiers) && (item.pricingTiers as unknown[]).length > 0;
      const completenessScore =
        Math.min(photoCount, 5) * 2 +                              // up to 10 pts (5+ photos)
        (item.shortDescription || item.description ? 3 : 0) +     // has description
        (item.mainLocationId ? 2 : 0) +                           // linked to location
        (item.anchorLocationId ? 1.5 : 0) +                       // linked to anchor city
        (item.startPoint ? 1 : 0) +                               // meeting point filled
        (hasTimeline ? 3 : 0) +                                    // has itinerary/timeline
        (hasFaqItems ? 2 : 0) +                                    // has FAQ
        (hasPricingTiers ? 1.5 : 0) +                             // has pricing tiers
        (item.priceFrom !== null ? 1 : 0);                        // has price

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
        ratingScore +       // 40–68  quality baseline (Bayesian-fair to newcomers)
        distanceScore +     //  0–20  location proximity (soft)
        anchorScore +       //  0–50  anchor city / exact location match
        pickupScore +       //  0–15  pickup from searched city
        dateScore +         //  0–20  has upcoming available sessions
        searchScore +       //  0–45  text relevance (when search query present)
        completenessScore + //  0–25  profile quality (achievable from day one)
        freshnessScore +    //  0–10  new listing discovery boost (first 30 days)
        rotationScore;      //  0–15  daily shuffle for equal-scored listings

      return {
        item,
        latitude: excursionLatitude,
        longitude: excursionLongitude,
        distanceKm,
        hasAvailableSession,
        relevance,
        fromPrice,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        item: (typeof rows)[number];
        latitude: number | null;
        longitude: number | null;
        distanceKm: number | null;
        hasAvailableSession: boolean;
        relevance: number;
        fromPrice: number | null;
      } => Boolean(entry),
    )
    // Selected sort controls the primary order, but we always keep deterministic
    // fallback ordering via `updatedAt` at the end.
    .sort((left, right) => {
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
        const leftDuration = left.item.durationMinutes ?? Number.MAX_SAFE_INTEGER;
        const rightDuration = right.item.durationMinutes ?? Number.MAX_SAFE_INTEGER;
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
    items: pagedRows.map(({ item, latitude, longitude, distanceKm, hasAvailableSession }) => ({
      id: item.id,
      slug: buildExcursionSlug(item.title, item.id),
      path: buildPublicExcursionPath({
        id: item.id,
        title: item.title,
        locationId: item.locationId,
        anchorLocation: item.anchorLocation,
      }),
      title: item.title ?? "Экскурсия без названия",
      locationId: item.locationId,
      locationName: item.locationName,
      latitude,
      longitude,
      mainLocationName: item.mainLocation?.name ?? null,
      anchorCityName: item.anchorLocation?.name ?? item.locationName,
      districtName: item.district?.name ?? null,
      categoryName: item.category?.name ?? null,
      startPoint: item.startPoint,
      durationMinutes: item.durationMinutes,
      priceFrom: toNumberOrNull(item.priceFrom),
      priceTo: toNumberOrNull(item.priceTo),
      currency: item.currency,
      coverImageUrl: item.photoUrls[0] ?? null,
      avgRating: Number(item.avgRating),
      reviewsCount: item.reviewsCount,
      distanceKm: distanceKm === null ? null : Number((distanceKm * 1.3).toFixed(1)),
      hasAvailableSession,
      pickupAvailable: item.pickupAvailable,
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
    filters: {
      // Echo normalized filters back to UI so client state can be restored from server truth.
      locationId: resolvedLocation?.id ?? null,
      // Keep user's raw location text in filters when georesolution fails,
      // so sidebar fields stay in sync with the search form input.
      locationName: resolvedLocation?.name ?? (rawLocationQuery || null),
      centerLat:
        resolvedLocation?.latitude !== null && resolvedLocation?.latitude !== undefined
          ? Number(resolvedLocation.latitude)
          : null,
      centerLng:
        resolvedLocation?.longitude !== null && resolvedLocation?.longitude !== undefined
          ? Number(resolvedLocation.longitude)
          : null,
      districtId: resolvedDistrict?.id ?? null,
      districtSlug: resolvedDistrict?.slug ?? null,
      districtName: resolvedDistrict?.name ?? null,
      categoryId: resolvedCategory?.id ?? null,
      categorySlug: resolvedCategory?.slug ?? null,
      categoryName: resolvedCategory?.name ?? null,
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

export async function getPublicExcursionByIdentifier(
  identifier: string,
  expectedLocationId?: string | null,
  viewerUserId?: string | null,
): Promise<PublicExcursionCard | null> {
  const id = extractPropertyId(identifier);

  const excursion = await db.excursion.findFirst({
    where: {
      id,
      status: ExcursionStatus.PUBLISHED,
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
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
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
          ...(viewerUserId
            ? {
                reactions: {
                  where: { userId: viewerUserId },
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

  const canonicalLocationSlug = excursion.anchorLocation?.slug ?? excursion.locationId;
  if (expectedLocationId && canonicalLocationSlug && expectedLocationId !== canonicalLocationSlug) {
    return null;
  }

  return {
    id: excursion.id,
    slug: buildExcursionSlug(excursion.title, excursion.id),
    path: buildPublicExcursionPath({
      id: excursion.id,
      locationId: excursion.locationId,
      title: excursion.title,
      anchorLocation: excursion.anchorLocation,
    }),
    title: excursion.title,
    locationId: excursion.locationId,
    locationName: excursion.locationName,
    mainLocationName: excursion.mainLocation?.name ?? null,
    anchorCityName: excursion.anchorLocation?.name ?? excursion.locationName,
    districtName: excursion.district?.name ?? null,
    categoryName: excursion.category?.name ?? null,
    address: excursion.address,
    latitude: excursion.latitude === null ? null : Number(excursion.latitude),
    longitude: excursion.longitude === null ? null : Number(excursion.longitude),
    startPoint: excursion.startPoint,
    meetingPointText: excursion.meetingPointText,
    description: excursion.description,
    shortDescription: excursion.shortDescription,
    fullDescription: excursion.fullDescription,
    routeDescription: excursion.routeDescription,
    durationMinutes: excursion.durationMinutes,
    scheduleText: excursion.scheduleText,
    format: excursion.format,
    languageCodes: excursion.languageCodes,
    isKidFriendly: excursion.isKidFriendly,
    pickupAvailable: excursion.pickupAvailable,
    tags: excursion.tags,
    priceFrom: excursion.priceFrom === null ? null : Number(excursion.priceFrom),
    priceTo: excursion.priceTo === null ? null : Number(excursion.priceTo),
    currency: excursion.currency,
    includedText: excursion.includedText,
    notIncludedText: excursion.notIncludedText,
    includedItems: excursion.includedItems,
    excludedItems: excursion.excludedItems,
    cancellationPolicy: excursion.cancellationPolicy,
    cancellationPolicyType: excursion.cancellationPolicyType,
    transferDetails: excursion.transferDetails,
    timeline: Array.isArray(excursion.timeline) ? (excursion.timeline as import("@/types/excursions").TimelineStep[]) : [],
    pricingTiers: Array.isArray(excursion.pricingTiers) ? (excursion.pricingTiers as import("@/types/excursions").PricingTier[]) : [],
    faqItems: Array.isArray(excursion.faqItems) ? (excursion.faqItems as import("@/types/excursions").FaqItem[]) : [],
    photoUrls: excursion.photoUrls,
    videoUrls: excursion.videoUrls,
    avgRating: Number(excursion.avgRating),
    reviewsCount: excursion.reviewsCount,
    contacts: {
      firstName: excursion.contactFirstName ?? excursion.owner.firstName,
      lastName: excursion.contactLastName ?? excursion.owner.lastName,
      phone: excursion.contactPhone ?? excursion.owner.phone,
      email: excursion.contactEmail ?? excursion.owner.email,
      websiteUrl: excursion.websiteUrl,
      whatsappUrl: excursion.whatsappUrl,
      telegramUrl: excursion.telegramUrl,
      vkUrl: excursion.vkUrl,
      maxUrl: excursion.maxUrl,
      okUrl: excursion.okUrl,
    },
    owner: {
      id: excursion.owner.id,
      firstName: excursion.owner.firstName,
      lastName: excursion.owner.lastName,
    },
    pickupLocations: excursion.pickupLocations.map((item) => ({
      id: item.location.id,
      name: item.location.name,
      slug: item.location.slug,
    })),
    routeLocations: excursion.routeLocations.map((item) => ({
      id: item.location.id,
      name: item.location.name,
      slug: item.location.slug,
      sortOrder: item.sortOrder,
    })),
    reviews: excursion.reviews.map(serializeReview),
  };
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
