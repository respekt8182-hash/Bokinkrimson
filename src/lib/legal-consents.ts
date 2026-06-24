import { legalConfig } from "@/config/legal";

export type ConsentEvidence = {
  consentType:
    | "personal_data"
    | "public_data_distribution"
    | "marketing"
    | "cookies_functional"
    | "cookies_analytics"
    | "review_publication";
  action: "granted" | "revoked" | "updated";
  documentVersion: string;
  url: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  categories?: string[];
  createdAt: string;
};

export function buildConsentEvidence(
  input: Omit<ConsentEvidence, "createdAt" | "documentVersion"> & {
    documentVersion?: string;
  },
): ConsentEvidence {
  return {
    consentType: input.consentType,
    action: input.action,
    documentVersion: input.documentVersion ?? legalConfig.documents.personalDataConsentVersion,
    url: input.url,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    categories: input.categories ?? [],
    createdAt: new Date().toISOString(),
  };
}

export function hasExplicitConsent(evidence: ConsentEvidence | null | undefined): boolean {
  return Boolean(evidence && evidence.action === "granted" && evidence.documentVersion.trim());
}
