import { getNowMs, readPositiveIntEnv } from "@/lib/search/prefilter-controls";

type PublicSlugCacheEntry = {
  value: string | null;
  expiresAt: number;
};

type PublicSlugLookupResult = {
  value: string | null;
  cacheHit: boolean;
  lookupDurationMs: number;
  ttlMs: number;
};

const globalCacheKey = "__bokin_public_slug_lookup_cache__";

type GlobalWithSlugCache = typeof globalThis & {
  [globalCacheKey]?: Map<string, PublicSlugCacheEntry>;
};

function getCache(): Map<string, PublicSlugCacheEntry> {
  const globalScope = globalThis as GlobalWithSlugCache;
  if (!globalScope[globalCacheKey]) {
    globalScope[globalCacheKey] = new Map();
  }

  return globalScope[globalCacheKey];
}

export function getPublicSlugLookupCacheTtlMs(): number {
  return readPositiveIntEnv({
    name: "PUBLIC_SLUG_LOOKUP_CACHE_TTL_MS",
    fallback: 600_000,
    min: 60_000,
    max: 900_000,
  });
}

export function buildPublicSlugCacheKey(parts: Array<string | null | undefined>): string {
  return parts.map((part) => encodeURIComponent(part ?? "")).join(":");
}

export async function resolveCachedPublicSlugLookup(input: {
  cacheKey: string;
  lookup: () => Promise<string | null>;
}): Promise<PublicSlugLookupResult> {
  const ttlMs = getPublicSlugLookupCacheTtlMs();
  const now = Date.now();
  const cache = getCache();
  const cached = cache.get(input.cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      value: cached.value,
      cacheHit: true,
      lookupDurationMs: 0,
      ttlMs,
    };
  }

  const startedAt = getNowMs();
  const value = await input.lookup();
  const lookupDurationMs = Math.round(getNowMs() - startedAt);
  cache.set(input.cacheKey, {
    value,
    expiresAt: now + ttlMs,
  });

  return {
    value,
    cacheHit: false,
    lookupDurationMs,
    ttlMs,
  };
}

export function clearPublicSlugLookupCache(): void {
  getCache().clear();
}
