export const LISTING_ANALYTICS_MANUAL_REFRESH_LIMIT = 2;
export const LISTING_ANALYTICS_REFRESH_LOCK_MINUTES = 10;
export const LISTING_ANALYTICS_STALE_AFTER_HOURS = 36;
export const LISTING_ANALYTICS_DEFAULT_TIME_ZONE = "Europe/Moscow";
export const LISTING_ANALYTICS_CRON_SETTING_KEY = "listing_analytics:last_auto_refresh_at";
export const LISTING_ANALYTICS_DEFAULT_DEDUP_WINDOW_MINUTES = 60;

function readIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function getListingAnalyticsTimeZone(): string {
  return process.env.LISTING_ANALYTICS_TIME_ZONE?.trim() || LISTING_ANALYTICS_DEFAULT_TIME_ZONE;
}

export function getListingAnalyticsAutoUpdateHour(): number {
  return readIntegerEnv("LISTING_ANALYTICS_AUTO_UPDATE_HOUR", 4, 0, 23);
}

export function getListingAnalyticsCronBatchLimit(): number {
  return readIntegerEnv("LISTING_ANALYTICS_CRON_BATCH_LIMIT", 150, 10, 1000);
}

export function getListingAnalyticsDedupWindowMinutes(): number {
  return readIntegerEnv(
    "LISTING_ANALYTICS_DEDUP_WINDOW_MINUTES",
    LISTING_ANALYTICS_DEFAULT_DEDUP_WINDOW_MINUTES,
    1,
    24 * 60,
  );
}
