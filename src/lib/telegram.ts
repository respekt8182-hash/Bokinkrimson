// Utility helpers that normalize Telegram handles and public profile URLs.
const TELEGRAM_URL_PREFIX = "https://t.me/";

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

  if (/^https?:\/\//i.test(trimmed)) {
    const normalizedHandle = normalizeTelegramHandle(trimmed);
    if (normalizedHandle) {
      return `${TELEGRAM_URL_PREFIX}${normalizedHandle}`;
    }
    return trimmed;
  }

  if (/^(?:www\.)?t\.me\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^www\./i, "")}`;
  }

  const normalizedHandle = normalizeTelegramHandle(trimmed);
  if (normalizedHandle) {
    return `${TELEGRAM_URL_PREFIX}${normalizedHandle}`;
  }

  return trimmed;
}
