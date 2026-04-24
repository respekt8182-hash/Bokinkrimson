// Website helper that normalizes external URLs and builds a favicon URL for UI cards.
const HAS_PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

export function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return HAS_PROTOCOL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function readWebsiteHostname(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(normalizeWebsiteUrl(value));
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

export function buildWebsiteFaviconUrl(value: string | null | undefined): string | null {
  const hostname = readWebsiteHostname(value);
  if (!hostname) {
    return null;
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}
