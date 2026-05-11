"use client";

import { useEffect, useState } from "react";
import { getAnalyticsVisitorId } from "@/lib/client-analytics-visitor";
import type { ListingEntityType } from "@/lib/listing-analytics";

type ListingLeadNumberState = {
  leadNumber: string | null;
  entityPublicId: number | null;
  loading: boolean;
  error: string | null;
};

export function useListingLeadNumber(input: {
  enabled: boolean;
  entityType: ListingEntityType;
  entityId: string;
  fallbackEntityPublicId?: number | null;
}): ListingLeadNumberState {
  const [state, setState] = useState<ListingLeadNumberState>({
    leadNumber: null,
    entityPublicId: input.fallbackEntityPublicId ?? null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!input.enabled) {
      setState({
        leadNumber: null,
        entityPublicId: input.fallbackEntityPublicId ?? null,
        loading: false,
        error: null,
      });
      return;
    }

    let canceled = false;
    setState((previous) => ({
      leadNumber: previous.leadNumber,
      entityPublicId: previous.entityPublicId ?? input.fallbackEntityPublicId ?? null,
      loading: previous.leadNumber === null,
      error: null,
    }));

    async function loadLeadNumber() {
      try {
        const response = await fetch("/api/listing-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: input.entityType,
            entityId: input.entityId,
            visitorId: getAnalyticsVisitorId(),
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          leadNumber?: string;
          entityPublicId?: number | null;
          error?: string;
        } | null;

        if (!response.ok || !payload?.leadNumber) {
          throw new Error(payload?.error ?? "Не удалось создать номер обращения");
        }

        if (!canceled) {
          setState({
            leadNumber: payload.leadNumber,
            entityPublicId: payload.entityPublicId ?? input.fallbackEntityPublicId ?? null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!canceled) {
          setState({
            leadNumber: null,
            entityPublicId: input.fallbackEntityPublicId ?? null,
            loading: false,
            error: error instanceof Error ? error.message : "Не удалось создать номер обращения",
          });
        }
      }
    }

    void loadLeadNumber();

    return () => {
      canceled = true;
    };
  }, [input.enabled, input.entityType, input.entityId, input.fallbackEntityPublicId]);

  return state;
}
