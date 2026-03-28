"use client";

import { useEffect } from "react";

type ViewTrackerProps = {
  propertyId: string;
};

// Fires a single POST to the view-tracking endpoint on first mount.
// Renders nothing — purely a side-effect component.
export function ViewTracker({ propertyId }: ViewTrackerProps) {
  useEffect(() => {
    fetch(`/api/properties/${propertyId}/view`, { method: "POST" }).catch(() => {});
  }, [propertyId]);

  return null;
}
