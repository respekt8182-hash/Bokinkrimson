import { buildCanonicalPath } from "@/lib/seo/canonical";

export const housingHubPath = "/rent";
export const attractionsHubPath = "/attractions";
export const excursionsHubPath = "/excursions";
export const toursHubPath = "/tours";
export const transfersHubPath = "/transfers";

const housingHubQueryOrder = ["location", "propertyType"] as const;
const excursionHubQueryOrder = ["location"] as const;
const marketplaceHubQueryOrder = ["q", "location", "radiusKm"] as const;

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

export function buildAttractionsHubPath(input?: {
  query?: string | null;
  location?: string | null;
  radiusKm?: number | string | null;
}): string {
  const entries: Array<[string, string]> = [];

  if (input?.query) {
    entries.push(["q", input.query]);
  }

  if (input?.location) {
    entries.push(["location", input.location]);
  }

  if (input?.radiusKm) {
    entries.push(["radiusKm", String(input.radiusKm)]);
  }

  return buildCanonicalPath(attractionsHubPath, entries, marketplaceHubQueryOrder);
}

export function buildTransfersHubPath(input?: {
  query?: string | null;
  location?: string | null;
  radiusKm?: number | string | null;
}): string {
  const entries: Array<[string, string]> = [];

  if (input?.query) {
    entries.push(["q", input.query]);
  }

  if (input?.location) {
    entries.push(["location", input.location]);
  }

  if (input?.radiusKm) {
    entries.push(["radiusKm", String(input.radiusKm)]);
  }

  return buildCanonicalPath(transfersHubPath, entries, marketplaceHubQueryOrder);
}

export function buildHousingLocationPath(locationSlug: string): string {
  return `/crimea/${encodeURIComponent(locationSlug)}`;
}

export function buildExcursionsLocationPath(locationSlug: string): string {
  return `/excursions/${encodeURIComponent(locationSlug)}`;
}
