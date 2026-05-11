"use client";

const ANALYTICS_VISITOR_STORAGE_KEY = "kv_analytics_visitor_id_v1";

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getAnalyticsVisitorId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(ANALYTICS_VISITOR_STORAGE_KEY);
    if (existing && existing.length <= 120) {
      return existing;
    }

    const next = createVisitorId();
    window.localStorage.setItem(ANALYTICS_VISITOR_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}
