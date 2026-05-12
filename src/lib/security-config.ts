const minimumJwtSecretLength = 32;
const minimumAdminSecretLength = 32;

export type RateLimitMode = "auto" | "memory" | "upstash";

function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test";
}

export function isDevelopmentEnvironment(): boolean {
  return !isProductionEnvironment() && !isTestEnvironment();
}

export function getJwtSecretValue(): string {
  const secret = process.env.JWT_SECRET?.trim() ?? "";

  if (secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short. Use at least 16 chars.");
  }

  return secret;
}

export function getAdminJwtSecretValue(): string {
  const secret = process.env.ADMIN_JWT_SECRET?.trim() ?? "";

  if (secret.length < 16) {
    throw new Error("ADMIN_JWT_SECRET is missing or too short. Use at least 16 chars.");
  }

  return secret;
}

export function getAdminLoginValue(): string {
  const login = process.env.ADMIN_LOGIN?.trim() ?? "";

  if (!login) {
    throw new Error("ADMIN_LOGIN is missing.");
  }

  return login;
}

export function getAdminPasswordHashValue(): string {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim() ?? "";

  if (!hash) {
    throw new Error("ADMIN_PASSWORD_HASH is missing.");
  }

  return hash;
}

function hashFingerprint(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
}

export function getAdminPasswordHashFingerprint(): string {
  return hashFingerprint(getAdminPasswordHashValue());
}

export function isMockPaymentsEnabled(): boolean {
  return !isProductionEnvironment();
}

export function getRateLimitMode(): RateLimitMode {
  const configured = process.env.RATE_LIMIT_MODE?.trim().toLowerCase();

  if (configured === "memory" || configured === "upstash") {
    return configured;
  }

  return "auto";
}

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getConfiguredPublicAssetOrigins(): string[] {
  const origins = new Set<string>();

  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (publicBaseUrl) {
    const origin = toOrigin(publicBaseUrl);
    if (origin) {
      origins.add(origin);
    }
  }

  if (endpoint) {
    const origin = toOrigin(endpoint);
    if (origin) {
      origins.add(origin);
    }
  }

  return [...origins];
}

export function getEmailDeliveryMode(): "smtp" | "log" {
  const configured = process.env.SECURITY_EMAIL_DELIVERY_MODE?.trim().toLowerCase();

  if (configured === "smtp") {
    return "smtp";
  }

  if (configured === "log") {
    return "log";
  }

  return isProductionEnvironment() ? "smtp" : "log";
}

export function getSecurityConfigurationIssues(): string[] {
  const issues: string[] = [];

  if ((process.env.JWT_SECRET?.trim().length ?? 0) < minimumJwtSecretLength) {
    issues.push(`JWT_SECRET must be at least ${minimumJwtSecretLength} characters`);
  }

  if ((process.env.ADMIN_JWT_SECRET?.trim().length ?? 0) < minimumAdminSecretLength) {
    issues.push(`ADMIN_JWT_SECRET must be at least ${minimumAdminSecretLength} characters`);
  }

  if (isBlank(process.env.ADMIN_PASSWORD_HASH)) {
    issues.push("ADMIN_PASSWORD_HASH is required");
  }

  if (isBlank(process.env.ADMIN_LOGIN)) {
    issues.push("ADMIN_LOGIN is required");
  }

  if (
    getRateLimitMode() === "upstash" &&
    (isBlank(process.env.UPSTASH_REDIS_REST_URL) || isBlank(process.env.UPSTASH_REDIS_REST_TOKEN))
  ) {
    issues.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  }

  if (getEmailDeliveryMode() === "smtp") {
    if (
      isBlank(process.env.SMTP_HOST) ||
      isBlank(process.env.SMTP_PORT) ||
      isBlank(process.env.SMTP_USER) ||
      isBlank(process.env.SMTP_PASSWORD) ||
      isBlank(process.env.SECURITY_EMAIL_FROM)
    ) {
      issues.push(
        "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SECURITY_EMAIL_FROM are required",
      );
    }
  }

  return issues;
}

export function assertRuntimeSecurityConfiguration(): void {
  if (!isProductionEnvironment()) {
    return;
  }

  const issues = getSecurityConfigurationIssues();
  if (issues.length > 0) {
    throw new Error(`SECURITY_CONFIGURATION_INVALID:${issues.join("; ")}`);
  }
}
