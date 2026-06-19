import { PaymentStatus, type Prisma } from "@prisma/client";

const YOOKASSA_API_BASE_URL = "https://api.yookassa.ru/v3";
const YOOKASSA_PAYMENT_DESCRIPTION_MAX_LENGTH = 128;
const YOOKASSA_RECEIPT_ITEM_DESCRIPTION_MAX_LENGTH = 128;
const DEFAULT_YOOKASSA_RECEIPT_VAT_CODE = 1;

const YOOKASSA_PAYMENT_MODES = ["full_payment", "full_prepayment"] as const;

export type YooKassaPaymentMode = (typeof YOOKASSA_PAYMENT_MODES)[number];

export type YooKassaReceiptCustomer = {
  email?: string;
  phone?: string;
  full_name?: string;
};

export type YooKassaReceiptItem = {
  description: string;
  quantity: number;
  amount: {
    value: string;
    currency: "RUB";
  };
  vat_code: number;
  payment_mode: YooKassaPaymentMode;
  payment_subject: "service";
};

export type YooKassaPaymentReceipt = {
  customer: YooKassaReceiptCustomer;
  items: YooKassaReceiptItem[];
};

export type YooKassaPaymentStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";

export type YooKassaPayment = {
  id: string;
  status: YooKassaPaymentStatus;
  paid?: boolean;
  amount?: {
    value?: string;
    currency?: string;
  };
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  };
  description?: string;
  metadata?: Record<string, unknown>;
  refundable?: boolean;
  test?: boolean;
  created_at?: string;
  captured_at?: string;
  expires_at?: string;
  cancellation_details?: {
    party?: string;
    reason?: string;
  };
};

export type YooKassaRefund = {
  id: string;
  payment_id?: string;
  status?: string;
  amount?: {
    value?: string;
    currency?: string;
  };
  created_at?: string;
};

export class YooKassaConfigurationError extends Error {
  constructor() {
    super("YOOKASSA_NOT_CONFIGURED");
  }
}

export class YooKassaApiError extends Error {
  status: number;
  responseBody: unknown;

  constructor(status: number, responseBody: unknown) {
    super("YOOKASSA_API_ERROR");
    this.status = status;
    this.responseBody = responseBody;
  }
}

function getYooKassaShopId(): string {
  return process.env.YOOKASSA_SHOP_ID?.trim() ?? "";
}

function getYooKassaSecretKey(): string {
  return process.env.YOOKASSA_SECRET_KEY?.trim() ?? "";
}

export function isYooKassaConfigured(): boolean {
  return Boolean(getYooKassaShopId() && getYooKassaSecretKey());
}

function getYooKassaCredentials(): { shopId: string; secretKey: string } {
  const shopId = getYooKassaShopId();
  const secretKey = getYooKassaSecretKey();

  if (!shopId || !secretKey) {
    throw new YooKassaConfigurationError();
  }

  return { shopId, secretKey };
}

function getAuthHeader(): string {
  const { shopId, secretKey } = getYooKassaCredentials();
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`;
}

function getAppBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configuredUrl || "http://localhost:3000";
}

export function buildAbsoluteAppUrl(path: string): string {
  const base = getAppBaseUrl();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  return url.toString();
}

function formatYooKassaAmount(valueRub: number): string {
  return Math.max(0, valueRub).toFixed(2);
}

function compactDescription(
  value: string,
  maxLength = YOOKASSA_PAYMENT_DESCRIPTION_MAX_LENGTH,
): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength - 1).trimEnd() : normalized;
}

function normalizeReceiptEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.includes("@") ? normalized : null;
}

function normalizeReceiptPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  const normalized = digits.length === 10 ? `7${digits}` : digits;

  return normalized.length >= 10 && normalized.length <= 15 ? normalized : null;
}

function normalizeReceiptFullName(value: string | null | undefined): string | null {
  const normalized = compactDescription(value ?? "", 256);
  return normalized || null;
}

function getReceiptVatCode(): number {
  const raw = Number(process.env.YOOKASSA_RECEIPT_VAT_CODE ?? DEFAULT_YOOKASSA_RECEIPT_VAT_CODE);
  return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : DEFAULT_YOOKASSA_RECEIPT_VAT_CODE;
}

function getReceiptPaymentMode(): YooKassaPaymentMode {
  const raw = process.env.YOOKASSA_RECEIPT_PAYMENT_MODE?.trim().toLowerCase();
  return YOOKASSA_PAYMENT_MODES.includes(raw as YooKassaPaymentMode)
    ? (raw as YooKassaPaymentMode)
    : "full_payment";
}

export function formatYooKassaReceiptDate(value: Date): string {
  return value.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function buildYooKassaReceiptItemDescription(input: {
  serviceLabel: string;
  listingName?: string | null;
  tariffLabel?: string | null;
  paidFrom?: Date | null;
  paidUntil?: Date | null;
}): string {
  const periodLabel =
    input.paidFrom && input.paidUntil
      ? `период: ${formatYooKassaReceiptDate(input.paidFrom)}-${formatYooKassaReceiptDate(input.paidUntil)}`
      : null;
  const listingName = input.listingName?.trim();
  const parts = [
    input.serviceLabel,
    input.tariffLabel?.trim() || null,
    periodLabel,
    listingName ? `объявление: ${listingName}` : null,
  ].filter((part): part is string => Boolean(part));

  return compactDescription(parts.join("; "), YOOKASSA_RECEIPT_ITEM_DESCRIPTION_MAX_LENGTH);
}

export function buildYooKassaPaymentReceipt(input: {
  amountRub: number;
  itemDescription: string;
  customer: {
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  };
  vatCode?: number;
  paymentMode?: YooKassaPaymentMode;
}): YooKassaPaymentReceipt | null {
  const email = normalizeReceiptEmail(input.customer.email);
  const phone = normalizeReceiptPhone(input.customer.phone);
  const fullName = normalizeReceiptFullName(input.customer.fullName);
  const customer: YooKassaReceiptCustomer = {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(fullName ? { full_name: fullName } : {}),
  };

  if (!customer.email && !customer.phone) {
    return null;
  }

  return {
    customer,
    items: [
      {
        description: compactDescription(
          input.itemDescription,
          YOOKASSA_RECEIPT_ITEM_DESCRIPTION_MAX_LENGTH,
        ),
        quantity: 1,
        amount: {
          value: formatYooKassaAmount(input.amountRub),
          currency: "RUB",
        },
        vat_code: input.vatCode ?? getReceiptVatCode(),
        payment_mode: input.paymentMode ?? getReceiptPaymentMode(),
        payment_subject: "service",
      },
    ],
  };
}

function shouldCapturePayment(): boolean {
  const raw = process.env.YOOKASSA_CAPTURE?.trim().toLowerCase();
  return raw !== "false" && raw !== "0";
}

async function parseYooKassaResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function requestYooKassa<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    idempotenceKey?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: HeadersInit = {
    Authorization: getAuthHeader(),
    "Content-Type": "application/json",
  };

  if (options.idempotenceKey) {
    headers["Idempotence-Key"] = options.idempotenceKey;
  }

  const response = await fetch(`${YOOKASSA_API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const responseBody = await parseYooKassaResponse(response);

  if (!response.ok) {
    throw new YooKassaApiError(response.status, responseBody);
  }

  return responseBody as T;
}

export async function createYooKassaPayment(input: {
  amountRub: number;
  idempotenceKey: string;
  description: string;
  returnUrl: string;
  metadata: Record<string, string | number | boolean | null>;
  receipt?: YooKassaPaymentReceipt | null;
}): Promise<YooKassaPayment> {
  return requestYooKassa<YooKassaPayment>("/payments", {
    method: "POST",
    idempotenceKey: input.idempotenceKey,
    body: {
      amount: {
        value: formatYooKassaAmount(input.amountRub),
        currency: "RUB",
      },
      capture: shouldCapturePayment(),
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      description: compactDescription(input.description),
      metadata: input.metadata,
      ...(input.receipt ? { receipt: input.receipt } : {}),
    },
  });
}

export async function getYooKassaPayment(paymentId: string): Promise<YooKassaPayment> {
  return requestYooKassa<YooKassaPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function getYooKassaRefund(refundId: string): Promise<YooKassaRefund> {
  return requestYooKassa<YooKassaRefund>(`/refunds/${encodeURIComponent(refundId)}`);
}

export function mapYooKassaPaymentStatus(status: string | null | undefined): PaymentStatus {
  switch (status) {
    case "succeeded":
      return PaymentStatus.SUCCEEDED;
    case "canceled":
      return PaymentStatus.CANCELED;
    case "pending":
    case "waiting_for_capture":
    default:
      return PaymentStatus.PENDING;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function mergeYooKassaPaymentPayload(
  providerPayload: Prisma.JsonValue | null,
  payment: YooKassaPayment,
): Prisma.InputJsonObject {
  const base = isRecord(providerPayload)
    ? providerPayload
    : providerPayload === null
      ? {}
      : { legacyProviderPayload: providerPayload };

  return {
    ...base,
    yookassa: {
      id: payment.id,
      status: payment.status,
      paid: payment.paid ?? false,
      amount: (payment.amount as Prisma.InputJsonObject | undefined) ?? null,
      confirmationType: payment.confirmation?.type ?? null,
      refundable: payment.refundable ?? null,
      test: payment.test ?? null,
      createdAt: payment.created_at ?? null,
      capturedAt: payment.captured_at ?? null,
      expiresAt: payment.expires_at ?? null,
      cancellationDetails:
        (payment.cancellation_details as Prisma.InputJsonObject | undefined) ?? null,
      metadata: (payment.metadata as Prisma.InputJsonObject | undefined) ?? null,
    },
  };
}

export function appendYooKassaRefundPayload(
  providerPayload: Prisma.JsonValue | null,
  refund: YooKassaRefund,
): Prisma.InputJsonObject {
  const base = isRecord(providerPayload)
    ? providerPayload
    : providerPayload === null
      ? {}
      : { legacyProviderPayload: providerPayload };
  const currentRefunds = Array.isArray(base.yookassaRefunds) ? base.yookassaRefunds : [];
  const nextRefund = {
    id: refund.id,
    paymentId: refund.payment_id ?? null,
    status: refund.status ?? null,
    amount: (refund.amount as Prisma.InputJsonObject | undefined) ?? null,
    createdAt: refund.created_at ?? null,
  };
  const withoutDuplicate = currentRefunds.filter(
    (item) => !isRecord(item) || item.id !== refund.id,
  );

  return {
    ...base,
    yookassaRefunds: [...withoutDuplicate, nextRefund],
  };
}
