"use client";

import { useEffect } from "react";
import { trackPublicEntityView } from "@/lib/client-view-tracking";

type ExcursionViewTrackerProps = {
  excursionId: string;
};

export function ExcursionViewTracker({ excursionId }: ExcursionViewTrackerProps) {
  useEffect(() => {
    trackPublicEntityView({
      storageKey: `excursion-view:${excursionId}`,
      url: `/api/excursions/${excursionId}/view`,
    });
  }, [excursionId]);

  return null;
}
