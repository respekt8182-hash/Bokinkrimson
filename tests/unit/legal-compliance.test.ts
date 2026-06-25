import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRegistryPublicationIssues } from "@/lib/accommodation-registry";
import { ManualNpdReceiptProvider, assertPlatformServicePaymentAllowed } from "@/lib/npd-receipts";
import { calculatePeriodicPreliminaryRefund } from "@/lib/refunds";
import { getOwnerNpdStatement, legalConfig, validateLegalConfig } from "@/config/legal";

function repoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("legal compliance foundation", () => {
  it("shows owner status as NPD and does not mention OGRNIP in the statement", () => {
    const statement = getOwnerNpdStatement();

    expect(statement).toContain("Налог на профессиональный доход");
    expect(statement).toContain("ИНН");
    expect(statement).not.toContain("ОГРНИП");
  });

  it("keeps accommodation payments disabled and allows only configured platform services", () => {
    expect(legalConfig.business.accommodationPaymentsEnabled).toBe(false);
    expect(() => assertPlatformServicePaymentAllowed("размещение карточки")).not.toThrow();
    expect(() => assertPlatformServicePaymentAllowed("оплата проживания")).toThrow(
      /Only explicitly configured platform services/,
    );
  });

  it("reports placeholders and accommodation payment flags in production validation", () => {
    const errors = validateLegalConfig(legalConfig);
    expect(errors).toContain("owner.claimsPostalAddress contains placeholder value");
    expect(errors).toContain("personalData.primaryDatabaseCountry contains placeholder value");

    const invalid = {
      ...legalConfig,
      business: {
        ...legalConfig.business,
        accommodationPaymentsEnabled: true,
      },
    };

    expect(validateLegalConfig(invalid as typeof legalConfig)).toContain(
      "accommodation payments must be disabled for LEAD_DIRECTORY mode",
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

  it("uses manual NPD receipt status when no official integration is configured", async () => {
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

  it("keeps public CTA and legal pages aligned with lead-directory mode", () => {
    const propertyDetails = repoFile("src/components/public/public-property-details.tsx");
    const oferta = repoFile("src/app/oferta/page.tsx");

    expect(propertyDetails).toContain("Запросить");
    expect(propertyDetails).toContain("Отправка запроса не подтверждает бронирование");
    expect(oferta).toContain("Оплата проживания, экскурсий или иных услуг владельцев объектов");
    expect(oferta).not.toContain("если это применимо");
  });
});
