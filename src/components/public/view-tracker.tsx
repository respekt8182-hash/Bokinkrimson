"use client";

import { useEffect } from "react";
import { trackPublicEntityView } from "@/lib/client-view-tracking";
import { markCatalogMapItemViewed } from "@/lib/catalog-map-memory";

type ViewTrackerProps = {
  propertyId: string;
};

export function ViewTracker({ propertyId }: ViewTrackerProps) {
  useEffect(() => {
    markCatalogMapItemViewed("housing", propertyId);

    trackPublicEntityView({
      storageKey: `property-view:${propertyId}`,
      url: `/api/properties/${propertyId}/view`,
      idleTimeoutMs: 3000,
    });
  }, [propertyId]);

  return null;
}
