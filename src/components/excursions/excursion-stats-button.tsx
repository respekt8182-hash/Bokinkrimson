"use client";

import { ListingStatsButton } from "@/components/statistics/listing-stats-button";

export function ExcursionStatsButton({
  excursionId,
  excursionTitle,
}: {
  excursionId: string;
  excursionTitle: string;
}) {
  return (
    <ListingStatsButton
      endpoint={`/api/excursions/${excursionId}/stats`}
      entityName={excursionTitle}
      storageKey={`excursion:${excursionId}`}
    />
  );
}
