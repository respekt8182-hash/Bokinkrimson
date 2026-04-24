const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function parseHttpUrl(value: string | null | undefined): URL | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (!HTTP_PROTOCOLS.has(url.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function hasAsciiProfilePath(url: URL): boolean {
  const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "");
  if (!decodedPath) {
    return false;
  }

  return /^[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/.test(decodedPath);
}

function normalizeProfileUrl(
  value: string | null | undefined,
  allowedHosts: readonly string[],
): string | null {
  const url = parseHttpUrl(value);
  if (!url) {
    return null;
  }

  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    return null;
  }

  if (!hasAsciiProfilePath(url)) {
    return null;
  }

  url.hash = "";
  return url.toString();
}

export function normalizeWhatsappUrl(value: string | null | undefined): string | null {
  const url = parseHttpUrl(value);
  if (!url) {
    return null;
  }

  return url.toString();
}

export function normalizeVkProfileUrl(value: string | null | undefined): string | null {
  return normalizeProfileUrl(value, ["vk.com", "m.vk.com", "vkontakte.ru", "m.vkontakte.ru"]);
}

export function normalizeMaxProfileUrl(value: string | null | undefined): string | null {
  return normalizeProfileUrl(value, ["max.ru", "www.max.ru"]);
}

export function normalizeOkProfileUrl(value: string | null | undefined): string | null {
  return normalizeProfileUrl(value, ["ok.ru", "www.ok.ru", "m.ok.ru"]);
}
