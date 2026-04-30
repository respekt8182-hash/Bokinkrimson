"use client";

import { useEffect } from "react";
import { trackPublicEntityView } from "@/lib/client-view-tracking";

type TransferViewTrackerProps = {
  transferId: string;
};

export function TransferViewTracker({ transferId }: TransferViewTrackerProps) {
  useEffect(() => {
    trackPublicEntityView({
      storageKey: `transfer-view:${transferId}`,
      url: `/api/transfers/${transferId}/view`,
    });
  }, [transferId]);

  return null;
}
