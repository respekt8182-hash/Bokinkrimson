"use client";

import { isFavoriteEntityType, type FavoriteEntityType } from "@/lib/favorite-entities";

const favoritesStorageKey = "wishlisted_ids";
const legacyFavoritesStorageKey = "boking.local_favorite_property_ids_v1";
const favoritesChangedEvent = "boking:favorites:changed";

export type LocalFavoriteItem = {
  entityType: FavoriteEntityType;
  id: string;
};

type ParsedFavoritesResult = {
  items: LocalFavoriteItem[];
  shouldRewrite: boolean;
};

function normalizeId(value: string): string {
  return value.trim();
}

function buildFavoriteItemKey(item: LocalFavoriteItem): string {
  return `${item.entityType}:${item.id}`;
}

function normalizeFavoriteItem(input: LocalFavoriteItem): LocalFavoriteItem | null {
  const id = normalizeId(input.id);
  if (!id) {
    return null;
  }

  return {
    entityType: input.entityType,
    id,
  };
}

function dedupeFavoriteItems(values: LocalFavoriteItem[]): LocalFavoriteItem[] {
  const seen = new Set<string>();
  const result: LocalFavoriteItem[] = [];

  for (const raw of values) {
    const item = normalizeFavoriteItem(raw);
    if (!item) {
      continue;
    }

    const key = buildFavoriteItemKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function parseStoredFavorites(parsed: unknown): ParsedFavoritesResult {
  if (!Array.isArray(parsed)) {
    return { items: [], shouldRewrite: false };
  }

  const items: LocalFavoriteItem[] = [];
  let shouldRewrite = false;

  for (const candidate of parsed) {
    if (typeof candidate === "string") {
      items.push({ entityType: "property", id: candidate });
      shouldRewrite = true;
      continue;
    }

    if (!candidate || typeof candidate !== "object") {
      shouldRewrite = true;
      continue;
    }

    const value = candidate as Partial<{
      entityType: string;
      type: string;
      id: string;
    }>;

    const entityType = isFavoriteEntityType(value.entityType)
      ? value.entityType
      : isFavoriteEntityType(value.type)
        ? value.type
        : null;

    if (!entityType || typeof value.id !== "string") {
      shouldRewrite = true;
      continue;
    }

    items.push({ entityType, id: value.id });
  }

  const deduped = dedupeFavoriteItems(items);
  if (deduped.length !== items.length) {
    shouldRewrite = true;
  }

  return { items: deduped, shouldRewrite };
}

function readFrom(key: string): ParsedFavoritesResult {
  if (typeof window === "undefined") {
    return { items: [], shouldRewrite: false };
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return { items: [], shouldRewrite: false };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseStoredFavorites(parsed);
  } catch {
    return { items: [], shouldRewrite: true };
  }
}

function readRawFavorites(): LocalFavoriteItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const primary = readFrom(favoritesStorageKey);
  if (primary.items.length > 0) {
    if (primary.shouldRewrite) {
      writeRawFavorites(primary.items);
    }
    return primary.items;
  }

  const legacy = readFrom(legacyFavoritesStorageKey);
  if (legacy.items.length > 0) {
    writeRawFavorites(legacy.items);
    window.localStorage.removeItem(legacyFavoritesStorageKey);
    return legacy.items;
  }

  return [];
}

function writeRawFavorites(values: LocalFavoriteItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = dedupeFavoriteItems(values);
  window.localStorage.setItem(favoritesStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event(favoritesChangedEvent));
}

export function getLocalFavorites(): LocalFavoriteItem[] {
  return readRawFavorites();
}

export function getLocalFavoriteIdsByType(entityType: FavoriteEntityType): string[] {
  return readRawFavorites()
    .filter((item) => item.entityType === entityType)
    .map((item) => item.id);
}

export function isLocalFavorite(item: LocalFavoriteItem): boolean {
  const normalized = normalizeFavoriteItem(item);
  if (!normalized) {
    return false;
  }

  const key = buildFavoriteItemKey(normalized);
  return readRawFavorites().some((favorite) => buildFavoriteItemKey(favorite) === key);
}

export function toggleLocalFavorite(item: LocalFavoriteItem): boolean {
  const normalized = normalizeFavoriteItem(item);
  if (!normalized) {
    return false;
  }

  const favorites = readRawFavorites();
  const key = buildFavoriteItemKey(normalized);
  const index = favorites.findIndex((favorite) => buildFavoriteItemKey(favorite) === key);

  if (index >= 0) {
    favorites.splice(index, 1);
    writeRawFavorites(favorites);
    return false;
  }

  favorites.push(normalized);
  writeRawFavorites(favorites);
  return true;
}

export function setLocalFavorite(item: LocalFavoriteItem, isFavorite: boolean): boolean {
  const normalized = normalizeFavoriteItem(item);
  if (!normalized) {
    return false;
  }

  const favorites = readRawFavorites();
  const key = buildFavoriteItemKey(normalized);
  const index = favorites.findIndex((favorite) => buildFavoriteItemKey(favorite) === key);

  if (isFavorite) {
    if (index === -1) {
      favorites.push(normalized);
      writeRawFavorites(favorites);
    }
    return true;
  }

  if (index !== -1) {
    favorites.splice(index, 1);
    writeRawFavorites(favorites);
  }
  return false;
}

export function getLocalFavoritePropertyIds(): string[] {
  return getLocalFavoriteIdsByType("property");
}

export function isLocalFavoriteProperty(propertyId: string): boolean {
  return isLocalFavorite({ entityType: "property", id: propertyId });
}

export function toggleLocalFavoriteProperty(propertyId: string): boolean {
  return toggleLocalFavorite({ entityType: "property", id: propertyId });
}

export function setLocalFavoriteProperty(propertyId: string, isFavorite: boolean): boolean {
  return setLocalFavorite({ entityType: "property", id: propertyId }, isFavorite);
}

export function subscribeLocalFavoritesChange(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== favoritesStorageKey && event.key !== legacyFavoritesStorageKey) {
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
