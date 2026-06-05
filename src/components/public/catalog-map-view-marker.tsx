"use client";

import { useEffect } from "react";
import {
  markCatalogMapItemViewed,
  type CatalogMapMemoryKey,
} from "@/lib/catalog-map-memory";

type CatalogMapViewMarkerProps = {
  catalogKey: CatalogMapMemoryKey;
  itemId: string;
};

export function CatalogMapViewMarker({ catalogKey, itemId }: CatalogMapViewMarkerProps) {
  useEffect(() => {
    markCatalogMapItemViewed(catalogKey, itemId);
  }, [catalogKey, itemId]);

  return null;
}
