import { randomUUID } from "node:crypto";
import { Prisma, TransferStatus } from "@prisma/client";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { db } from "@/lib/db";
import { resolveCrimeaLocationCenter } from "@/lib/crimea-location-centers";
import { haversineDistanceKm, resolveExcursionLocation } from "@/lib/excursion-directory";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import {
  isDatabaseFallbackEligibleError,
  isDatabaseSchemaMissingError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import { extractPropertyId, slugify } from "@/lib/public-properties";
import {
  createStaticAttractionDraft,
  getStaticAttractionByIdentifier,
  getStaticAttractionCatalog,
  getStaticAttractionCategories,
  getStaticAttractions,
  type StaticAttraction,
} from "@/lib/static-attractions";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  deriveTransferSummaryFromFleet,
  normalizeTransferServiceTags,
  type TransferFleetItem,
} from "@/lib/transfers";

export type PublicAttractionCatalogQuery = {
  query?: string;
  location?: string;
  category?: string;
  radiusKm?: number;
  sort?: "relevance" | "distance_asc" | "newest" | "name_asc";
  page?: number;
  pageSize?: number;
  allowLargePageSize?: boolean;
};

export type PublicTransferCatalogQuery = {
  query?: string;
  location?: string;
  transferType?: string;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?:
    | "relevance"
    | "distance_asc"
    | "price_asc"
    | "price_desc"
    | "rating_desc"
    | "popular_desc"
    | "newest";
  page?: number;
  pageSize?: number;
  allowLargePageSize?: boolean;
};

export type PublicAttractionCatalogItem = {
  id: string;
  slug: string;
  path: string;
  title: string;
  h1: string;
  seoTitle: string;
  metaDescription: string;
  category: string | null;
  tags: string[];
  locationName: string | null;
  districtName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  shortDescription: string | null;
  description: string | null;
  photoUrls: string[];
  coverImageUrl: string | null;
  gallery: StaticAttraction["gallery"];
  facts: StaticAttraction["facts"];
  sections: StaticAttraction["sections"];
  nearby: string[];
  faq: StaticAttraction["faq"];
  distanceKm: number | null;
  websiteUrl: string | null;
  mapUrl: string | null;
  updatedAt: string;
};

export type PublicTransferCatalogItem = {
  id: string;
  slug: string;
  path: string;
  title: string;
  transferType: string | null;
  serviceTags: string[];
  fleet: TransferFleetItem[];
  vehicleClass: string | null;
  vehicleModel: string | null;
  seats: number | null;
  luggage: number | null;
  locationName: string | null;
  districtName: string | null;
  serviceArea: string | null;
  routeExamples: string | null;
  latitude: number | null;
  longitude: number | null;
  priceFrom: number | null;
  priceUnitLabel: string | null;
  currency: string;
  avgRating: number;
  reviewsCount: number;
  shortDescription: string | null;
  description: string | null;
  photoUrls: string[];
  coverImageUrl: string | null;
  distanceKm: number | null;
  contacts: {
    contactName: string | null;
    phone: string | null;
    phone2: string | null;
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
};

export type PublicAttractionCatalogResult = {
  items: PublicAttractionCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    query: string | null;
    locationName: string | null;
    centerLat: number | null;
    centerLng: number | null;
    category: string | null;
    radiusKm: number;
    sort: "relevance" | "distance_asc" | "newest" | "name_asc";
  };
};

export type PublicTransferCatalogResult = {
  items: PublicTransferCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    query: string | null;
    locationName: string | null;
    centerLat: number | null;
    centerLng: number | null;
    transferType: string | null;
    radiusKm: number;
    minPrice: number | null;
    maxPrice: number | null;
    sort:
      | "relevance"
      | "distance_asc"
      | "price_asc"
      | "price_desc"
      | "rating_desc"
      | "popular_desc"
      | "newest";
  };
};

export type PublicMarketplaceLocationSuggestion = {
  id: string;
  name: string;
  subtitle: string;
  activeListingsCount: number;
  searchTerms: string[];
};

const transferInclude = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
    },
  },
  location: {
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
    },
  },
  district: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.TransferInclude;

type TransferRow = Prisma.TransferGetPayload<{ include: typeof transferInclude }>;

type Point = {
  latitude: number;
  longitude: number;
};

function isMarketplaceFallbackError(error: unknown): boolean {
  return isDatabaseSchemaMissingError(error) || isDatabaseFallbackEligibleError(error);
}

function logMarketplaceFallback(context: string, entityLabel: string): void {
  logDatabaseFallbackOnce(
    context,
    `${entityLabel} data is unavailable. Returning an empty marketplace response until the database migration is applied.`,
  );
}

function toNumberOrNull(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function parsePage(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value ?? 1)) : 1;
}

function parsePageSize(value: number | undefined, allowLargePageSize = false): number {
  const cap = allowLargePageSize ? 5000 : 30;
  return Number.isFinite(value) ? Math.min(cap, Math.max(1, Math.round(value ?? 30))) : 30;
}

function parseRadiusKm(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(5, Math.min(100, Math.round(value ?? 30))) : 30;
}

function parseMoney(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function pluralize(value: number, variants: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) return variants[2];
  if (mod > 1 && mod < 5) return variants[1];
  if (mod === 1) return variants[0];
  return variants[2];
}

function getFirstPhotoUrl(urls: string[] | null | undefined): string | null {
  return (urls ?? []).map((url) => url.trim()).find(Boolean) ?? null;
}

function getTransferPoint(row: TransferRow): Point | null {
  const latitude = toNumberOrNull(row.latitude) ?? toNumberOrNull(row.location?.latitude);
  const longitude = toNumberOrNull(row.longitude) ?? toNumberOrNull(row.location?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function getDistanceKm(center: Point | null, point: Point | null): number | null {
  if (!center || !point) {
    return null;
  }

  return haversineDistanceKm(center, point);
}

function getSearchScoreMap<T extends { id: string }>(
  query: string,
  rows: T[],
  resolver: (item: T) => Array<string | null | undefined>,
): Map<string, number> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return new Map();
  }

  const ranked = rankByTrigramWithScores(trimmed, rows, resolver, {
    limit: rows.length,
    minScore: 0.08,
  });

  return new Map(ranked.map((item) => [item.item.id, item.score]));
}

function containsQuery(query: string, candidates: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  return candidates.some((candidate) => normalizeText(candidate).includes(normalizedQuery));
}

function buildFallbackSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function getDailyRotationKey(): string {
  const now = new Date();
  const dayIso = now.toISOString().slice(0, 10);
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

function getTransferCatalogRankScore(row: TransferRow): number {
  const rating = Number(row.avgRating);
  const reviewsCount = row.reviewsCount;
  const fleetSummary = deriveTransferSummaryFromFleet(row);
  const publishedAt = row.publishedAt ?? row.createdAt;
  const daysSincePublished = Math.max(0, (Date.now() - publishedAt.getTime()) / 86_400_000);
  const daysSinceUpdate = Math.max(0, (Date.now() - row.updatedAt.getTime()) / 86_400_000);

  const credibility = Math.min(1, 0.28 + 0.72 * Math.sqrt(reviewsCount / 16));
  const ratingScore = rating > 0 ? rating * 90 * credibility : 0;
  const reviewVolumeScore = Math.log1p(reviewsCount) * 14;
  const viewsScore = Math.log1p(row.profileViews / 20) * 5;
  const completenessScore =
    (fleetSummary.photoUrls.length > 0 ? 8 : 0) +
    (fleetSummary.fleet.length > 0 ? 5 : 0) +
    (row.description ? 4 : 0) +
    (row.phone || row.whatsappUrl || row.telegramUrl ? 3 : 0);
  const newListingBoost = Math.max(0, 24 - Math.log1p(daysSincePublished) * 8);
  const freshnessScore = Math.max(0, 5 - Math.log1p(daysSinceUpdate / 7) * 2);
  const rotation = (stableHash(`${getDailyRotationKey()}:transfer:${row.id}`) % 1000) / 1000;

  return (
    ratingScore +
    reviewVolumeScore +
    viewsScore +
    completenessScore +
    newListingBoost +
    freshnessScore +
    rotation * 0.4
  );
}

export function buildAttractionSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "dostoprimechatelnost") || "dostoprimechatelnost";
  return `${base}-${id}`;
}

export function buildTransferSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "transfer") || "transfer";
  return `${base}-${id}`;
}

export function buildPublicAttractionPath(item: {
  id: string;
  title: string | null;
  slug?: string | null;
}): string {
  const slug = item.slug?.trim() || buildAttractionSlug(item.title, item.id);
  return `/attractions/${slug}`;
}

export function buildPublicTransferPath(item: { id: string; title: string | null }): string {
  return `/transfers/${buildTransferSlug(item.title, item.id)}`;
}

function mapAttractionCatalogItem(
  row: StaticAttraction,
  distanceKm: number | null,
): PublicAttractionCatalogItem {
  const photoUrls = row.gallery.map((image) => image.url);

  return {
    id: row.id,
    slug: row.slug,
    path: buildPublicAttractionPath({ id: row.id, title: row.title, slug: row.slug }),
    title: row.title,
    h1: row.h1,
    seoTitle: row.seoTitle,
    metaDescription: row.metaDescription,
    category: row.category,
    tags: row.tags,
    locationName: row.locationName,
    districtName: row.districtName,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    shortDescription: row.shortDescription,
    description: row.description,
    photoUrls,
    coverImageUrl: getFirstPhotoUrl(photoUrls),
    gallery: row.gallery,
    facts: row.facts,
    sections: row.sections,
    nearby: row.nearby,
    faq: row.faq,
    distanceKm: distanceKm === null ? null : Number((distanceKm * 1.3).toFixed(1)),
    websiteUrl: row.websiteUrl,
    mapUrl: row.mapUrl,
    updatedAt: row.updatedAt,
  };
}

function mapTransferCatalogItem(
  row: TransferRow,
  distanceKm: number | null,
): PublicTransferCatalogItem {
  const fallbackContactName = `${row.owner.firstName} ${row.owner.lastName}`.trim();
  const fleetSummary = deriveTransferSummaryFromFleet(row);
  const serviceTags = normalizeTransferServiceTags(row.serviceTags);

  return {
    id: row.id,
    slug: buildTransferSlug(row.title, row.id),
    path: buildPublicTransferPath({ id: row.id, title: row.title }),
    title: row.title ?? "Трансфер без названия",
    transferType: row.transferType,
    serviceTags,
    fleet: fleetSummary.fleet,
    vehicleClass: fleetSummary.vehicleClass ?? row.vehicleClass,
    vehicleModel: fleetSummary.vehicleModel ?? row.vehicleModel,
    seats: fleetSummary.seats ?? row.seats,
    luggage: fleetSummary.luggage ?? row.luggage,
    locationName: row.location?.name ?? row.locationName,
    districtName: row.district?.name ?? null,
    serviceArea: row.serviceArea,
    routeExamples: row.routeExamples,
    latitude: toNumberOrNull(row.latitude) ?? toNumberOrNull(row.location?.latitude),
    longitude: toNumberOrNull(row.longitude) ?? toNumberOrNull(row.location?.longitude),
    priceFrom: fleetSummary.priceFrom ?? toNumberOrNull(row.priceFrom),
    priceUnitLabel: fleetSummary.priceUnitLabel ?? row.priceUnitLabel,
    currency: row.currency,
    avgRating: Number(row.avgRating),
    reviewsCount: row.reviewsCount,
    shortDescription: row.shortDescription,
    description: row.description,
    photoUrls: row.photoUrls.length > 0 ? row.photoUrls : fleetSummary.photoUrls,
    coverImageUrl: getFirstPhotoUrl(
      row.photoUrls.length > 0 ? row.photoUrls : fleetSummary.photoUrls,
    ),
    distanceKm: distanceKm === null ? null : Number((distanceKm * 1.3).toFixed(1)),
    contacts: {
      contactName: row.contactName ?? fallbackContactName,
      phone: row.phone ?? row.owner.phone,
      phone2: row.phone2,
      websiteUrl: row.websiteUrl,
      whatsappUrl: normalizeWhatsappUrl(row.whatsappUrl),
      telegramUrl: normalizeTelegramProfileUrl(row.telegramUrl),
      vkUrl: normalizeVkProfileUrl(row.vkUrl),
      maxUrl: normalizeMaxProfileUrl(row.maxUrl),
      okUrl: normalizeOkProfileUrl(row.okUrl),
    },
    owner: {
      id: row.owner.id,
      firstName: row.owner.firstName,
      lastName: row.owner.lastName,
      avatarUrl: row.owner.avatarUrl,
    },
  };
}

function parseTransferSort(value: PublicTransferCatalogQuery["sort"]) {
  return value === "distance_asc" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "rating_desc" ||
    value === "popular_desc" ||
    value === "newest"
    ? value
    : "relevance";
}

export async function getPublicAttractionCatalog(
  query: PublicAttractionCatalogQuery,
): Promise<PublicAttractionCatalogResult> {
  const result = await getStaticAttractionCatalog(query);

  return {
    items: result.entries.map(({ item, distanceKm }) => mapAttractionCatalogItem(item, distanceKm)),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    filters: result.filters,
  };
}

export async function getPublicTransferCatalog(
  query: PublicTransferCatalogQuery,
): Promise<PublicTransferCatalogResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize, query.allowLargePageSize === true);
  const searchQuery = query.query?.trim() ?? "";
  const locationQuery = query.location?.trim() ?? "";
  const transferType = query.transferType?.trim() ?? "";
  const radiusKm = parseRadiusKm(query.radiusKm);
  const haversineRadiusKm = radiusKm / 1.3;
  const sort = parseTransferSort(query.sort);
  const minPrice = parseMoney(query.minPrice);
  const maxPrice = parseMoney(query.maxPrice);

  const resolvedLocation = await resolveExcursionLocation({
    location: locationQuery,
  });
  const locationCenter =
    resolvedLocation?.latitude !== null &&
    resolvedLocation?.latitude !== undefined &&
    resolvedLocation?.longitude !== null &&
    resolvedLocation?.longitude !== undefined
      ? {
          name: resolvedLocation.name,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        }
      : await resolveCrimeaLocationCenter(resolvedLocation?.name ?? locationQuery);
  const center = locationCenter
    ? { latitude: locationCenter.latitude, longitude: locationCenter.longitude }
    : null;

  let rows: TransferRow[];
  try {
    rows = await db.transfer.findMany({
      where: {
        status: TransferStatus.PUBLISHED,
        isPublishedVisible: true,
        owner: {
          deletedAt: null,
        },
      },
      include: transferInclude,
      orderBy: [{ updatedAt: "desc" }],
    });
  } catch (error) {
    if (!isMarketplaceFallbackError(error)) {
      throw error;
    }

    logMarketplaceFallback("public-transfers-catalog", "Transfer");

    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
      filters: {
        query: searchQuery || null,
        locationName: resolvedLocation?.name ?? locationCenter?.name ?? (locationQuery || null),
        centerLat: center?.latitude ?? null,
        centerLng: center?.longitude ?? null,
        transferType: transferType || null,
        radiusKm,
        minPrice,
        maxPrice,
        sort,
      },
    };
  }

  const searchScores = getSearchScoreMap(searchQuery, rows, (item) => [
    item.title,
    item.transferType,
    ...normalizeTransferServiceTags(item.serviceTags),
    item.vehicleClass,
    item.vehicleModel,
    item.locationName,
    item.location?.name,
    item.serviceArea,
    item.routeExamples,
    item.shortDescription,
    item.description,
    ...deriveTransferSummaryFromFleet(item).fleet.flatMap((fleetItem) => [
      fleetItem.title,
      fleetItem.transportKind,
      fleetItem.vehicleClass,
      fleetItem.vehicleModel,
      fleetItem.description,
    ]),
  ]);

  const filtered = rows
    .map((row) => {
      const fleetSummary = deriveTransferSummaryFromFleet(row);
      const point = getTransferPoint(row);
      const distanceKm = getDistanceKm(center, point);
      const priceFrom = fleetSummary.priceFrom ?? toNumberOrNull(row.priceFrom);
      const resolvedLocationMatch = resolvedLocation
        ? row.locationId === resolvedLocation.id ||
          normalizeText(row.locationName) === normalizeText(resolvedLocation.name) ||
          normalizeText(row.location?.name) === normalizeText(resolvedLocation.name)
        : false;
      const textLocationMatch = containsQuery(locationQuery, [
        row.locationName,
        row.location?.name,
        row.district?.name,
        row.serviceArea,
        row.routeExamples,
      ]);
      const radiusLocationMatch = distanceKm !== null && distanceKm <= haversineRadiusKm;
      const locationMatch =
        !locationQuery || resolvedLocationMatch || textLocationMatch || radiusLocationMatch;

      if (!locationMatch) {
        return null;
      }

      if (transferType && normalizeText(row.transferType) !== normalizeText(transferType)) {
        return null;
      }

      if (minPrice !== null && (priceFrom === null || priceFrom < minPrice)) {
        return null;
      }

      if (maxPrice !== null && (priceFrom === null || priceFrom > maxPrice)) {
        return null;
      }

      const searchScore = searchScores.get(row.id) ?? 0;
      if (
        searchQuery &&
        searchScore <= 0 &&
        !containsQuery(searchQuery, [
          row.title,
          row.transferType,
          ...normalizeTransferServiceTags(row.serviceTags),
          row.vehicleClass,
          row.vehicleModel,
          row.locationName,
          row.location?.name,
          row.serviceArea,
          row.routeExamples,
          row.shortDescription,
          row.description,
          ...deriveTransferSummaryFromFleet(row).fleet.flatMap((fleetItem) => [
            fleetItem.title,
            fleetItem.transportKind,
            fleetItem.vehicleClass,
            fleetItem.vehicleModel,
            fleetItem.description,
          ]),
        ])
      ) {
        return null;
      }

      const distanceScore =
        distanceKm === null
          ? 0
          : Math.max(0, (1 - distanceKm / Math.max(haversineRadiusKm * 2, 30)) * 20);
      const exactLocationScore =
        resolvedLocation && row.locationId === resolvedLocation.id ? 35 : 0;
      const relevance = searchScore * 70 + distanceScore + exactLocationScore;
      const catalogRank = getTransferCatalogRankScore(row);

      return { row, distanceKm, relevance, priceFrom, catalogRank };
    })
    .filter(
      (
        item,
      ): item is {
        row: TransferRow;
        distanceKm: number | null;
        relevance: number;
        priceFrom: number | null;
        catalogRank: number;
      } => Boolean(item),
    );

  filtered.sort((left, right) => {
    if (sort === "distance_asc") {
      if (left.distanceKm === null && right.distanceKm === null) return 0;
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm;
    }

    if (sort === "price_asc") {
      if (left.priceFrom === null && right.priceFrom === null) return 0;
      if (left.priceFrom === null) return 1;
      if (right.priceFrom === null) return -1;
      return left.priceFrom - right.priceFrom;
    }

    if (sort === "price_desc") {
      if (left.priceFrom === null && right.priceFrom === null) return 0;
      if (left.priceFrom === null) return 1;
      if (right.priceFrom === null) return -1;
      return right.priceFrom - left.priceFrom;
    }

    if (sort === "newest") {
      return right.row.updatedAt.getTime() - left.row.updatedAt.getTime();
    }

    if (sort === "rating_desc") {
      const byRating = Number(right.row.avgRating) - Number(left.row.avgRating);
      if (Math.abs(byRating) > 0.00001) return byRating;
      const byReviews = right.row.reviewsCount - left.row.reviewsCount;
      if (byReviews !== 0) return byReviews;
    }

    if (sort === "popular_desc") {
      const byReviews = right.row.reviewsCount - left.row.reviewsCount;
      if (byReviews !== 0) return byReviews;
      const byRating = Number(right.row.avgRating) - Number(left.row.avgRating);
      if (Math.abs(byRating) > 0.00001) return byRating;
    }

    const byRelevance =
      searchQuery.length >= 2 || locationQuery || locationCenter
        ? right.relevance - left.relevance
        : right.catalogRank - left.catalogRank;
    if (Math.abs(byRelevance) > 0.00001) return byRelevance;

    const byCatalogRank = right.catalogRank - left.catalogRank;
    if (Math.abs(byCatalogRank) > 0.00001) return byCatalogRank;
    return right.row.updatedAt.getTime() - left.row.updatedAt.getTime();
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    items: paged.map(({ row, distanceKm }) => mapTransferCatalogItem(row, distanceKm)),
    total,
    page: safePage,
    pageSize,
    totalPages,
    filters: {
      query: searchQuery || null,
      locationName: resolvedLocation?.name ?? locationCenter?.name ?? (locationQuery || null),
      centerLat: center?.latitude ?? null,
      centerLng: center?.longitude ?? null,
      transferType: transferType || null,
      radiusKm,
      minPrice,
      maxPrice,
      sort,
    },
  };
}

export async function getPublicAttractionByIdentifier(
  identifier: string,
): Promise<PublicAttractionCatalogItem | null> {
  const row = await getStaticAttractionByIdentifier(identifier);

  return row ? mapAttractionCatalogItem(row, null) : null;
}

export async function getPublicTransferByIdentifier(
  identifier: string,
): Promise<PublicTransferCatalogItem | null> {
  const id = extractPropertyId(identifier);
  let row: TransferRow | null;
  try {
    row = await db.transfer.findFirst({
      where: {
        id,
        status: TransferStatus.PUBLISHED,
        isPublishedVisible: true,
        owner: {
          deletedAt: null,
        },
      },
      include: transferInclude,
    });
  } catch (error) {
    if (!isMarketplaceFallbackError(error)) {
      throw error;
    }

    logMarketplaceFallback("public-transfer-detail", "Transfer");
    return null;
  }

  return row ? mapTransferCatalogItem(row, null) : null;
}

export async function getOwnerPreviewTransferByIdentifier(
  identifier: string,
  ownerId: string,
): Promise<PublicTransferCatalogItem | null> {
  const id = extractPropertyId(identifier);
  let row: TransferRow | null;

  try {
    row = await db.transfer.findFirst({
      where: {
        id,
        ownerId,
        owner: {
          deletedAt: null,
        },
      },
      include: transferInclude,
    });
  } catch (error) {
    if (!isMarketplaceFallbackError(error)) {
      throw error;
    }

    logMarketplaceFallback("owner-preview-transfer-detail", "Transfer");
    return null;
  }

  return row ? mapTransferCatalogItem(row, null) : null;
}

export async function getMarketplaceDirectoryData(): Promise<{
  attractionCategories: string[];
  transferTypes: string[];
  locationNames: string[];
  attractionLocationSuggestions: PublicMarketplaceLocationSuggestion[];
  transferLocationSuggestions: PublicMarketplaceLocationSuggestion[];
}> {
  const [staticAttractions, staticAttractionCategories] = await Promise.all([
    getStaticAttractions(),
    getStaticAttractionCategories(),
  ]);
  let transfers: Array<{
    transferType: string | null;
    locationName: string | null;
    location: { name: string } | null;
  }>;

  try {
    transfers = await db.transfer.findMany({
      where: {
        status: TransferStatus.PUBLISHED,
        isPublishedVisible: true,
        owner: { deletedAt: null },
      },
      select: {
        transferType: true,
        locationName: true,
        location: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  } catch (error) {
    if (!isMarketplaceFallbackError(error)) {
      throw error;
    }

    logMarketplaceFallback("public-marketplace-directory", "Marketplace directory");
    transfers = [];
  }

  const transferTypes = new Set<string>();
  const locationNames = new Set<string>();
  const attractionLocationCounts = new Map<string, { name: string; count: number; searchTerms: Set<string> }>();
  const transferLocationCounts = new Map<string, { name: string; count: number; searchTerms: Set<string> }>();

  for (const item of staticAttractions) {
    const locationName = item.locationName;
    if (locationName?.trim()) {
      const name = locationName.trim();
      const key = normalizeText(name);
      locationNames.add(name);
      const current = attractionLocationCounts.get(key);
      const searchTerms = current?.searchTerms ?? new Set<string>();
      for (const term of [item.locationName, item.districtName, ...item.locationAliases]) {
        if (term?.trim()) searchTerms.add(term.trim());
      }
      attractionLocationCounts.set(key, {
        name: current?.name ?? name,
        count: (current?.count ?? 0) + 1,
        searchTerms,
      });
    }
  }

  for (const item of transfers) {
    if (item.transferType?.trim()) transferTypes.add(item.transferType.trim());
    const locationName = item.location?.name ?? item.locationName;
    if (locationName?.trim()) {
      const name = locationName.trim();
      const key = normalizeText(name);
      locationNames.add(name);
      const current = transferLocationCounts.get(key);
      const searchTerms = current?.searchTerms ?? new Set<string>();
      searchTerms.add(name);
      transferLocationCounts.set(key, {
        name: current?.name ?? name,
        count: (current?.count ?? 0) + 1,
        searchTerms,
      });
    }
  }

  const toLocationSuggestions = (
    items: Map<string, { name: string; count: number; searchTerms: Set<string> }>,
    kind: "attractions" | "transfers",
  ): PublicMarketplaceLocationSuggestion[] =>
    Array.from(items.values())
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.name.localeCompare(right.name, "ru");
      })
      .map((item) => {
        const listingLabel =
          kind === "attractions"
            ? `${item.count} ${pluralize(item.count, ["место досуга", "места досуга", "мест досуга"])}`
            : `${item.count} ${pluralize(item.count, ["трансфер", "трансфера", "трансферов"])}`;

        return {
          id: slugify(item.name) || normalizeText(item.name),
          name: item.name,
          subtitle: `Крым, Россия · ${listingLabel}`,
          activeListingsCount: item.count,
          searchTerms: Array.from(item.searchTerms),
        };
      });

  return {
    attractionCategories: staticAttractionCategories,
    transferTypes: [...transferTypes].sort((a, b) => a.localeCompare(b, "ru")),
    locationNames: [...locationNames].sort((a, b) => a.localeCompare(b, "ru")),
    attractionLocationSuggestions: toLocationSuggestions(attractionLocationCounts, "attractions"),
    transferLocationSuggestions: toLocationSuggestions(transferLocationCounts, "transfers"),
  };
}

export async function createAttractionDraft(input: {
  title?: string | null;
  createdByLogin?: string | null;
}) {
  return createStaticAttractionDraft(input);
}

export async function createTransferDraft(input: {
  ownerId: string;
  title?: string | null;
  contactName?: string | null;
  phone?: string | null;
}) {
  const created = await db.transfer.create({
    data: {
      ownerId: input.ownerId,
      title: input.title?.trim() || "Новый трансфер",
      slug: buildFallbackSlug("transfer"),
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
    },
    select: {
      id: true,
      title: true,
    },
  });

  return db.transfer.update({
    where: { id: created.id },
    data: {
      slug: buildTransferSlug(created.title, created.id),
    },
  });
}
