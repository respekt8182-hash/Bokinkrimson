import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentStatus } from "@prisma/client";

const dbMocks = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  paymentUpdate: vi.fn(),
  webhookReceiptCreate: vi.fn(),
  webhookReceiptUpdate: vi.fn(),
  transaction: vi.fn(),
}));

const yookassaMocks = vi.hoisted(() => ({
  getYookassaPayment: vi.fn(),
  isTrustedYookassaWebhookSource: vi.fn(),
  isYookassaConfigured: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const excursionMocks = vi.hoisted(() => ({
  autoSubmitExcursionAfterSuccessfulPayment: vi.fn(),
}));

const transferMocks = vi.hoisted(() => ({
  autoSubmitTransferAfterSuccessfulPayment: vi.fn(),
  submitTransferToModerationIfReady: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    payment: {
      findFirst: dbMocks.paymentFindFirst,
      update: dbMocks.paymentUpdate,
    },
    webhookReceipt: {
      create: dbMocks.webhookReceiptCreate,
      update: dbMocks.webhookReceiptUpdate,
    },
    $transaction: dbMocks.transaction,
  },
}));

vi.mock("@/lib/yookassa", () => ({
  getYookassaPayment: yookassaMocks.getYookassaPayment,
  isTrustedYookassaWebhookSource: yookassaMocks.isTrustedYookassaWebhookSource,
  isYookassaConfigured: yookassaMocks.isYookassaConfigured,
}));

vi.mock("@/lib/logger", () => ({
  logger: loggerMocks,
}));

vi.mock("@/lib/properties", () => ({
  autoSubmitPropertyAfterSuccessfulPayment: vi.fn(),
}));

vi.mock("@/lib/excursions", () => ({
  autoSubmitExcursionAfterSuccessfulPayment:
    excursionMocks.autoSubmitExcursionAfterSuccessfulPayment,
}));

vi.mock("@/lib/transfers", () => ({
  autoSubmitTransferAfterSuccessfulPayment: transferMocks.autoSubmitTransferAfterSuccessfulPayment,
  submitTransferToModerationIfReady: transferMocks.submitTransferToModerationIfReady,
}));

async function loadWebhookRoute() {
  vi.resetModules();
  return import("../../src/app/api/payments/yookassa/webhook/route");
}

describe("YooKassa webhook hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    yookassaMocks.isTrustedYookassaWebhookSource.mockReturnValue(true);
    yookassaMocks.isYookassaConfigured.mockReturnValue(true);
    dbMocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        payment: { update: dbMocks.paymentUpdate },
        webhookReceipt: { update: dbMocks.webhookReceiptUpdate },
      }),
    );
  });

  it("does not confirm payment when provider-side verification fails", async () => {
    yookassaMocks.getYookassaPayment.mockRejectedValue(new Error("provider unavailable"));

    const { POST } = await loadWebhookRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/payments/yookassa/webhook", {
        method: "POST",
        body: JSON.stringify({
          event: "payment.succeeded",
          object: { id: "provider-payment-1" },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(dbMocks.paymentFindFirst).not.toHaveBeenCalled();
    expect(dbMocks.paymentUpdate).not.toHaveBeenCalled();
    expect(dbMocks.webhookReceiptCreate).not.toHaveBeenCalled();
  });

  it("auto-submits an excursion after verified successful payment", async () => {
    yookassaMocks.getYookassaPayment.mockResolvedValue({
      id: "provider-payment-1",
      status: "succeeded",
      paid: true,
      amount: {
        value: "1990.00",
        currency: "RUB",
      },
    });
    dbMocks.paymentFindFirst.mockResolvedValue({
      id: "payment-1",
      status: PaymentStatus.PENDING,
      confirmationUrl: null,
      providerPayload: null,
      propertyId: null,
      excursionId: "excursion-1",
      paidAt: null,
      canceledAt: null,
      placementValidUntil: null,
    });
    dbMocks.webhookReceiptCreate.mockResolvedValue({ id: "receipt-1" });
    dbMocks.paymentUpdate.mockResolvedValue({
      id: "payment-1",
      status: PaymentStatus.SUCCEEDED,
      propertyId: null,
      excursionId: "excursion-1",
    });
    dbMocks.webhookReceiptUpdate.mockResolvedValue({ id: "receipt-1" });

    const { POST } = await loadWebhookRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/payments/yookassa/webhook", {
        method: "POST",
        body: JSON.stringify({
          event: "payment.succeeded",
          object: { id: "provider-payment-1" },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(excursionMocks.autoSubmitExcursionAfterSuccessfulPayment).toHaveBeenCalledWith(
      expect.anything(),
      "excursion-1",
    );
  });

  it("auto-submits a legacy transfer payment using the tariff reference", async () => {
    yookassaMocks.getYookassaPayment.mockResolvedValue({
      id: "provider-payment-transfer",
      status: "succeeded",
      paid: true,
      amount: {
        value: "990.00",
        currency: "RUB",
      },
    });
    dbMocks.paymentFindFirst.mockResolvedValue({
      id: "payment-transfer-1",
      status: PaymentStatus.PENDING,
      confirmationUrl: null,
      providerPayload: null,
      propertyId: null,
      excursionId: null,
      transferId: null,
      tariffCode: "transfer_standard:transfer-1",
      paidAt: null,
      canceledAt: null,
      placementValidUntil: null,
    });
    dbMocks.webhookReceiptCreate.mockResolvedValue({ id: "receipt-transfer-1" });
    dbMocks.paymentUpdate.mockResolvedValue({
      id: "payment-transfer-1",
      status: PaymentStatus.SUCCEEDED,
      propertyId: null,
      excursionId: null,
      transferId: null,
    });
    dbMocks.webhookReceiptUpdate.mockResolvedValue({ id: "receipt-transfer-1" });

    const { POST } = await loadWebhookRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/payments/yookassa/webhook", {
        method: "POST",
        body: JSON.stringify({
          event: "payment.succeeded",
          object: { id: "provider-payment-transfer" },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(transferMocks.submitTransferToModerationIfReady).toHaveBeenCalledWith(
      expect.anything(),
      "transfer-1",
    );
    expect(transferMocks.autoSubmitTransferAfterSuccessfulPayment).not.toHaveBeenCalled();
  });
});
