"use client";

import { useEffect, useState } from "react";

export type CatalogMapPlacement = "mobile" | "tablet" | "desktop" | null;

export function useCatalogMapPlacement(): CatalogMapPlacement {
  const [placement, setPlacement] = useState<CatalogMapPlacement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const fallbackTimer = window.setTimeout(() => setPlacement("desktop"), 0);
      return () => {
        window.clearTimeout(fallbackTimer);
      };
    }

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const tabletQuery = window.matchMedia("(min-width: 768px)");

    const updatePlacement = () => {
      if (desktopQuery.matches) {
        setPlacement("desktop");
        return;
      }

      setPlacement(tabletQuery.matches ? "tablet" : "mobile");
    };

    updatePlacement();

    desktopQuery.addEventListener("change", updatePlacement);
    tabletQuery.addEventListener("change", updatePlacement);

    return () => {
      desktopQuery.removeEventListener("change", updatePlacement);
      tabletQuery.removeEventListener("change", updatePlacement);
    };
  }, []);

  return placement;
}
