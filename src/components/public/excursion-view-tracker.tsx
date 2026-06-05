"use client";

import { useEffect } from "react";
import { trackPublicEntityView } from "@/lib/client-view-tracking";
import { markCatalogMapItemViewedForKeys } from "@/lib/catalog-map-memory";

type ExcursionViewTrackerProps = {
  excursionId: string;
};

export function ExcursionViewTracker({ excursionId }: ExcursionViewTrackerProps) {
  useEffect(() => {
    markCatalogMapItemViewedForKeys(["excursions", "tours"], excursionId);

    trackPublicEntityView({
      storageKey: `excursion-view:${excursionId}`,
      url: `/api/excursions/${excursionId}/view`,
    });
  }, [excursionId]);

  return null;
}
