import {
  CustomLocationStatus,
  MediaType,
  PetsPolicy,
  Prisma,
  PropertyStatus,
  ReviewStatus,
} from "@prisma/client";
import { cache } from "react";
import {
  crimeaLocationById,
  crimeaLocations,
  propertyTypeById,
  propertyTypes,
} from "@/lib/constants";
import {
  calculateDistanceKm,
  isWithinRadiusKm,
  NEARBY_CATALOG_RADIUS_KM,
  roundDistanceKm,
  type CatalogGeoPoint,
  type CatalogSearchMatchKind,
} from "@/lib/catalog-radius";
import { resolveCrimeaLocationCenter } from "@/lib/crimea-location-centers";
import { getKnownCrimeaLocationCenter } from "@/lib/crimea-location-coordinates";
import { findCrimeaSettlementById, findCrimeaSettlementByName } from "@/lib/crimea-settlements";
import { db } from "@/lib/db";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import { normalizeLocationName, searchLocationDirectory } from "@/lib/location-directory";
import { normalizeLegacyFotoImageUrl, serializeMedia } from "@/lib/media";
import {
  addDays,
  calculateRoomStayPrice,
  normalizeRoomPriceType,
  parseIsoDate,
  toIsoDate,
  type RoomPriceType,
} from "@/lib/pricing";
import { cleanFaqItems, cleanPublicText, cleanPublicTextList } from "@/lib/public-content-quality";
import {
  parsePublishedPropertySnapshot,
  shouldUsePublishedSnapshot,
  type PublishedPropertySnapshot,
} from "@/lib/property-public-snapshot";
import { serializeReview } from "@/lib/reviews";
import { normalizeRoomTitle } from "@/lib/room-title";
import { serializeRoom, roomInclude } from "@/lib/rooms";
import { buildPublishedPropertyVisibilityWhere } from "@/lib/public-visibility";
import type { FaqItem } from "@/types/excursions";

// Public catalog domain layer:
// - builds SEO paths/slugs
// - resolves fuzzy location filters
// - reads only published properties for guest-facing pages/API
type ResolvedLocation = {
  id: string;
  name: string;
};

export type PublicCatalogQuery = {
  location?: string;
  locationId?: string;
  type?: string;
  query?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  hasPhotos?: boolean;
  hasReviews?: boolean;
  familyFriendly?: boolean;
  petsAllowed?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "rating_desc" | "popular_desc";
  page?: number;
  pageSize?: number;
  trackSearchImpressions?: boolean;
  allowLargePageSize?: boolean;
};

export type PublicCatalogRoomPreview = {
  id: string;
  title: string;
  beds: number;
  extraBeds: number;
  roomsCount: number;
  areaSqm: number | null;
  maxGuests: number;
  priceFrom: number | null;
  priceType: RoomPriceType | null;
  currency: string | null;
};

export type PublicCatalogItem = {
  id: string;
  slug: string;
  path: string;
  createdAt: string;
  name: string;
  type: string | null;
  typeLabel: string | null;
  description: string | null;
  starRating: number;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  searchMatchKind: CatalogSearchMatchKind;
  checkInFrom: string | null;
  childrenAllowed: boolean;
  petsPolicy: PetsPolicy | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  roomPreviews: PublicCatalogRoomPreview[];
  activeRoomsCount: number;
  minNightPrice: number | null;
  minNightPriceType: RoomPriceType | null;
  currency: string | null;
  stayContext: {
    checkIn: string;
    checkOut: string;
    nights: number;
    mode: "selected" | "today";
  };
  stayPrice: {
    total: number;
    currency: string;
    nights: number;
    nightly: number;
    totalNightly: number;
    priceType: RoomPriceType | "MIXED";
    roomTitle: string | null;
  } | null;
  roomSnapshot: {
    title: string;
    beds: number;
    extraBeds: number;
    roomsCount: number;
    areaSqm: number | null;
  } | null;
  amenityHighlights: string[];
  seaDistanceLabel: string | null;
  avgRating: number;
  reviewsCount: number;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

export type PublicCatalogResult = {
  items: PublicCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    locationId: string | null;
    locationName: string | null;
    type: string | null;
    query: string | null;
    minPrice: number | null;
    maxPrice: number | null;
    minRating: number | null;
    hasPhotos: boolean;
    hasReviews: boolean;
    familyFriendly: boolean;
    petsAllowed: boolean;
    sort: "relevance" | "price_asc" | "price_desc" | "rating_desc" | "popular_desc";
    nearbyRadiusKm: number | null;
  };
};

export type PublicPropertyCard = {
  id: string;
  slug: string;
  path: string;
  name: string | null;
  type: string | null;
  typeLabel: string | null;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  faqItems: FaqItem[];
  media: ReturnType<typeof serializeMedia>[];
  amenities: Array<{ id: string; name: string; category: string }>;
  customAmenities: string[];
  amenityHighlights: string[];
  amenityGroups: {
    property: string[];
    rooms: string[];
    combined: string[];
  };
  contacts: {
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
    receiveRequests: boolean;
  };
  rules: {
    checkInFrom: string | null;
    checkOutUntil: string | null;
    childrenAllowed: boolean | null;
    childrenMinAge: number | null;
    petsPolicy: "FORBIDDEN" | "ON_REQUEST" | "ALLOWED" | null;
    smokingPolicy: "FORBIDDEN" | "ON_REQUEST" | "ALLOWED" | null;
    quietHoursEnabled: boolean | null;
    quietHoursFrom: string | null;
    quietHoursTo: string | null;
    parkingInfo: string | null;
    mealOptions: string | null;
    prepaymentPolicy: string | null;
  };
  classification: {
    registryNumber: string | null;
    registryDetails: string | null;
    classificationApplicable: boolean;
  };
  rooms: ReturnType<typeof serializeRoom>[];
  activeRoomsCount: number;
  minNightPrice: number | null;
  minNightPriceType: RoomPriceType | null;
  currency: string | null;
  avgRating: number;
  reviewsCount: number;
  reviews: ReturnType<typeof serializeReview>[];
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

const cyrillicToLatinMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const addressNormalizationRules: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bул\b/g, "улица"],
  [/\bпр-?т\b|\bпросп\b/g, "проспект"],
  [/\bпер\b/g, "переулок"],
  [/\bмкр\b|\bмкрн\b/g, "микрорайон"],
  [/\bд\b/g, "дом"],
  [/\bкорп\b/g, "корпус"],
  [/\bкв\b/g, "квартира"],
];

// Stable transliteration keeps slug URLs human-readable and deterministic.
function transliterateToLatin(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join("");
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameCatalogLocation(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftKey = normalizeLocationName(left ?? "");
  const rightKey = normalizeLocationName(right ?? "");
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function getCatalogLocationPoint(input: {
  latitude: number | null;
  longitude: number | null;
  locationId: string | null;
  locationName: string | null;
}): CatalogGeoPoint | null {
  if (
    input.latitude !== null &&
    input.longitude !== null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  const knownCenter =
    getKnownCrimeaLocationCenter(input.locationName) ??
    getKnownCrimeaLocationCenter(input.locationId);

  return knownCenter ? { latitude: knownCenter.latitude, longitude: knownCenter.longitude } : null;
}

function getSearchMatchKindRank(kind: CatalogSearchMatchKind): number {
  return kind === "primary" ? 0 : 1;
}

function normalizeAddressSearchText(value: string): string {
  let normalized = normalizeSearchText(value).replace(/-/g, " ");

  for (const [pattern, replacement] of addressNormalizationRules) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function toSearchVariants(value: string): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);
  const transliterated = normalizeSearchText(transliterateToLatin(normalized));
  if (transliterated) {
    variants.add(transliterated);
  }

  const normalizedAddress = normalizeAddressSearchText(normalized);
  if (normalizedAddress) {
    variants.add(normalizedAddress);

    const transliteratedAddress = normalizeSearchText(transliterateToLatin(normalizedAddress));
    if (transliteratedAddress) {
      variants.add(transliteratedAddress);
    }
  }

  return Array.from(variants);
}

function toSearchFieldVariants(value: string, options?: { isAddress?: boolean }): string[] {
  // Build multiple text variants so "Yalta", "ялта", translit, and address abbreviations
  // can still match the same listing field.
  const normalized = options?.isAddress
    ? normalizeAddressSearchText(value)
    : normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);
  const transliterated = normalizeSearchText(transliterateToLatin(normalized));
  if (transliterated) {
    variants.add(transliterated);
  }

  if (!options?.isAddress) {
    const asAddress = normalizeAddressSearchText(normalized);
    if (asAddress) {
      variants.add(asAddress);
      const transliteratedAddress = normalizeSearchText(transliterateToLatin(asAddress));
      if (transliteratedAddress) {
        variants.add(transliteratedAddress);
      }
    }
  }

  return Array.from(variants);
}

function getTokenMatchScore(queryVariants: string[], candidateVariants: string[]): number {
  let best = 0;

  for (const query of queryVariants) {
    if (!query) {
      continue;
    }

    for (const candidate of candidateVariants) {
      if (!candidate) {
        continue;
      }

      if (candidate === query) {
        best = Math.max(best, 1.35);
        continue;
      }

      if (candidate.startsWith(query)) {
        best = Math.max(best, 1.1);
        continue;
      }

      if (candidate.split(" ").some((token) => token.startsWith(query))) {
        best = Math.max(best, 0.95);
        continue;
      }

      if (candidate.includes(query)) {
        best = Math.max(best, 0.75);
      }
    }
  }

  return best;
}

type WeightedSearchField = {
  value: string | null | undefined;
  weight: number;
  isAddress?: boolean;
};

function getWeightedFieldTokenScore(
  queryVariants: string[],
  fields: WeightedSearchField[],
): number {
  let best = 0;

  for (const field of fields) {
    if (!field.value) {
      continue;
    }

    const candidateVariants = toSearchFieldVariants(field.value, {
      isAddress: field.isAddress === true,
    });
    if (candidateVariants.length === 0) {
      continue;
    }

    // We keep the best weighted field score instead of summing all fields
    // to avoid over-rewarding long descriptions with repeated tokens.
    const tokenScore = getTokenMatchScore(queryVariants, candidateVariants);
    const phraseBonus = queryVariants.reduce((bonus, query) => {
      if (!query) {
        return bonus;
      }

      if (candidateVariants.some((candidate) => candidate === query)) {
        return Math.max(bonus, 0.4);
      }
      if (candidateVariants.some((candidate) => candidate.startsWith(query))) {
        return Math.max(bonus, 0.24);
      }
      if (candidateVariants.some((candidate) => candidate.includes(query))) {
        return Math.max(bonus, 0.14);
      }

      return bonus;
    }, 0);

    best = Math.max(best, (tokenScore + phraseBonus) * field.weight);
  }

  return best;
}

export function slugify(input: string): string {
  return transliterateToLatin(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Public slugs are kept human-readable for SEO; legacy id-suffixed URLs are still resolved.
export function buildPropertySlug(name: string | null, _id?: string): string {
  void _id;
  const base = slugify(name ?? "obekt") || "obekt";
  return base;
}

const publicEntityIdPatterns = [
  /^c[a-z0-9]{10,}$/i,
  /^(?:property|excursion|attraction|transfer)_[a-z0-9]{10,}$/i,
  /^demo_(?:property|excursion|tour|attraction|transfer)_\d+$/i,
];

export function isPublicEntityId(value: string): boolean {
  return publicEntityIdPatterns.some((pattern) => pattern.test(value));
}

// Supports both raw id and slug with trailing id segment, including seeded demo ids.
export function extractPropertyId(identifier: string): string {
  const clean = identifier.trim();
  if (isPublicEntityId(clean)) {
    return clean;
  }

  const parts = clean.split("-");
  const last = parts[parts.length - 1] ?? "";
  if (isPublicEntityId(last)) {
    return last;
  }

  return clean;
}

export function buildPublicPropertyPath(property: {
  id: string;
  locationId: string | null;
  name: string | null;
}): string {
  const location = property.locationId ?? "crimea";
  return `/crimea/${location}/${buildPropertySlug(property.name, property.id)}`;
}

// Resolves location from id/exact name/fuzzy name. Returns null if filter should be ignored.
async function resolveLocation(input: {
  locationId?: string;
  location?: string;
}): Promise<ResolvedLocation | null> {
  // Resolution order is strict: built-in id -> approved custom id -> exact text -> fuzzy.
  // This keeps deterministic URLs while still being forgiving for user input.
  const byId =
    input.locationId && crimeaLocationById[input.locationId]
      ? { id: input.locationId, name: crimeaLocationById[input.locationId].name }
      : null;

  if (byId) {
    return byId;
  }

  const officialById = await findCrimeaSettlementById(input.locationId);
  if (officialById) {
    return { id: officialById.id, name: officialById.name };
  }

  if (input.locationId) {
    const approvedCustomById = await db.customLocation.findFirst({
      where: {
        slug: input.locationId,
        status: CustomLocationStatus.APPROVED,
      },
      select: {
        slug: true,
        name: true,
      },
    });

    if (approvedCustomById) {
      return { id: approvedCustomById.slug, name: approvedCustomById.name };
    }
  }

  const value = input.location?.trim();
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();
  const exact = crimeaLocations.find(
    (location) => location.id.toLowerCase() === lower || location.name.toLowerCase() === lower,
  );
  if (exact) {
    return exact;
  }

  const exactOfficialSettlement = await findCrimeaSettlementByName(value);
  if (exactOfficialSettlement) {
    return { id: exactOfficialSettlement.id, name: exactOfficialSettlement.name };
  }

  const exactApprovedCustomByName = await db.customLocation.findFirst({
    where: {
      normalizedName: normalizeLocationName(value),
      status: CustomLocationStatus.APPROVED,
    },
    select: {
      slug: true,
      name: true,
    },
  });
  if (exactApprovedCustomByName) {
    return {
      id: exactApprovedCustomByName.slug,
      name: exactApprovedCustomByName.name,
    };
  }

  if (value.length >= 2) {
    const [best] = await searchLocationDirectory(value, 1);
    if (best) {
      return { id: best.id, name: best.name };
    }
  }

  return null;
}

// Catalog cards show a single "from price", calculated as global min price across room periods.
function getMinPriceByRooms(
  rooms: Array<{
    prices: Array<{
      price: Prisma.Decimal | number;
      priceType?: RoomPriceType | string | null;
      currency: string;
    }>;
  }>,
): {
  minNightPrice: number | null;
  minNightPriceType: RoomPriceType | null;
  currency: string | null;
} {
  let minNightPrice: number | null = null;
  let minNightPriceType: RoomPriceType | null = null;
  let currency: string | null = null;

  for (const room of rooms) {
    for (const priceItem of room.prices) {
      const value = Number(priceItem.price);
      if (minNightPrice === null || value < minNightPrice) {
        minNightPrice = value;
        minNightPriceType = normalizeRoomPriceType(priceItem.priceType);
        currency = priceItem.currency;
      }
    }
  }

  return { minNightPrice, minNightPriceType, currency };
}

type CatalogStayRange = {
  checkIn: string;
  checkOut: string;
  nights: number;
  mode: "selected" | "today";
};

type CatalogRoomPricePoint = {
  dateFrom: string;
  dateTo: string;
  price: number;
  priceType: RoomPriceType;
  minGuests: number | null;
  currency: string;
};

type CatalogRoomForStay = {
  title: string;
  beds: number;
  extraBeds: number;
  prices: CatalogRoomPricePoint[];
};

type CatalogRoomCard = CatalogRoomForStay & {
  id: string;
  roomsCount: number;
  areaSqm: Prisma.Decimal | number | null;
};

export function getPublicCatalogSnapshot(input: {
  status: PropertyStatus;
  pendingEditStatus: PropertyStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
}): PublishedPropertySnapshot | null {
  return shouldUsePublishedSnapshot(input)
    ? parsePublishedPropertySnapshot(input.publishedSnapshot)
    : null;
}

export function resolvePublicCatalogDisplayState(property: {
  status: PropertyStatus;
  pendingEditStatus: PropertyStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
  name: string | null;
  type: string | null;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  seaDistance: string | null;
  latitude: Prisma.Decimal | number | null;
  longitude: Prisma.Decimal | number | null;
  description: string | null;
  checkInFrom: string | null;
  childrenAllowed: boolean | null;
  petsPolicy: PetsPolicy | null;
  starRating: number | null;
  media: Array<{ url: string; type: MediaType }>;
  rooms: Array<{
    id: string;
    title: string;
    beds: number;
    extraBeds: number;
    roomsCount?: number | null;
    areaSqm: Prisma.Decimal | number | null;
    prices: Array<{
      dateFrom: Date;
      dateTo: Date;
      price: Prisma.Decimal | number;
      priceType?: RoomPriceType | string | null;
      minGuests: number | null;
      currency: string;
    }>;
  }>;
}) {
  const snapshot = getPublicCatalogSnapshot({
    status: property.status,
    pendingEditStatus: property.pendingEditStatus,
    publishedSnapshot: property.publishedSnapshot,
  });

  const rooms: CatalogRoomCard[] = snapshot
    ? snapshot.rooms.map((room) => ({
        id: room.id,
        title: normalizeRoomTitle(room.title),
        beds: room.beds,
        extraBeds: room.extraBeds,
        roomsCount: Math.max(1, room.roomsCount ?? 1),
        areaSqm: room.areaSqm,
        prices: room.prices.map((price) => ({
          dateFrom: price.dateFrom,
          dateTo: price.dateTo,
          price: price.price,
          priceType: normalizeRoomPriceType(price.priceType),
          minGuests: price.minGuests ?? null,
          currency: price.currency,
        })),
      }))
    : property.rooms.map((room) => ({
        id: room.id,
        title: normalizeRoomTitle(room.title),
        beds: room.beds,
        extraBeds: room.extraBeds,
        roomsCount: Math.max(1, room.roomsCount ?? 1),
        areaSqm: room.areaSqm,
        prices: room.prices.map((price) => ({
          dateFrom: toIsoDate(price.dateFrom),
          dateTo: toIsoDate(price.dateTo),
          price: Number(price.price),
          priceType: normalizeRoomPriceType(price.priceType),
          minGuests: price.minGuests ?? null,
          currency: price.currency,
        })),
      }));

  return {
    snapshot,
    name: snapshot?.property.name ?? property.name,
    type: snapshot?.property.type ?? property.type,
    locationId: snapshot?.property.locationId ?? property.locationId,
    locationName: snapshot?.property.locationName ?? property.locationName,
    address: snapshot?.property.address ?? property.address,
    seaDistance: snapshot?.property.seaDistance ?? property.seaDistance,
    latitude:
      snapshot?.property.latitude ??
      (property.latitude === null ? null : Number(property.latitude)),
    longitude:
      snapshot?.property.longitude ??
      (property.longitude === null ? null : Number(property.longitude)),
    description: cleanPublicText(snapshot?.property.description ?? property.description, {
      minLength: 10,
      maxLength: 5000,
      preserveLineBreaks: true,
    }),
    checkInFrom: snapshot?.property.checkInFrom ?? property.checkInFrom,
    childrenAllowed: snapshot?.property.childrenAllowed ?? property.childrenAllowed,
    petsPolicy: snapshot?.property.petsPolicy ?? property.petsPolicy,
    starRating: snapshot?.property.starRating ?? property.starRating ?? 0,
    imageUrls: (snapshot ? snapshot.media : property.media)
      .filter((media) => media.type === MediaType.IMAGE)
      .map((media) => media.url)
      .map((url) => normalizeLegacyFotoImageUrl(url))
      .filter((url) => url.trim().length > 0),
    rooms,
  };
}

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveCatalogStayRange(checkIn?: string, checkOut?: string): CatalogStayRange {
  const parsedCheckIn = checkIn ? parseIsoDate(checkIn) : null;
  const parsedCheckOut = checkOut ? parseIsoDate(checkOut) : null;

  if (parsedCheckIn && parsedCheckOut && parsedCheckOut > parsedCheckIn) {
    const nights = Math.floor((parsedCheckOut.getTime() - parsedCheckIn.getTime()) / 86400000);
    return {
      checkIn: toIsoDate(parsedCheckIn),
      checkOut: toIsoDate(parsedCheckOut),
      nights,
      mode: "selected",
    };
  }

  const today = parseIsoDate(getLocalTodayIso());
  if (!today) {
    // Last-resort deterministic fallback keeps downstream pricing logic safe.
    return {
      checkIn: "1970-01-01",
      checkOut: "1970-01-02",
      nights: 1,
      mode: "today",
    };
  }

  return {
    // When user does not provide a valid range, catalog still computes "price per 1 night from today".
    checkIn: toIsoDate(today),
    checkOut: toIsoDate(addDays(today, 1)),
    nights: 1,
    mode: "today",
  };
}

function getMaxRequiredMinGuestsForStay(
  prices: CatalogRoomPricePoint[],
  checkIn: string,
  nights: number,
): number {
  const from = parseIsoDate(checkIn);
  if (!from || nights <= 0) {
    return 1;
  }

  let requiredMinGuests = 1;
  for (let index = 0; index < nights; index += 1) {
    const dayIso = toIsoDate(addDays(from, index));
    const period = prices.find((price) => price.dateFrom <= dayIso && price.dateTo >= dayIso);
    if (period?.minGuests && period.minGuests > requiredMinGuests) {
      requiredMinGuests = period.minGuests;
    }
  }

  return requiredMinGuests;
}

function getBestStayPriceByRooms(input: {
  rooms: CatalogRoomForStay[];
  checkIn: string;
  checkOut: string;
  guests: number;
}): {
  total: number;
  currency: string;
  nights: number;
  nightly: number;
  totalNightly: number;
  priceType: RoomPriceType | "MIXED";
  roomTitle: string | null;
} | null {
  const guests = Math.max(1, Math.floor(input.guests));
  let best: {
    total: number;
    currency: string;
    nights: number;
    unitTotal: number;
    priceType: RoomPriceType | "MIXED";
    roomTitle: string | null;
  } | null = null;

  for (const room of input.rooms) {
    // A room is eligible only if it can physically fit guests and has complete
    // pricing for the requested range.
    const roomCapacity = room.beds + room.extraBeds;
    if (guests > roomCapacity || room.prices.length === 0) {
      continue;
    }

    const calculation = calculateRoomStayPrice({
      prices: room.prices,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests,
    });

    if (!calculation.ok || calculation.nights <= 0) {
      continue;
    }

    const requiredMinGuests = getMaxRequiredMinGuestsForStay(
      room.prices,
      input.checkIn,
      calculation.nights,
    );
    if (guests < requiredMinGuests) {
      continue;
    }

    if (!best || calculation.total < best.total) {
      best = {
        total: calculation.total,
        currency: calculation.currency,
        nights: calculation.nights,
        unitTotal: calculation.unitTotal,
        priceType: calculation.priceType,
        roomTitle: normalizeRoomTitle(room.title) || null,
      };
    }
  }

  if (!best) {
    return null;
  }

  return {
    total: best.total,
    currency: best.currency,
    nights: best.nights,
    nightly: Math.round((best.priceType === "MIXED" ? best.total : best.unitTotal) / best.nights),
    totalNightly: Math.round(best.total / best.nights),
    priceType: best.priceType,
    roomTitle: best.roomTitle,
  };
}

function normalizeAmenityText(value: string): string {
  return cleanPublicText(value.replace(/\s+/g, " ").trim(), { minLength: 2, maxLength: 80 }) ?? "";
}

const MAX_KEY_AMENITIES_PER_PROPERTY = 4;

const amenityPriorityPatterns: RegExp[] = [
  /\bwi[\s-]?fi\b|вай[\s-]?фай|интернет/i,
  /парков/i,
  /кондиц|air[\s-]?condition/i,
  /кухн|мини[\s-]?кух/i,
  /бассейн/i,
  /вид на море|панорам/i,
  /завтрак|breakfast/i,
  /трансфер|transfer|shuttle/i,
  /живот|pets?|pet-friendly/i,
  /балкон|террас/i,
  /стирал|washer|laundry/i,
];

function shouldSkipAmenityForHighlights(value: string): boolean {
  if (/до\s*моря|первая\s+линия/i.test(value)) {
    return true;
  }

  // Base sanitary facilities do not help conversion in catalog cards.
  return /писсуар|унитаз|туалет|раковин|sink|urinal|toilet|душев|ванн(а|ой|у)?|shower|bath|сануз/i.test(
    value,
  );
}

function getAmenityPriority(value: string): number {
  const normalized = value.toLowerCase();
  const index = amenityPriorityPatterns.findIndex((pattern) => pattern.test(normalized));
  return index === -1 ? 999 : index;
}

function dedupeRoomAmenityNames(names: string[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const rawName of names) {
    const value = normalizeAmenityText(rawName);
    if (!value || shouldSkipAmenityForHighlights(value)) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(value);
  }

  return values;
}

function sortAmenityValuesForCatalog(values: string[]): string[] {
  return dedupeRoomAmenityNames(values)
    .map((value, order) => ({
      value,
      order,
      priority: getAmenityPriority(value),
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.order - right.order;
    })
    .map((entry) => entry.value);
}

function collectAmenityHighlights(input: {
  propertyAmenityNames: string[];
  propertyCustomAmenityNames: string[];
  roomAmenityNamesByRoom: string[][];
}): string[] {
  type AmenityStat = {
    value: string;
    roomHits: number;
    priority: number;
    order: number;
  };

  const byKey = new Map<string, AmenityStat>();
  let order = 0;

  for (const roomAmenityNames of input.roomAmenityNamesByRoom) {
    const roomValues = dedupeRoomAmenityNames(roomAmenityNames);
    for (const value of roomValues) {
      const key = value.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.roomHits += 1;
        continue;
      }
      byKey.set(key, {
        value,
        roomHits: 1,
        priority: getAmenityPriority(value),
        order,
      });
      order += 1;
    }
  }

  const propertySource = [...input.propertyAmenityNames, ...input.propertyCustomAmenityNames];
  for (const rawValue of propertySource) {
    const value = normalizeAmenityText(rawValue);
    if (!value || shouldSkipAmenityForHighlights(value)) {
      continue;
    }
    const key = value.toLowerCase();
    if (byKey.has(key)) {
      continue;
    }
    byKey.set(key, {
      value,
      roomHits: 0,
      priority: getAmenityPriority(value),
      order,
    });
    order += 1;
  }

  const entries = Array.from(byKey.values());
  const roomCount = input.roomAmenityNamesByRoom.length;
  const repeatedThreshold = roomCount > 1 ? 2 : 1;

  // First prefer amenities repeated across rooms (strong property signal),
  // then fill remaining slots with high-priority single-room/global amenities.
  const repeatedFirst = entries
    .filter((entry) => entry.roomHits >= repeatedThreshold)
    .sort((left, right) => {
      if (right.roomHits !== left.roomHits) {
        return right.roomHits - left.roomHits;
      }
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.order - right.order;
    });

  const fallback = entries
    .filter((entry) => !repeatedFirst.includes(entry))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      if (right.roomHits !== left.roomHits) {
        return right.roomHits - left.roomHits;
      }
      return left.order - right.order;
    });

  return [...repeatedFirst, ...fallback]
    .map((entry) => entry.value)
    .slice(0, MAX_KEY_AMENITIES_PER_PROPERTY);
}

function stripPaidAmenitySuffix(value: string): string {
  return value.replace(/\s*\((?:платно|paid)\)\s*$/i, "").trim();
}

function dedupeAllAmenityValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = normalizeAmenityText(stripPaidAmenitySuffix(rawValue));
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result.sort((left, right) => left.localeCompare(right, "ru"));
}

function collectPropertyAmenityGroups(input: {
  propertyAmenityNames: string[];
  propertyCustomAmenityNames: string[];
  roomAmenityNamesByRoom: string[][];
}): {
  property: string[];
  rooms: string[];
  combined: string[];
} {
  const property = dedupeAllAmenityValues([
    ...input.propertyAmenityNames,
    ...input.propertyCustomAmenityNames,
  ]);
  const rooms = dedupeAllAmenityValues(input.roomAmenityNamesByRoom.flat());
  const combined = dedupeAllAmenityValues([...property, ...rooms]);

  return {
    property,
    rooms,
    combined,
  };
}

function pickRepresentativeRoom(
  rooms: Array<{
    title: string;
    beds: number;
    extraBeds: number;
    roomsCount?: number | null;
    areaSqm: Prisma.Decimal | number | null;
  }>,
  preferredTitle: string | null,
): {
  title: string;
  beds: number;
  extraBeds: number;
  roomsCount: number;
  areaSqm: number | null;
} | null {
  if (rooms.length === 0) {
    return null;
  }

  const normalizedPreferredTitle = preferredTitle ? normalizeRoomTitle(preferredTitle) : "";
  const preferred = normalizedPreferredTitle
    ? rooms.find((room) => normalizeRoomTitle(room.title) === normalizedPreferredTitle)
    : null;
  const room = preferred ?? rooms[0];
  if (!room) {
    return null;
  }

  return {
    title: normalizeRoomTitle(room.title),
    beds: room.beds,
    extraBeds: room.extraBeds,
    roomsCount: Math.max(1, room.roomsCount ?? 1),
    areaSqm: room.areaSqm === null ? null : Number(room.areaSqm),
  };
}

function extractSeaDistanceLabel(customAmenities: Array<{ name: string }>): string | null {
  for (const item of customAmenities) {
    const value = normalizeAmenityText(item.name);
    if (!value) {
      continue;
    }

    if (/первая\s+линия/i.test(value)) {
      return "Первая линия у моря";
    }

    const distanceMatch = value.match(/до\s*моря[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(км|м)\b/i);
    if (distanceMatch) {
      const amount = distanceMatch[1].replace(",", ".");
      const unit = distanceMatch[2].toLowerCase();
      return `До моря: ${amount} ${unit}`;
    }

    if (/до\s*моря/i.test(value)) {
      return value.length > 48 ? `${value.slice(0, 45)}...` : value;
    }
  }

  return null;
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

function getCatalogRankScore(property: {
  id: string;
  avgRating: Prisma.Decimal;
  reviewsCount: number;
  searchImpressions: number;
  profileViews: number;
  favoritesCount: number;
  media: Array<{ roomId: string | null }>;
  description: string | null;
  updatedAt: Date;
}): number {
  const rating = Number(property.avgRating);
  const { reviewsCount, searchImpressions, profileViews, favoritesCount } = property;

  // 1. Rating authority — credibility factor reduces weight for unreviewed objects.
  //    0 reviews → 30 % weight; trust grows with sqrt(reviewsCount / 20), caps at 100 %.
  const credibility = Math.min(1, 0.3 + 0.7 * Math.sqrt(reviewsCount / 20));
  const ratingScore = rating > 0 ? rating * 100 * credibility : 0;

  // 2. Review volume — logarithmic so 100 reviews isn't 100× better than 1.
  const reviewScore = Math.log1p(reviewsCount) * 12;

  // 3. Engagement signals — all logarithmic; values normalised so growth is gradual.
  const impressionsScore = Math.log1p(searchImpressions / 100) * 8;
  const viewsScore = Math.log1p(profileViews / 20) * 6;
  const favoritesScore = Math.log1p(favoritesCount) * 8;

  // 4. Content completeness bonus — objects with photos and description rank higher.
  const hasMainPhoto = property.media.some((m) => m.roomId === null);
  const completeness = (hasMainPhoto ? 8 : 0) + (property.description ? 4 : 0);

  // 5. Freshness — small bonus for recently updated listings, decays over ~2 months.
  const daysSinceUpdate = (Date.now() - property.updatedAt.getTime()) / 86_400_000;
  const freshness = Math.max(0, 5 - Math.log1p(daysSinceUpdate / 7) * 2);

  // 6. Daily rotation (0–0.4) — prevents static ordering for similarly-scored objects.
  const rotation = (stableHash(`${getDailyRotationKey()}:${property.id}`) % 1000) / 1000;

  return (
    ratingScore +
    reviewScore +
    impressionsScore +
    viewsScore +
    favoritesScore +
    completeness +
    freshness +
    rotation * 0.4
  );
}

function parseCatalogSort(
  value: string | undefined,
): "relevance" | "price_asc" | "price_desc" | "rating_desc" | "popular_desc" {
  if (!value) return "relevance";
  switch (value) {
    case "price_asc":
    case "price_desc":
    case "rating_desc":
    case "popular_desc":
    case "relevance":
      return value;
    default:
      return "relevance";
  }
}

// Main query used by /search page and /api/public/properties.
export async function getPublicCatalog(query: PublicCatalogQuery): Promise<PublicCatalogResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSizeCap = query.allowLargePageSize ? 5000 : 30;
  const pageSize = Math.min(pageSizeCap, Math.max(1, query.pageSize ?? 30));
  const searchQuery = query.query?.trim() ?? "";
  const stayRange = resolveCatalogStayRange(query.checkIn, query.checkOut);
  const guestsCount =
    typeof query.guests === "number" && Number.isFinite(query.guests) && query.guests > 0
      ? Math.floor(query.guests)
      : 1;
  const sort = parseCatalogSort(query.sort);
  const minPrice =
    typeof query.minPrice === "number" && Number.isFinite(query.minPrice) && query.minPrice > 0
      ? query.minPrice
      : null;
  const maxPrice =
    typeof query.maxPrice === "number" && Number.isFinite(query.maxPrice) && query.maxPrice > 0
      ? query.maxPrice
      : null;
  const minRating =
    typeof query.minRating === "number" && Number.isFinite(query.minRating) && query.minRating > 0
      ? Math.min(5, Math.max(1, query.minRating))
      : null;
  const hasPhotos = query.hasPhotos === true;
  const hasReviews = query.hasReviews === true;
  const familyFriendly = query.familyFriendly === true;
  const petsAllowed = query.petsAllowed === true;
  const hasExplicitLocationFilter =
    Boolean(query.locationId?.trim()) || Boolean(query.location?.trim());
  const [resolvedLocation, queryLocationHint] = await Promise.all([
    resolveLocation({
      locationId: query.locationId,
      location: query.location,
    }),
    !hasExplicitLocationFilter && searchQuery.length >= 2
      ? resolveLocation({ location: searchQuery })
      : Promise.resolve<ResolvedLocation | null>(null),
  ]);
  const type =
    query.type && propertyTypes.some((propertyType) => propertyType.id === query.type)
      ? query.type
      : null;
  const resolvedLocationCenter = hasExplicitLocationFilter
    ? await resolveCrimeaLocationCenter(
        resolvedLocation?.name ?? query.location ?? query.locationId ?? null,
      )
    : null;
  const locationCenterPoint: CatalogGeoPoint | null = resolvedLocationCenter
    ? {
        latitude: resolvedLocationCenter.latitude,
        longitude: resolvedLocationCenter.longitude,
      }
    : null;
  const hasLocationSearchScope = Boolean(resolvedLocation || locationCenterPoint);

  const where: Prisma.PropertyWhereInput = {
    ...buildPublishedPropertyVisibilityWhere(),
    ...(minRating !== null ? { avgRating: { gte: minRating } } : {}),
    ...(hasReviews ? { reviewsCount: { gt: 0 } } : {}),
  };

  const catalogInclude = Prisma.validator<Prisma.PropertyInclude>()({
    owner: {
      select: {
        id: true,
        firstName: true,
        avatarUrl: true,
      },
    },
    media: {
      where: { roomId: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 8,
    },
    rooms: {
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        beds: true,
        extraBeds: true,
        roomsCount: true,
        areaSqm: true,
        prices: {
          select: {
            dateFrom: true,
            dateTo: true,
            price: true,
            priceType: true,
            minGuests: true,
            currency: true,
          },
        },
      },
    },
  });

  type CatalogPropertyRow = Prisma.PropertyGetPayload<{
    include: typeof catalogInclude;
  }>;
  // Step 1: fetch broad candidate pool with lightweight joins.
  // Fine-grained ranking/sorting is applied in memory because it mixes trigram score + dynamic stay pricing.
  const allProperties: CatalogPropertyRow[] = await db.property.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: catalogInclude,
    take: 5000,
  });
  const catalogDisplayStateById = new Map(
    allProperties.map((property) => [property.id, resolvePublicCatalogDisplayState(property)]),
  );

  const queryVariants = toSearchVariants(searchQuery);
  const trigramScoreMap =
    searchQuery.length >= 2
      ? new Map(
          rankByTrigramWithScores(
            searchQuery,
            allProperties,
            (property) => {
              const displayState = catalogDisplayStateById.get(property.id);
              const typeLabel = displayState?.type
                ? (propertyTypeById[displayState.type]?.name ?? displayState.type)
                : null;
              const normalizedAddress = displayState?.address
                ? normalizeAddressSearchText(displayState.address)
                : null;

              return [
                displayState?.name ?? property.name,
                displayState?.name ? transliterateToLatin(displayState.name) : null,
                displayState?.locationName ?? property.locationName,
                displayState?.locationName ? transliterateToLatin(displayState.locationName) : null,
                displayState?.address ?? property.address,
                normalizedAddress,
                normalizedAddress ? transliterateToLatin(normalizedAddress) : null,
                displayState?.description ?? property.description,
                typeLabel,
                ...(displayState?.rooms ?? []).map((room) => room.title),
              ];
            },
            { limit: allProperties.length, minScore: 0.05 },
          ).map((entry) => [entry.item.id, entry.score]),
        )
      : new Map<string, number>();
  const searchScoreEntries: Array<[string, number]> = [];

  if (searchQuery.length >= 2) {
    // Hybrid ranking: token score catches structured/address terms,
    // trigram score catches typos and near matches.
    for (const property of allProperties) {
      const displayState = catalogDisplayStateById.get(property.id);
      const typeLabel = displayState?.type
        ? (propertyTypeById[displayState.type]?.name ?? displayState.type)
        : null;
      const tokenScore = getWeightedFieldTokenScore(queryVariants, [
        { value: displayState?.name ?? property.name, weight: 1.45 },
        { value: displayState?.address ?? property.address, weight: 1.3, isAddress: true },
        { value: displayState?.locationName ?? property.locationName, weight: 1.08 },
        { value: typeLabel, weight: 0.46 },
        { value: displayState?.description ?? property.description, weight: 0.58 },
        ...(displayState?.rooms ?? []).map((room) => ({ value: room.title, weight: 0.72 })),
      ]);
      const trigramScore = trigramScoreMap.get(property.id) ?? 0;
      const locationBoost =
        queryLocationHint && displayState?.locationId === queryLocationHint.id ? 0.22 : 0;
      const score = Math.max(tokenScore, trigramScore * 1.12) + locationBoost;

      if (score >= 0.34) {
        searchScoreEntries.push([property.id, score]);
      }
    }
  }

  const searchScoreMap = new Map(searchScoreEntries);

  // Reduce candidate set before expensive per-card enrichment:
  // text filter -> price constraints -> ranking payload.
  const filteredRows = allProperties
    .map((property) => {
      const displayState = catalogDisplayStateById.get(property.id);
      if (!displayState) {
        return null;
      }

      if (searchQuery.length >= 2 && !searchScoreMap.has(property.id)) {
        return null;
      }

      const exactLocationMatch = resolvedLocation
        ? isSameCatalogLocation(displayState.locationId, resolvedLocation.id) ||
          isSameCatalogLocation(displayState.locationName, resolvedLocation.name)
        : false;
      const distanceKm = calculateDistanceKm(
        locationCenterPoint,
        getCatalogLocationPoint({
          latitude: displayState.latitude,
          longitude: displayState.longitude,
          locationId: displayState.locationId,
          locationName: displayState.locationName,
        }),
      );
      const nearbyLocationMatch =
        !exactLocationMatch && isWithinRadiusKm(distanceKm, NEARBY_CATALOG_RADIUS_KM);
      const searchMatchKind: CatalogSearchMatchKind =
        hasLocationSearchScope && !exactLocationMatch ? "nearby" : "primary";

      if (hasLocationSearchScope && !exactLocationMatch && !nearbyLocationMatch) {
        return null;
      }
      if (type && displayState.type !== type) {
        return null;
      }
      if (hasPhotos && displayState.imageUrls.length === 0) {
        return null;
      }
      if (familyFriendly && displayState.childrenAllowed !== true) {
        return null;
      }
      if (
        petsAllowed &&
        !([PetsPolicy.ON_REQUEST, PetsPolicy.ALLOWED] as PetsPolicy[]).includes(
          displayState.petsPolicy ?? PetsPolicy.FORBIDDEN,
        )
      ) {
        return null;
      }

      const { minNightPrice, minNightPriceType, currency } = getMinPriceByRooms(
        displayState.rooms.map((room) => ({
          prices: room.prices,
        })),
      );
      if (minPrice !== null && (minNightPrice === null || minNightPrice < minPrice)) {
        return null;
      }
      if (maxPrice !== null && (minNightPrice === null || minNightPrice > maxPrice)) {
        return null;
      }

      return {
        property,
        displayState,
        minNightPrice,
        minNightPriceType,
        currency,
        distanceKm,
        searchMatchKind,
        // Multi-factor catalog rank: rating, reviews, engagement signals, freshness, rotation.
        catalogRank: getCatalogRankScore(property),
        searchScore: searchScoreMap.get(property.id) ?? 0,
      };
    })
    .filter(
      (
        item,
      ): item is {
        property: CatalogPropertyRow;
        displayState: ReturnType<typeof resolvePublicCatalogDisplayState>;
        minNightPrice: number | null;
        minNightPriceType: RoomPriceType | null;
        currency: string | null;
        distanceKm: number | null;
        searchMatchKind: CatalogSearchMatchKind;
        catalogRank: number;
        searchScore: number;
      } => Boolean(item),
    )
    .sort((left, right) => {
      if (hasLocationSearchScope && left.searchMatchKind !== right.searchMatchKind) {
        return (
          getSearchMatchKindRank(left.searchMatchKind) -
          getSearchMatchKindRank(right.searchMatchKind)
        );
      }

      if (sort === "price_asc") {
        if (left.minNightPrice === null && right.minNightPrice === null) return 0;
        if (left.minNightPrice === null) return 1;
        if (right.minNightPrice === null) return -1;
        const byPrice = left.minNightPrice - right.minNightPrice;
        if (Math.abs(byPrice) > 0.00001) return byPrice;
      } else if (sort === "price_desc") {
        if (left.minNightPrice === null && right.minNightPrice === null) return 0;
        if (left.minNightPrice === null) return 1;
        if (right.minNightPrice === null) return -1;
        const byPrice = right.minNightPrice - left.minNightPrice;
        if (Math.abs(byPrice) > 0.00001) return byPrice;
      } else if (sort === "rating_desc") {
        const byRating = Number(right.property.avgRating) - Number(left.property.avgRating);
        if (Math.abs(byRating) > 0.00001) return byRating;
      } else if (sort === "popular_desc") {
        const byPopularity = right.property.reviewsCount - left.property.reviewsCount;
        if (byPopularity !== 0) return byPopularity;
        // Tiebreak by combined engagement signals when review count is equal.
        const rightEngagement = right.property.favoritesCount + right.property.profileViews * 0.1;
        const leftEngagement = left.property.favoritesCount + left.property.profileViews * 0.1;
        const byEngagement = rightEngagement - leftEngagement;
        if (Math.abs(byEngagement) > 0.00001) return byEngagement;
      } else {
        const byRelevance =
          searchQuery.length >= 2
            ? right.searchScore - left.searchScore
            : right.catalogRank - left.catalogRank;
        if (Math.abs(byRelevance) > 0.00001) return byRelevance;
      }

      const byCatalogRank = right.catalogRank - left.catalogRank;
      if (Math.abs(byCatalogRank) > 0.00001) return byCatalogRank;
      return right.property.updatedAt.getTime() - left.property.updatedAt.getTime();
    });

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedPropertyIds = pagedRows.map((entry) => entry.property.id);
  const shouldTrackSearchImpressions = query.trackSearchImpressions !== false;

  // Fire-and-forget: track how many times each property has appeared in paginated results.
  // Used by the ranking formula (searchImpressions signal). Don't await — keep response fast.
  if (shouldTrackSearchImpressions && pagedPropertyIds.length > 0) {
    db.property
      .updateMany({
        where: { id: { in: pagedPropertyIds } },
        data: { searchImpressions: { increment: 1 } },
      })
      .catch(() => {});
  }

  // Step 2: load extra card-only metadata only for current page to keep response cost predictable.
  const cardMetaRows =
    pagedPropertyIds.length > 0
      ? await db.property.findMany({
          where: {
            id: { in: pagedPropertyIds },
          },
          select: {
            id: true,
            amenities: {
              orderBy: [{ amenityId: "asc" }],
              take: 12,
              select: {
                amenity: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            customAmenities: {
              orderBy: [{ createdAt: "asc" }],
              take: 12,
              select: {
                name: true,
              },
            },
            roomAmenitySettings: {
              where: {
                enabled: true,
                isKeyAmenity: true,
              },
              orderBy: [{ updatedAt: "asc" }],
              select: {
                feature: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            rooms: {
              where: { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                features: {
                  select: {
                    feature: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
                customFeatures: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        })
      : [];
  const cardMetaById = new Map(cardMetaRows.map((entry) => [entry.id, entry]));

  const items: PublicCatalogItem[] = pagedRows.map((entry) => {
    const property = entry.property;
    const displayState = entry.displayState;
    const cardMeta = cardMetaById.get(property.id);

    // Use published snapshot for display content when owner edits are under moderation.
    const catalogSnap = displayState.snapshot;
    const imageUrls = displayState.imageUrls;
    const roomPricing = displayState.rooms;
    const stayPrice = getBestStayPriceByRooms({
      rooms: roomPricing,
      checkIn: stayRange.checkIn,
      checkOut: stayRange.checkOut,
      guests: guestsCount,
    });
    const roomSnapshot = pickRepresentativeRoom(displayState.rooms, stayPrice?.roomTitle ?? null);
    // Manual "key amenity" configuration has priority; auto-highlights are fallback.
    // When a snapshot is available, prefer its keyRoomAmenityNames for display.
    const selectedKeyAmenityNames = sortAmenityValuesForCatalog(
      catalogSnap
        ? catalogSnap.keyRoomAmenityNames
        : (cardMeta?.roomAmenitySettings ?? []).map((setting) => setting.feature.name),
    ).slice(0, MAX_KEY_AMENITIES_PER_PROPERTY);
    const amenityHighlights =
      selectedKeyAmenityNames.length > 0
        ? selectedKeyAmenityNames
        : collectAmenityHighlights({
            propertyAmenityNames: catalogSnap
              ? catalogSnap.amenities.map((a) => a.name)
              : (cardMeta?.amenities ?? []).map((item) => item.amenity.name),
            propertyCustomAmenityNames: catalogSnap
              ? catalogSnap.customAmenities
              : (cardMeta?.customAmenities ?? []).map((item) => item.name),
            roomAmenityNamesByRoom: catalogSnap
              ? catalogSnap.rooms.map((room) => [
                  ...room.features.map((f) => f.name),
                  ...room.customFeatures.map((f) => stripPaidAmenitySuffix(f)),
                ])
              : (cardMeta?.rooms ?? []).map((room) => [
                  ...room.features.map((item) => item.feature.name),
                  ...room.customFeatures.map((item) => item.name),
                ]),
          });
    const seaDistanceLabel =
      displayState.seaDistance?.trim() ||
      null ||
      extractSeaDistanceLabel(
        catalogSnap
          ? catalogSnap.customAmenities.map((name) => ({ name }))
          : (cardMeta?.customAmenities ?? []),
      );
    const roomPreviews: PublicCatalogRoomPreview[] = displayState.rooms
      .map((room) => {
        let priceFrom: number | null = null;
        let roomPriceType: RoomPriceType | null = null;
        let roomCurrency: string | null = null;

        for (const price of room.prices) {
          const value = Number(price.price);
          if (!Number.isFinite(value)) {
            continue;
          }
          if (priceFrom === null || value < priceFrom) {
            priceFrom = value;
            roomPriceType = normalizeRoomPriceType(price.priceType);
            roomCurrency = price.currency;
          }
        }

        return {
          id: room.id,
          title: normalizeRoomTitle(room.title) || "Номер",
          beds: room.beds,
          extraBeds: room.extraBeds,
          roomsCount: Math.max(1, room.roomsCount),
          areaSqm: room.areaSqm === null ? null : Number(room.areaSqm),
          maxGuests: Math.max(1, room.beds + room.extraBeds),
          priceFrom,
          priceType: roomPriceType,
          currency: roomCurrency,
        };
      })
      .sort((left, right) => {
        if (left.priceFrom === null && right.priceFrom === null) {
          return left.title.localeCompare(right.title, "ru");
        }
        if (left.priceFrom === null) {
          return 1;
        }
        if (right.priceFrom === null) {
          return -1;
        }
        if (left.priceFrom !== right.priceFrom) {
          return left.priceFrom - right.priceFrom;
        }
        return left.title.localeCompare(right.title, "ru");
      })
      .slice(0, 3);

    const displayName = displayState.name;
    const displayType = displayState.type;
    const displayLocationId = displayState.locationId;
    const displayLocationName = displayState.locationName;
    const description = displayState.description?.trim();
    const starRating = displayState.starRating;

    return {
      id: property.id,
      slug: buildPropertySlug(displayName, property.id),
      path: buildPublicPropertyPath({
        id: property.id,
        locationId: displayLocationId,
        name: displayName,
      }),
      createdAt: property.createdAt.toISOString(),
      name: displayName ?? "Объект без названия",
      type: displayType,
      typeLabel: displayType ? (propertyTypeById[displayType]?.name ?? displayType) : null,
      description: description ? description.slice(0, 150) : null,
      starRating: Math.max(0, Math.min(5, starRating)),
      locationId: displayLocationId,
      locationName: displayLocationId
        ? (crimeaLocationById[displayLocationId]?.name ?? displayLocationName)
        : displayLocationName,
      address: displayState.address ?? null,
      latitude: displayState.latitude,
      longitude: displayState.longitude,
      distanceKm: roundDistanceKm(entry.distanceKm),
      searchMatchKind: entry.searchMatchKind,
      checkInFrom: displayState.checkInFrom,
      childrenAllowed: displayState.childrenAllowed === true,
      petsPolicy: displayState.petsPolicy as PetsPolicy | null,
      coverImageUrl: imageUrls[0] ?? null,
      imageUrls,
      roomPreviews,
      activeRoomsCount: displayState.rooms.length,
      minNightPrice: entry.minNightPrice,
      minNightPriceType: entry.minNightPriceType,
      currency: entry.currency,
      stayContext: stayRange,
      stayPrice,
      roomSnapshot,
      amenityHighlights,
      seaDistanceLabel,
      avgRating: Number(property.avgRating),
      reviewsCount: property.reviewsCount,
      owner: {
        id: property.owner.id,
        firstName: property.owner.firstName,
        lastName: "",
        avatarUrl: property.owner.avatarUrl,
      },
    };
  });

  return {
    items,
    page: safePage,
    pageSize,
    total,
    totalPages,
    filters: {
      locationId: resolvedLocation?.id ?? null,
      locationName: resolvedLocation?.name ?? null,
      type,
      query: searchQuery || null,
      minPrice,
      maxPrice,
      minRating,
      hasPhotos,
      hasReviews,
      familyFriendly,
      petsAllowed,
      sort,
      nearbyRadiusKm: hasLocationSearchScope ? NEARBY_CATALOG_RADIUS_KM : null,
    },
  };
}

const publicPropertyInclude = Prisma.validator<Prisma.PropertyInclude>()({
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      avatarUrl: true,
    },
  },
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  amenities: {
    include: {
      amenity: true,
    },
  },
  customAmenities: true,
  roomAmenitySettings: {
    where: {
      enabled: true,
      isKeyAmenity: true,
    },
    orderBy: [{ updatedAt: "asc" }],
    select: {
      feature: {
        select: {
          name: true,
        },
      },
    },
  },
  reviews: {
    where: {
      status: ReviewStatus.ACTIVE,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 9,
    include: {
      user: {
        select: {
          firstName: true,
          avatarUrl: true,
        },
      },
    },
  },
  rooms: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: roomInclude,
  },
});

const publicPropertyIdentifierSelect = Prisma.validator<Prisma.PropertySelect>()({
  id: true,
  name: true,
  locationId: true,
  status: true,
  pendingEditStatus: true,
  publishedSnapshot: true,
  updatedAt: true,
});

type PublicPropertyRecord = Prisma.PropertyGetPayload<{
  include: typeof publicPropertyInclude;
}>;
type PublicPropertyIdentifierRecord = Prisma.PropertyGetPayload<{
  select: typeof publicPropertyIdentifierSelect;
}>;

const getCachedPublicPropertyRecord = cache(
  async (propertyId: string): Promise<PublicPropertyRecord | null> =>
    db.property.findFirst({
      where: {
        id: propertyId,
        ...buildPublishedPropertyVisibilityWhere(),
      },
      include: publicPropertyInclude,
    }),
);

function getPropertyIdentifierState(
  property: PublicPropertyIdentifierRecord,
  options?: { usePublishedSnapshot?: boolean },
): { slug: string; locationId: string | null } {
  const snapshot =
    options?.usePublishedSnapshot !== false &&
    shouldUsePublishedSnapshot({
      status: property.status,
      pendingEditStatus: property.pendingEditStatus,
      publishedSnapshot: property.publishedSnapshot,
    })
      ? parsePublishedPropertySnapshot(property.publishedSnapshot)
      : null;
  const displayName = snapshot?.property.name ?? property.name;
  const displayLocationId = snapshot?.property.locationId ?? property.locationId;

  return {
    slug: buildPropertySlug(displayName, property.id),
    locationId: displayLocationId,
  };
}

async function findPropertyIdByPublicSlug(input: {
  identifier: string;
  expectedLocationId?: string | null;
  ownerId?: string | null;
  usePublishedSnapshot?: boolean;
}): Promise<string | null> {
  const slug = slugify(input.identifier);
  if (!slug) {
    return null;
  }

  const rows = await db.property.findMany({
    where: input.ownerId
      ? {
          ownerId: input.ownerId,
          ownerDeletedAt: null,
        }
      : buildPublishedPropertyVisibilityWhere(),
    select: publicPropertyIdentifierSelect,
    orderBy: [{ updatedAt: "desc" }],
  });

  const match = rows.find((property) => {
    const state = getPropertyIdentifierState(property, {
      usePublishedSnapshot: input.usePublishedSnapshot,
    });
    return (
      state.slug === slug &&
      (!input.expectedLocationId || state.locationId === input.expectedLocationId)
    );
  });

  return match?.id ?? null;
}

async function getReviewReactionById(
  property: Pick<PublicPropertyRecord, "reviews">,
  viewerUserId?: string | null,
): Promise<Map<string, "LIKE" | "DISLIKE"> | null> {
  const reviewReactionById =
    viewerUserId && property.reviews.length > 0
      ? new Map(
          (
            await db.reviewReaction.findMany({
              where: {
                userId: viewerUserId,
                reviewId: { in: property.reviews.map((review) => review.id) },
              },
              select: {
                reviewId: true,
                value: true,
              },
            })
          ).map((reaction) => [reaction.reviewId, reaction.value]),
        )
      : null;

  return reviewReactionById;
}

function buildPublicPropertyCardFromRecord(
  property: PublicPropertyRecord,
  reviewReactionById: Map<string, "LIKE" | "DISLIKE"> | null,
  options?: { usePublishedSnapshot?: boolean },
): PublicPropertyCard {
  // When a published property has a pending owner edit under moderation, serve the
  // published snapshot (last approved version) instead of the live (unmoderated) data.
  const snap =
    options?.usePublishedSnapshot !== false &&
    shouldUsePublishedSnapshot({
      status: property.status,
      pendingEditStatus: property.pendingEditStatus,
      publishedSnapshot: property.publishedSnapshot,
    })
      ? parsePublishedPropertySnapshot(property.publishedSnapshot)
      : null;

  // Content fields: use snapshot (approved) or live.
  const sp = snap?.property ?? null;
  const displayMedia = (snap ? snap.media : property.media.map(serializeMedia)).map((media) => ({
    ...media,
    url: normalizeLegacyFotoImageUrl(media.url),
  }));
  const displayAmenities = snap ? snap.amenities : property.amenities.map((item) => item.amenity);
  const displayCustomAmenities = cleanPublicTextList(
    snap ? snap.customAmenities : property.customAmenities.map((item) => item.name),
    { minLength: 2, maxLength: 80 },
  );
  const displayKeyRoomAmenityNames = cleanPublicTextList(
    snap ? snap.keyRoomAmenityNames : property.roomAmenitySettings.map((item) => item.feature.name),
    { minLength: 2, maxLength: 80 },
  );
  const rawDisplayRooms = snap ? snap.rooms : property.rooms.map(serializeRoom);
  const displayRooms = rawDisplayRooms.map((room) => ({
    ...room,
    customFeatures: cleanPublicTextList(room.customFeatures, { minLength: 2, maxLength: 80 }),
  }));

  // Room-level amenity names for highlight/group computation.
  const roomAmenityNamesByRoom = displayRooms.map((room) => [
    ...room.features.map((feature) => feature.name),
    ...room.customFeatures.map((feature) => stripPaidAmenitySuffix(feature)),
  ]);

  // Min price: snapshot rooms have serialized prices (number), live rooms have Prisma.Decimal.
  const { minNightPrice, minNightPriceType, currency } = snap
    ? (() => {
        let min: number | null = null;
        let minType: RoomPriceType | null = null;
        let cur: string | null = null;
        for (const room of snap.rooms) {
          for (const price of room.prices) {
            if (min === null || price.price < min) {
              min = price.price;
              minType = normalizeRoomPriceType(price.priceType);
              cur = price.currency;
            }
          }
        }
        return { minNightPrice: min, minNightPriceType: minType, currency: cur };
      })()
    : getMinPriceByRooms(
        property.rooms.map((room) => ({
          prices: room.prices.map((priceItem) => ({
            price: priceItem.price,
            priceType: priceItem.priceType,
            currency: priceItem.currency,
          })),
        })),
      );

  const displayName = sp?.name ?? property.name;
  const displayType = sp?.type ?? property.type;
  const displayLocationId = sp?.locationId ?? property.locationId;
  const displayLocationName = sp?.locationName ?? property.locationName;
  const displayDescription = cleanPublicText(sp?.description ?? property.description, {
    minLength: 10,
    maxLength: 5000,
    preserveLineBreaks: true,
  });
  const displayFaqItems = cleanFaqItems(
    sp?.faqItems ?? (Array.isArray(property.faqItems) ? (property.faqItems as FaqItem[]) : []),
  );

  const selectedKeyAmenityNames = sortAmenityValuesForCatalog(displayKeyRoomAmenityNames).slice(
    0,
    MAX_KEY_AMENITIES_PER_PROPERTY,
  );
  const amenityHighlights =
    selectedKeyAmenityNames.length > 0
      ? selectedKeyAmenityNames
      : collectAmenityHighlights({
          propertyAmenityNames: displayAmenities.map((a) => a.name),
          propertyCustomAmenityNames: displayCustomAmenities,
          roomAmenityNamesByRoom,
        });
  const amenityGroups = collectPropertyAmenityGroups({
    propertyAmenityNames: displayAmenities.map((a) => a.name),
    propertyCustomAmenityNames: displayCustomAmenities,
    roomAmenityNamesByRoom,
  });

  const displayContactEmail = sp !== null ? sp.contactEmail : property.contactEmail;
  const displayShowEmail = sp !== null ? sp.showEmail : property.showEmail;

  return {
    id: property.id,
    slug: buildPropertySlug(displayName, property.id),
    path: buildPublicPropertyPath({
      id: property.id,
      locationId: displayLocationId,
      name: displayName,
    }),
    name: displayName,
    type: displayType,
    typeLabel: displayType ? (propertyTypeById[displayType]?.name ?? displayType) : null,
    locationId: displayLocationId,
    locationName: displayLocationId
      ? (crimeaLocationById[displayLocationId]?.name ?? displayLocationName)
      : displayLocationName,
    address: sp?.address ?? property.address,
    latitude: sp?.latitude ?? (property.latitude === null ? null : Number(property.latitude)),
    longitude: sp?.longitude ?? (property.longitude === null ? null : Number(property.longitude)),
    description: displayDescription,
    faqItems: displayFaqItems,
    media: displayMedia,
    amenities: displayAmenities,
    customAmenities: displayCustomAmenities,
    amenityHighlights,
    amenityGroups,
    contacts: {
      phone: sp?.phone ?? property.phone,
      phoneName: sp?.phoneName ?? property.phoneName,
      phone2: sp?.phone2 ?? property.phone2,
      phone2Name: sp?.phone2Name ?? property.phone2Name,
      phone3: sp?.phone3 ?? property.phone3,
      phone3Name: sp?.phone3Name ?? property.phone3Name,
      websiteUrl: sp?.websiteUrl ?? property.websiteUrl,
      email: displayContactEmail ?? (displayShowEmail ? property.owner.email : null),
      whatsappUrl: sp?.whatsappUrl ?? property.whatsappUrl,
      telegramUrl: sp?.telegramUrl ?? property.telegramUrl,
      vkUrl: sp?.vkUrl ?? property.vkUrl,
      maxUrl: sp?.maxUrl ?? property.maxUrl,
      okUrl: sp?.okUrl ?? property.okUrl,
      receiveRequests: sp?.receiveRequests ?? property.receiveRequests,
    },
    rules: {
      checkInFrom: sp?.checkInFrom ?? property.checkInFrom,
      checkOutUntil: sp?.checkOutUntil ?? property.checkOutUntil,
      childrenAllowed: sp?.childrenAllowed ?? property.childrenAllowed,
      childrenMinAge: sp?.childrenMinAge ?? property.childrenMinAge,
      petsPolicy: (sp?.petsPolicy ?? property.petsPolicy) as
        | "FORBIDDEN"
        | "ON_REQUEST"
        | "ALLOWED"
        | null,
      smokingPolicy: (sp?.smokingPolicy ?? property.smokingPolicy) as
        | "FORBIDDEN"
        | "ON_REQUEST"
        | "ALLOWED"
        | null,
      quietHoursEnabled: sp?.quietHoursEnabled ?? property.quietHoursEnabled,
      quietHoursFrom: sp?.quietHoursFrom ?? property.quietHoursFrom,
      quietHoursTo: sp?.quietHoursTo ?? property.quietHoursTo,
      parkingInfo: sp?.parkingInfo ?? property.parkingInfo ?? null,
      mealOptions: sp?.mealOptions ?? property.mealOptions ?? null,
      prepaymentPolicy: sp?.prepaymentPolicy ?? property.prepaymentPolicy ?? null,
    },
    classification: {
      registryNumber: sp?.registryNumber ?? property.registryNumber,
      registryDetails: sp?.registryDetails ?? property.registryDetails,
      classificationApplicable: sp?.classificationApplicable ?? property.classificationApplicable,
    },
    rooms: displayRooms,
    activeRoomsCount: displayRooms.length,
    minNightPrice,
    minNightPriceType,
    currency,
    avgRating: Number(property.avgRating),
    reviewsCount: property.reviewsCount,
    reviews: property.reviews.map((review) =>
      serializeReview({
        ...review,
        currentUserReaction: reviewReactionById?.get(review.id) ?? null,
      }),
    ),
    owner: {
      id: property.owner.id,
      firstName: property.owner.firstName,
      lastName: "",
      avatarUrl: property.owner.avatarUrl,
    },
  };
}

// Main query used by /crimea/[location]/[slug] and /api/public/properties/[identifier].
export async function getPublicPropertyByIdentifier(
  identifier: string,
  expectedLocationId?: string | null,
  viewerUserId?: string | null,
): Promise<PublicPropertyCard | null> {
  const extractedId = extractPropertyId(identifier);
  const id = isPublicEntityId(extractedId)
    ? extractedId
    : await findPropertyIdByPublicSlug({
        identifier,
        expectedLocationId,
        usePublishedSnapshot: true,
      });
  if (!id) {
    return null;
  }

  const property = await getCachedPublicPropertyRecord(id);

  if (!property) {
    return null;
  }

  const reviewReactionById = await getReviewReactionById(property, viewerUserId);
  const item = buildPublicPropertyCardFromRecord(property, reviewReactionById, {
    usePublishedSnapshot: true,
  });

  if (expectedLocationId && item.locationId !== expectedLocationId) {
    return null;
  }

  return item;
}

export async function getOwnerPreviewPropertyByIdentifier(
  identifier: string,
  ownerId: string,
  expectedLocationId?: string | null,
  viewerUserId?: string | null,
): Promise<PublicPropertyCard | null> {
  const extractedId = extractPropertyId(identifier);
  const id = isPublicEntityId(extractedId)
    ? extractedId
    : await findPropertyIdByPublicSlug({
        identifier,
        expectedLocationId,
        ownerId,
        usePublishedSnapshot: false,
      });
  if (!id) {
    return null;
  }

  const property = await db.property.findFirst({
    where: {
      id,
      ownerId,
      ownerDeletedAt: null,
    },
    include: publicPropertyInclude,
  });

  if (!property) {
    return null;
  }

  const reviewReactionById = await getReviewReactionById(property, viewerUserId);
  const item = buildPublicPropertyCardFromRecord(property, reviewReactionById, {
    usePublishedSnapshot: false,
  });

  return item;
}
