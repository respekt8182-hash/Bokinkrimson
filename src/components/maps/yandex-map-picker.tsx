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
        container: { fitToViewport: () => void };
        behaviors: { enable: (behavior: string | string[]) => void };
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

import { Check, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReverseGeocodeItem = {
  address: string;
  localityName?: string | null;
  localityType?: string | null;
  localityDisplayName?: string | null;
};

type LocationSearchItem = {
  name: string;
  latitude: number;
  longitude: number;
  zoom?: number | null;
};

type YandexMapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
  onAddressResolved?: (item: ReverseGeocodeItem) => void;
  initialSearchValue?: string | null;
  onLocationSearchResolved?: (item: LocationSearchItem) => void;
};

const DEFAULT_CENTER: [number, number] = [44.9482, 34.1003];
const COORDINATE_EPSILON = 0.0000001;
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

async function resolveLocationCenter(location: string): Promise<LocationSearchItem | null> {
  const response = await fetch(`/api/location-center?location=${encodeURIComponent(location)}`);

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { item?: LocationSearchItem | null };
  if (
    !body.item ||
    !Number.isFinite(body.item.latitude) ||
    !Number.isFinite(body.item.longitude)
  ) {
    return null;
  }

  return body.item;
}

function coordinatesFromValues(
  latitude: number | null,
  longitude: number | null,
): [number, number] | null {
  return latitude !== null && longitude !== null ? [latitude, longitude] : null;
}

function areSameCoordinates(
  first: [number, number] | null,
  second: [number, number] | null,
): boolean {
  if (first === null || second === null) {
    return first === second;
  }

  return (
    Math.abs(first[0] - second[0]) < COORDINATE_EPSILON &&
    Math.abs(first[1] - second[1]) < COORDINATE_EPSILON
  );
}

export function YandexMapPicker({
  latitude,
  longitude,
  onCoordinatesChange,
  onAddressResolved,
  initialSearchValue = "",
  onLocationSearchResolved,
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
  const onLocationSearchResolvedRef = useRef(onLocationSearchResolved);
  const initialSearchValueRef = useRef(initialSearchValue ?? "");
  const selectedCoordinatesRef = useRef<[number, number] | null>(
    coordinatesFromValues(latitude, longitude),
  );
  const resolveRequestIdRef = useRef(0);
  const locationSearchRequestIdRef = useRef(0);
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(() =>
    coordinatesFromValues(latitude, longitude),
  );
  const [confirmedCoordinates, setConfirmedCoordinates] = useState<[number, number] | null>(() =>
    coordinatesFromValues(latitude, longitude),
  );
  const [isContainerReady, setIsContainerReady] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [locationQuery, setLocationQuery] = useState(() => initialSearchValue?.trim() ?? "");
  const [locationSearchError, setLocationSearchError] = useState("");
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const keyError = !apiKey
    ? "Добавьте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env.local или .env для интерактивной карты."
    : "";

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    onAddressResolvedRef.current = onAddressResolved;
  }, [onAddressResolved]);

  useEffect(() => {
    onLocationSearchResolvedRef.current = onLocationSearchResolved;
  }, [onLocationSearchResolved]);

  useEffect(() => {
    const previous = initialSearchValueRef.current.trim();
    const next = initialSearchValue?.trim() ?? "";
    initialSearchValueRef.current = initialSearchValue ?? "";

    if (!next) {
      return;
    }

    setLocationQuery((current) => {
      const normalizedCurrent = current.trim();
      return !normalizedCurrent || normalizedCurrent === previous ? next : current;
    });
  }, [initialSearchValue]);

  useEffect(() => {
    const nextCoordinates = coordinatesFromValues(latitude, longitude);
    selectedCoordinatesRef.current = nextCoordinates;
    setSelectedCoordinates((current) =>
      areSameCoordinates(current, nextCoordinates) ? current : nextCoordinates,
    );

    if (nextCoordinates === null) {
      setConfirmedCoordinates(null);
    }
  }, [latitude, longitude]);

  const handleCoordinatesChange = useCallback((nextLat: number, nextLng: number) => {
    const nextCoordinates: [number, number] = [nextLat, nextLng];
    selectedCoordinatesRef.current = nextCoordinates;
    setSelectedCoordinates(nextCoordinates);
    resolveRequestIdRef.current += 1;
    setResolveError("");
    setIsResolvingAddress(false);
    onCoordinatesChangeRef.current(nextLat, nextLng);
  }, []);

  const moveMarkerToCoordinates = useCallback(
    (coordinates: [number, number], zoom?: number | null) => {
      markerRef.current?.geometry.setCoordinates(coordinates);
      mapRef.current?.setCenter(coordinates, zoom ?? 14, { duration: 300 });
      mapRef.current?.container.fitToViewport();
      handleCoordinatesChange(coordinates[0], coordinates[1]);
    },
    [handleCoordinatesChange],
  );

  const searchLocation = useCallback(async () => {
    const query = locationQuery.trim();

    if (query.length < 2) {
      setLocationSearchError("Введите город или посёлок.");
      return;
    }

    const requestId = locationSearchRequestIdRef.current + 1;
    locationSearchRequestIdRef.current = requestId;
    setIsSearchingLocation(true);
    setLocationSearchError("");

    try {
      const item = await resolveLocationCenter(query);

      if (locationSearchRequestIdRef.current !== requestId) {
        return;
      }

      if (!item) {
        setLocationSearchError("Не удалось найти населённый пункт в Крыму.");
        return;
      }

      const coordinates: [number, number] = [item.latitude, item.longitude];
      setLocationQuery(item.name);
      moveMarkerToCoordinates(coordinates, item.zoom ?? 13);
      onLocationSearchResolvedRef.current?.(item);
    } catch {
      if (locationSearchRequestIdRef.current === requestId) {
        setLocationSearchError("Не удалось выполнить поиск. Проверьте сеть и попробуйте ещё раз.");
      }
    } finally {
      if (locationSearchRequestIdRef.current === requestId) {
        setIsSearchingLocation(false);
      }
    }
  }, [locationQuery, moveMarkerToCoordinates]);

  const confirmGeoposition = useCallback(async () => {
    const coordinates = selectedCoordinatesRef.current;

    if (!coordinates) {
      setResolveError("Поставьте метку на карте, затем подтвердите геопозицию.");
      return;
    }

    if (!onAddressResolvedRef.current) {
      return;
    }

    const requestId = resolveRequestIdRef.current + 1;
    resolveRequestIdRef.current = requestId;
    setIsResolvingAddress(true);
    setResolveError("");

    try {
      const geocodeItem = await reverseGeocode(coordinates[0], coordinates[1]);

      if (
        resolveRequestIdRef.current !== requestId ||
        !areSameCoordinates(selectedCoordinatesRef.current, coordinates)
      ) {
        return;
      }

      if (!geocodeItem) {
        setResolveError("Не удалось определить адрес. Попробуйте подтвердить точку ещё раз.");
        return;
      }

      onAddressResolvedRef.current(geocodeItem);
      setConfirmedCoordinates(coordinates);
    } catch {
      if (resolveRequestIdRef.current === requestId) {
        setResolveError("Не удалось подтвердить геопозицию. Проверьте сеть и API-ключ.");
      }
    } finally {
      if (resolveRequestIdRef.current === requestId) {
        setIsResolvingAddress(false);
      }
    }
  }, []);

  const hasSelectedCoordinates = selectedCoordinates !== null;
  const hasUnconfirmedSelection =
    selectedCoordinates !== null && !areSameCoordinates(selectedCoordinates, confirmedCoordinates);
  const confirmHint = hasUnconfirmedSelection
    ? "Метка выбрана. Нажмите подтверждение, чтобы определить адрес и город."
    : hasSelectedCoordinates
      ? "После перемещения метки подтвердите геопозицию заново."
      : "Поставьте метку на карте, затем подтвердите геопозицию.";
  const confirmButtonIcon = isResolvingAddress ? Loader2 : Check;
  const confirmButtonIconClassName = isResolvingAddress ? "h-4 w-4 animate-spin" : "h-4 w-4";
  const confirmButtonLabel = isResolvingAddress ? "Определяем адрес..." : "Подтвердить геопозицию";

  const handleConfirmClick = useCallback(() => {
    void confirmGeoposition();
  }, [confirmGeoposition]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frameId: number | null = null;

    const updateContainerReady = () => {
      const rect = container.getBoundingClientRect();
      const isReady = rect.width > 0 && rect.height > 0;
      setIsContainerReady(isReady);

      if (isReady) {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
        frameId = window.requestAnimationFrame(() => {
          mapRef.current?.container.fitToViewport();
        });
      }
    };

    updateContainerReady();

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateContainerReady);
    observer?.observe(container);
    window.addEventListener("resize", updateContainerReady);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", updateContainerReady);
    };
  }, []);

  useEffect(() => {
    if (!apiKey || !isContainerReady) {
      return;
    }

    if (!containerRef.current || mapRef.current) {
      mapRef.current?.container.fitToViewport();
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

          const initialCenter = selectedCoordinatesRef.current ?? initialCenterRef.current;
          const map = new window.ymaps.Map(
            containerRef.current,
            {
              center: initialCenter,
              zoom: 11,
              controls: ["zoomControl", "fullscreenControl"],
            },
            { suppressMapOpenBlock: true },
          );
          map.behaviors.enable(["drag", "multiTouch", "scrollZoom"]);

          const marker = new window.ymaps.Placemark(
            initialCenter,
            {},
            { draggable: true, preset: "islands#redDotIcon" },
          );

          marker.events.add("dragend", () => {
            const [lat, lng] = marker.geometry.getCoordinates();
            handleCoordinatesChange(lat, lng);
          });

          map.events.add("click", (event) => {
            const coords = event.get("coords");
            marker.geometry.setCoordinates(coords);
            handleCoordinatesChange(coords[0], coords[1]);
          });

          map.geoObjects.add(marker);

          mapRef.current = map;
          markerRef.current = marker;
          window.requestAnimationFrame(() => map.container.fitToViewport());
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
  }, [apiKey, handleCoordinatesChange, isContainerReady]);

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
        className="flex flex-col gap-2 rounded-xl border border-olive/12 bg-white/75 p-3 sm:flex-row"
      >
        <Input
          value={locationQuery}
          onChange={(event) => {
            setLocationQuery(event.target.value);
            setLocationSearchError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchLocation();
            }
          }}
          placeholder="Найти город или посёлок"
          className="min-h-11 sm:flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={isSearchingLocation || locationQuery.trim().length < 2}
          className="min-h-11 gap-2 sm:w-auto"
          onClick={() => void searchLocation()}
        >
          <AppIcon
            icon={isSearchingLocation ? Loader2 : Search}
            className={isSearchingLocation ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          {isSearchingLocation ? "Ищем..." : "Найти"}
        </Button>
      </div>
      {locationSearchError ? <p className="text-xs text-red-600">{locationSearchError}</p> : null}
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-xl border border-olive/20 bg-sand/40 [touch-action:none]"
      />
      {keyError || loadError ? (
        <p className="text-xs text-amber-700">{keyError || loadError}</p>
      ) : null}
      {onAddressResolved ? (
        <div className="flex flex-col gap-2 rounded-xl border border-olive/12 bg-white/75 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-olive/65">{confirmHint}</p>
          <Button
            onClick={handleConfirmClick}
            disabled={!hasSelectedCoordinates || isResolvingAddress}
            className="w-full gap-2 sm:w-auto"
          >
            <AppIcon icon={confirmButtonIcon} className={confirmButtonIconClassName} />
            {confirmButtonLabel}
          </Button>
        </div>
      ) : null}
      {resolveError ? <p className="text-xs text-red-600">{resolveError}</p> : null}
      <p className="text-xs text-olive/60">
        Клик по карте или перетаскивание метки меняет только координаты. Запрос к геокодеру
        выполняется после подтверждения.
      </p>
    </div>
  );
}
