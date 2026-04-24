import { buildCanonicalPath } from "@/lib/seo/canonical";

export const housingHubPath = "/rent";
export const excursionsHubPath = "/excursions";
export const toursHubPath = "/tours";

const housingHubQueryOrder = ["location", "propertyType"] as const;
const excursionHubQueryOrder = ["location"] as const;

export function buildHousingHubPath(input?: {
  location?: string | null;
  propertyType?: string | null;
}): string {
  const entries: Array<[string, string]> = [];

  if (input?.location) {
    entries.push(["location", input.location]);
  }

  if (input?.propertyType) {
    entries.push(["propertyType", input.propertyType]);
  }

  return buildCanonicalPath(housingHubPath, entries, housingHubQueryOrder);
}

export function buildExcursionsHubPath(input?: { location?: string | null }): string {
  const entries: Array<[string, string]> = [];

  if (input?.location) {
    entries.push(["location", input.location]);
  }

  return buildCanonicalPath(excursionsHubPath, entries, excursionHubQueryOrder);
}

export function buildToursHubPath(input?: { location?: string | null }): string {
  const entries: Array<[string, string]> = [];

  if (input?.location) {
    entries.push(["location", input.location]);
  }

  return buildCanonicalPath(toursHubPath, entries, excursionHubQueryOrder);
}

export function buildHousingLocationPath(locationSlug: string): string {
  return `/crimea/${encodeURIComponent(locationSlug)}`;
}

export function buildExcursionsLocationPath(locationSlug: string): string {
  return `/excursions/${encodeURIComponent(locationSlug)}`;
}
