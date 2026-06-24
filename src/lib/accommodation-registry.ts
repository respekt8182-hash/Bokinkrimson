export type LegalListingType =
  | "PRIVATE_RENTAL"
  | "GUEST_HOUSE"
  | "CLASSIFIED_ACCOMMODATION"
  | "NON_ACCOMMODATION_LISTING";

export type AccommodationRegistryStatus = "ACTIVE" | "SUSPENDED" | "EXPIRED" | "NOT_VERIFIED";

export type AccommodationRegistryData = {
  legalListingType: LegalListingType;
  registryId?: string | null;
  registryUrl?: string | null;
  registryStatus?: AccommodationRegistryStatus | null;
  registryCheckedAt?: Date | string | null;
  registryType?: string | null;
  registryCategory?: string | null;
};

export type RegistryPublicationIssue =
  | "REGISTRY_ID_REQUIRED"
  | "REGISTRY_URL_REQUIRED"
  | "REGISTRY_ACTIVE_REQUIRED"
  | "REGISTRY_CHECK_EXPIRED";

const registryRequiredTypes: LegalListingType[] = ["GUEST_HOUSE", "CLASSIFIED_ACCOMMODATION"];
const DEFAULT_MAX_REGISTRY_CHECK_AGE_DAYS = 30;

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function parseRegistryDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function requiresAccommodationRegistry(type: LegalListingType): boolean {
  return registryRequiredTypes.includes(type);
}

export function getRegistryPublicationIssues(
  data: AccommodationRegistryData,
  now = new Date(),
  maxAgeDays = DEFAULT_MAX_REGISTRY_CHECK_AGE_DAYS,
): RegistryPublicationIssue[] {
  if (!requiresAccommodationRegistry(data.legalListingType)) {
    return [];
  }

  const issues: RegistryPublicationIssue[] = [];

  if (isBlank(data.registryId)) {
    issues.push("REGISTRY_ID_REQUIRED");
  }

  if (isBlank(data.registryUrl)) {
    issues.push("REGISTRY_URL_REQUIRED");
  }

  if (data.registryStatus !== "ACTIVE") {
    issues.push("REGISTRY_ACTIVE_REQUIRED");
  }

  const checkedAt = parseRegistryDate(data.registryCheckedAt);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  if (!checkedAt || now.getTime() - checkedAt.getTime() > maxAgeMs) {
    issues.push("REGISTRY_CHECK_EXPIRED");
  }

  return issues;
}

export function canPublishAccommodationListing(data: AccommodationRegistryData): boolean {
  return getRegistryPublicationIssues(data).length === 0;
}
