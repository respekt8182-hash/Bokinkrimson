type RequestOriginContext = {
  headers: Pick<Headers, "get">;
  nextUrl: URL;
};

function splitHeaderValues(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitConfiguredOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveRequestProtocol(request: RequestOriginContext): string {
  const forwardedProto = splitHeaderValues(request.headers.get("x-forwarded-proto"))[0];

  if (forwardedProto === "http" || forwardedProto === "https") {
    return forwardedProto;
  }

  return request.nextUrl.protocol.replace(/:$/, "");
}

function getOriginFromReferer(refererHeader: string | null): string | null {
  if (!refererHeader) {
    return null;
  }

  return normalizeOrigin(refererHeader);
}

export function getAllowedOrigins(request: RequestOriginContext): string[] {
  const allowedOrigins = new Set<string>([request.nextUrl.origin]);
  const protocol = resolveRequestProtocol(request);
  const hostCandidates = [
    ...splitHeaderValues(request.headers.get("x-forwarded-host")),
    ...splitHeaderValues(request.headers.get("host")),
  ];

  for (const host of hostCandidates) {
    const origin = normalizeOrigin(`${protocol}://${host}`);
    if (origin) {
      allowedOrigins.add(origin);
    }
  }

  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...splitConfiguredOrigins(process.env.CSRF_TRUSTED_ORIGINS),
  ];

  for (const configuredOrigin of configuredOrigins) {
    if (!configuredOrigin) {
      continue;
    }

    const origin = normalizeOrigin(configuredOrigin);
    if (origin) {
      allowedOrigins.add(origin);
    }
  }

  return [...allowedOrigins];
}

export function isSameOrigin(request: RequestOriginContext): boolean {
  const allowedOrigins = getAllowedOrigins(request);
  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();

  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return false;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    const origin = normalizeOrigin(originHeader);
    return Boolean(origin && allowedOrigins.includes(origin));
  }

  const refererOrigin = getOriginFromReferer(request.headers.get("referer"));
  if (refererOrigin) {
    return allowedOrigins.includes(refererOrigin);
  }

  return true;
}
