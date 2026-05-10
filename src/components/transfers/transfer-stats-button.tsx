"use client";

import { ListingStatsButton } from "@/components/statistics/listing-stats-button";

export function TransferStatsButton({
  transferId,
  transferTitle,
}: {
  transferId: string;
  transferTitle: string;
}) {
  return (
    <ListingStatsButton
      endpoint={`/api/transfers/${transferId}/stats`}
      entityName={transferTitle}
      storageKey={`transfer:${transferId}`}
    />
  );
}
