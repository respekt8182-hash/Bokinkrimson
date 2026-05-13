const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

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

function normalizeWhatsappPhoneNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  if (digits.length === 10) {
    return `7${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }

  return digits;
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
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const url = parseHttpUrl(trimmed);
  if (url) {
    return url.toString();
  }

  const phoneNumber = normalizeWhatsappPhoneNumber(trimmed);
  if (!phoneNumber) {
    return null;
  }

  return `https://wa.me/${phoneNumber}`;
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

export function normalizeEmailAddress(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function normalizeEmailHref(value: string | null | undefined): string | null {
  const address = normalizeEmailAddress(value);
  return address ? `mailto:${address}` : null;
}
