"use client";

import { useEffect, useMemo, useState } from "react";
const loadedCarouselFetchUrls = new Set<string>();
const carouselImagePreloadRequests = new Map<string, Promise<boolean>>();

type CarouselImagePreloadOptions = {
  enabled?: boolean;
  preloadCount?: number | "all";
  referenceOptimizedSrc?: string | null;
};

function buildNextImagePreloadUrl(url: string, width: number, quality: number): string {
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.includes("/_next/image?") ||
    typeof window === "undefined"
  ) {
    return url;
  }

  const normalizedUrl = /^https?:\/\//.test(url) ? url : url.startsWith("/") ? url : `/${url}`;
  return `${window.location.origin}/_next/image?url=${encodeURIComponent(normalizedUrl)}&w=${width}&q=${quality}`;
}

function parseReferenceImageRequest(referenceOptimizedSrc: string | null | undefined): {
  width: number;
  quality: number;
} | null {
  if (!referenceOptimizedSrc || typeof window === "undefined") {
    return null;
  }

  try {
    const referenceUrl = new URL(referenceOptimizedSrc, window.location.origin);
    if (!referenceUrl.pathname.endsWith("/_next/image")) {
      return null;
    }

    const width = Number.parseInt(referenceUrl.searchParams.get("w") ?? "", 10);
    const quality = Number.parseInt(referenceUrl.searchParams.get("q") ?? "75", 10);

    if (!Number.isFinite(width) || width <= 0) {
      return null;
    }

    return {
      width,
      quality: Number.isFinite(quality) && quality > 0 ? quality : 75,
    };
  } catch {
    return null;
  }
}

function getFallbackWidths() {
  if (typeof window === "undefined") {
    return [640];
  }

  const dpr = window.devicePixelRatio || 1;
  if (dpr >= 2.5) return [828, 1080];
  if (dpr >= 1.5) return [640, 828];
  return [384, 640];
}

function buildPreloadUrls(url: string, referenceOptimizedSrc: string | null | undefined): string[] {
  if (url.startsWith("data:") || url.startsWith("blob:") || url.includes("/_next/image?")) {
    return [url];
  }

  const referenceRequest = parseReferenceImageRequest(referenceOptimizedSrc);
  if (referenceRequest) {
    return [
      buildNextImagePreloadUrl(url, referenceRequest.width, referenceRequest.quality),
    ];
  }

  return getFallbackWidths().map((width) => buildNextImagePreloadUrl(url, width, 75));
}

function preloadCarouselFetchUrl(fetchUrl: string): Promise<boolean> {
  if (loadedCarouselFetchUrls.has(fetchUrl)) {
    return Promise.resolve(true);
  }

  const existingRequest = carouselImagePreloadRequests.get(fetchUrl);
  if (existingRequest) {
    return existingRequest;
  }

  const request = new Promise<boolean>((resolve) => {
    const image = new window.Image();
    image.decoding = "async";

    const finalize = (isLoaded: boolean) => {
      if (isLoaded) {
        loadedCarouselFetchUrls.add(fetchUrl);
      }
      carouselImagePreloadRequests.delete(fetchUrl);
      resolve(isLoaded);
    };

    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().catch(() => undefined).finally(() => finalize(true));
        return;
      }

      finalize(true);
    };

    image.onerror = () => finalize(false);
    image.src = fetchUrl;
  });

  carouselImagePreloadRequests.set(fetchUrl, request);
  return request;
}

export function useCarouselImagePreload(
  urls: readonly string[],
  currentIndex: number,
  options: CarouselImagePreloadOptions = {},
) {
  const { enabled = true, preloadCount = 1, referenceOptimizedSrc = null } = options;
  const [readyUrls, setReadyUrls] = useState<Set<string>>(() => new Set());

  const candidateUrls = useMemo(() => {
    if (!enabled || urls.length <= 1) {
      return [];
    }

    if (preloadCount === "all") {
      return urls.filter((_, index) => index !== currentIndex);
    }

    const normalizedCount = Math.max(1, preloadCount);
    const orderedCandidates: string[] = [];
    for (let offset = 1; offset <= normalizedCount; offset += 1) {
      orderedCandidates.push(urls[(currentIndex + offset) % urls.length]);
      orderedCandidates.push(urls[(currentIndex - offset + urls.length) % urls.length]);
    }

    return Array.from(new Set(orderedCandidates.filter((url): url is string => Boolean(url))));
  }, [currentIndex, enabled, preloadCount, urls]);

  useEffect(() => {
    if (typeof window === "undefined" || candidateUrls.length === 0) {
      return;
    }

    const preloadCandidates = candidateUrls.map((sourceUrl) => ({
      sourceUrl,
      fetchUrls: buildPreloadUrls(sourceUrl, referenceOptimizedSrc),
    }));

    let isCancelled = false;
    const markAsReady = (sourceUrl: string) => {
      if (isCancelled) {
        return;
      }

      setReadyUrls((prev) => {
        if (prev.has(sourceUrl)) {
          return prev;
        }

        const next = new Set(prev);
        next.add(sourceUrl);
        return next;
      });
    };

    for (const { sourceUrl, fetchUrls } of preloadCandidates) {
      if (fetchUrls.some((fetchUrl) => loadedCarouselFetchUrls.has(fetchUrl))) {
        markAsReady(sourceUrl);
        continue;
      }

      void Promise.all(fetchUrls.map((fetchUrl) => preloadCarouselFetchUrl(fetchUrl))).then(
        (results) => {
          if (results.some(Boolean)) {
            markAsReady(sourceUrl);
          }
        },
      );
    };

    return () => {
      isCancelled = true;
    };
  }, [candidateUrls, referenceOptimizedSrc]);

  return readyUrls;
}
