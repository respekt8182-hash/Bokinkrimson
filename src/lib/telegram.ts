// Utility helpers that normalize Telegram handles and public profile URLs.
const TELEGRAM_URL_PREFIX = "https://t.me/";
const TELEGRAM_PHONE_URL_PREFIX = "https://t.me/+";

function extractTelegramPhoneCandidate(value: string): string {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    if (url.protocol === "tg:" && url.hostname.toLowerCase() === "resolve") {
      return url.searchParams.get("phone") ?? "";
    }
  } catch {
    // Fall back to plain-text parsing below.
  }

  const withoutDomain = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, "");
  return withoutDomain.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
}

function normalizeTelegramPhoneNumber(value: string): string | null {
  const candidate = extractTelegramPhoneCandidate(value).trim();
  if (!candidate || !/^\+?[\d\s().-]+$/.test(candidate)) {
    return null;
  }

  const digits = candidate.replace(/\D/g, "");
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

function normalizeTelegramHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutDomain = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, "");
  const withoutAt = withoutDomain.replace(/^@+/, "");
  const cleanValue = withoutAt.replace(/^\/+|\/+$/g, "");

  if (/^[A-Za-z0-9_]+$/.test(cleanValue)) {
    return cleanValue;
  }

  return null;
}

export function normalizeTelegramProfileUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedPhoneNumber = normalizeTelegramPhoneNumber(trimmed);
  if (normalizedPhoneNumber) {
    return `${TELEGRAM_PHONE_URL_PREFIX}${normalizedPhoneNumber}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const normalizedHandle = normalizeTelegramHandle(trimmed);
    if (normalizedHandle) {
      return `${TELEGRAM_URL_PREFIX}${normalizedHandle}`;
    }
    return null;
  }

  if (/^(?:www\.)?t\.me\//i.test(trimmed)) {
    const normalizedHandle = normalizeTelegramHandle(trimmed);
    if (normalizedHandle) {
      return `${TELEGRAM_URL_PREFIX}${normalizedHandle}`;
    }
    return null;
  }

  const normalizedHandle = normalizeTelegramHandle(trimmed);
  if (normalizedHandle) {
    return `${TELEGRAM_URL_PREFIX}${normalizedHandle}`;
  }

  return null;
}
