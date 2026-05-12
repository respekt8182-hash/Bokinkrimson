import { afterEach, describe, expect, it } from "vitest";
import { getSecurityConfigurationIssues } from "../../src/lib/security-config";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  RATE_LIMIT_MODE: process.env.RATE_LIMIT_MODE,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  SECURITY_EMAIL_DELIVERY_MODE: process.env.SECURITY_EMAIL_DELIVERY_MODE,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SECURITY_EMAIL_FROM: process.env.SECURITY_EMAIL_FROM,
};

function restoreEnvValue(key: keyof typeof originalEnv) {
  const value = originalEnv[key];

  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

afterEach(() => {
  for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
    restoreEnvValue(key);
  }
});

function applySelfHostedProductionBaseline() {
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "x".repeat(32);
  process.env.ADMIN_JWT_SECRET = "y".repeat(32);
  process.env.ADMIN_LOGIN = "admin";
  process.env.ADMIN_PASSWORD_HASH = "\\$2b\\$10\\$exampleexampleexampleexampleexampleexampleex";
  process.env.SECURITY_EMAIL_DELIVERY_MODE = "log";
  delete process.env.RATE_LIMIT_MODE;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SECURITY_EMAIL_FROM;
}

describe("self-hosted production security configuration", () => {
  it("allows a single-node production deployment without external payment provider", () => {
    applySelfHostedProductionBaseline();

    expect(getSecurityConfigurationIssues()).toEqual([]);
  });

  it("requires Upstash credentials when rate-limit mode is forced to upstash", () => {
    applySelfHostedProductionBaseline();
    process.env.RATE_LIMIT_MODE = "upstash";

    expect(getSecurityConfigurationIssues()).toContain(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required",
    );
  });
});
