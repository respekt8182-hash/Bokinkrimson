"use client";

import { useEffect } from "react";

type ExcursionViewTrackerProps = {
  excursionId: string;
};

// Fires a single POST to the excursion view-tracking endpoint on first mount.
// Renders nothing — purely a side-effect component.
export function ExcursionViewTracker({ excursionId }: ExcursionViewTrackerProps) {
  useEffect(() => {
    fetch(`/api/excursions/${excursionId}/view`, { method: "POST" }).catch(() => {});
  }, [excursionId]);

  return null;
}
