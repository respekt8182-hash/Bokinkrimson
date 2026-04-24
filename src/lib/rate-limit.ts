import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getRateLimitMode } from "@/lib/security-config";

type BucketEntry = {
  count: number;
  resetAt: number;
};

type RateStore = Map<string, BucketEntry>;

export type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
  source: "memory" | "upstash";
};

type RateLimiterOptions = {
  id: string;
  windowMs: number;
  maxRequests: number;
};

type RateLimiter = {
  limit(key: string): Promise<LimitResult>;
};

declare global {
  var __bokingRateLimitStores: Map<string, RateStore> | undefined;
  var __bokingUpstashRateLimiters: Map<string, RateLimiter> | undefined;
}

export class RateLimitConfigurationError extends Error {
  constructor(message = "RATE_LIMIT_CONFIGURATION_INVALID") {
    super(message);
  }
}

export class RateLimitBackendUnavailableError extends Error {
  constructor(message = "RATE_LIMIT_BACKEND_UNAVAILABLE") {
    super(message);
  }
}

function getStore(id: string): RateStore {
  if (!global.__bokingRateLimitStores) {
    global.__bokingRateLimitStores = new Map<string, RateStore>();
  }

  const existing = global.__bokingRateLimitStores.get(id);
  if (existing) {
    return existing;
  }

  const created: RateStore = new Map();
  global.__bokingRateLimitStores.set(id, created);
  return created;
}

export function createInMemoryRateLimiter(options: RateLimiterOptions): RateLimiter {
  const store = getStore(options.id);

  function pruneExpired(now: number) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  return {
    async limit(key: string): Promise<LimitResult> {
      const now = Date.now();
      pruneExpired(now);

      const existing = store.get(key);
      if (!existing || existing.resetAt <= now) {
        const resetAt = now + options.windowMs;
        store.set(key, { count: 1, resetAt });
        return {
          allowed: true,
          remaining: Math.max(0, options.maxRequests - 1),
          retryAfterSeconds: Math.ceil(options.windowMs / 1000),
          resetAt,
          source: "memory",
        };
      }

      existing.count += 1;
      store.set(key, existing);

      return {
        allowed: existing.count <= options.maxRequests,
        remaining: Math.max(0, options.maxRequests - existing.count),
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        resetAt: existing.resetAt,
        source: "memory",
      };
    },
  };
}

function getFixedWindowDuration(windowMs: number): string {
  if (windowMs % 3_600_000 === 0) {
    return `${Math.max(1, Math.round(windowMs / 3_600_000))} h`;
  }

  if (windowMs % 60_000 === 0) {
    return `${Math.max(1, Math.round(windowMs / 60_000))} m`;
  }

  return `${Math.max(1, Math.ceil(windowMs / 1_000))} s`;
}

function hasUpstashConfiguration(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function getUpstashLimiter(options: RateLimiterOptions): RateLimiter {
  if (!hasUpstashConfiguration()) {
    throw new RateLimitConfigurationError();
  }

  if (!global.__bokingUpstashRateLimiters) {
    global.__bokingUpstashRateLimiters = new Map<string, RateLimiter>();
  }

  const existing = global.__bokingUpstashRateLimiters.get(options.id);
  if (existing) {
    return existing;
  }

  const redis = Redis.fromEnv();
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(
      options.maxRequests,
      getFixedWindowDuration(options.windowMs) as Parameters<typeof Ratelimit.fixedWindow>[1],
    ),
    prefix: `boking:${options.id}`,
    analytics: false,
  });

  const limiter: RateLimiter = {
    async limit(key: string): Promise<LimitResult> {
      try {
        const result = await ratelimit.limit(key);
        const resetAt =
          typeof result.reset === "number" && Number.isFinite(result.reset)
            ? result.reset
            : Date.now() + options.windowMs;

        return {
          allowed: result.success,
          remaining: Math.max(0, result.remaining),
          retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
          resetAt,
          source: "upstash",
        };
      } catch (error) {
        throw new RateLimitBackendUnavailableError(
          error instanceof Error ? error.message : "RATE_LIMIT_BACKEND_UNAVAILABLE",
        );
      }
    },
  };

  global.__bokingUpstashRateLimiters.set(options.id, limiter);
  return limiter;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const mode = getRateLimitMode();

  if (mode === "memory") {
    return createInMemoryRateLimiter(options);
  }

  if (mode === "upstash") {
    return getUpstashLimiter(options);
  }

  if (hasUpstashConfiguration()) {
    return getUpstashLimiter(options);
  }

  return createInMemoryRateLimiter(options);
}
