"use client";

import { ListingStatsButton } from "@/components/statistics/listing-stats-button";

export function StatsButton({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  return (
    <ListingStatsButton
      endpoint={`/api/properties/${propertyId}/stats`}
      entityName={propertyName}
      storageKey={`property:${propertyId}`}
    />
  );
}
