"use client";

import { useEffect } from "react";
import { trackPublicEntityView } from "@/lib/client-view-tracking";
import { markCatalogMapItemViewed } from "@/lib/catalog-map-memory";

type TransferViewTrackerProps = {
  transferId: string;
};

export function TransferViewTracker({ transferId }: TransferViewTrackerProps) {
  useEffect(() => {
    markCatalogMapItemViewed("transfers", transferId);

    trackPublicEntityView({
      storageKey: `transfer-view:${transferId}`,
      url: `/api/transfers/${transferId}/view`,
    });
  }, [transferId]);

  return null;
}
