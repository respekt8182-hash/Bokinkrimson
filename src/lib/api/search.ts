// Client-side helpers for building housing search requests, URLs, and normalized responses.
import type { PublicCatalogItem } from "@/lib/public-properties";
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
): URLSearchParams {
  const params = new URLSearchParams();

  params.set("page", String(Math.max(1, page)));
  params.set("page_size", String(Math.max(1, pageSize)));

  appendIfNotEmpty(params, "q", filters.query);
  appendIfNotEmpty(params, "location", filters.location);
  appendIfNotEmpty(params, "locationId", filters.locationId);
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
): Promise<SearchResponse> {
  const query = buildAccommodationSearchParams(filters, page, pageSize).toString();
  const response = await fetch(`/api/search/accommodations?${query}`, {
    method: "GET",
    signal,
    cache: "no-store",
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
  return params.toString();
}
