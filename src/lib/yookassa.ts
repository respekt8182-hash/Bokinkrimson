// Domain/service module for yookassa.
const YOOKASSA_API_BASE = "https://api.yookassa.ru/v3";

type YookassaConfig = {
  shopId: string;
  secretKey: string;
  returnUrl: string;
};

export type YookassaCreatePaymentInput = {
  idempotenceKey: string;
  amountRub: number;
  description: string;
  metadata: Record<string, string>;
};

export type YookassaPaymentResponse = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  cancellation_details?: {
    reason: string;
    party: string;
  };
  metadata?: Record<string, string>;
};

function getConfig(): YookassaConfig | null {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim() ?? "";
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() ?? "";
  const returnUrl = process.env.YOOKASSA_RETURN_URL?.trim() ?? "";

  if (!shopId || !secretKey || !returnUrl) {
    return null;
  }

  return { shopId, secretKey, returnUrl };
}

function getAuthHeader(shopId: string, secretKey: string): string {
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  return `Basic ${credentials}`;
}

export function isYookassaConfigured(): boolean {
  return Boolean(getConfig());
}

export async function createYookassaPayment(
  input: YookassaCreatePaymentInput,
): Promise<YookassaPaymentResponse> {
  const config = getConfig();
  if (!config) {
    throw new Error("YOOKASSA_NOT_CONFIGURED");
  }

  const response = await fetch(`${YOOKASSA_API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(config.shopId, config.secretKey),
      "Content-Type": "application/json",
      "Idempotence-Key": input.idempotenceKey,
    },
    body: JSON.stringify({
      amount: {
        value: input.amountRub.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: config.returnUrl,
      },
      capture: true,
      description: input.description,
      metadata: input.metadata,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`YOOKASSA_CREATE_FAILED:${response.status}:${bodyText}`);
  }

  return (await response.json()) as YookassaPaymentResponse;
}

export async function getYookassaPayment(paymentId: string): Promise<YookassaPaymentResponse> {
  const config = getConfig();
  if (!config) {
    throw new Error("YOOKASSA_NOT_CONFIGURED");
  }

  const response = await fetch(`${YOOKASSA_API_BASE}/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(config.shopId, config.secretKey),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`YOOKASSA_GET_FAILED:${response.status}:${bodyText}`);
  }

  return (await response.json()) as YookassaPaymentResponse;
}
