import { randomUUID } from "node:crypto";
import { AttractionStatus, Prisma, TransferStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { haversineDistanceKm, resolveExcursionLocation } from "@/lib/excursion-directory";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import { extractPropertyId, slugify } from "@/lib/public-properties";

export type PublicAttractionCatalogQuery = {
  query?: string;
  location?: string;
  category?: string;
  radiusKm?: number;
  sort?: "relevance" | "distance_asc" | "newest" | "name_asc";
  page?: number;
  pageSize?: number;
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
};

export type PublicAttractionCatalogItem = {
  id: string;
  slug: string;
  path: string;
  title: string;
  category: string | null;
  locationName: string | null;
  districtName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  shortDescription: string | null;
  description: string | null;
  coverImageUrl: string | null;
  distanceKm: number | null;
  websiteUrl: string | null;
};

export type PublicTransferCatalogItem = {
  id: string;
  slug: string;
  path: string;
  title: string;
  transferType: string | null;
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
  shortDescription: string | null;
  description: string | null;
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

const attractionInclude = {
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
} satisfies Prisma.AttractionInclude;

const transferInclude = {
  owner: {
    select: {
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

type AttractionRow = Prisma.AttractionGetPayload<{ include: typeof attractionInclude }>;
type TransferRow = Prisma.TransferGetPayload<{ include: typeof transferInclude }>;

type Point = {
  latitude: number;
  longitude: number;
};

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

function parsePageSize(value: number | undefined): number {
  return Number.isFinite(value) ? Math.min(30, Math.max(1, Math.round(value ?? 30))) : 30;
}

function parseRadiusKm(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(5, Math.min(100, Math.round(value ?? 30))) : 30;
}

function parseMoney(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getFirstPhotoUrl(urls: string[] | null | undefined): string | null {
  return (urls ?? []).map((url) => url.trim()).find(Boolean) ?? null;
}

function getAttractionPoint(row: AttractionRow): Point | null {
  const latitude = toNumberOrNull(row.latitude) ?? toNumberOrNull(row.location?.latitude);
  const longitude = toNumberOrNull(row.longitude) ?? toNumberOrNull(row.location?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
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

export function buildAttractionSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "dostoprimechatelnost") || "dostoprimechatelnost";
  return `${base}-${id}`;
}

export function buildTransferSlug(title: string | null, id: string): string {
  const base = slugify(title ?? "transfer") || "transfer";
  return `${base}-${id}`;
}

export function buildPublicAttractionPath(item: { id: string; title: string | null }): string {
  return `/attractions/${buildAttractionSlug(item.title, item.id)}`;
}

export function buildPublicTransferPath(item: { id: string; title: string | null }): string {
  return `/transfers/${buildTransferSlug(item.title, item.id)}`;
}

function mapAttractionCatalogItem(
  row: AttractionRow,
  distanceKm: number | null,
): PublicAttractionCatalogItem {
  return {
    id: row.id,
    slug: buildAttractionSlug(row.title, row.id),
    path: buildPublicAttractionPath({ id: row.id, title: row.title }),
    title: row.title,
    category: row.category,
    locationName: row.location?.name ?? row.locationName,
    districtName: row.district?.name ?? null,
    address: row.address,
    latitude: toNumberOrNull(row.latitude) ?? toNumberOrNull(row.location?.latitude),
    longitude: toNumberOrNull(row.longitude) ?? toNumberOrNull(row.location?.longitude),
    shortDescription: row.shortDescription,
    description: row.description,
    coverImageUrl: getFirstPhotoUrl(row.photoUrls),
    distanceKm: distanceKm === null ? null : Number((distanceKm * 1.3).toFixed(1)),
    websiteUrl: row.websiteUrl,
  };
}

function mapTransferCatalogItem(
  row: TransferRow,
  distanceKm: number | null,
): PublicTransferCatalogItem {
  const fallbackContactName = `${row.owner.firstName} ${row.owner.lastName}`.trim();

  return {
    id: row.id,
    slug: buildTransferSlug(row.title, row.id),
    path: buildPublicTransferPath({ id: row.id, title: row.title }),
    title: row.title ?? "Трансфер без названия",
    transferType: row.transferType,
    vehicleClass: row.vehicleClass,
    vehicleModel: row.vehicleModel,
    seats: row.seats,
    luggage: row.luggage,
    locationName: row.location?.name ?? row.locationName,
    districtName: row.district?.name ?? null,
    serviceArea: row.serviceArea,
    routeExamples: row.routeExamples,
    latitude: toNumberOrNull(row.latitude) ?? toNumberOrNull(row.location?.latitude),
    longitude: toNumberOrNull(row.longitude) ?? toNumberOrNull(row.location?.longitude),
    priceFrom: toNumberOrNull(row.priceFrom),
    priceUnitLabel: row.priceUnitLabel,
    currency: row.currency,
    shortDescription: row.shortDescription,
    description: row.description,
    coverImageUrl: getFirstPhotoUrl(row.photoUrls),
    distanceKm: distanceKm === null ? null : Number((distanceKm * 1.3).toFixed(1)),
    contacts: {
      contactName: row.contactName ?? fallbackContactName,
      phone: row.phone ?? row.owner.phone,
      phone2: row.phone2,
      websiteUrl: row.websiteUrl,
      whatsappUrl: row.whatsappUrl,
      telegramUrl: row.telegramUrl,
      vkUrl: row.vkUrl,
      maxUrl: row.maxUrl,
      okUrl: row.okUrl,
    },
    owner: {
      firstName: row.owner.firstName,
      lastName: row.owner.lastName,
      avatarUrl: row.owner.avatarUrl,
    },
  };
}

function parseAttractionSort(value: PublicAttractionCatalogQuery["sort"]) {
  return value === "distance_asc" || value === "newest" || value === "name_asc"
    ? value
    : "relevance";
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
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const searchQuery = query.query?.trim() ?? "";
  const locationQuery = query.location?.trim() ?? "";
  const category = query.category?.trim() ?? "";
  const radiusKm = parseRadiusKm(query.radiusKm);
  const haversineRadiusKm = radiusKm / 1.3;
  const sort = parseAttractionSort(query.sort);

  const resolvedLocation = await resolveExcursionLocation({
    location: locationQuery,
  });
  const center =
    resolvedLocation?.latitude !== null &&
    resolvedLocation?.latitude !== undefined &&
    resolvedLocation?.longitude !== null &&
    resolvedLocation?.longitude !== undefined
      ? { latitude: resolvedLocation.latitude, longitude: resolvedLocation.longitude }
      : null;

  const rows = await db.attraction.findMany({
    where: {
      status: AttractionStatus.PUBLISHED,
      isPublishedVisible: true,
    },
    include: attractionInclude,
    orderBy: [{ updatedAt: "desc" }],
  });

  const searchScores = getSearchScoreMap(searchQuery, rows, (item) => [
    item.title,
    item.category,
    item.locationName,
    item.location?.name,
    item.district?.name,
    item.shortDescription,
    item.description,
  ]);

  const filtered = rows
    .map((row) => {
      const point = getAttractionPoint(row);
      const distanceKm = getDistanceKm(center, point);
      const locationMatch = resolvedLocation
        ? row.locationId === resolvedLocation.id ||
          normalizeText(row.locationName) === normalizeText(resolvedLocation.name) ||
          normalizeText(row.location?.name) === normalizeText(resolvedLocation.name) ||
          (distanceKm !== null && distanceKm <= haversineRadiusKm)
        : !locationQuery ||
          containsQuery(locationQuery, [
            row.locationName,
            row.location?.name,
            row.district?.name,
            row.address,
          ]);

      if (!locationMatch) {
        return null;
      }

      if (category && normalizeText(row.category) !== normalizeText(category)) {
        return null;
      }

      const searchScore = searchScores.get(row.id) ?? 0;
      if (
        searchQuery &&
        searchScore <= 0 &&
        !containsQuery(searchQuery, [
          row.title,
          row.category,
          row.locationName,
          row.location?.name,
          row.shortDescription,
          row.description,
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

      return { row, distanceKm, relevance };
    })
    .filter((item): item is { row: AttractionRow; distanceKm: number | null; relevance: number } =>
      Boolean(item),
    );

  filtered.sort((left, right) => {
    if (sort === "distance_asc") {
      if (left.distanceKm === null && right.distanceKm === null) return 0;
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm;
    }

    if (sort === "name_asc") {
      return left.row.title.localeCompare(right.row.title, "ru");
    }

    if (sort === "newest") {
      return right.row.updatedAt.getTime() - left.row.updatedAt.getTime();
    }

    const byRelevance = right.relevance - left.relevance;
    if (Math.abs(byRelevance) > 0.00001) return byRelevance;
    return right.row.updatedAt.getTime() - left.row.updatedAt.getTime();
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    items: paged.map(({ row, distanceKm }) => mapAttractionCatalogItem(row, distanceKm)),
    total,
    page: safePage,
    pageSize,
    totalPages,
    filters: {
      query: searchQuery || null,
      locationName: resolvedLocation?.name ?? (locationQuery || null),
      centerLat: center?.latitude ?? null,
      centerLng: center?.longitude ?? null,
      category: category || null,
      radiusKm,
      sort,
    },
  };
}

export async function getPublicTransferCatalog(
  query: PublicTransferCatalogQuery,
): Promise<PublicTransferCatalogResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
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
  const center =
    resolvedLocation?.latitude !== null &&
    resolvedLocation?.latitude !== undefined &&
    resolvedLocation?.longitude !== null &&
    resolvedLocation?.longitude !== undefined
      ? { latitude: resolvedLocation.latitude, longitude: resolvedLocation.longitude }
      : null;

  const rows = await db.transfer.findMany({
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

  const searchScores = getSearchScoreMap(searchQuery, rows, (item) => [
    item.title,
    item.transferType,
    item.vehicleClass,
    item.vehicleModel,
    item.locationName,
    item.location?.name,
    item.serviceArea,
    item.routeExamples,
    item.shortDescription,
    item.description,
  ]);

  const filtered = rows
    .map((row) => {
      const point = getTransferPoint(row);
      const distanceKm = getDistanceKm(center, point);
      const priceFrom = toNumberOrNull(row.priceFrom);
      const locationMatch = resolvedLocation
        ? row.locationId === resolvedLocation.id ||
          normalizeText(row.locationName) === normalizeText(resolvedLocation.name) ||
          normalizeText(row.location?.name) === normalizeText(resolvedLocation.name) ||
          (distanceKm !== null && distanceKm <= haversineRadiusKm)
        : !locationQuery ||
          containsQuery(locationQuery, [
            row.locationName,
            row.location?.name,
            row.district?.name,
            row.serviceArea,
            row.routeExamples,
          ]);

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
          row.vehicleClass,
          row.vehicleModel,
          row.locationName,
          row.location?.name,
          row.serviceArea,
          row.routeExamples,
          row.shortDescription,
          row.description,
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

      return { row, distanceKm, relevance, priceFrom };
    })
    .filter(
      (
        item,
      ): item is {
        row: TransferRow;
        distanceKm: number | null;
        relevance: number;
        priceFrom: number | null;
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
    }

    if (sort === "popular_desc") {
      const byReviews = right.row.reviewsCount - left.row.reviewsCount;
      if (byReviews !== 0) return byReviews;
    }

    const byRelevance = right.relevance - left.relevance;
    if (Math.abs(byRelevance) > 0.00001) return byRelevance;
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
      locationName: resolvedLocation?.name ?? (locationQuery || null),
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
  const id = extractPropertyId(identifier);
  const row = await db.attraction.findFirst({
    where: {
      id,
      status: AttractionStatus.PUBLISHED,
      isPublishedVisible: true,
    },
    include: attractionInclude,
  });

  return row ? mapAttractionCatalogItem(row, null) : null;
}

export async function getPublicTransferByIdentifier(
  identifier: string,
): Promise<PublicTransferCatalogItem | null> {
  const id = extractPropertyId(identifier);
  const row = await db.transfer.findFirst({
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

  return row ? mapTransferCatalogItem(row, null) : null;
}

export async function getMarketplaceDirectoryData(): Promise<{
  attractionCategories: string[];
  transferTypes: string[];
  locationNames: string[];
}> {
  const [attractions, transfers] = await Promise.all([
    db.attraction.findMany({
      where: { status: AttractionStatus.PUBLISHED, isPublishedVisible: true },
      select: {
        category: true,
        locationName: true,
        location: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    db.transfer.findMany({
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
    }),
  ]);

  const attractionCategories = new Set<string>();
  const transferTypes = new Set<string>();
  const locationNames = new Set<string>();

  for (const item of attractions) {
    if (item.category?.trim()) attractionCategories.add(item.category.trim());
    const locationName = item.location?.name ?? item.locationName;
    if (locationName?.trim()) locationNames.add(locationName.trim());
  }

  for (const item of transfers) {
    if (item.transferType?.trim()) transferTypes.add(item.transferType.trim());
    const locationName = item.location?.name ?? item.locationName;
    if (locationName?.trim()) locationNames.add(locationName.trim());
  }

  return {
    attractionCategories: [...attractionCategories].sort((a, b) => a.localeCompare(b, "ru")),
    transferTypes: [...transferTypes].sort((a, b) => a.localeCompare(b, "ru")),
    locationNames: [...locationNames].sort((a, b) => a.localeCompare(b, "ru")),
  };
}

export async function createAttractionDraft(input: {
  title?: string | null;
  createdByLogin?: string | null;
}) {
  const created = await db.attraction.create({
    data: {
      title: input.title?.trim() || "Новая достопримечательность",
      slug: buildFallbackSlug("attraction"),
      createdByLogin: input.createdByLogin ?? null,
    },
    select: {
      id: true,
      title: true,
    },
  });

  return db.attraction.update({
    where: { id: created.id },
    data: {
      slug: buildAttractionSlug(created.title, created.id),
    },
  });
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
