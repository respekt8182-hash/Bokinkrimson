"use client";

import { useEffect } from "react";
import { trackPublicEntityView } from "@/lib/client-view-tracking";

type ViewTrackerProps = {
  propertyId: string;
};

export function ViewTracker({ propertyId }: ViewTrackerProps) {
  useEffect(() => {
    trackPublicEntityView({
      storageKey: `property-view:${propertyId}`,
      url: `/api/properties/${propertyId}/view`,
      idleTimeoutMs: 3000,
    });
  }, [propertyId]);

  return null;
}
