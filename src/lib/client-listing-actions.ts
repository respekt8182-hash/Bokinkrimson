import type { ListingActionType, ListingEntityType } from "@/lib/listing-analytics";
import { getAnalyticsVisitorId } from "@/lib/client-analytics-visitor";

type ListingActionPayload = {
  entityType: ListingEntityType;
  entityId: string;
  actionType: ListingActionType;
  leadNumber?: string | null;
};

export function trackListingAction(payload: ListingActionPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    ...payload,
    visitorId: getAnalyticsVisitorId(),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/listing-actions", blob)) {
      return;
    }
  }

  void fetch("/api/listing-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
