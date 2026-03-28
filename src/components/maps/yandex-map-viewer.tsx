// UI component for yandex map viewer in the maps module.
"use client";

import { useEffect, useRef, useState } from "react";

type YandexMapViewerProps = {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
};

let scriptPromise: Promise<void> | null = null;

type YandexMapInstance = {
  destroy: () => void;
  setCenter: (center: [number, number], zoom?: number, options?: unknown) => void;
  geoObjects: {
    add: (value: unknown) => void;
    removeAll: () => void;
  };
};

type YandexApi = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, state: unknown, options?: unknown) => YandexMapInstance;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => unknown;
};

function getYandexApi(): YandexApi | undefined {
  return (window as Window & { ymaps?: YandexApi }).ymaps;
}

function loadYandexScript(apiKey: string): Promise<void> {
  if (getYandexApi()) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps="true"]');

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.defer = true;
    script.dataset.yandexMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function YandexMapViewer({
  latitude,
  longitude,
  zoom = 15,
  className = "h-80 w-full",
}: YandexMapViewerProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      return;
    }

    let mounted = true;

    const setupMap = async () => {
      try {
        await loadYandexScript(apiKey);

        const ymaps = getYandexApi();
        if (!mounted || !containerRef.current || !ymaps) {
          return;
        }

        ymaps.ready(() => {
          const readyYmaps = getYandexApi();
          if (!mounted || !containerRef.current || !readyYmaps) {
            return;
          }

          const map = new readyYmaps.Map(
            containerRef.current,
            {
              center: [latitude, longitude],
              zoom,
              controls: ["zoomControl", "fullscreenControl"],
            },
            { suppressMapOpenBlock: true },
          );

          const marker = new readyYmaps.Placemark(
            [latitude, longitude],
            {},
            { preset: "islands#redDotIcon" },
          );

          map.geoObjects.add(marker);
          mapRef.current = map;
          setError("");
        });
      } catch {
        setError("Не удалось загрузить Яндекс.Карты. Проверьте ключ и подключение к сети.");
      }
    };

    void setupMap();

    return () => {
      mounted = false;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [apiKey, latitude, longitude, zoom]);

  useEffect(() => {
    const ymaps = getYandexApi();
    if (!mapRef.current || !ymaps) {
      return;
    }

    mapRef.current.geoObjects.removeAll();
    const marker = new ymaps.Placemark(
      [latitude, longitude],
      {},
      { preset: "islands#redDotIcon" },
    );
    mapRef.current.geoObjects.add(marker);
    mapRef.current.setCenter([latitude, longitude], zoom, { duration: 250 });
  }, [latitude, longitude, zoom]);

  if (!apiKey) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Добавьте `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` для отображения карты.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`${className} overflow-hidden rounded-xl border border-olive/20 bg-sand/40`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
