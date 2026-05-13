"use client";

import { ListingStatsButton } from "@/components/statistics/listing-stats-button";

export function TransferStatsButton({
  transferId,
  transferTitle,
  className,
}: {
  transferId: string;
  transferTitle: string;
  className?: string;
}) {
  return (
    <ListingStatsButton
      endpoint={`/api/transfers/${transferId}/stats`}
      entityName={transferTitle}
      storageKey={`transfer:${transferId}`}
      className={className}
    />
  );
}
