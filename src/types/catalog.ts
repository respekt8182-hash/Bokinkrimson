// Shared TypeScript contracts for housing catalog filters, cards, and paginated responses.
import type { PublicCatalogItem } from "@/lib/public-properties";

export type CatalogViewMode = "list" | "grid";

export interface ResultCardData {
  id: string;
  name: string;
  type: "guest_house" | "hotel" | "hostel" | "camping" | string;
  location: string;
  rating: number | null;
  reviewCount: number;
  amenities: string[];
  pricePerNight: number;
  priceTotal: number;
  currency: "RUB";
  previewPhotoUrl: string;
  photoCount: number;
  badge?: "top" | "new" | "sale";
  slug: string;
  lat: number;
  lng: number;
}

export type SearchFilters = {
  direction: "housing";
  query: string;
  location: string;
  locationId: string;
  propertyType: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  guestsAdults: string;
  guestsChildren: string;
  minPrice: string;
  maxPrice: string;
  sort: "" | "relevance" | "price_asc" | "price_desc" | "rating_desc" | "popular_desc";
  minRating: string;
  hasPhotos: boolean;
  hasReviews: boolean;
  familyFriendly: boolean;
  petsAllowed: boolean;
};

export type SearchResponse = {
  items: PublicCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
};

export type SearchApiResponse = {
  items: PublicCatalogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type EmptyStateSuggestion = {
  title: string;
  description: string;
  ctaLabel: string;
  filters: Partial<SearchFilters>;
  count: number;
};

