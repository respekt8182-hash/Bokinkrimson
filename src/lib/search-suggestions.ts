import { unstable_cache } from "next/cache";
import { crimeaLocationById, crimeaLocations } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";
import { getStaticAttractions, type StaticAttraction } from "@/lib/static-attractions";

export type SearchSuggestionDirection = "housing" | "excursions" | "attractions" | "transfers";
export type SearchSuggestionType = "location" | "hotel" | "listing";

export type SearchSuggestionItem = {
  type: SearchSuggestionType;
  id: string;
  name: string;
  subtitle: string;
  locationId: string | null;
  activeListingsCount: number;
};

type PopularLocationEntry = {
  locationId: string;
  viewCount: number;
};

type LocationCountEntry = {
  locationId: string;
  locationName: string | null;
  activeListingsCount: number;
};

type ExcursionSuggestionRow = {
  locationId: string | null;
  locationName: string | null;
  anchorLocation: { slug: string; name: string } | null;
  mainLocation: { slug: string; name: string } | null;
};

type TransferSuggestionRow = {
  locationId: string | null;
  locationName: string | null;
  location: { slug: string; name: string } | null;
};

type LocationAggregate = {
  id: string;
  name: string;
  activeListingsCount: number;
  subtitle: string;
};

const popularLocationsLimit = 8;
const popularSuggestionsRevalidateSeconds = 5 * 60;
const crimeaLocationSubtitle = "Крым, Россия";

export function buildHousingLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

export function buildExcursionLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

export function buildAttractionLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
}

export function buildTransferLocationSubtitle(activeListingsCount: number): string {
  void activeListingsCount;
  return crimeaLocationSubtitle;
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

function sortLocationCountEntries(left: LocationCountEntry, right: LocationCountEntry): number {
  if (right.activeListingsCount !== left.activeListingsCount) {
    return right.activeListingsCount - left.activeListingsCount;
  }

  const leftName = crimeaLocationById[left.locationId]?.name ?? left.locationId;
  const rightName = crimeaLocationById[right.locationId]?.name ?? right.locationId;
  return leftName.localeCompare(rightName, "ru");
}

function sortPopularSuggestionItems(
  left: SearchSuggestionItem,
  right: SearchSuggestionItem,
  viewRankMap: Map<string, number>,
): number {
  const leftRank = viewRankMap.get(left.id);
  const rightRank = viewRankMap.get(right.id);

  if (leftRank !== undefined || rightRank !== undefined) {
    if (leftRank === undefined) {
      return 1;
    }
    if (rightRank === undefined) {
      return -1;
    }
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
  }

  if (right.activeListingsCount !== left.activeListingsCount) {
    return right.activeListingsCount - left.activeListingsCount;
  }

  return left.name.localeCompare(right.name, "ru");
}

function sortLocationAggregates(left: LocationAggregate, right: LocationAggregate): number {
  if (right.activeListingsCount !== left.activeListingsCount) {
    return right.activeListingsCount - left.activeListingsCount;
  }

  return left.name.localeCompare(right.name, "ru");
}

function buildExcursionLocationAggregates(rows: ExcursionSuggestionRow[]): LocationAggregate[] {
  const byLocationId = new Map<string, LocationAggregate>();

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
  items.sort(sortLocationAggregates);
  return items;
}

function buildAttractionLocationAggregates(rows: StaticAttraction[]): LocationAggregate[] {
  const byLocationName = new Map<string, LocationAggregate>();

  for (const row of rows) {
    const displayName = row.locationName?.trim();
    if (!displayName) {
      continue;
    }

    const locationId = displayName.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "-");
    const existing = byLocationName.get(locationId);
    if (!existing) {
      byLocationName.set(locationId, {
        id: locationId,
        name: displayName,
        activeListingsCount: 1,
        subtitle: "",
      });
      continue;
    }

    existing.activeListingsCount += 1;
  }

  const items = Array.from(byLocationName.values()).map((item) => ({
    ...item,
    subtitle: buildAttractionLocationSubtitle(item.activeListingsCount),
  }));
  items.sort(sortLocationAggregates);
  return items;
}

function buildTransferLocationAggregates(rows: TransferSuggestionRow[]): LocationAggregate[] {
  const byLocationId = new Map<string, LocationAggregate>();

  for (const row of rows) {
    const displayName = row.location?.name?.trim() || row.locationName?.trim() || "";
    const locationId =
      row.location?.slug?.trim() ||
      row.locationId?.trim() ||
      displayName.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "-");

    if (!displayName || !locationId) {
      continue;
    }

    const existing = byLocationId.get(locationId);
    if (!existing) {
      byLocationId.set(locationId, {
        id: locationId,
        name: displayName,
        activeListingsCount: 1,
        subtitle: "",
      });
      continue;
    }

    existing.activeListingsCount += 1;
  }

  const items = Array.from(byLocationId.values()).map((item) => ({
    ...item,
    subtitle: buildTransferLocationSubtitle(item.activeListingsCount),
  }));
  items.sort(sortLocationAggregates);
  return items;
}

async function readPopularHousingLocationIds(): Promise<PopularLocationEntry[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const viewGroups = await db.viewLog.groupBy({
    by: ["entityId"],
    where: { entityType: "property", date: { gte: thirtyDaysAgo } },
    _sum: { count: true },
  });

  const propertyIds = viewGroups.map((group) => group.entityId);
  const properties =
    propertyIds.length > 0
      ? await db.property.findMany({
          where: {
            id: { in: propertyIds },
            ...buildPublishedPropertyVisibilityWhere(),
          },
          select: { id: true, locationId: true },
        })
      : [];

  const propertyLocationMap = new Map(
    properties.filter((property) => property.locationId).map((property) => [property.id, property.locationId as string]),
  );

  const locationViewCounts = new Map<string, number>();
  for (const group of viewGroups) {
    const locationId = propertyLocationMap.get(group.entityId);
    if (!locationId) {
      continue;
    }

    locationViewCounts.set(
      locationId,
      (locationViewCounts.get(locationId) ?? 0) + (group._sum.count ?? 0),
    );
  }

  return Array.from(locationViewCounts.entries())
    .map(([locationId, viewCount]) => ({ locationId, viewCount }))
    .sort((left, right) => right.viewCount - left.viewCount);
}

async function readPopularExcursionLocationIds(): Promise<PopularLocationEntry[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const viewGroups = await db.viewLog.groupBy({
    by: ["entityId"],
    where: { entityType: "excursion", date: { gte: thirtyDaysAgo } },
    _sum: { count: true },
  });

  const excursionIds = viewGroups.map((group) => group.entityId);
  const excursions =
    excursionIds.length > 0
      ? await db.excursion.findMany({
          where: {
            id: { in: excursionIds },
            ...buildPublishedExcursionVisibilityWhere(),
          },
          select: {
            id: true,
            anchorLocationId: true,
            mainLocationId: true,
          },
        })
      : [];

  const excursionLocationMap = new Map(
    excursions.map((excursion) => [
      excursion.id,
      excursion.anchorLocationId ?? excursion.mainLocationId ?? null,
    ]),
  );

  const locationViewCounts = new Map<string, number>();
  for (const group of viewGroups) {
    const locationId = excursionLocationMap.get(group.entityId);
    if (!locationId) {
      continue;
    }

    locationViewCounts.set(
      locationId,
      (locationViewCounts.get(locationId) ?? 0) + (group._sum.count ?? 0),
    );
  }

  return Array.from(locationViewCounts.entries())
    .map(([locationId, viewCount]) => ({ locationId, viewCount }))
    .sort((left, right) => right.viewCount - left.viewCount);
}

const readCachedPopularHousingSuggestions = unstable_cache(
  async (): Promise<SearchSuggestionItem[]> => {
    const locationCounts = await db.property.groupBy({
      by: ["locationId"],
      where: {
        ...buildPublishedPropertyVisibilityWhere(),
        locationId: { not: null },
        rooms: {
          some: {
            isActive: true,
          },
        },
      },
      _count: {
        _all: true,
      },
      _min: {
        locationName: true,
      },
    });

    const countEntries = locationCounts
      .map((row) => {
        const locationId = row.locationId?.trim();
        if (!locationId) {
          return null;
        }

        return {
          locationId,
          locationName: row._min.locationName?.trim() || null,
          activeListingsCount: row._count._all,
        } satisfies LocationCountEntry;
      })
      .filter((row): row is LocationCountEntry => Boolean(row))
      .sort(sortLocationCountEntries);

    if (countEntries.length === 0) {
      return [];
    }

    let popularEntries: PopularLocationEntry[] = [];
    try {
      popularEntries = await readPopularHousingLocationIds();
    } catch {
      popularEntries = [];
    }

    const countEntryById = new Map(countEntries.map((entry) => [entry.locationId, entry]));
    const prioritizedLocationIds = Array.from(
      new Set([
        ...popularEntries
          .slice(0, popularLocationsLimit * 4)
          .map((entry) => entry.locationId)
          .filter((locationId) => countEntryById.has(locationId)),
        ...countEntries
          .slice(0, popularLocationsLimit * 4)
          .map((entry) => entry.locationId),
      ]),
    );

    const viewRankMap = new Map(popularEntries.map((entry, index) => [entry.locationId, index]));
    const rows: SearchSuggestionItem[] = [];

    for (const locationId of prioritizedLocationIds) {
      const entry = countEntryById.get(locationId);
      if (!entry) {
        continue;
      }

      const displayName = crimeaLocationById[locationId]?.name ?? entry.locationName ?? locationId;
      rows.push({
        type: "location",
        id: locationId,
        name: displayName,
        subtitle: buildHousingLocationSubtitle(entry.activeListingsCount),
        locationId,
        activeListingsCount: entry.activeListingsCount,
      });
    }

    rows.sort((left, right) => sortPopularSuggestionItems(left, right, viewRankMap));
    return rows.slice(0, popularLocationsLimit);
  },
  ["popular-housing-search-suggestions-v2"],
  { revalidate: popularSuggestionsRevalidateSeconds },
);

const readCachedPopularExcursionSuggestions = unstable_cache(
  async (): Promise<SearchSuggestionItem[]> => {
    const rows = await db.excursion.findMany({
      where: {
        ...buildPublishedExcursionVisibilityWhere(),
      },
      select: {
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
    });

    const locationAggregates = buildExcursionLocationAggregates(rows);
    if (locationAggregates.length === 0) {
      return [];
    }

    let popularEntries: PopularLocationEntry[] = [];
    try {
      popularEntries = await readPopularExcursionLocationIds();
    } catch {
      popularEntries = [];
    }

    if (popularEntries.length === 0) {
      return locationAggregates.slice(0, popularLocationsLimit).map(toLocationSuggestion);
    }

    const viewRankMap = new Map(popularEntries.map((entry, index) => [entry.locationId, index]));
    const locationById = new Map(locationAggregates.map((item) => [item.id, item]));
    const popular = popularEntries
      .slice(0, popularLocationsLimit)
      .map((entry) => locationById.get(entry.locationId))
      .filter((item): item is LocationAggregate => Boolean(item))
      .sort((left, right) => (viewRankMap.get(left.id) ?? 999) - (viewRankMap.get(right.id) ?? 999))
      .map(toLocationSuggestion);

    if (popular.length >= popularLocationsLimit) {
      return popular;
    }

    const existingIds = new Set(popular.map((item) => item.id));
    const fallback = locationAggregates
      .filter((item) => !existingIds.has(item.id))
      .slice(0, popularLocationsLimit - popular.length)
      .map(toLocationSuggestion);

    return [...popular, ...fallback];
  },
  ["popular-excursion-search-suggestions-v2"],
  { revalidate: popularSuggestionsRevalidateSeconds },
);

const readCachedPopularAttractionSuggestions = unstable_cache(
  async (): Promise<SearchSuggestionItem[]> => {
    const rows = await getStaticAttractions();
    const locationAggregates = buildAttractionLocationAggregates(rows);
    return locationAggregates.slice(0, popularLocationsLimit).map(toLocationSuggestion);
  },
  ["popular-attraction-search-suggestions-v2"],
  { revalidate: popularSuggestionsRevalidateSeconds },
);

const readCachedPopularTransferSuggestions = unstable_cache(
  async (): Promise<SearchSuggestionItem[]> => {
    const rows = await db.transfer.findMany({
      where: {
        ...buildPublishedTransferVisibilityWhere(),
      },
      select: {
        locationId: true,
        locationName: true,
        location: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const locationAggregates = buildTransferLocationAggregates(rows);
    return locationAggregates.slice(0, popularLocationsLimit).map(toLocationSuggestion);
  },
  ["popular-transfer-search-suggestions-v2"],
  { revalidate: popularSuggestionsRevalidateSeconds },
);

function buildFallbackLocationSubtitle(direction: SearchSuggestionDirection): string {
  if (direction === "housing") {
    return buildHousingLocationSubtitle(0);
  }

  if (direction === "attractions") {
    return buildAttractionLocationSubtitle(0);
  }

  if (direction === "transfers") {
    return buildTransferLocationSubtitle(0);
  }

  return buildExcursionLocationSubtitle(0);
}

export function getFallbackPopularLocationSuggestions(
  direction: SearchSuggestionDirection,
  limit = popularLocationsLimit,
): SearchSuggestionItem[] {
  return crimeaLocations.slice(0, limit).map((item) => ({
    type: "location",
    id: item.id,
    name: item.name,
    subtitle: buildFallbackLocationSubtitle(direction),
    locationId: item.id,
    activeListingsCount: 0,
  }));
}

export async function getPopularHousingSuggestions(): Promise<SearchSuggestionItem[]> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "popular-housing-search-suggestions",
      "Database is unavailable. Using built-in housing location suggestions.",
    );

    return getFallbackPopularLocationSuggestions("housing");
  }

  try {
    const suggestions = await readCachedPopularHousingSuggestions();
    return suggestions.length > 0 ? suggestions : getFallbackPopularLocationSuggestions("housing");
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "popular-housing-search-suggestions",
      "Database is unavailable or credentials are invalid. Using built-in housing location suggestions.",
    );

    return getFallbackPopularLocationSuggestions("housing");
  }
}

export async function getPopularExcursionSuggestions(): Promise<SearchSuggestionItem[]> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "popular-excursion-search-suggestions",
      "Database is unavailable. Using built-in excursion location suggestions.",
    );

    return getFallbackPopularLocationSuggestions("excursions");
  }

  try {
    const suggestions = await readCachedPopularExcursionSuggestions();
    return suggestions.length > 0 ? suggestions : getFallbackPopularLocationSuggestions("excursions");
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "popular-excursion-search-suggestions",
      "Database is unavailable or credentials are invalid. Using built-in excursion location suggestions.",
    );

    return getFallbackPopularLocationSuggestions("excursions");
  }
}

export async function getPopularAttractionSuggestions(): Promise<SearchSuggestionItem[]> {
  const suggestions = await readCachedPopularAttractionSuggestions();
  return suggestions.length > 0 ? suggestions : getFallbackPopularLocationSuggestions("attractions");
}

export async function getPopularTransferSuggestions(): Promise<SearchSuggestionItem[]> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "popular-transfer-search-suggestions",
      "Database is unavailable. Using built-in transfer location suggestions.",
    );

    return getFallbackPopularLocationSuggestions("transfers");
  }

  try {
    const suggestions = await readCachedPopularTransferSuggestions();
    return suggestions.length > 0 ? suggestions : getFallbackPopularLocationSuggestions("transfers");
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "popular-transfer-search-suggestions",
      "Database is unavailable or credentials are invalid. Using built-in transfer location suggestions.",
    );

    return getFallbackPopularLocationSuggestions("transfers");
  }
}
