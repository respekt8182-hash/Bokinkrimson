import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getRegistryModerationDecision,
  getRegistryPublicationIssues,
} from "@/lib/accommodation-registry";
import { ManualNpdReceiptProvider, assertPlatformServicePaymentAllowed } from "@/lib/npd-receipts";
import { calculatePeriodicPreliminaryRefund } from "@/lib/refunds";
import {
  getOwnerNpdStatement,
  getPublicRequisites,
  legalConfig,
  validateLegalConfig,
} from "@/config/legal";
import { getPlacementBasePrice, placementTariffs } from "@/lib/placement-pricing";
import { publicObjectTariffCards, publicServiceTariffRows } from "@/lib/site-tariffs";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";

function repoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const publicLegalFiles = [
  "src/app/documents/page.tsx",
  "src/app/about/page.tsx",
  "src/app/cooperation/page.tsx",
  "src/app/legal/page.tsx",
  "src/app/legal/terms/page.tsx",
  "src/app/oferta/page.tsx",
  "src/app/uslugi-i-tarify/page.tsx",
  "src/app/legal/privacy/page.tsx",
  "src/app/legal/personal-data-consent/page.tsx",
  "src/app/legal/public-data-consent/page.tsx",
  "src/app/legal/marketing-consent/page.tsx",
  "src/app/legal/review-publication-consent/page.tsx",
  "src/app/legal/cookies/page.tsx",
  "src/app/legal/requisites/page.tsx",
  "src/app/legal/refund/page.tsx",
  "src/app/legal/copyright-complaint/page.tsx",
  "src/app/refund-request/page.tsx",
  "src/components/legal/legal-documents-hub.tsx",
  "src/components/legal/standard-legal-page.tsx",
  "src/components/legal/refund-request-form.tsx",
  "src/components/payments/property-payment-panel.tsx",
  "src/components/pricing/placement-promo.tsx",
];

const forbiddenPublicPhrases = [
  "Документ является проектом",
  "проверки юристом",
  "требуется проверка юристом",
  "не является гарантией полного соответствия",
  "укажи реальный почтовый адрес",
  "берётся из конфигурации",
  "если автоматическая интеграция не настроена",
  "создаётся задача на ручное формирование",
  "создается задача на ручное формирование",
  "даты создания объявления",
  "с даты создания карточки",
  "LEAD_DIRECTORY",
  "Checkbox",
  "opt-in",
  "TODO",
  "FIXME",
  "placeholder",
  "[ПОЧТОВЫЙ",
  "[СТРАНА",
  "[РЕГИОН",
  "[НОМЕР",
];

const publicOperationalFiles = [
  "src/app/api/ksr/verify/route.ts",
  "src/components/objects/object-wizard.tsx",
  "src/lib/npd-receipts.ts",
];

describe("legal compliance foundation", () => {
  it("does not expose draft phrases or internal terms on public legal surfaces", () => {
    const publicText = publicLegalFiles.map(repoFile).join("\n");

    for (const phrase of forbiddenPublicPhrases) {
      expect(publicText).not.toContain(phrase);
    }
  });

  it("does not expose integration fallback details in public operational messages", () => {
    const publicText = publicOperationalFiles.map(repoFile).join("\n");

    expect(publicText).not.toContain("Автоматическая проверка");
    expect(publicText).not.toContain("автоматическая интеграция");
    expect(publicText).not.toContain("ручного формирования");
    expect(publicText).not.toContain("создаётся задача");
  });

  it("shows owner status as NPD and does not mention OGRNIP in the statement", () => {
    const statement = getOwnerNpdStatement();

    expect(statement).toContain("Налог на профессиональный доход");
    expect(statement).toContain("ИНН");
    expect(statement).not.toContain("ОГРНИП");
  });

  it("uses one public requisites source and omits unknown public placeholders", () => {
    const requisites = getPublicRequisites();

    expect(requisites).toContainEqual({ label: "ФИО исполнителя", value: legalConfig.owner.fullName });
    expect(requisites).toContainEqual({ label: "ИНН", value: legalConfig.owner.inn });
    expect(requisites.some((item) => item.value.includes("[") || item.value.includes("TODO"))).toBe(false);
  });

  it("keeps release blockers in production validation instead of public pages", () => {
    const errors = validateLegalConfig(legalConfig);

    expect(errors).toContain("LEGAL_CLAIMS_POSTAL_ADDRESS is required");
    expect(errors).toContain("LEGAL_PRIMARY_DATABASE_COUNTRY is required");
    expect(repoFile("LEGAL_RELEASE_BLOCKERS.md")).toContain("LEGAL_CLAIMS_POSTAL_ADDRESS");
  });

  it("keeps accommodation payments disabled and allows only configured platform services", () => {
    expect(legalConfig.business.accommodationPaymentsEnabled).toBe(false);
    expect(() => assertPlatformServicePaymentAllowed("размещение карточки")).not.toThrow();
    expect(() => assertPlatformServicePaymentAllowed("оплата проживания")).toThrow(
      /Only explicitly configured platform services/,
    );
  });

  it("blocks registry-required listings without active registry data", () => {
    expect(
      getRegistryPublicationIssues({
        legalListingType: "GUEST_HOUSE",
        registryId: null,
        registryUrl: null,
        registryStatus: "NOT_VERIFIED",
      }),
    ).toEqual([
      "REGISTRY_ID_REQUIRED",
      "REGISTRY_URL_REQUIRED",
      "REGISTRY_ACTIVE_REQUIRED",
      "REGISTRY_CHECK_EXPIRED",
    ]);

    expect(
      getRegistryPublicationIssues(
        {
          legalListingType: "CLASSIFIED_ACCOMMODATION",
          registryId: "123",
          registryUrl: "https://example.test/registry/123",
          registryStatus: "ACTIVE",
          registryCheckedAt: "2026-06-20T00:00:00.000Z",
        },
        new Date("2026-06-24T00:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("sends non-applicable classification claims to moderation and blocks unsure choices", () => {
    expect(
      getRegistryModerationDecision({
        legalListingType: "PRIVATE_RENTAL",
        nonApplicabilityReason: "Жилое помещение не является средством размещения",
        ownerConfirmationAccepted: true,
        registryStatus: "NOT_VERIFIED",
      }),
    ).toBe("SEND_TO_REGISTRY_REVIEW");

    expect(
      getRegistryModerationDecision({
        legalListingType: "NON_ACCOMMODATION_LISTING",
        nonApplicabilityReason: "Не уверен",
        ownerConfirmationAccepted: true,
        registryStatus: "NOT_VERIFIED",
      }),
    ).toBe("BLOCK_PUBLICATION");
  });

  it("keeps marketing consent optional and evidence for offer and personal data separate", () => {
    expect(repoFile("prisma/schema.prisma")).toContain("ConsentEvent");
    expect(repoFile("prisma/schema.prisma")).toContain("PlatformServiceOrder");
    expect(repoFile("src/app/legal/marketing-consent/page.tsx")).toContain("Необязательное");
    expect(repoFile("src/app/oferta/page.tsx")).toContain("оформляются отдельно от акцепта оферты");
  });

  it("does not load optional analytics until cookie consent allows it", () => {
    const source = CookieConsentBanner.toString();

    expect(source).toContain("analyticsAllowed");
    expect(source).toContain("analyticsAllowed ?");
    expect(source).toContain("yandex-metrika");
  });

  it("keeps tariff durations aligned with the legal model", () => {
    expect(publicObjectTariffCards.map((item) => item.id).sort()).toEqual(["season", "yearly"]);
    expect(publicServiceTariffRows.every((row) => row.durationLabel === "12 месяцев")).toBe(true);
    expect(getPlacementBasePrice("excursion", "season")).toBe(placementTariffs.excursion.yearPrice);
    expect(getPlacementBasePrice("tour", "season")).toBe(placementTariffs.tour.yearPrice);
    expect(getPlacementBasePrice("transfer", "season")).toBe(placementTariffs.transfer.yearPrice);
  });

  it("calculates only a preliminary refund amount", () => {
    const result = calculatePeriodicPreliminaryRefund({
      paidAmount: 10_000,
      usedDays: 3,
      totalServiceDays: 10,
      documentedActualExpenses: 500,
    });

    expect(result.providedValue).toBe(3_000);
    expect(result.preliminaryRefund).toBe(6_500);
    expect(result.notice).toContain("Предварительная сумма");
  });

  it("uses manual NPD receipt status without promising automatic receipt integration", async () => {
    const provider = new ManualNpdReceiptProvider();
    const result = await provider.createReceipt({
      id: "order-id",
      orderNumber: "ORD-1",
      serviceName: "размещение карточки",
      amount: 1000,
      offerVersion: legalConfig.documents.offerVersion,
    });

    expect(result.status).toBe("receipt_pending_manual_issue");
    expect(result.adminNotificationRequired).toBe(true);
    expect(result.receiptUrl).toBeUndefined();
  });
});
