// Client-side helpers for building housing search requests, URLs, and normalized responses.
import type { PublicCatalogItem } from "@/lib/public-properties";
import { fetchWithRetry } from "@/lib/client-retry-fetch";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { buildHousingCatalogPath } from "@/lib/seo/routes";
import { buildDateRangeParam } from "@/lib/seo/url-normalize";
import type { SearchApiResponse, SearchFilters, SearchResponse } from "@/types/catalog";

const DEFAULT_PAGE_SIZE = 30;

function appendIfNotEmpty(params: URLSearchParams, key: string, value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return;
  }
  params.set(key, normalized);
}

function appendListIfNotEmpty(params: URLSearchParams, key: string, values: readonly string[]) {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return;
  }

  params.set(key, Array.from(new Set(normalized)).join(","));
}

function parseItems(value: unknown): PublicCatalogItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as PublicCatalogItem[];
}

export function buildAccommodationSearchParams(
  filters: SearchFilters,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  bounds?: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  const hasBounds = Boolean(bounds?.trim());

  params.set("page", String(Math.max(1, page)));
  params.set("page_size", String(Math.max(1, pageSize)));

  appendIfNotEmpty(params, "q", filters.query);
  if (!hasBounds) {
    appendIfNotEmpty(params, "location", filters.location);
    appendIfNotEmpty(params, "locationId", filters.locationId);
  }
  appendIfNotEmpty(params, "propertyType", filters.propertyType);
  appendIfNotEmpty(params, "checkIn", filters.checkIn);
  appendIfNotEmpty(params, "checkOut", filters.checkOut);
  appendIfNotEmpty(params, "guests", filters.guests);
  appendIfNotEmpty(params, "guestsAdults", filters.guestsAdults);
  appendIfNotEmpty(params, "guestsChildren", filters.guestsChildren);
  appendIfNotEmpty(params, "minPrice", filters.minPrice);
  appendIfNotEmpty(params, "maxPrice", filters.maxPrice);
  appendIfNotEmpty(params, "sort", filters.sort);
  appendIfNotEmpty(params, "minRating", filters.minRating);

  if (filters.hasPhotos) params.set("hasPhotos", "1");
  if (filters.hasReviews) params.set("hasReviews", "1");
  if (filters.familyFriendly) params.set("familyFriendly", "1");
  if (filters.petsAllowed) params.set("petsAllowed", "1");
  if (filters.nearSea) params.set("nearSea", "1");
  if (filters.hasPool) params.set("hasPool", "1");
  if (filters.hasKitchen) params.set("hasKitchen", "1");
  if (filters.hasAirConditioner) params.set("hasAirConditioner", "1");
  if (filters.hasParking) params.set("hasParking", "1");
  if (filters.smokingForbidden) params.set("smokingForbidden", "1");
  if (filters.quietHours) params.set("quietHours", "1");
  appendListIfNotEmpty(params, "amenityIds", filters.amenityIds);
  appendListIfNotEmpty(params, "roomFeatureIds", filters.roomFeatureIds);
  appendIfNotEmpty(params, "bounds", bounds ?? "");

  return params;
}

function toSearchResponse(payload: SearchApiResponse): SearchResponse {
  const page = Number.isFinite(payload.page) ? Math.max(1, payload.page) : 1;
  const totalPages = Number.isFinite(payload.total_pages) ? Math.max(1, payload.total_pages) : 1;
  const pageSize = Number.isFinite(payload.page_size)
    ? Math.max(1, payload.page_size)
    : DEFAULT_PAGE_SIZE;
  const total = Number.isFinite(payload.total) ? Math.max(0, payload.total) : 0;

  return {
    items: parseItems(payload.items),
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

export async function fetchAccommodationSearch(
  filters: SearchFilters,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  signal?: AbortSignal,
  bounds?: string | null,
): Promise<SearchResponse> {
  const query = buildAccommodationSearchParams(filters, page, pageSize, bounds).toString();

  const response = await fetchWithRetry(`/api/search/accommodations?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
    retries: 2,
    retryDelayMs: 400,
    timeoutMs: 9_000,
  });

  if (!response.ok) {
    throw new Error("accommodations_fetch_failed");
  }

  const payload = (await response.json()) as SearchApiResponse;
  return toSearchResponse(payload);
}

export function buildHousingCatalogUrl(
  filters: SearchFilters,
  page = 1,
  keepPageParam = false,
): string {
  const entries: Array<[string, string]> = [];
  const basePath = buildHousingCatalogPath({
    location: filters.location,
    locationId: filters.locationId,
  });
  const isLocationInPath = basePath !== "/rent";

  if (filters.query.trim()) entries.push(["q", filters.query]);
  if (!isLocationInPath && filters.location.trim()) entries.push(["location", filters.location]);
  if (filters.propertyType.trim()) entries.push(["propertyType", filters.propertyType]);
  const datesParam = buildDateRangeParam(filters.checkIn, filters.checkOut);
  if (datesParam) {
    entries.push(["dates", datesParam]);
  } else {
    if (filters.checkIn.trim()) entries.push(["checkIn", filters.checkIn]);
    if (filters.checkOut.trim()) entries.push(["checkOut", filters.checkOut]);
  }
  if (filters.guests.trim() && filters.guests.trim() !== "2")
    entries.push(["guests", filters.guests]);
  if (filters.guestsAdults.trim() && filters.guestsAdults.trim() !== "2") {
    entries.push(["guestsAdults", filters.guestsAdults]);
  }
  if (filters.guestsChildren.trim() && filters.guestsChildren.trim() !== "0") {
    entries.push(["guestsChildren", filters.guestsChildren]);
  }
  if (filters.minPrice.trim()) entries.push(["minPrice", filters.minPrice]);
  if (filters.maxPrice.trim()) entries.push(["maxPrice", filters.maxPrice]);
  if (filters.sort.trim()) entries.push(["sort", filters.sort]);
  if (filters.minRating.trim()) entries.push(["minRating", filters.minRating]);

  if (filters.hasPhotos) entries.push(["hasPhotos", "1"]);
  if (filters.hasReviews) entries.push(["hasReviews", "1"]);
  if (filters.familyFriendly) entries.push(["familyFriendly", "1"]);
  if (filters.petsAllowed) entries.push(["petsAllowed", "1"]);
  if (filters.nearSea) entries.push(["nearSea", "1"]);
  if (filters.hasPool) entries.push(["hasPool", "1"]);
  if (filters.hasKitchen) entries.push(["hasKitchen", "1"]);
  if (filters.hasAirConditioner) entries.push(["hasAirConditioner", "1"]);
  if (filters.hasParking) entries.push(["hasParking", "1"]);
  if (filters.smokingForbidden) entries.push(["smokingForbidden", "1"]);
  if (filters.quietHours) entries.push(["quietHours", "1"]);
  if (filters.amenityIds.length > 0) {
    entries.push(["amenityIds", Array.from(new Set(filters.amenityIds)).join(",")]);
  }
  if (filters.roomFeatureIds.length > 0) {
    entries.push(["roomFeatureIds", Array.from(new Set(filters.roomFeatureIds)).join(",")]);
  }
  if (keepPageParam && page > 1) entries.push(["page", String(page)]);

  return buildCanonicalPath(basePath, entries, [
    "q",
    "location",
    "propertyType",
    "dates",
    "checkIn",
    "checkOut",
    "guests",
    "guestsAdults",
    "guestsChildren",
    "minPrice",
    "maxPrice",
    "sort",
    "minRating",
    "hasPhotos",
    "hasReviews",
    "familyFriendly",
    "petsAllowed",
    "nearSea",
    "hasPool",
    "hasKitchen",
    "hasAirConditioner",
    "hasParking",
    "smokingForbidden",
    "quietHours",
    "amenityIds",
    "roomFeatureIds",
    "page",
  ]);
}

export function buildHousingMapQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  appendIfNotEmpty(params, "q", filters.query);
  appendIfNotEmpty(params, "location", filters.location);
  appendIfNotEmpty(params, "locationId", filters.locationId);
  appendIfNotEmpty(params, "type", filters.propertyType);
  appendIfNotEmpty(params, "guests", filters.guests);
  appendIfNotEmpty(params, "guestsAdults", filters.guestsAdults);
  appendIfNotEmpty(params, "guestsChildren", filters.guestsChildren);
  appendIfNotEmpty(params, "checkIn", filters.checkIn);
  appendIfNotEmpty(params, "checkOut", filters.checkOut);
  appendIfNotEmpty(params, "minPrice", filters.minPrice);
  appendIfNotEmpty(params, "maxPrice", filters.maxPrice);
  appendIfNotEmpty(params, "sort", filters.sort);
  appendIfNotEmpty(params, "minRating", filters.minRating);
  if (filters.hasPhotos) params.set("hasPhotos", "1");
  if (filters.hasReviews) params.set("hasReviews", "1");
  if (filters.familyFriendly) params.set("familyFriendly", "1");
  if (filters.petsAllowed) params.set("petsAllowed", "1");
  if (filters.nearSea) params.set("nearSea", "1");
  if (filters.hasPool) params.set("hasPool", "1");
  if (filters.hasKitchen) params.set("hasKitchen", "1");
  if (filters.hasAirConditioner) params.set("hasAirConditioner", "1");
  if (filters.hasParking) params.set("hasParking", "1");
  if (filters.smokingForbidden) params.set("smokingForbidden", "1");
  if (filters.quietHours) params.set("quietHours", "1");
  appendListIfNotEmpty(params, "amenityIds", filters.amenityIds);
  appendListIfNotEmpty(params, "roomFeatureIds", filters.roomFeatureIds);
  return params.toString();
}
