// UI component for yandex map picker in the maps module.
"use client";

declare global {
  interface Window {
    ymaps?: {
      ready: (callback: () => void) => void;
      Map: new (
        element: HTMLElement,
        state: unknown,
        options?: unknown,
      ) => {
        destroy: () => void;
        setCenter: (center: [number, number], zoom?: number, options?: unknown) => void;
        geoObjects: { add: (value: unknown) => void };
        events: {
          add: (
            event: "click",
            callback: (event: { get: (name: string) => [number, number] }) => void,
          ) => void;
        };
      };
      Placemark: new (
        coordinates: [number, number],
        properties: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => {
        geometry: {
          setCoordinates: (coordinates: [number, number]) => void;
          getCoordinates: () => [number, number];
        };
        events: {
          add: (event: "dragend", callback: () => void) => void;
        };
      };
    };
  }
}

import { useCallback, useEffect, useRef, useState } from "react";

type ReverseGeocodeItem = {
  address: string;
  localityName?: string | null;
  localityType?: string | null;
  localityDisplayName?: string | null;
};

type YandexMapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
  onAddressResolved?: (item: ReverseGeocodeItem) => void;
};

const DEFAULT_CENTER: [number, number] = [44.9482, 34.1003];
let scriptPromise: Promise<void> | null = null;

function loadYandexScript(apiKey: string): Promise<void> {
  if (window.ymaps) {
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

async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeItem | null> {
  const response = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`);

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { item?: ReverseGeocodeItem };
  if (!body.item?.address) {
    return null;
  }

  return body.item;
}

export function YandexMapPicker({
  latitude,
  longitude,
  onCoordinatesChange,
  onAddressResolved,
}: YandexMapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<InstanceType<NonNullable<typeof window.ymaps>["Map"]> | null>(null);
  const markerRef = useRef<InstanceType<NonNullable<typeof window.ymaps>["Placemark"]> | null>(
    null,
  );
  const [loadError, setLoadError] = useState("");
  const initialCenterRef = useRef<[number, number]>(
    latitude !== null && longitude !== null ? [latitude, longitude] : DEFAULT_CENTER,
  );
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const onAddressResolvedRef = useRef(onAddressResolved);
  const keyError = !apiKey
    ? "Добавьте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env для интерактивной карты."
    : "";

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    onAddressResolvedRef.current = onAddressResolved;
  }, [onAddressResolved]);

  const handleCoordinatesChange = useCallback(
    async (nextLat: number, nextLng: number, resolveAddress = true) => {
      onCoordinatesChangeRef.current(nextLat, nextLng);

      if (resolveAddress && onAddressResolvedRef.current) {
        const geocodeItem = await reverseGeocode(nextLat, nextLng);

        if (geocodeItem) {
          onAddressResolvedRef.current(geocodeItem);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    if (!containerRef.current) {
      return;
    }

    let mounted = true;

    const setupMap = async () => {
      try {
        await loadYandexScript(apiKey);

        if (!mounted || !containerRef.current || !window.ymaps) {
          return;
        }

        window.ymaps.ready(() => {
          if (!mounted || !containerRef.current || !window.ymaps) {
            return;
          }

          const map = new window.ymaps.Map(
            containerRef.current,
            {
              center: initialCenterRef.current,
              zoom: 11,
              controls: ["zoomControl", "fullscreenControl"],
            },
            { suppressMapOpenBlock: true },
          );

          const marker = new window.ymaps.Placemark(
            initialCenterRef.current,
            {},
            { draggable: true, preset: "islands#redDotIcon" },
          );

          marker.events.add("dragend", () => {
            const [lat, lng] = marker.geometry.getCoordinates();
            void handleCoordinatesChange(lat, lng, true);
          });

          map.events.add("click", (event) => {
            const coords = event.get("coords");
            marker.geometry.setCoordinates(coords);
            void handleCoordinatesChange(coords[0], coords[1], true);
          });

          map.geoObjects.add(marker);

          mapRef.current = map;
          markerRef.current = marker;
          setLoadError("");
        });
      } catch {
        setLoadError("Не удалось загрузить Яндекс.Карты. Проверьте API-ключ и сеть.");
      }
    };

    void setupMap();

    return () => {
      mounted = false;
      mapRef.current?.destroy();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [apiKey, handleCoordinatesChange]);

  useEffect(() => {
    if (!markerRef.current || !mapRef.current || latitude === null || longitude === null) {
      return;
    }

    markerRef.current.geometry.setCoordinates([latitude, longitude]);
    mapRef.current.setCenter([latitude, longitude], 14, { duration: 250 });
  }, [latitude, longitude]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-xl border border-olive/20 bg-sand/40"
      />
      {keyError || loadError ? (
        <p className="text-xs text-amber-700">{keyError || loadError}</p>
      ) : null}
      <p className="text-xs text-olive/60">
        Клик по карте или перетаскивание метки обновляет координаты.
      </p>
    </div>
  );
}
