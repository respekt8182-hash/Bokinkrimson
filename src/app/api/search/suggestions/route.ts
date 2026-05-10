import { NextResponse } from "next/server";
import { crimeaLocationById, crimeaLocations } from "@/lib/constants";
import { db } from "@/lib/db";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import { getLocationDirectoryItems, type LocationDirectoryItem } from "@/lib/location-directory";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublishedTransferVisibilityWhere,
  buildPublicCatalogExcursionVisibilityWhere,
  buildPublicCatalogPropertyVisibilityWhere,
} from "@/lib/public-visibility";
import { createInMemoryRateLimiter } from "@/lib/rate-limit";
import {
  getPopularAttractionSuggestions,
  getPopularExcursionSuggestions,
  getPopularHousingSuggestions,
  getPopularTransferSuggestions,
  type SearchSuggestionItem,
} from "@/lib/search-suggestions";
import { getStaticAttractions, type StaticAttraction } from "@/lib/static-attractions";
import { normalizeTransferServiceTags } from "@/lib/transfers";

type SuggestionDirection = "housing" | "excursions" | "attractions" | "transfers";
type SuggestionType = "location" | "hotel" | "listing";

type SearchSuggestionsResponse = {
  recent: SearchSuggestionItem[];
  popular: SearchSuggestionItem[];
  matches: SearchSuggestionItem[];
};

type HousingSuggestionRow = {
  id: string;
  name: string | null;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
};

type ExcursionSuggestionRow = {
  id: string;
  offerType: string;
  title: string | null;
  subtypeLabel: string | null;
  locationId: string | null;
  locationName: string | null;
  startPoint: string | null;
  meetingPointText: string | null;
  shortDescription: string | null;
  description: string | null;
  routeDescription: string | null;
  finishPoint: string | null;
  tags: string[];
  anchorLocation: { slug: string; name: string } | null;
  mainLocation: { slug: string; name: string } | null;
  district: { name: string } | null;
  category: { name: string } | null;
  routeLocations: Array<{ location: { slug: string; name: string } }>;
};

type AttractionSuggestionRow = Pick<
  StaticAttraction,
  | "id"
  | "title"
  | "h1"
  | "category"
  | "tags"
  | "locationName"
  | "districtName"
  | "locationAliases"
  | "address"
  | "shortDescription"
  | "description"
  | "nearby"
  | "searchKeywords"
>;

type TransferSuggestionRow = {
  id: string;
  title: string | null;
  transferType: string | null;
  vehicleClass: string | null;
  vehicleModel: string | null;
  locationId: string | null;
  locationName: string | null;
  serviceArea: string | null;
  routeExamples: string | null;
  shortDescription: string | null;
  description: string | null;
  serviceTags: string[];
  fleet: unknown;
  location: { slug: string; name: string } | null;
};

type LocationAggregate = {
  id: string;
  name: string;
  normalizedName: string;
  latinName: string;
  activeListingsCount: number;
  subtitle: string;
  searchTerms: string[];
};

type RankedSuggestion = {
  item: SearchSuggestionItem;
  score: number;
};

type ListingCandidate = {
  item: SearchSuggestionItem;
  searchTerms: string[];
  popularity: number;
};

type CachedRows<T> = {
  rows: T[];
  expiresAt: number;
};

const queryMaxLength = 80;
const defaultLimit = 10;
const minLimit = 5;
const maxLimit = 20;
const sourceCacheTtlMs = 60_000;
const popularLocationsLimit = 8;
const crimeaLocationSubtitle = "Крым, Россия";

const addressNormalizationRules: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bул\b/g, "улица"],
  [/\bпр-?т\b|\bпросп\b/g, "проспект"],
  [/\bпер\b/g, "переулок"],
  [/\bмкр\b|\bмкрн\b/g, "микрорайон"],
  [/\bд\b/g, "дом"],
  [/\bкорп\b/g, "корпус"],
  [/\bкв\b/g, "квартира"],
];

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

const suggestionsRateLimiter = createInMemoryRateLimiter({
  id: "api-search-suggestions",
  windowMs: 60_000,
  maxRequests: 120,
});

// Short-lived in-memory caches reduce repeated DB scans under fast typing in search box.
let housingRowsCache: CachedRows<HousingSuggestionRow> | null = null;
let excursionRowsCache: CachedRows<ExcursionSuggestionRow> | null = null;
let attractionRowsCache: CachedRows<AttractionSuggestionRow> | null = null;
let transferRowsCache: CachedRows<TransferSuggestionRow> | null = null;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function transliterateToLatin(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join("");
}

function normalizeAddressText(value: string): string {
  let normalized = normalizeText(value).replace(/-/g, " ");

  for (const [pattern, replacement] of addressNormalizationRules) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function parseDirection(raw: string | null): SuggestionDirection {
  if (raw === "excursions" || raw === "attractions" || raw === "transfers") {
    return raw;
  }

  return "housing";
}

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return defaultLimit;
  }

  return Math.max(minLimit, Math.min(maxLimit, parsed));
}

function parseInclude(raw: string | null, direction: SuggestionDirection): Set<SuggestionType> {
  const defaults =
    direction === "housing"
      ? new Set<SuggestionType>(["location", "hotel"])
      : new Set<SuggestionType>(["location"]);

  if (!raw) {
    return defaults;
  }

  const include = new Set<SuggestionType>();
  const tokens = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (token === "locations") {
      include.add("location");
      continue;
    }

    if (token === "listings" && direction !== "housing") {
      include.add("listing");
      continue;
    }

    if (token === "hotels" && direction === "housing") {
      include.add("hotel");
    }
  }

  // If client sent unknown tokens, fall back to safe defaults instead of returning empty results.
  return include.size > 0 ? include : defaults;
}

function getClientRateLimitKey(request: Request): string {
  // IP + truncated UA keeps limit stable for a browser session behind shared proxies.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim() ?? "";
  const ip = firstForwardedIp || request.headers.get("x-real-ip")?.trim() || "anonymous";
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(0, 120);
  return `${ip}:${userAgent}`;
}

function toSearchVariants(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);
  const transliterated = normalizeText(transliterateToLatin(normalized));
  if (transliterated) {
    variants.add(transliterated);
  }

  const normalizedAddress = normalizeAddressText(normalized);
  if (normalizedAddress) {
    variants.add(normalizedAddress);

    const transliteratedAddress = normalizeText(transliterateToLatin(normalizedAddress));
    if (transliteratedAddress) {
      variants.add(transliteratedAddress);
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

function toCandidateVariants(value: string, options?: { isAddress?: boolean }): string[] {
  const normalized = options?.isAddress ? normalizeAddressText(value) : normalizeText(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);
  const transliterated = normalizeText(transliterateToLatin(normalized));
  if (transliterated) {
    variants.add(transliterated);
  }

  if (!options?.isAddress) {
    const asAddress = normalizeAddressText(normalized);
    if (asAddress) {
      variants.add(asAddress);
      const transliteratedAddress = normalizeText(transliterateToLatin(asAddress));
      if (transliteratedAddress) {
        variants.add(transliteratedAddress);
      }
    }
  }

  return Array.from(variants);
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

    const candidateVariants = toCandidateVariants(field.value, {
      isAddress: field.isAddress === true,
    });
    if (candidateVariants.length === 0) {
      continue;
    }

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

function buildHousingLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

function buildExcursionLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

function buildAttractionLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

function buildTransferLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

function trimSubtitle(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 96 ? `${compact.slice(0, 93)}...` : compact;
}

function buildHotelSubtitle(locationName: string | null, address: string | null): string {
  const cleanLocationName = locationName?.trim() ?? "";
  const cleanAddress = address?.trim() ?? "";

  if (!cleanLocationName && !cleanAddress) {
    return "Крым, Россия";
  }

  if (cleanLocationName && cleanAddress) {
    if (normalizeText(cleanAddress).includes(normalizeText(cleanLocationName))) {
      return trimSubtitle(cleanAddress);
    }
    return trimSubtitle(`${cleanLocationName} · ${cleanAddress}`);
  }

  if (cleanAddress) {
    return trimSubtitle(cleanAddress);
  }

  return `${cleanLocationName}, Крым`;
}

function compactListingSubtitle(parts: Array<string | null | undefined>): string {
  const subtitle = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return subtitle ? trimSubtitle(subtitle) : "Крым, Россия";
}

function uniqueSearchTerms(
  values: Array<string | null | undefined | Array<string | null | undefined>>,
): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const value of values) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const trimmed = item?.trim();
      if (!trimmed) {
        continue;
      }

      const normalized = normalizeText(trimmed);
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      terms.push(trimmed);
    }
  }

  return terms;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function collectTransferFleetSearchTerms(fleet: unknown): string[] {
  if (!Array.isArray(fleet)) {
    return [];
  }

  return uniqueSearchTerms(
    fleet.flatMap((item) => {
      if (!isPlainObject(item)) {
        return [];
      }

      return [
        item.title,
        item.transportKind,
        item.vehicleClass,
        item.vehicleModel,
        item.description,
      ].filter((value): value is string => typeof value === "string");
    }),
  );
}

function toLocationSuggestion(item: LocationAggregate): SearchSuggestionItem {
  return {
    type: "location",
    id: item.id,
    name: item.name,
    subtitle: item.subtitle,
    locationId: item.id,
    activeListingsCount: item.activeListingsCount,
  };
}

function sortLocations(left: LocationAggregate, right: LocationAggregate): number {
  if (right.activeListingsCount !== left.activeListingsCount) {
    return right.activeListingsCount - left.activeListingsCount;
  }

  return left.name.localeCompare(right.name, "ru");
}

function mergeDirectoryLocationAggregates(
  items: LocationAggregate[],
  directory: LocationDirectoryItem[],
): LocationAggregate[] {
  const byNormalizedName = new Map(items.map((item) => [normalizeText(item.name), item]));

  for (const location of directory) {
    const name = location.name.trim();
    if (!name) {
      continue;
    }

    const normalizedName = normalizeText(name);
    const existing = byNormalizedName.get(normalizedName);
    if (existing) {
      existing.searchTerms = uniqueSearchTerms([existing.searchTerms, location.id, name]);
      continue;
    }

    byNormalizedName.set(normalizedName, {
      id: location.id.trim() || toStableLocationId(name),
      name,
      normalizedName,
      latinName: normalizeText(transliterateToLatin(name)),
      activeListingsCount: 0,
      subtitle: crimeaLocationSubtitle,
      searchTerms: uniqueSearchTerms([name, location.id]),
    });
  }

  const merged = Array.from(byNormalizedName.values());
  merged.sort(sortLocations);
  return merged;
}

function buildHousingLocationAggregates(rows: HousingSuggestionRow[]): LocationAggregate[] {
  const byLocationId = new Map<string, LocationAggregate>();

  // Aggregate listing counts by location id; these counts feed popularity ordering and boosts.
  for (const row of rows) {
    const locationId = row.locationId?.trim();
    if (!locationId) {
      continue;
    }

    const builtInName = crimeaLocationById[locationId]?.name;
    const fallbackName = row.locationName?.trim();
    const displayName = builtInName || fallbackName || locationId;

    const existing = byLocationId.get(locationId);
    if (!existing) {
      byLocationId.set(locationId, {
        id: locationId,
        name: displayName,
        normalizedName: normalizeText(displayName),
        latinName: normalizeText(transliterateToLatin(displayName)),
        activeListingsCount: 1,
        subtitle: "",
        searchTerms: [],
      });
      continue;
    }

    existing.activeListingsCount += 1;
    if (!crimeaLocationById[locationId] && fallbackName && existing.name === locationId) {
      existing.name = fallbackName;
      existing.normalizedName = normalizeText(fallbackName);
      existing.latinName = normalizeText(transliterateToLatin(fallbackName));
    }
  }

  const items = Array.from(byLocationId.values()).map((item) => ({
    ...item,
    subtitle: buildHousingLocationSubtitle(item.activeListingsCount),
  }));

  items.sort(sortLocations);
  return items;
}

function buildExcursionLocationAggregates(rows: ExcursionSuggestionRow[]): LocationAggregate[] {
  const byLocationId = new Map<string, LocationAggregate>();

  // Prefer anchor/main location slugs because they define canonical excursion geography.
  for (const row of rows) {
    const locationId =
      row.anchorLocation?.slug?.trim() ||
      row.mainLocation?.slug?.trim() ||
      row.locationId?.trim() ||
      "";

    if (!locationId) {
      continue;
    }

    const displayName =
      row.anchorLocation?.name?.trim() ||
      row.mainLocation?.name?.trim() ||
      row.locationName?.trim() ||
      locationId;

    const existing = byLocationId.get(locationId);
    if (!existing) {
      byLocationId.set(locationId, {
        id: locationId,
        name: displayName,
        normalizedName: normalizeText(displayName),
        latinName: normalizeText(transliterateToLatin(displayName)),
        activeListingsCount: 1,
        subtitle: "",
        searchTerms: [],
      });
      continue;
    }

    existing.activeListingsCount += 1;
  }

  const items = Array.from(byLocationId.values()).map((item) => ({
    ...item,
    subtitle: buildExcursionLocationSubtitle(item.activeListingsCount),
  }));
  items.sort(sortLocations);
  return items;
}

function toStableLocationId(value: string): string {
  return transliterateToLatin(normalizeText(value))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildAttractionLocationAggregates(rows: AttractionSuggestionRow[]): LocationAggregate[] {
  const byLocationId = new Map<string, LocationAggregate>();

  for (const row of rows) {
    const displayName = row.locationName?.trim();
    if (!displayName) {
      continue;
    }

    const locationId = toStableLocationId(displayName);
    const searchTerms = [row.locationName, row.districtName, ...row.locationAliases].flatMap(
      (term) => (term?.trim() ? [term.trim()] : []),
    );
    const existing = byLocationId.get(locationId);
    if (!existing) {
      byLocationId.set(locationId, {
        id: locationId,
        name: displayName,
        normalizedName: normalizeText(displayName),
        latinName: normalizeText(transliterateToLatin(displayName)),
        activeListingsCount: 1,
        subtitle: "",
        searchTerms,
      });
      continue;
    }

    existing.activeListingsCount += 1;
    for (const term of searchTerms) {
      if (!existing.searchTerms.some((current) => normalizeText(current) === normalizeText(term))) {
        existing.searchTerms.push(term);
      }
    }
  }

  const items = Array.from(byLocationId.values()).map((item) => ({
    ...item,
    subtitle: buildAttractionLocationSubtitle(item.activeListingsCount),
  }));
  items.sort(sortLocations);
  return items;
}

function buildTransferLocationAggregates(rows: TransferSuggestionRow[]): LocationAggregate[] {
  const byLocationId = new Map<string, LocationAggregate>();

  for (const row of rows) {
    const displayName = row.location?.name?.trim() || row.locationName?.trim() || "";
    const locationId =
      row.location?.slug?.trim() || row.locationId?.trim() || toStableLocationId(displayName);

    if (!displayName || !locationId) {
      continue;
    }

    const searchTerms = [row.location?.name, row.locationName].flatMap((term) =>
      term?.trim() ? [term.trim()] : [],
    );
    const existing = byLocationId.get(locationId);
    if (!existing) {
      byLocationId.set(locationId, {
        id: locationId,
        name: displayName,
        normalizedName: normalizeText(displayName),
        latinName: normalizeText(transliterateToLatin(displayName)),
        activeListingsCount: 1,
        subtitle: "",
        searchTerms,
      });
      continue;
    }

    existing.activeListingsCount += 1;
    for (const term of searchTerms) {
      if (!existing.searchTerms.some((current) => normalizeText(current) === normalizeText(term))) {
        existing.searchTerms.push(term);
      }
    }
  }

  const items = Array.from(byLocationId.values()).map((item) => ({
    ...item,
    subtitle: buildTransferLocationSubtitle(item.activeListingsCount),
  }));
  items.sort(sortLocations);
  return items;
}

function buildExcursionListingCandidates(rows: ExcursionSuggestionRow[]): ListingCandidate[] {
  return rows
    .map((row): ListingCandidate | null => {
      const title = row.title?.trim();
      if (!title) {
        return null;
      }

      const locationId =
        row.anchorLocation?.slug?.trim() ||
        row.mainLocation?.slug?.trim() ||
        row.locationId?.trim() ||
        null;
      const locationName =
        row.anchorLocation?.name?.trim() ||
        row.mainLocation?.name?.trim() ||
        row.locationName?.trim() ||
        null;
      const routeLocationNames = row.routeLocations.map((route) => route.location.name);
      const offerLabel = row.offerType === "TOUR" ? "Тур" : "Экскурсия";
      const subtitle = compactListingSubtitle([offerLabel, row.category?.name, locationName]);

      return {
        item: {
          type: "listing",
          id: row.id,
          name: title,
          subtitle,
          locationId,
          activeListingsCount: 1,
        },
        searchTerms: uniqueSearchTerms([
          title,
          row.subtypeLabel,
          locationName,
          row.locationName,
          row.anchorLocation?.name,
          row.mainLocation?.name,
          row.district?.name,
          row.category?.name,
          row.startPoint,
          row.meetingPointText,
          row.finishPoint,
          row.shortDescription,
          row.description,
          row.routeDescription,
          row.tags,
          routeLocationNames,
        ]),
        popularity: 1,
      };
    })
    .filter((item): item is ListingCandidate => Boolean(item));
}

function buildAttractionListingCandidates(rows: AttractionSuggestionRow[]): ListingCandidate[] {
  return rows
    .map((row): ListingCandidate | null => {
      const title = row.title?.trim();
      if (!title) {
        return null;
      }

      return {
        item: {
          type: "listing",
          id: row.id,
          name: title,
          subtitle: compactListingSubtitle([row.category ?? "Место", row.locationName]),
          locationId: row.locationName ? toStableLocationId(row.locationName) : null,
          activeListingsCount: 1,
        },
        searchTerms: uniqueSearchTerms([
          title,
          row.h1,
          row.category,
          row.locationName,
          row.districtName,
          row.address,
          row.shortDescription,
          row.description,
          row.tags,
          row.locationAliases,
          row.nearby,
          row.searchKeywords,
        ]),
        popularity: 1,
      };
    })
    .filter((item): item is ListingCandidate => Boolean(item));
}

function buildTransferListingCandidates(rows: TransferSuggestionRow[]): ListingCandidate[] {
  return rows
    .map((row): ListingCandidate | null => {
      const fleetSearchTerms = collectTransferFleetSearchTerms(row.fleet);
      const serviceTags = normalizeTransferServiceTags(row.serviceTags);
      const locationName = row.location?.name?.trim() || row.locationName?.trim() || null;
      const locationId = row.location?.slug?.trim() || row.locationId?.trim() || null;
      const name =
        row.title?.trim() ||
        row.routeExamples?.trim() ||
        row.transferType?.trim() ||
        row.vehicleModel?.trim() ||
        "Трансфер";

      return {
        item: {
          type: "listing",
          id: row.id,
          name,
          subtitle: compactListingSubtitle([row.transferType ?? "Трансфер", locationName]),
          locationId,
          activeListingsCount: 1,
        },
        searchTerms: uniqueSearchTerms([
          name,
          row.transferType,
          row.vehicleClass,
          row.vehicleModel,
          locationName,
          row.locationName,
          row.serviceArea,
          row.routeExamples,
          row.shortDescription,
          row.description,
          serviceTags,
          fleetSearchTerms,
        ]),
        popularity: 1,
      };
    })
    .filter((item): item is ListingCandidate => Boolean(item));
}

function buildFallbackLocationAggregates(direction: SuggestionDirection): LocationAggregate[] {
  void direction;

  return crimeaLocations.map((item) => ({
    id: item.id,
    name: item.name,
    normalizedName: normalizeText(item.name),
    latinName: normalizeText(transliterateToLatin(item.name)),
    activeListingsCount: 0,
    subtitle: crimeaLocationSubtitle,
    searchTerms: [],
  }));
}

function buildFallbackSuggestionsResponse(input: {
  direction: SuggestionDirection;
  query: string;
  include: Set<SuggestionType>;
  limit: number;
}): SearchSuggestionsResponse {
  const locationAggregates = buildFallbackLocationAggregates(input.direction);

  const popular =
    !input.query && input.include.has("location")
      ? locationAggregates.slice(0, popularLocationsLimit).map(toLocationSuggestion)
      : [];

  const matches =
    input.query && input.include.has("location")
      ? rankLocationMatches({
          query: input.query,
          items: locationAggregates,
          limit: input.limit,
        }).map((entry) => entry.item)
      : [];

  return {
    recent: [],
    popular,
    matches,
  };
}

async function getHousingSuggestionRows(): Promise<HousingSuggestionRow[]> {
  const now = Date.now();
  if (housingRowsCache && housingRowsCache.expiresAt > now) {
    return housingRowsCache.rows;
  }

  const rows = await db.property.findMany({
    where: {
      ...buildPublicCatalogPropertyVisibilityWhere(),
      rooms: {
        some: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      locationId: true,
      locationName: true,
      address: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 5000,
  });

  housingRowsCache = {
    rows,
    expiresAt: now + sourceCacheTtlMs,
  };

  return rows;
}

async function getExcursionSuggestionRows(): Promise<ExcursionSuggestionRow[]> {
  const now = Date.now();
  if (excursionRowsCache && excursionRowsCache.expiresAt > now) {
    return excursionRowsCache.rows;
  }

  const rows = await db.excursion.findMany({
    where: {
      ...buildPublicCatalogExcursionVisibilityWhere(),
    },
    select: {
      id: true,
      offerType: true,
      title: true,
      subtypeLabel: true,
      locationId: true,
      locationName: true,
      startPoint: true,
      meetingPointText: true,
      shortDescription: true,
      description: true,
      routeDescription: true,
      finishPoint: true,
      tags: true,
      anchorLocation: {
        select: {
          slug: true,
          name: true,
        },
      },
      mainLocation: {
        select: {
          slug: true,
          name: true,
        },
      },
      district: {
        select: {
          name: true,
        },
      },
      category: {
        select: {
          name: true,
        },
      },
      routeLocations: {
        select: {
          location: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 5000,
  });

  excursionRowsCache = {
    rows,
    expiresAt: now + sourceCacheTtlMs,
  };

  return rows;
}

async function getAttractionSuggestionRows(): Promise<AttractionSuggestionRow[]> {
  const now = Date.now();
  if (attractionRowsCache && attractionRowsCache.expiresAt > now) {
    return attractionRowsCache.rows;
  }

  const rows = (await getStaticAttractions()).map((item) => ({
    id: item.id,
    title: item.title,
    h1: item.h1,
    category: item.category,
    tags: item.tags,
    locationName: item.locationName,
    districtName: item.districtName,
    locationAliases: item.locationAliases,
    address: item.address,
    shortDescription: item.shortDescription,
    description: item.description,
    nearby: item.nearby,
    searchKeywords: item.searchKeywords,
  }));

  attractionRowsCache = {
    rows,
    expiresAt: now + sourceCacheTtlMs,
  };

  return rows;
}

async function getTransferSuggestionRows(): Promise<TransferSuggestionRow[]> {
  const now = Date.now();
  if (transferRowsCache && transferRowsCache.expiresAt > now) {
    return transferRowsCache.rows;
  }

  const rows = await db.transfer.findMany({
    where: {
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: {
      id: true,
      title: true,
      transferType: true,
      vehicleClass: true,
      vehicleModel: true,
      locationId: true,
      locationName: true,
      serviceArea: true,
      routeExamples: true,
      shortDescription: true,
      description: true,
      serviceTags: true,
      fleet: true,
      location: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 5000,
  });

  transferRowsCache = {
    rows,
    expiresAt: now + sourceCacheTtlMs,
  };

  return rows;
}

function rankLocationMatches(input: {
  query: string;
  items: LocationAggregate[];
  limit: number;
}): RankedSuggestion[] {
  const queryRaw = input.query.trim();
  if (!queryRaw) {
    return [];
  }

  const queryVariants = toSearchVariants(queryRaw);
  const trigramScoreMap =
    queryRaw.length >= 2
      ? new Map(
          rankByTrigramWithScores(
            queryRaw,
            input.items,
            (item) => [item.name, item.latinName, ...item.searchTerms],
            { limit: input.items.length, minScore: 0.03 },
          ).map((entry) => [entry.item.id, entry.score]),
        )
      : new Map<string, number>();

  const minScore = queryRaw.length >= 2 ? 0.2 : 0.75;

  return input.items
    .map((item) => {
      const searchTermVariants = item.searchTerms.flatMap((term) => toCandidateVariants(term));
      const tokenScore = getTokenMatchScore(queryVariants, [
        item.normalizedName,
        item.latinName,
        ...searchTermVariants,
      ]);
      const locationNameBoost = queryVariants.reduce((boost, query) => {
        if (!query) {
          return boost;
        }

        if (item.normalizedName === query || item.latinName === query) {
          return Math.max(boost, 1);
        }

        if (item.normalizedName.startsWith(query) || item.latinName.startsWith(query)) {
          return Math.max(boost, 0.72);
        }

        if (
          item.normalizedName.split(" ").some((token) => token.startsWith(query)) ||
          item.latinName.split(" ").some((token) => token.startsWith(query))
        ) {
          return Math.max(boost, 0.48);
        }

        return boost;
      }, 0);
      const trigramScore = trigramScoreMap.get(item.id) ?? 0;
      // Popular destinations get a small bias, but text relevance still dominates.
      const popularityBoost = Math.min(0.35, Math.log(item.activeListingsCount + 1) / 7.5);
      const score = Math.max(tokenScore, trigramScore) + locationNameBoost + popularityBoost;

      return {
        item: toLocationSuggestion(item),
        score,
      };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);
}

function rankHotelMatches(input: {
  query: string;
  rows: HousingSuggestionRow[];
  locationCountById: Map<string, number>;
  limit: number;
}): RankedSuggestion[] {
  const queryRaw = input.query.trim();
  if (!queryRaw) {
    return [];
  }

  const candidates = input.rows
    .filter((row) => row.name && row.name.trim().length > 0)
    .map((row) => {
      const name = row.name?.trim() ?? "";
      const locationName = row.locationId
        ? (crimeaLocationById[row.locationId]?.name ?? row.locationName ?? null)
        : (row.locationName ?? null);

      return {
        id: row.id,
        name,
        locationId: row.locationId,
        locationName,
        address: row.address?.trim() ?? null,
      };
    });

  const queryVariants = toSearchVariants(queryRaw);
  const trigramScoreMap =
    queryRaw.length >= 2
      ? new Map(
          rankByTrigramWithScores(
            queryRaw,
            candidates,
            (item) => [
              item.name,
              transliterateToLatin(item.name),
              item.locationName,
              item.locationName ? transliterateToLatin(item.locationName) : null,
              item.address,
              item.address ? normalizeAddressText(item.address) : null,
              item.address ? transliterateToLatin(normalizeAddressText(item.address)) : null,
            ],
            { limit: candidates.length, minScore: 0.03 },
          ).map((entry) => [entry.item.id, entry.score]),
        )
      : new Map<string, number>();

  // Hotel matches are noisier than location matches, so we keep a stricter floor.
  const minScore = queryRaw.length >= 2 ? 0.34 : 0.96;

  return candidates
    .map((item) => {
      const tokenScore = getWeightedFieldTokenScore(queryVariants, [
        { value: item.name, weight: 1.35 },
        { value: item.address, weight: 1.28, isAddress: true },
        { value: item.locationName, weight: 0.98 },
      ]);
      const trigramScore = trigramScoreMap.get(item.id) ?? 0;
      const locationPopularity = item.locationId
        ? (input.locationCountById.get(item.locationId) ?? 1)
        : 1;
      const popularityBoost = Math.min(0.2, Math.log(locationPopularity + 1) / 10);
      const score = Math.max(tokenScore, trigramScore * 1.12) + popularityBoost;

      return {
        item: {
          type: "hotel" as const,
          id: item.id,
          name: item.name,
          subtitle: buildHotelSubtitle(item.locationName, item.address),
          locationId: item.locationId,
          activeListingsCount: locationPopularity,
        },
        score,
      };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);
}

function rankListingMatches(input: {
  query: string;
  items: ListingCandidate[];
  limit: number;
}): RankedSuggestion[] {
  const queryRaw = input.query.trim();
  if (!queryRaw) {
    return [];
  }

  const queryVariants = toSearchVariants(queryRaw);
  const trigramScoreMap =
    queryRaw.length >= 2
      ? new Map(
          rankByTrigramWithScores(
            queryRaw,
            input.items,
            (candidate) => [candidate.item.name, candidate.item.subtitle, ...candidate.searchTerms],
            { limit: input.items.length, minScore: 0.03 },
          ).map((entry) => [entry.item.item.id, entry.score]),
        )
      : new Map<string, number>();

  const minScore = queryRaw.length >= 2 ? 0.28 : 0.9;

  return input.items
    .map((candidate) => {
      const weightedFields: WeightedSearchField[] = [
        { value: candidate.item.name, weight: 1.45 },
        { value: candidate.item.subtitle, weight: 0.62 },
        ...candidate.searchTerms.map((term) => ({ value: term, weight: 0.96 })),
      ];
      const tokenScore = getWeightedFieldTokenScore(queryVariants, weightedFields);
      const trigramScore = trigramScoreMap.get(candidate.item.id) ?? 0;
      const popularityBoost = Math.min(0.16, Math.log(candidate.popularity + 1) / 12);
      const score = Math.max(tokenScore, trigramScore * 1.14) + popularityBoost;

      return {
        item: candidate.item,
        score,
      };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);
}

function mergeRankedSuggestions(input: {
  locations: RankedSuggestion[];
  hotels?: RankedSuggestion[];
  listings?: RankedSuggestion[];
  limit: number;
}): SearchSuggestionItem[] {
  return [...input.locations, ...(input.hotels ?? []), ...(input.listings ?? [])]
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit)
    .map((entry) => entry.item);
}

export async function GET(request: Request) {
  const rate = await suggestionsRateLimiter.limit(getClientRateLimitKey(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const direction = parseDirection(searchParams.get("direction"));
  const limit = parseLimit(searchParams.get("limit"));
  const include = parseInclude(searchParams.get("include"), direction);
  const query = (searchParams.get("query") ?? "").trim().slice(0, queryMaxLength);
  const canUseFallback = process.env.NODE_ENV !== "production";
  const requiresDatabase = direction !== "attractions";
  const responseHeaders = {
    "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    "X-RateLimit-Remaining": String(rate.remaining),
  };

  if (canUseFallback && requiresDatabase && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "search-suggestions",
      "Database is unavailable. Returning built-in location suggestions.",
    );

    return NextResponse.json(
      buildFallbackSuggestionsResponse({
        direction,
        query,
        include,
        limit,
      }),
      {
        headers: responseHeaders,
      },
    );
  }

  try {
    let popular: SearchSuggestionItem[] = [];
    let matches: SearchSuggestionItem[] = [];

    if (direction === "housing") {
      if (!query && include.has("location")) {
        popular = await getPopularHousingSuggestions();
      }

      if (query) {
        // Housing can return both locations and specific properties ("hotels").
        const [rows, locationDirectory] = await Promise.all([
          getHousingSuggestionRows(),
          getLocationDirectoryItems(),
        ]);
        const locationAggregates = mergeDirectoryLocationAggregates(
          buildHousingLocationAggregates(rows),
          locationDirectory,
        );
        const locationCountById = new Map(
          locationAggregates.map((item) => [item.id, item.activeListingsCount]),
        );

        // For housing we blend location + hotel matches into one ranked list.
        const locationMatches = include.has("location")
          ? rankLocationMatches({
              query,
              items: locationAggregates,
              limit: Math.max(limit, 12),
            })
          : [];
        const hotelMatches = include.has("hotel")
          ? rankHotelMatches({
              query,
              rows,
              locationCountById,
              limit: Math.max(limit, 14),
            })
          : [];

        matches = mergeRankedSuggestions({
          locations: locationMatches,
          hotels: hotelMatches,
          limit,
        });
      }
    } else if (direction === "excursions") {
      if (!query && include.has("location")) {
        popular = await getPopularExcursionSuggestions();
      }

      if (query) {
        const [rows, locationDirectory] = await Promise.all([
          getExcursionSuggestionRows(),
          getLocationDirectoryItems(),
        ]);
        const locationAggregates = mergeDirectoryLocationAggregates(
          buildExcursionLocationAggregates(rows),
          locationDirectory,
        );
        const locationMatches = include.has("location")
          ? rankLocationMatches({
              query,
              items: locationAggregates,
              limit: Math.max(limit, 12),
            })
          : [];
        const listingMatches = include.has("listing")
          ? rankListingMatches({
              query,
              items: buildExcursionListingCandidates(rows),
              limit: Math.max(limit, 12),
            })
          : [];

        matches = mergeRankedSuggestions({
          locations: locationMatches,
          listings: listingMatches,
          limit,
        });
      }
    } else if (direction === "attractions") {
      if (!query && include.has("location")) {
        popular = await getPopularAttractionSuggestions();
      }

      if (query) {
        const [rows, locationDirectory] = await Promise.all([
          getAttractionSuggestionRows(),
          getLocationDirectoryItems(),
        ]);
        const locationAggregates = mergeDirectoryLocationAggregates(
          buildAttractionLocationAggregates(rows),
          locationDirectory,
        );
        const locationMatches = include.has("location")
          ? rankLocationMatches({
              query,
              items: locationAggregates,
              limit: Math.max(limit, 12),
            })
          : [];
        const listingMatches = include.has("listing")
          ? rankListingMatches({
              query,
              items: buildAttractionListingCandidates(rows),
              limit: Math.max(limit, 12),
            })
          : [];

        matches = mergeRankedSuggestions({
          locations: locationMatches,
          listings: listingMatches,
          limit,
        });
      }
    } else {
      if (!query && include.has("location")) {
        popular = await getPopularTransferSuggestions();
      }

      if (query) {
        const [rows, locationDirectory] = await Promise.all([
          getTransferSuggestionRows(),
          getLocationDirectoryItems(),
        ]);
        const locationAggregates = mergeDirectoryLocationAggregates(
          buildTransferLocationAggregates(rows),
          locationDirectory,
        );
        const locationMatches = include.has("location")
          ? rankLocationMatches({
              query,
              items: locationAggregates,
              limit: Math.max(limit, 12),
            })
          : [];
        const listingMatches = include.has("listing")
          ? rankListingMatches({
              query,
              items: buildTransferListingCandidates(rows),
              limit: Math.max(limit, 12),
            })
          : [];

        matches = mergeRankedSuggestions({
          locations: locationMatches,
          listings: listingMatches,
          limit,
        });
      }
    }

    const payload: SearchSuggestionsResponse = {
      // "recent" is reserved for client-side/local history and intentionally empty on server.
      recent: [],
      popular,
      matches,
    };

    return NextResponse.json(payload, {
      headers: responseHeaders,
    });
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "search-suggestions",
      "Database is unavailable or credentials are invalid. Returning built-in location suggestions.",
    );

    return NextResponse.json(
      buildFallbackSuggestionsResponse({
        direction,
        query,
        include,
        limit,
      }),
      {
        headers: responseHeaders,
      },
    );
  }
}
