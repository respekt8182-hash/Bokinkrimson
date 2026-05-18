import { randomUUID } from "node:crypto";
import { Prisma, TransferStatus } from "@prisma/client";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { db } from "@/lib/db";
import { getExternalReviewSummaryWithFallback } from "@/lib/external-reviews";
import { resolveCrimeaLocationCenter } from "@/lib/crimea-location-centers";
import { resolveExcursionLocation } from "@/lib/excursion-directory";
import {
  calculateDistanceKm,
  isWithinRadiusKm,
  parseNearbyCatalogRadiusKm,
  roundDistanceKm,
  type CatalogSearchMatchKind,
} from "@/lib/catalog-radius";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import {
  isDatabaseFallbackEligibleError,
  isDatabaseSchemaMissingError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import { cleanPublicText, cleanPublicTextList } from "@/lib/public-content-quality";
import { formatPublicContactName, formatPublicPersonName } from "@/lib/public-display-name";
import { extractPropertyId, isPublicEntityId, slugify } from "@/lib/public-properties";
import { getRankingStatsByEntity } from "@/lib/ranking-stats";
import {
  buildSearchFingerprint,
  clamp,
  compareRankedItems,
  median,
  rankItems,
  scoreRankingCandidate,
} from "@/lib/ranking-v2";
import { isPointInsideBounds, type MapBounds } from "@/lib/search-contracts";
import {
  createStaticAttractionDraft,
  getStaticAttractionByIdentifier,
  getStaticAttractionCatalog,
  getStaticAttractions,
  type StaticAttraction,
} from "@/lib/static-attractions";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { applyPublishedTransferSnapshotToRow } from "@/lib/transfer-public-snapshot";
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
  bounds?: MapBounds | null;
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
  bounds?: MapBounds | null;
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

export type PublicAttractionMapItem = Pick<
  PublicAttractionCatalogItem,
  | "id"
  | "path"
  | "title"
  | "category"
  | "tags"
  | "locationName"
  | "districtName"
  | "address"
  | "latitude"
  | "longitude"
  | "shortDescription"
  | "coverImageUrl"
>;

export type PublicTransferCatalogItem = {
  id: string;
  publicId: number | null;
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
  searchMatchKind: CatalogSearchMatchKind;
  contacts: {
    contactName: string | null;
    phone: string | null;
    phoneName: string | null;
    phone2: string | null;
    phone2Name: string | null;
    phone3: string | null;
    phone3Name: string | null;
    websiteUrl: string | null;
    email: string | null;
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
    nearbyRadiusKm: number | null;
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
      email: true,
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

const transferIdentifierSelect = Prisma.validator<Prisma.TransferSelect>()({
  id: true,
  title: true,
  slug: true,
  status: true,
  pendingEditStatus: true,
  publishedSnapshot: true,
  updatedAt: true,
});

type TransferIdentifierRow = Prisma.TransferGetPayload<{ select: typeof transferIdentifierSelect }>;

type Point = {
  latitude: number;
  longitude: number;
};

function isMarketplaceFallbackError(error: unknown): boolean {
  return isDatabaseSchemaMissingError(error) || isDatabaseFallbackEligibleError(error);
}

function getTransferIdentifierSlug(row: TransferIdentifierRow): string {
  const publicRow = applyPublishedTransferSnapshotToRow(row);
  return buildTransferPublicSlug(publicRow.title);
}

async function findTransferIdByPublicSlug(input: {
  identifier: string;
  ownerId?: string | null;
}): Promise<string | null> {
  const publicSlug = slugify(input.identifier.trim());
  if (!publicSlug) {
    return null;
  }

  const rows = await db.transfer.findMany({
    where: input.ownerId
      ? {
          ownerId: input.ownerId,
          owner: {
            deletedAt: null,
          },
        }
      : {
          status: TransferStatus.PUBLISHED,
          isPublishedVisible: true,
          owner: {
            deletedAt: null,
          },
        },
    select: transferIdentifierSelect,
    orderBy: [{ updatedAt: "desc" }],
  });

  const match = rows.find(
    (row) => getTransferIdentifierSlug(row) === publicSlug || slugify(row.slug) === publicSlug,
  );

  return match?.id ?? null;
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
  return parseNearbyCatalogRadiusKm(value);
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
  return calculateDistanceKm(center, point);
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

function getSearchMatchKindRank(kind: CatalogSearchMatchKind): number {
  return kind === "primary" ? 0 : 1;
}

function buildFallbackSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function getTransferIntentScore(input: {
  hasSearch: boolean;
  searchScore: number;
  hasLocationQuery: boolean;
  primaryLocationMatch: boolean;
  nearbyLocationMatch: boolean;
  transferTypeMatch: boolean;
  distanceKm: number | null;
  radiusKm: number;
}): number {
  const routeAndTextScore = input.hasSearch ? clamp((input.searchScore / 1.2) * 100, 20, 100) : 72;
  const locationScore = !input.hasLocationQuery
    ? 72
    : input.primaryLocationMatch
      ? 100
      : input.nearbyLocationMatch
        ? clamp(82 - ((input.distanceKm ?? input.radiusKm) / Math.max(input.radiusKm, 1)) * 30, 45, 82)
        : 25;
  const typeScore = input.transferTypeMatch ? 100 : 72;

  return clamp(routeAndTextScore * 0.45 + locationScore * 0.35 + typeScore * 0.2, 0, 100);
}

function getTransferAvailabilityScore(input: {
  priceFrom: number | null;
  hasFleet: boolean;
  seats: number | null;
  luggage: number | null;
  hasContactPath: boolean;
  locationMatched: boolean;
}): number {
  return clamp(
    (input.priceFrom !== null ? 28 : 0) +
      (input.hasFleet ? 22 : 0) +
      (input.seats !== null && input.seats > 0 ? 16 : 0) +
      (input.luggage !== null && input.luggage >= 0 ? 8 : 0) +
      (input.hasContactPath ? 16 : 0) +
      (input.locationMatched ? 10 : 0),
    0,
    100,
  );
}

function getTransferCompletenessScore(input: {
  photoCount: number;
  fleetCount: number;
  description: string | null;
  serviceArea: string | null;
  routeExamples: string | null;
  priceFrom: number | null;
  latitude: number | null;
  longitude: number | null;
  hasContactPath: boolean;
  seats: number | null;
  luggage: number | null;
  serviceTagsCount: number;
}): number {
  return clamp(
    (input.photoCount > 0 ? 16 : 0) +
      Math.min(input.photoCount, 6) * 3 +
      (input.fleetCount > 0 ? 14 : 0) +
      (input.description ? 8 : 0) +
      (input.serviceArea ? 8 : 0) +
      (input.routeExamples ? 8 : 0) +
      (input.priceFrom !== null ? 12 : 0) +
      (input.latitude !== null && input.longitude !== null ? 8 : 0) +
      (input.hasContactPath ? 8 : 0) +
      (input.seats !== null && input.seats > 0 ? 5 : 0) +
      (input.luggage !== null && input.luggage >= 0 ? 3 : 0) +
      Math.min(input.serviceTagsCount, 4) * 2,
    0,
    100,
  );
}

function getTransferFreshnessScore(input: {
  now: Date;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
}): number {
  const publishedAt = input.publishedAt ?? input.createdAt;
  const ageDays = Math.max(0, (input.now.getTime() - publishedAt.getTime()) / 86_400_000);
  const updateAgeDays = Math.max(0, (input.now.getTime() - input.updatedAt.getTime()) / 86_400_000);
  const newness = ageDays <= 30 ? (1 - ageDays / 30) * 55 : 0;
  const weakMeaningfulUpdate = updateAgeDays <= 45 ? (1 - updateAgeDays / 45) * 25 : 0;

  return clamp(20 + newness + weakMeaningfulUpdate, 0, 100);
}

export function buildAttractionSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "dostoprimechatelnost") || "dostoprimechatelnost";
  return `${base}-${id}`;
}

export function buildTransferSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "transfer") || "transfer";
  return `${base}-${id}`;
}

export function buildTransferPublicSlug(title: string | null): string {
  return slugify(title ?? "transfer") || "transfer";
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
  return `/transfers/${buildTransferPublicSlug(item.title)}`;
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
    distanceKm: roundDistanceKm(distanceKm),
    websiteUrl: row.websiteUrl,
    mapUrl: row.mapUrl,
    updatedAt: row.updatedAt,
  };
}

function mapAttractionMapItem(row: StaticAttraction): PublicAttractionMapItem {
  const photoUrls = row.gallery.map((image) => image.url);

  return {
    id: row.id,
    path: buildPublicAttractionPath({ id: row.id, title: row.title, slug: row.slug }),
    title: row.title,
    category: row.category,
    tags: row.tags.slice(0, 1),
    locationName: row.locationName,
    districtName: row.districtName,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    shortDescription: row.shortDescription,
    coverImageUrl: getFirstPhotoUrl(photoUrls),
  };
}

function mapTransferCatalogItem(
  row: TransferRow,
  distanceKm: number | null,
  searchMatchKind: CatalogSearchMatchKind = "primary",
): PublicTransferCatalogItem {
  const fallbackContactName = formatPublicPersonName(row.owner, "");
  const contactName = formatPublicContactName(row.contactName, fallbackContactName) || null;
  const fleetSummary = deriveTransferSummaryFromFleet(row);
  const serviceTags = cleanPublicTextList(normalizeTransferServiceTags(row.serviceTags), {
    minLength: 2,
    maxLength: 60,
    maxItems: 5,
  });
  const fleet = fleetSummary.fleet
    .map((item) => ({
      ...item,
      title: cleanPublicText(item.title, { minLength: 2, maxLength: 80 }) ?? "",
      transportKind: cleanPublicText(item.transportKind, { minLength: 2, maxLength: 60 }) ?? "",
      vehicleClass: cleanPublicText(item.vehicleClass, { minLength: 2, maxLength: 60 }) ?? "",
      vehicleModel: cleanPublicText(item.vehicleModel, { minLength: 2, maxLength: 80 }) ?? "",
      luggageNote: cleanPublicText(item.luggageNote, { minLength: 2, maxLength: 140 }) ?? "",
      priceUnitLabel:
        cleanPublicText(item.priceUnitLabel, { minLength: 2, maxLength: 40 }) ??
        item.priceUnitLabel,
      description:
        cleanPublicText(item.description, {
          minLength: 8,
          maxLength: 700,
          preserveLineBreaks: true,
        }) ?? "",
    }))
    .filter(
      (item) =>
        item.title ||
        item.transportKind ||
        item.vehicleClass ||
        item.vehicleModel ||
        item.seats ||
        item.luggage ||
        item.luggageNote ||
        item.priceFrom ||
        item.photoUrl ||
        item.photoUrls.length > 0 ||
        item.description,
    );

  return {
    id: row.id,
    publicId: row.publicId ?? null,
    slug: buildTransferPublicSlug(row.title),
    path: buildPublicTransferPath({ id: row.id, title: row.title }),
    title: row.title ?? "Трансфер без названия",
    transferType: cleanPublicText(row.transferType, { minLength: 2, maxLength: 80 }),
    serviceTags,
    fleet,
    vehicleClass: cleanPublicText(fleetSummary.vehicleClass ?? row.vehicleClass, {
      minLength: 2,
      maxLength: 80,
    }),
    vehicleModel: cleanPublicText(fleetSummary.vehicleModel ?? row.vehicleModel, {
      minLength: 2,
      maxLength: 80,
    }),
    seats: fleetSummary.seats ?? row.seats,
    luggage: fleetSummary.luggage ?? row.luggage,
    locationName: row.location?.name ?? row.locationName,
    districtName: row.district?.name ?? null,
    serviceArea: cleanPublicText(row.serviceArea, {
      minLength: 4,
      maxLength: 700,
      preserveLineBreaks: true,
    }),
    routeExamples: cleanPublicText(row.routeExamples, {
      minLength: 4,
      maxLength: 900,
      preserveLineBreaks: true,
    }),
    latitude: toNumberOrNull(row.latitude) ?? toNumberOrNull(row.location?.latitude),
    longitude: toNumberOrNull(row.longitude) ?? toNumberOrNull(row.location?.longitude),
    priceFrom: fleetSummary.priceFrom ?? toNumberOrNull(row.priceFrom),
    priceUnitLabel:
      cleanPublicText(fleetSummary.priceUnitLabel ?? row.priceUnitLabel, {
        minLength: 2,
        maxLength: 40,
      }) ?? null,
    currency: row.currency,
    avgRating: Number(row.avgRating),
    reviewsCount: row.reviewsCount,
    shortDescription: cleanPublicText(row.shortDescription, { minLength: 10, maxLength: 360 }),
    description: cleanPublicText(row.description, {
      minLength: 10,
      maxLength: 3000,
      preserveLineBreaks: true,
    }),
    photoUrls: row.photoUrls.length > 0 ? row.photoUrls : fleetSummary.photoUrls,
    coverImageUrl: getFirstPhotoUrl(
      row.photoUrls.length > 0 ? row.photoUrls : fleetSummary.photoUrls,
    ),
    distanceKm: roundDistanceKm(distanceKm),
    searchMatchKind,
    contacts: {
      contactName,
      phone: row.phone ?? row.owner.phone,
      phoneName: row.phoneName,
      phone2: row.phone2,
      phone2Name: row.phone2Name,
      phone3: row.phone3,
      phone3Name: row.phone3Name,
      websiteUrl: row.websiteUrl,
      email: row.contactEmail ?? row.owner.email,
      whatsappUrl: normalizeWhatsappUrl(row.whatsappUrl),
      telegramUrl: normalizeTelegramProfileUrl(row.telegramUrl),
      vkUrl: normalizeVkProfileUrl(row.vkUrl),
      maxUrl: normalizeMaxProfileUrl(row.maxUrl),
      okUrl: normalizeOkProfileUrl(row.okUrl),
    },
    owner: {
      id: row.owner.id,
      firstName: row.owner.firstName,
      lastName: "",
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

export async function getPublicAttractionMapItems(
  query: PublicAttractionCatalogQuery,
): Promise<{ items: PublicAttractionMapItem[]; total: number }> {
  const result = await getStaticAttractionCatalog({
    ...query,
    page: 1,
    pageSize: 5000,
    allowLargePageSize: true,
  });

  return {
    items: result.entries.map(({ item }) => mapAttractionMapItem(item)),
    total: result.total,
  };
}

export async function getPublicTransferCatalog(
  query: PublicTransferCatalogQuery,
): Promise<PublicTransferCatalogResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize, query.allowLargePageSize === true);
  const searchQuery = query.query?.trim() ?? "";
  const bounds = query.bounds ?? null;
  const locationQuery = bounds ? "" : (query.location?.trim() ?? "");
  const transferType = query.transferType?.trim() ?? "";
  const radiusKm = parseRadiusKm(query.radiusKm);
  const sort = parseTransferSort(query.sort);
  const minPrice = parseMoney(query.minPrice);
  const maxPrice = parseMoney(query.maxPrice);
  const rankingNow = new Date();

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
        nearbyRadiusKm: locationQuery ? radiusKm : null,
      },
    };
  }

  const effectiveRows = rows.map((row) => applyPublishedTransferSnapshotToRow(row));
  const rankingStatsById = await getRankingStatsByEntity(
    "transfer",
    effectiveRows.map((row) => row.id),
    rankingNow,
  );
  const impressionsMedian = Math.max(
    1,
    median(effectiveRows.map((row) => rankingStatsById.get(row.id)?.last30Days.cardViews ?? 0)),
  );
  const searchFingerprint = buildSearchFingerprint({
    vertical: "transfer",
    query: searchQuery,
    location: (resolvedLocation?.id ?? locationQuery) || null,
    transferType,
    radiusKm,
    minPrice,
    maxPrice,
    sort,
    bounds,
  });

  const searchScores = getSearchScoreMap(searchQuery, effectiveRows, (item) => [
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

  const filtered = effectiveRows
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
      const primaryLocationMatch =
        Boolean(locationQuery) && (resolvedLocationMatch || textLocationMatch);
      const nearbyLocationMatch =
        Boolean(locationQuery) && center !== null && isWithinRadiusKm(distanceKm, radiusKm);
      const locationMatch = !locationQuery || primaryLocationMatch || nearbyLocationMatch;
      const searchMatchKind: CatalogSearchMatchKind =
        locationQuery && !primaryLocationMatch ? "nearby" : "primary";

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

      if (
        !isPointInsideBounds(
          point?.latitude ?? null,
          point?.longitude ?? null,
          bounds,
        )
      ) {
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
        distanceKm === null ? 0 : Math.max(0, (1 - distanceKm / Math.max(radiusKm * 2, 30)) * 20);
      const exactLocationScore =
        resolvedLocation && row.locationId === resolvedLocation.id ? 35 : 0;
      const relevance = searchScore * 70 + distanceScore + exactLocationScore;
      const stats = rankingStatsById.get(row.id)?.last30Days;
      const hasContactPath = Boolean(
        row.phone ||
          row.owner.phone ||
          row.whatsappUrl ||
          row.telegramUrl ||
          row.contactEmail ||
          row.receiveRequests,
      );
      const photoCount =
        row.photoUrls.length > 0 ? row.photoUrls.length : fleetSummary.photoUrls.length;
      const intentScore = getTransferIntentScore({
        hasSearch: searchQuery.length >= 2,
        searchScore,
        hasLocationQuery: Boolean(locationQuery),
        primaryLocationMatch,
        nearbyLocationMatch,
        transferTypeMatch: !transferType || normalizeText(row.transferType) === normalizeText(transferType),
        distanceKm,
        radiusKm,
      });
      const availabilityScore = getTransferAvailabilityScore({
        priceFrom,
        hasFleet: fleetSummary.fleet.length > 0,
        seats: fleetSummary.seats ?? row.seats,
        luggage: fleetSummary.luggage ?? row.luggage,
        hasContactPath,
        locationMatched: locationMatch,
      });
      const completenessScore = getTransferCompletenessScore({
        photoCount,
        fleetCount: fleetSummary.fleet.length,
        description: row.shortDescription ?? row.description,
        serviceArea: row.serviceArea,
        routeExamples: row.routeExamples,
        priceFrom,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        hasContactPath,
        seats: fleetSummary.seats ?? row.seats,
        luggage: fleetSummary.luggage ?? row.luggage,
        serviceTagsCount: normalizeTransferServiceTags(row.serviceTags).length,
      });
      const freshnessScore = getTransferFreshnessScore({
        now: rankingNow,
        createdAt: row.createdAt,
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
      });
      const ranking = scoreRankingCandidate(
        {
          id: row.id,
          ownerId: row.ownerId,
          vertical: "transfer",
          avgRating: Number(row.avgRating),
          reviewsCount: row.reviewsCount,
          createdAt: row.createdAt,
          publishedAt: row.publishedAt ?? row.createdAt,
          updatedAt: row.updatedAt,
          exposureCount: stats?.cardViews ?? 0,
          componentScores: {
            intentScore,
            availabilityScore,
            completenessScore,
            freshnessScore,
          },
          behaviorMetrics: {
            cardViews: stats?.cardViews ?? 0,
            favorites: stats?.favorites ?? 0,
            phoneClicks: stats?.phoneClicks ?? 0,
            messengerClicks: stats?.messengerClicks ?? 0,
            emailClicks: stats?.emailClicks ?? 0,
            createBookingClicks: stats?.createBookingClicks ?? 0,
          },
        },
        {
          now: rankingNow,
          searchFingerprint,
          impressionsMedian,
          targetTestImpressions: 100,
        },
      );

      return {
        id: row.id,
        ownerId: row.ownerId,
        row,
        distanceKm,
        searchMatchKind,
        relevance: ranking.finalScore || relevance,
        priceFrom,
        ranking,
        sortValues: {
          price: priceFrom,
          distance: distanceKm,
          createdAt: row.createdAt,
          publishedAt: row.publishedAt ?? row.createdAt,
          updatedAt: row.updatedAt,
        },
      };
    })
    .filter(
      (
        item,
      ): item is {
        id: string;
        ownerId: string;
        row: TransferRow;
        distanceKm: number | null;
        searchMatchKind: CatalogSearchMatchKind;
        relevance: number;
        priceFrom: number | null;
        ranking: ReturnType<typeof scoreRankingCandidate>;
        sortValues: {
          price: number | null;
          distance: number | null;
          createdAt: Date;
          publishedAt: Date;
          updatedAt: Date;
        };
      } => Boolean(item),
    );

  filtered.sort((left, right) => {
    if (locationQuery && left.searchMatchKind !== right.searchMatchKind) {
      return (
        getSearchMatchKindRank(left.searchMatchKind) - getSearchMatchKindRank(right.searchMatchKind)
      );
    }

    return compareRankedItems(left, right, sort);
  });

  const rankedRows =
    sort === "relevance"
      ? locationQuery
        ? [
            ...rankItems(
              filtered.filter((entry) => entry.searchMatchKind === "primary"),
              sort,
              { pageSize },
            ),
            ...rankItems(
              filtered.filter((entry) => entry.searchMatchKind !== "primary"),
              sort,
              { pageSize },
            ),
          ]
        : rankItems(filtered, sort, { pageSize })
      : filtered;

  const total = rankedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = rankedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    items: paged.map(({ row, distanceKm, searchMatchKind }) =>
      mapTransferCatalogItem(row, distanceKm, searchMatchKind),
    ),
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
      nearbyRadiusKm: locationQuery ? radiusKm : null,
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
  const extractedId = extractPropertyId(identifier);
  const id = isPublicEntityId(extractedId)
    ? extractedId
    : await findTransferIdByPublicSlug({ identifier });
  if (!id) {
    return null;
  }

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

  if (!row) {
    return null;
  }

  const item = mapTransferCatalogItem(applyPublishedTransferSnapshotToRow(row), null);
  const summary = await getExternalReviewSummaryWithFallback({
    entityType: "transfer",
    entityId: row.id,
    avgRating: item.avgRating,
    reviewsCount: item.reviewsCount,
  });

  return {
    ...item,
    avgRating: summary.avgRating,
    reviewsCount: summary.reviewsCount,
  };
}

export async function getOwnerPreviewTransferByIdentifier(
  identifier: string,
  ownerId: string,
): Promise<PublicTransferCatalogItem | null> {
  const extractedId = extractPropertyId(identifier);
  const id = isPublicEntityId(extractedId)
    ? extractedId
    : await findTransferIdByPublicSlug({ identifier, ownerId });
  if (!id) {
    return null;
  }

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

  if (!row) {
    return null;
  }

  const item = mapTransferCatalogItem(row, null);
  const summary = await getExternalReviewSummaryWithFallback({
    entityType: "transfer",
    entityId: row.id,
    avgRating: item.avgRating,
    reviewsCount: item.reviewsCount,
  });

  return {
    ...item,
    avgRating: summary.avgRating,
    reviewsCount: summary.reviewsCount,
  };
}

export async function getAttractionMarketplaceDirectoryData(): Promise<{
  attractionCategories: string[];
  attractionTotal: number;
  attractionLocationSuggestions: PublicMarketplaceLocationSuggestion[];
}> {
  const staticAttractions = await getStaticAttractions();
  const attractionCategories = Array.from(
    new Set(
      staticAttractions
        .map((item) => item.category)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));
  const attractionLocationCounts = new Map<
    string,
    { name: string; count: number; searchTerms: Set<string> }
  >();

  for (const item of staticAttractions) {
    const locationName = item.locationName;
    if (!locationName?.trim()) {
      continue;
    }

    const name = locationName.trim();
    const key = normalizeText(name);
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

  return {
    attractionCategories,
    attractionTotal: staticAttractions.length,
    attractionLocationSuggestions: Array.from(attractionLocationCounts.values())
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.name.localeCompare(right.name, "ru");
      })
      .map((item) => ({
        id: slugify(item.name) || normalizeText(item.name),
        name: item.name,
        subtitle: `Крым, Россия · ${item.count} ${pluralize(item.count, ["место досуга", "места досуга", "мест досуга"])}`,
        activeListingsCount: item.count,
        searchTerms: Array.from(item.searchTerms),
      })),
  };
}

export async function getMarketplaceDirectoryData(): Promise<{
  attractionCategories: string[];
  transferTypes: string[];
  locationNames: string[];
  attractionTotal: number;
  transferTotal: number;
  attractionLocationSuggestions: PublicMarketplaceLocationSuggestion[];
  transferLocationSuggestions: PublicMarketplaceLocationSuggestion[];
}> {
  const staticAttractions = await getStaticAttractions();
  const staticAttractionCategories = Array.from(
    new Set(
      staticAttractions
        .map((item) => item.category)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));
  let transfers: Array<{
    status: TransferStatus;
    pendingEditStatus: TransferStatus | null;
    publishedSnapshot: Prisma.JsonValue | null;
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
        status: true,
        pendingEditStatus: true,
        publishedSnapshot: true,
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
  const attractionLocationCounts = new Map<
    string,
    { name: string; count: number; searchTerms: Set<string> }
  >();
  const transferLocationCounts = new Map<
    string,
    { name: string; count: number; searchTerms: Set<string> }
  >();

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

  for (const rawItem of transfers) {
    const item = applyPublishedTransferSnapshotToRow(rawItem);
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
    attractionTotal: staticAttractions.length,
    transferTotal: transfers.length,
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
