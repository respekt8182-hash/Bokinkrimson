const YOOKASSA_API_BASE = "https://api.yookassa.ru/v3";

type YookassaConfig = {
  shopId: string;
  secretKey: string;
  returnUrl: string;
  webhookAllowlist: string[];
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

function splitConfiguredValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfig(): YookassaConfig | null {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim() ?? "";
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() ?? "";
  const returnUrl = process.env.YOOKASSA_RETURN_URL?.trim() ?? "";
  const webhookAllowlist = splitConfiguredValues(process.env.YOOKASSA_WEBHOOK_IP_ALLOWLIST);

  if (!shopId || !secretKey || !returnUrl) {
    return null;
  }

  return { shopId, secretKey, returnUrl, webhookAllowlist };
}

function getAuthHeader(shopId: string, secretKey: string): string {
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  return `Basic ${credentials}`;
}

function ipToInteger(ip: string): number | null {
  const segments = ip.split(".");
  if (segments.length !== 4) {
    return null;
  }

  let result = 0;

  for (const segment of segments) {
    const parsed = Number.parseInt(segment, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
      return null;
    }

    result = (result << 8) + parsed;
  }

  return result >>> 0;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/");
  const ipInt = ipToInteger(ip);
  const networkInt = ipToInteger(network);
  const prefix = Number.parseInt(prefixRaw ?? "", 10);

  if (ipInt === null || networkInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

export function isYookassaConfigured(): boolean {
  return Boolean(getConfig());
}

export function isTrustedYookassaWebhookSource(request: Request): boolean {
  const config = getConfig();
  if (!config || config.webhookAllowlist.length === 0) {
    return false;
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const candidate = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  if (!candidate) {
    return false;
  }

  return config.webhookAllowlist.some((allowed) =>
    allowed.includes("/") ? matchesCidr(candidate, allowed) : allowed === candidate,
  );
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
    cache: "no-store",
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`YOOKASSA_GET_FAILED:${response.status}:${bodyText}`);
  }

  return (await response.json()) as YookassaPaymentResponse;
}
