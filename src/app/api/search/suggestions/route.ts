import { NextResponse } from "next/server";
import { crimeaLocationById, crimeaLocations } from "@/lib/constants";
import { db } from "@/lib/db";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
} from "@/lib/public-visibility";
import { createInMemoryRateLimiter } from "@/lib/rate-limit";
import {
  getPopularExcursionSuggestions,
  getPopularHousingSuggestions,
  type SearchSuggestionItem,
} from "@/lib/search-suggestions";

type SuggestionDirection = "housing" | "excursions";
type SuggestionType = "location" | "hotel";

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
  locationId: string | null;
  locationName: string | null;
  anchorLocation: { slug: string; name: string } | null;
  mainLocation: { slug: string; name: string } | null;
};

type LocationAggregate = {
  id: string;
  name: string;
  normalizedName: string;
  latinName: string;
  activeListingsCount: number;
  subtitle: string;
};

type RankedSuggestion = {
  item: SearchSuggestionItem;
  score: number;
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
const popularLocationsLimit = 5;

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

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
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

function pluralize(value: number, variants: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) {
    return variants[2];
  }
  if (mod > 1 && mod < 5) {
    return variants[1];
  }
  if (mod === 1) {
    return variants[0];
  }
  return variants[2];
}

function parseDirection(raw: string | null): SuggestionDirection {
  return raw === "excursions" ? "excursions" : "housing";
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
  const label = pluralize(activeListingsCount, [
    "активный объект",
    "активных объекта",
    "активных объектов",
  ]);
  return `Крым, Россия · ${activeListingsCount} ${label}`;
}

function buildExcursionLocationSubtitle(activeListingsCount: number): string {
  const label = pluralize(activeListingsCount, [
    "активная экскурсия",
    "активные экскурсии",
    "активных экскурсий",
  ]);
  return `Крым, Россия · ${activeListingsCount} ${label}`;
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

function buildFallbackLocationAggregates(direction: SuggestionDirection): LocationAggregate[] {
  const subtitle =
    direction === "housing" ? "Крым, Россия · жильё" : "Крым, Россия · экскурсии";

  return crimeaLocations.map((item) => ({
    id: item.id,
    name: item.name,
    normalizedName: normalizeText(item.name),
    latinName: normalizeText(transliterateToLatin(item.name)),
    activeListingsCount: 0,
    subtitle,
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
      ...buildPublishedPropertyVisibilityWhere(),
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
      ...buildPublishedExcursionVisibilityWhere(),
    },
    select: {
      id: true,
      locationId: true,
      locationName: true,
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
            (item) => [item.name, item.latinName],
            { limit: input.items.length, minScore: 0.03 },
          ).map((entry) => [entry.item.id, entry.score]),
        )
      : new Map<string, number>();

  const minScore = queryRaw.length >= 2 ? 0.2 : 0.75;

  return input.items
    .map((item) => {
      const tokenScore = getTokenMatchScore(queryVariants, [item.normalizedName, item.latinName]);
      const trigramScore = trigramScoreMap.get(item.id) ?? 0;
      // Popular destinations get a small bias, but text relevance still dominates.
      const popularityBoost = Math.min(0.35, Math.log(item.activeListingsCount + 1) / 7.5);
      const score = Math.max(tokenScore, trigramScore) + popularityBoost;

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
        : row.locationName ?? null;

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
      const locationPopularity =
        item.locationId ? (input.locationCountById.get(item.locationId) ?? 1) : 1;
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

function mergeRankedSuggestions(input: {
  locations: RankedSuggestion[];
  hotels: RankedSuggestion[];
  limit: number;
}): SearchSuggestionItem[] {
  return [...input.locations, ...input.hotels]
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
  const responseHeaders = {
    "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    "X-RateLimit-Remaining": String(rate.remaining),
  };

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
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
        const rows = await getHousingSuggestionRows();
        const locationAggregates = buildHousingLocationAggregates(rows);
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
    } else {
      if (!query && include.has("location")) {
        popular = await getPopularExcursionSuggestions();
      }

      if (query && include.has("location")) {
        // Excursions currently expose location suggestions only.
        const rows = await getExcursionSuggestionRows();
        const locationAggregates = buildExcursionLocationAggregates(rows);
        matches = rankLocationMatches({
          query,
          items: locationAggregates,
          limit,
        }).map((entry) => entry.item);
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
