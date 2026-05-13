"use client";

import { ListingStatsButton } from "@/components/statistics/listing-stats-button";

export function ExcursionStatsButton({
  excursionId,
  excursionTitle,
  className,
}: {
  excursionId: string;
  excursionTitle: string;
  className?: string;
}) {
  return (
    <ListingStatsButton
      endpoint={`/api/excursions/${excursionId}/stats`}
      entityName={excursionTitle}
      storageKey={`excursion:${excursionId}`}
      className={className}
    />
  );
}
