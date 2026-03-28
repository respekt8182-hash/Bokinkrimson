// Zod schema for public housing search query params shared by catalog and map endpoints.
import { z } from "zod";

const booleanParamSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "") {
    return false;
  }
  return undefined;
}, z.boolean().optional());

export const SearchFiltersSchema = z.object({
  location: z.string().trim().max(120).optional(),
  locationId: z.string().trim().max(120).optional(),
  query: z.string().trim().max(160).optional(),
  q: z.string().trim().max(160).optional(),
  checkIn: z.string().trim().optional(),
  checkOut: z.string().trim().optional(),
  guests: z.coerce.number().int().min(1).max(20).optional(),
  guestsAdults: z.coerce.number().int().min(1).max(20).optional(),
  guestsChildren: z.coerce.number().int().min(0).max(20).optional(),
  sort: z.string().trim().max(40).default("recommended"),
  minRating: z.coerce.number().min(0).max(5).optional(),
  hasPhotos: booleanParamSchema,
  hasReviews: booleanParamSchema,
  familyFriendly: booleanParamSchema,
  kidsFriendly: booleanParamSchema,
  petsAllowed: booleanParamSchema,
  propertyType: z.string().trim().max(80).optional(),
  type: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  page_size: z.coerce.number().int().min(1).max(30).default(30),
  pageSize: z.coerce.number().int().min(1).max(30).optional(),
});

export type SearchFiltersInput = z.infer<typeof SearchFiltersSchema>;
