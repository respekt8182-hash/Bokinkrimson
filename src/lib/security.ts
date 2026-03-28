// Domain/service module for security.
const ipHeaderCandidates = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "fastly-client-ip",
];

function normalizeIp(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  return trimmed;
}

function getIpFromHeaders(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first) {
      const normalized = normalizeIp(first);
      if (normalized) {
        return normalized;
      }
    }
  }

  for (const headerName of ipHeaderCandidates) {
    if (headerName === "x-forwarded-for") {
      continue;
    }

    const value = request.headers.get(headerName);
    if (!value) {
      continue;
    }

    const normalized = normalizeIp(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function hashFingerprint(value: string): string {
  // FNV-1a 32-bit hash: fast, deterministic, no runtime-specific crypto API needed.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getClientFingerprint(request: Request): string {
  const userAgent = request.headers.get("user-agent")?.trim().toLowerCase() ?? "";
  const language = request.headers.get("accept-language")?.trim().toLowerCase() ?? "";
  return `fp-${hashFingerprint(`${userAgent}|${language}`)}`;
}

export function getRequestIp(request: Request): string {
  const ip = getIpFromHeaders(request);
  if (ip) {
    return ip;
  }

  // No client IP headers (common in local dev and some proxy setups):
  // fallback to a deterministic per-client fingerprint to avoid one global bucket.
  return getClientFingerprint(request);
}
