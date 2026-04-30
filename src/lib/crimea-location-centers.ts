import "server-only";

import {
  getKnownCrimeaLocationCenter,
  normalizeCrimeaLocationKey,
  type CrimeaLocationCenter,
} from "@/lib/crimea-location-coordinates";
import { geocodeAddress } from "@/lib/yandex-geocoder";

const CRIMEA_BOUNDS = {
  minLatitude: 44.2,
  maxLatitude: 46.3,
  minLongitude: 32.4,
  maxLongitude: 36.8,
};

const genericCrimeaKeys = new Set(["крым", "республика крым", "весь крым", "crimea"]);
const geocodeCache = new Map<string, Promise<CrimeaLocationCenter | null>>();

function isInsideCrimea(latitude: number, longitude: number): boolean {
  return (
    latitude >= CRIMEA_BOUNDS.minLatitude &&
    latitude <= CRIMEA_BOUNDS.maxLatitude &&
    longitude >= CRIMEA_BOUNDS.minLongitude &&
    longitude <= CRIMEA_BOUNDS.maxLongitude
  );
}

function createGeocodedCenter(
  requestedName: string,
  latitude: number,
  longitude: number,
  displayName: string | null | undefined,
): CrimeaLocationCenter {
  const name = displayName?.trim() || requestedName;

  return {
    name,
    latitude,
    longitude,
    zoom: 12,
    keys: [normalizeCrimeaLocationKey(requestedName), normalizeCrimeaLocationKey(name)].filter(
      Boolean,
    ),
  };
}

async function resolveCrimeaLocationCenterViaGeocoder(
  location: string,
): Promise<CrimeaLocationCenter | null> {
  const result = await geocodeAddress(`${location}, Республика Крым, Россия`);

  if (!result || !isInsideCrimea(result.latitude, result.longitude)) {
    return null;
  }

  const localityCenter = getKnownCrimeaLocationCenter(
    result.localityDisplayName ?? result.localityName,
  );
  if (localityCenter) {
    return localityCenter;
  }

  return createGeocodedCenter(
    location,
    result.latitude,
    result.longitude,
    result.localityDisplayName ?? result.localityName,
  );
}

export async function resolveCrimeaLocationCenter(
  value: string | null | undefined,
): Promise<CrimeaLocationCenter | null> {
  const known = getKnownCrimeaLocationCenter(value);
  if (known) {
    return known;
  }

  const location = value?.trim().replace(/\s+/g, " ") ?? "";
  const key = normalizeCrimeaLocationKey(location);
  if (location.length < 2 || !key || genericCrimeaKeys.has(key)) {
    return null;
  }

  const cached = geocodeCache.get(key);
  if (cached) {
    return cached;
  }

  const promise = resolveCrimeaLocationCenterViaGeocoder(location).catch(() => null);
  geocodeCache.set(key, promise);

  return promise;
}
