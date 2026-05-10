"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackListingAction } from "@/lib/client-listing-actions";
import type { ListingActionType, ListingEntityType } from "@/lib/listing-analytics";

type TrackingContext = {
  entityType: ListingEntityType;
  entityId: string;
};

type TrackedContactLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  actionType: ListingActionType;
  children: ReactNode;
  tracking?: TrackingContext | null;
};

export function TrackedContactLink({
  actionType,
  tracking = null,
  onClick,
  children,
  ...props
}: TrackedContactLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        if (tracking) {
          trackListingAction({ ...tracking, actionType });
        }
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
