"use client";

import { getAnalyticsVisitorId } from "@/lib/client-analytics-visitor";

const scheduledViewKeys = new Set<string>();

type TrackPublicEntityViewInput = {
  storageKey: string;
  url: string;
  idleTimeoutMs?: number;
};

function clearScheduledView(storageKey: string) {
  scheduledViewKeys.delete(storageKey);

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage restrictions and let the next mount retry.
  }
}

function markViewScheduled(storageKey: string): boolean {
  if (scheduledViewKeys.has(storageKey)) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(storageKey) === "1") {
      return false;
    }

    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // sessionStorage can be unavailable in embedded / private contexts.
  }

  scheduledViewKeys.add(storageKey);
  return true;
}

export function trackPublicEntityView({
  storageKey,
  url,
  idleTimeoutMs = 2500,
}: TrackPublicEntityViewInput) {
  if (typeof window === "undefined") {
    return;
  }

  if (!markViewScheduled(storageKey)) {
    return;
  }

  let hasSent = false;
  let fallbackTimerId: number | null = null;
  let idleCallbackId: number | null = null;

  const cleanup = () => {
    window.removeEventListener("load", scheduleSendOnce);
    window.removeEventListener("pagehide", sendOnce);

    if (fallbackTimerId !== null) {
      window.clearTimeout(fallbackTimerId);
      fallbackTimerId = null;
    }

    if (idleCallbackId !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleCallbackId);
      idleCallbackId = null;
    }
  };

  const sendRequest = () => {
    const body = JSON.stringify({ visitorId: getAnalyticsVisitorId() });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) {
          return;
        }
      } catch {
        // Fall through to fetch.
      }
    }

    void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        hasSent = false;
        clearScheduledView(storageKey);
      });
  };

  const sendOnce = () => {
    if (hasSent) {
      return;
    }

    hasSent = true;
    cleanup();
    sendRequest();
  };

  const scheduleSendOnce = () => {
    if (hasSent) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(sendOnce, {
        timeout: idleTimeoutMs,
      });
      return;
    }

    fallbackTimerId = window.setTimeout(sendOnce, Math.min(idleTimeoutMs, 1200));
  };

  window.addEventListener("pagehide", sendOnce, { once: true });

  if (document.readyState === "complete") {
    scheduleSendOnce();
    return;
  }

  window.addEventListener("load", scheduleSendOnce, { once: true });
}
