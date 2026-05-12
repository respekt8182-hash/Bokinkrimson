"use client";

import { ListingStatsButton } from "@/components/statistics/listing-stats-button";

export function StatsButton({
  propertyId,
  propertyName,
  className,
}: {
  propertyId: string;
  propertyName: string;
  className?: string;
}) {
  return (
    <ListingStatsButton
      endpoint={`/api/properties/${propertyId}/stats`}
      entityName={propertyName}
      storageKey={`property:${propertyId}`}
      className={className}
    />
  );
}
