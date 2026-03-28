"use client";

// Client-side localStorage adapter for anonymous favorite properties with sync events across tabs.
const favoritesStorageKey = "wishlisted_ids";
const legacyFavoritesStorageKey = "boking.local_favorite_property_ids_v1";
const favoritesChangedEvent = "boking:favorites:changed";

function normalizeId(value: string): string {
  return value.trim();
}

function dedupeIds(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = normalizeId(raw);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

function readRawIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const readFrom = (key: string): string[] => {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return dedupeIds(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
      return [];
    }
  };

  const primary = readFrom(favoritesStorageKey);
  if (primary.length > 0) {
    return primary;
  }

  const legacy = readFrom(legacyFavoritesStorageKey);
  if (legacy.length > 0) {
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(legacy));
    window.localStorage.removeItem(legacyFavoritesStorageKey);
    return legacy;
  }

  return [];
}

function writeRawIds(values: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = dedupeIds(values);
  window.localStorage.setItem(favoritesStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event(favoritesChangedEvent));
}

export function getLocalFavoritePropertyIds(): string[] {
  return readRawIds();
}

export function isLocalFavoriteProperty(propertyId: string): boolean {
  const id = normalizeId(propertyId);
  if (!id) {
    return false;
  }

  return readRawIds().includes(id);
}

export function toggleLocalFavoriteProperty(propertyId: string): boolean {
  const id = normalizeId(propertyId);
  if (!id) {
    return false;
  }

  const ids = readRawIds();
  const index = ids.indexOf(id);

  if (index >= 0) {
    ids.splice(index, 1);
    writeRawIds(ids);
    return false;
  }

  ids.push(id);
  writeRawIds(ids);
  return true;
}

export function setLocalFavoriteProperty(propertyId: string, isFavorite: boolean): boolean {
  const id = normalizeId(propertyId);
  if (!id) {
    return false;
  }

  const ids = readRawIds();
  const index = ids.indexOf(id);

  if (isFavorite) {
    if (index === -1) {
      ids.push(id);
      writeRawIds(ids);
    }
    return true;
  }

  if (index !== -1) {
    ids.splice(index, 1);
    writeRawIds(ids);
  }
  return false;
}

export function subscribeLocalFavoritesChange(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key &&
      event.key !== favoritesStorageKey &&
      event.key !== legacyFavoritesStorageKey
    ) {
      return;
    }
    onChange();
  };

  const handleCustom = () => onChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(favoritesChangedEvent, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(favoritesChangedEvent, handleCustom);
  };
}
