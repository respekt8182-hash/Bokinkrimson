"use client";

import { ExternalLink, MapPin, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import {
  adminInputClass,
  adminTextareaClass,
} from "@/components/admin/admin-ui";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";

type ReverseGeocodeItem = {
  address: string;
  localityName?: string | null;
  localityDisplayName?: string | null;
};

type AdminAttractionLocationEditorProps = {
  title: string;
  locationName: string;
  districtName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationAliases: string[];
  mapUrl: string;
};

function coordinateToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function formatCoordinate(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function parseCoordinate(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPointUrl(latitude: number, longitude: number): string {
  return `https://yandex.ru/maps/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude},pm2rdm&z=15&l=map`;
}

export function AdminAttractionLocationEditor({
  title,
  locationName: initialLocationName,
  districtName: initialDistrictName,
  address: initialAddress,
  latitude: initialLatitude,
  longitude: initialLongitude,
  locationAliases,
  mapUrl: initialMapUrl,
}: AdminAttractionLocationEditorProps) {
  const [locationName, setLocationName] = useState(initialLocationName);
  const [districtName, setDistrictName] = useState(initialDistrictName);
  const [address, setAddress] = useState(initialAddress);
  const [latitudeValue, setLatitudeValue] = useState(() => coordinateToInput(initialLatitude));
  const [longitudeValue, setLongitudeValue] = useState(() => coordinateToInput(initialLongitude));
  const [mapUrl, setMapUrl] = useState(initialMapUrl);

  const latitude = useMemo(() => parseCoordinate(latitudeValue), [latitudeValue]);
  const longitude = useMemo(() => parseCoordinate(longitudeValue), [longitudeValue]);
  const pointUrl = latitude !== null && longitude !== null ? buildPointUrl(latitude, longitude) : "";

  function handleCoordinatesChange(nextLatitude: number, nextLongitude: number) {
    setLatitudeValue(formatCoordinate(nextLatitude));
    setLongitudeValue(formatCoordinate(nextLongitude));
  }

  function handleAddressResolved(item: ReverseGeocodeItem) {
    if (item.address) {
      setAddress(item.address);
    }

    const resolvedLocality = item.localityDisplayName ?? item.localityName ?? "";
    if (resolvedLocality) {
      setLocationName((current) => current || resolvedLocality);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-olive/10 bg-cream/45">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-olive">
              <MapPin className="h-4 w-4 text-primary" />
              {locationName || title}
            </p>
            <p className="mt-1 truncate text-xs text-olive/55">
              {address || "Адрес появится после выбора точки"}
            </p>
          </div>
          {pointUrl ? (
            <a
              href={mapUrl || pointUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/8"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Открыть
            </a>
          ) : null}
        </div>
        <div className="px-3 pb-3">
          <YandexMapPicker
            latitude={latitude}
            longitude={longitude}
            onCoordinatesChange={handleCoordinatesChange}
            onAddressResolved={handleAddressResolved}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-olive">Город / посёлок</span>
          <input
            name="locationName"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-olive">Район</span>
          <input
            name="districtName"
            value={districtName}
            onChange={(event) => setDistrictName(event.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-olive">Адрес или ориентир</span>
          <input
            name="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={adminInputClass}
          />
        </label>
      </div>

      <details className="rounded-2xl border border-olive/10 bg-white/70 px-4 py-3">
        <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-olive">
          <SlidersHorizontal className="h-4 w-4 text-olive/45" />
          Точные данные и поиск
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Широта</span>
            <input
              name="latitude"
              value={latitudeValue}
              onChange={(event) => setLatitudeValue(event.target.value)}
              inputMode="decimal"
              className={adminInputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Долгота</span>
            <input
              name="longitude"
              value={longitudeValue}
              onChange={(event) => setLongitudeValue(event.target.value)}
              inputMode="decimal"
              className={adminInputClass}
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-olive">Яндекс Карты</span>
            <input
              name="mapUrl"
              value={mapUrl}
              onChange={(event) => setMapUrl(event.target.value)}
              placeholder={pointUrl || "https://yandex.ru/maps/..."}
              className={adminInputClass}
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-olive">Алиасы для поиска</span>
            <textarea
              name="locationAliases"
              defaultValue={locationAliases.join("\n")}
              className={adminTextareaClass}
            />
          </label>
        </div>
      </details>
    </div>
  );
}
