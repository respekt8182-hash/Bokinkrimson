// Domain/service module for rate limit.
type BucketEntry = {
  count: number;
  resetAt: number;
};

type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimiterOptions = {
  id: string;
  windowMs: number;
  maxRequests: number;
};

type RateStore = Map<string, BucketEntry>;

declare global {
  var __bokingRateLimitStores: Map<string, RateStore> | undefined;
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

export function createInMemoryRateLimiter(options: RateLimiterOptions) {
  const store = getStore(options.id);

  function pruneExpired(now: number) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  return {
    limit(key: string): LimitResult {
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
        };
      }

      existing.count += 1;
      store.set(key, existing);

      const remaining = Math.max(0, options.maxRequests - existing.count);
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

      return {
        allowed: existing.count <= options.maxRequests,
        remaining,
        retryAfterSeconds,
      };
    },
  };
}
