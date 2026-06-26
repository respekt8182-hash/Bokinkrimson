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
  nonApplicabilityReason?: string | null;
  ownerConfirmationAccepted?: boolean | null;
};

export type RegistryPublicationIssue =
  | "REGISTRY_ID_REQUIRED"
  | "REGISTRY_URL_REQUIRED"
  | "REGISTRY_ACTIVE_REQUIRED"
  | "REGISTRY_CHECK_EXPIRED"
  | "NON_APPLICABILITY_REASON_REQUIRED"
  | "OWNER_CONFIRMATION_REQUIRED"
  | "REGISTRY_REVIEW_REQUIRED"
  | "REGISTRY_UNSURE_BLOCKS_PUBLICATION";

export type RegistryModerationDecision =
  | "CAN_PUBLISH"
  | "SEND_TO_REGISTRY_REVIEW"
  | "BLOCK_PUBLICATION";

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

export function requiresRegistryReviewForNonApplicable(type: LegalListingType): boolean {
  return type === "PRIVATE_RENTAL" || type === "NON_ACCOMMODATION_LISTING";
}

export function getRegistryPublicationIssues(
  data: AccommodationRegistryData,
  now = new Date(),
  maxAgeDays = DEFAULT_MAX_REGISTRY_CHECK_AGE_DAYS,
): RegistryPublicationIssue[] {
  if (!requiresAccommodationRegistry(data.legalListingType)) {
    const issues: RegistryPublicationIssue[] = [];

    if (data.legalListingType === "NON_ACCOMMODATION_LISTING") {
      issues.push("REGISTRY_UNSURE_BLOCKS_PUBLICATION");
    }

    if (requiresRegistryReviewForNonApplicable(data.legalListingType)) {
      if (isBlank(data.nonApplicabilityReason)) {
        issues.push("NON_APPLICABILITY_REASON_REQUIRED");
      }

      if (!data.ownerConfirmationAccepted) {
        issues.push("OWNER_CONFIRMATION_REQUIRED");
      }

      if (data.registryStatus !== "ACTIVE") {
        issues.push("REGISTRY_REVIEW_REQUIRED");
      }
    }

    return issues;
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

export function getRegistryModerationDecision(
  data: AccommodationRegistryData,
): RegistryModerationDecision {
  const issues = getRegistryPublicationIssues(data);

  if (issues.length === 0) {
    return "CAN_PUBLISH";
  }

  if (issues.includes("REGISTRY_UNSURE_BLOCKS_PUBLICATION")) {
    return "BLOCK_PUBLICATION";
  }

  if (
    issues.every((issue) =>
      ["REGISTRY_REVIEW_REQUIRED", "REGISTRY_CHECK_EXPIRED"].includes(issue),
    )
  ) {
    return "SEND_TO_REGISTRY_REVIEW";
  }

  return "BLOCK_PUBLICATION";
}
