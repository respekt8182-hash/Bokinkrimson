"use client";

// Yandex.Maps polygon picker for Crimea districts and urban/municipal okrugs.
// Uses the existing ymaps global (declared in yandex-map-picker.tsx) and accesses
// Polygon via `as any` to avoid redeclaring the conflicting global interface.

import { useCallback, useEffect, useRef, useState } from "react";
import { CRIMEA_DISTRICTS, CRIMEA_DISTRICT_BY_SLUG } from "@/lib/crimea-districts";

type YmapsPolygon = {
  options: { set: (key: string, value: unknown) => void };
  events: { add: (event: string, callback: () => void) => void };
};

type YmapsMapWithGeoObjects = {
  destroy: () => void;
  geoObjects: { add: (value: unknown) => void };
};

type CrimeaDistrictMapPickerProps = {
  value: string | null; // area slug
  onChange: (slug: string, name: string) => void;
};

const CRIMEA_CENTER: [number, number] = [45.0, 34.1];
const FILL_DEFAULT = "#4a7c59";
const FILL_HOVER = "#2d5a3d";
const FILL_SELECTED = "#1a3d28";
const FILL_OPACITY_DEFAULT = 0.18;
const FILL_OPACITY_HOVER = 0.35;
const FILL_OPACITY_SELECTED = 0.5;
const STROKE_DEFAULT = "#4a7c59";
const STROKE_SELECTED = "#1a3d28";
const STROKE_WIDTH_DEFAULT = 1;
const STROKE_WIDTH_SELECTED = 2;

const MUNICIPAL_OKRUG_SLUGS = new Set([
  "alushta-urban",
  "armyansk-urban",
  "sudak-urban",
  "feodosiya-urban",
  "yalta-urban",
]);

const CITY_OKRUG_SLUGS = new Set([
  "dzhankoy-urban",
  "yevpatoriya-urban",
  "kerch-urban",
  "krasnoperekopsk-urban",
  "saky-urban",
  "simferopol-urban",
]);

const SEVASTOPOL_DISTRICT_SUFFIX = "-sevastopol";

// Shared script loader — reuses the same promise as yandex-map-picker.tsx.
// The real promise is stored on the singleton variable; this just piggy-backs on
// the existing yandex-map-picker script loader or creates one if none exists yet.
let scriptPromise: Promise<void> | null = null;

function loadYandexScript(apiKey: string): Promise<void> {
  if (window.ymaps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script error")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.defer = true;
    script.dataset.yandexMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script error"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function CrimeaDistrictMapPicker({ value, onChange }: CrimeaDistrictMapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YmapsMapWithGeoObjects | null>(null);
  const polygonsRef = useRef<Map<string, YmapsPolygon>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Re-apply polygon styles whenever value or hover changes.
  const applyPolygonStyle = useCallback(
    (_slug: string, polygon: YmapsPolygon, isSelected: boolean, isHovered: boolean) => {
      if (isSelected) {
        polygon.options.set("fillColor", FILL_SELECTED);
        polygon.options.set("fillOpacity", FILL_OPACITY_SELECTED);
        polygon.options.set("strokeColor", STROKE_SELECTED);
        polygon.options.set("strokeWidth", STROKE_WIDTH_SELECTED);
      } else if (isHovered) {
        polygon.options.set("fillColor", FILL_HOVER);
        polygon.options.set("fillOpacity", FILL_OPACITY_HOVER);
        polygon.options.set("strokeColor", STROKE_DEFAULT);
        polygon.options.set("strokeWidth", STROKE_WIDTH_DEFAULT);
      } else {
        polygon.options.set("fillColor", FILL_DEFAULT);
        polygon.options.set("fillOpacity", FILL_OPACITY_DEFAULT);
        polygon.options.set("strokeColor", STROKE_DEFAULT);
        polygon.options.set("strokeWidth", STROKE_WIDTH_DEFAULT);
      }
    },
    [],
  );

  useEffect(() => {
    for (const [slug, polygon] of polygonsRef.current.entries()) {
      applyPolygonStyle(slug, polygon, slug === value, slug === hoveredSlug);
    }
  }, [value, hoveredSlug, applyPolygonStyle]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let mounted = true;

    const setup = async () => {
      try {
        await loadYandexScript(apiKey);
        if (!mounted || !containerRef.current || !window.ymaps) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ymaps = window.ymaps as any;

        ymaps.ready(() => {
          if (!mounted || !containerRef.current || !ymaps.Map || !ymaps.Polygon) return;

          const map: YmapsMapWithGeoObjects = new ymaps.Map(
            containerRef.current,
            { center: CRIMEA_CENTER, zoom: 8, controls: ["zoomControl"] },
            { suppressMapOpenBlock: true },
          );
          mapRef.current = map;

          for (const district of CRIMEA_DISTRICTS) {
            const polygon: YmapsPolygon = new ymaps.Polygon(
              [district.polygon],
              { hintContent: district.name },
              {
                fillColor: FILL_DEFAULT,
                fillOpacity: FILL_OPACITY_DEFAULT,
                strokeColor: STROKE_DEFAULT,
                strokeWidth: STROKE_WIDTH_DEFAULT,
                cursor: "pointer",
              },
            );

            polygon.events.add("mouseenter", () => setHoveredSlug(district.slug));
            polygon.events.add("mouseleave", () =>
              setHoveredSlug((prev) => (prev === district.slug ? null : prev)),
            );
            polygon.events.add("click", () => onChangeRef.current(district.slug, district.name));

            map.geoObjects.add(polygon);
            polygonsRef.current.set(district.slug, polygon);
          }

          setMapLoaded(true);
          setLoadError("");
        });
      } catch {
        if (mounted) setLoadError("Не удалось загрузить карту");
      }
    };

    void setup();
    const polygons = polygonsRef.current;

    return () => {
      mounted = false;
      mapRef.current?.destroy();
      mapRef.current = null;
      polygons.clear();
      setMapLoaded(false);
    };
  }, [apiKey]);

  const selectedDistrict = value ? CRIMEA_DISTRICT_BY_SLUG[value] : null;
  const keyError = !apiKey
    ? "Добавьте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env.local или .env для карты районов и округов."
    : "";
  const areaGroups = [
    {
      title: "Районы Крыма",
      items: CRIMEA_DISTRICTS.filter(
        (item) =>
          !MUNICIPAL_OKRUG_SLUGS.has(item.slug) &&
          !CITY_OKRUG_SLUGS.has(item.slug) &&
          !item.slug.endsWith(SEVASTOPOL_DISTRICT_SUFFIX),
      ),
    },
    {
      title: "Муниципальные округа",
      items: CRIMEA_DISTRICTS.filter((item) => MUNICIPAL_OKRUG_SLUGS.has(item.slug)),
    },
    {
      title: "Городские округа",
      items: CRIMEA_DISTRICTS.filter((item) => CITY_OKRUG_SLUGS.has(item.slug)),
    },
    {
      title: "Районы Севастополя",
      items: CRIMEA_DISTRICTS.filter((item) => item.slug.endsWith(SEVASTOPOL_DISTRICT_SUFFIX)),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-3">
      {/* Yandex.Maps with district polygons */}
      <div className="relative overflow-hidden rounded-xl border border-olive/20 bg-sand/40">
        <div ref={containerRef} className="h-72 w-full" />
        {!mapLoaded && !loadError && !keyError && (
          <div className="absolute inset-0 flex items-center justify-center bg-sand/60 text-xs text-olive/50">
            Загрузка карты…
          </div>
        )}
        {(keyError || loadError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-sand/80 px-4 text-center text-xs text-amber-700">
            {keyError || loadError}
          </div>
        )}
        {selectedDistrict && (
          <div className="absolute bottom-2 left-2 rounded-lg border border-primary/30 bg-white/90 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm">
            {selectedDistrict.name}
          </div>
        )}
      </div>

      <p className="text-xs text-olive/55">
        Нажмите на район или округ на карте, либо выберите из списка ниже.
      </p>

      {/* Area groups and buttons */}
      <div className="space-y-2.5">
        {areaGroups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-olive/55">
              {group.title}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((district) => {
                const isSelected = value === district.slug;
                return (
                  <button
                    key={district.slug}
                    type="button"
                    onClick={() => onChange(district.slug, district.name)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-olive/18 bg-white text-olive/65 hover:border-primary/35 hover:text-olive"
                    }`}
                  >
                    {district.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange("", "")}
            className="rounded-lg border border-olive/15 bg-white px-2.5 py-1 text-xs text-olive/45 transition hover:border-terra/30 hover:text-terra"
          >
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}
