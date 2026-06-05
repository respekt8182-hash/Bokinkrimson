"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo } from "react";
import { markCatalogMapItemViewed } from "@/lib/catalog-map-memory";

export type CatalogMemoryKey = "housing" | "excursions" | "tours" | "attractions" | "transfers";

type CatalogScrollState = {
  catalogKey: CatalogMemoryKey;
  url: string;
  scrollY: number;
  itemId: string | null;
  updatedAt: number;
};

const storagePrefix = "krymvokrug.catalogScroll";
const maxStateAgeMs = 1000 * 60 * 45;

function getCatalogStorageKey(catalogKey: CatalogMemoryKey): string {
  return `${storagePrefix}.${catalogKey}`;
}

function getDetailStorageKey(detailUrl: string): string {
  return `${storagePrefix}.detail.${detailUrl}`;
}

function buildCurrentUrl(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function normalizeUrl(value: string): string {
  if (typeof window === "undefined") {
    return value;
  }

  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function readState(key: string): CatalogScrollState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CatalogScrollState>;
    if (
      !parsed ||
      typeof parsed.url !== "string" ||
      typeof parsed.scrollY !== "number" ||
      typeof parsed.updatedAt !== "number" ||
      Date.now() - parsed.updatedAt > maxStateAgeMs
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return {
      catalogKey: parsed.catalogKey as CatalogMemoryKey,
      url: parsed.url,
      scrollY: Math.max(0, parsed.scrollY),
      itemId: typeof parsed.itemId === "string" ? parsed.itemId : null,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeState(key: string, state: CatalogScrollState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Best-effort UX cache: navigation must keep working even when storage is unavailable.
  }
}

function saveCatalogState(
  catalogKey: CatalogMemoryKey,
  catalogUrl: string,
  detailUrl?: string | null,
  itemId?: string | null,
): void {
  const liveCatalogUrl =
    typeof window === "undefined"
      ? catalogUrl
      : `${window.location.pathname}${window.location.search}`;
  const state: CatalogScrollState = {
    catalogKey,
    url: normalizeUrl(liveCatalogUrl),
    scrollY: Math.max(0, window.scrollY || window.pageYOffset || 0),
    itemId: itemId ?? null,
    updatedAt: Date.now(),
  };

  writeState(getCatalogStorageKey(catalogKey), state);

  if (detailUrl) {
    writeState(getDetailStorageKey(normalizeUrl(detailUrl)), state);
  }
}

function restoreScrollPosition(targetY: number): void {
  let attempts = 0;
  const maxAttempts = 10;

  const run = () => {
    attempts += 1;
    window.scrollTo({ top: targetY, left: 0, behavior: "auto" });

    if (attempts < maxAttempts && Math.abs(window.scrollY - targetY) > 2) {
      window.setTimeout(run, 80);
    }
  };

  window.requestAnimationFrame(run);
}

export function CatalogScrollRestorer({ catalogKey }: { catalogKey: CatalogMemoryKey }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const currentUrl = useMemo(
    () => buildCurrentUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  const saveCurrentState = useCallback(
    (detailUrl?: string | null, itemId?: string | null) => {
      saveCatalogState(catalogKey, currentUrl, detailUrl, itemId);
    },
    [catalogKey, currentUrl],
  );

  useEffect(() => {
    const state = readState(getCatalogStorageKey(catalogKey));
    if (!state || state.url !== normalizeUrl(currentUrl) || state.scrollY <= 0) {
      return;
    }

    restoreScrollPosition(state.scrollY);
  }, [catalogKey, currentUrl]);

  useEffect(() => {
    let frameId = 0;

    const scheduleSave = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        saveCurrentState();
      });
    };

    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[data-catalog-detail-link]");
      if (!link) {
        return;
      }

      const linkCatalogKey = link.dataset.catalogDetailLink as CatalogMemoryKey | undefined;
      const itemId = link.dataset.catalogItemId ?? null;
      if (itemId) {
        markCatalogMapItemViewed(linkCatalogKey ?? catalogKey, itemId);
      }

      saveCatalogState(
        linkCatalogKey ?? catalogKey,
        currentUrl,
        link.href,
        itemId,
      );
    };

    const saveCurrentStateNow = () => saveCurrentState();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveCurrentState();
      }
    };

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", saveCurrentStateNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleClick, true);

    saveCurrentState();

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("pagehide", saveCurrentStateNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleClick, true);
    };
  }, [catalogKey, currentUrl, saveCurrentState]);

  return null;
}

export function CatalogBackLink({
  catalogKey,
  fallbackHref,
  className,
  children,
}: {
  catalogKey: CatalogMemoryKey;
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const currentUrl = useMemo(
    () => buildCurrentUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const detailState = readState(getDetailStorageKey(normalizeUrl(currentUrl)));
    const catalogState = readState(getCatalogStorageKey(catalogKey));
    const state = detailState ?? catalogState;
    const returnUrl = state?.url ? normalizeUrl(state.url) : null;

    if (!returnUrl) {
      return;
    }

    event.preventDefault();
    router.push(returnUrl, { scroll: false });
  }

  return (
    <Link href={fallbackHref} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
