"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import {
  getFavoriteEntityCardLabel,
  getFavoriteEntityFilterLabel,
  type FavoriteEntityType,
} from "@/lib/favorite-entities";
import {
  buildProgramRouteSummary,
  formatProgramDuration,
  formatProgramPrice,
} from "@/lib/excursion-offers";
import {
  getLocalFavorites,
  subscribeLocalFavoritesChange,
  type LocalFavoriteItem,
} from "@/lib/local-favorites";
import type { PublicExcursionCard } from "@/lib/public-excursions";
import type {
  PublicAttractionCatalogItem,
  PublicTransferCatalogItem,
} from "@/lib/public-marketplace";
import type { PublicPropertyCard } from "@/lib/public-properties";
import {
  attractionsHubPath,
  excursionsHubPath,
  housingHubPath,
  toursHubPath,
  transfersHubPath,
} from "@/lib/seo/routes";

type FavoriteViewFilter = "all" | FavoriteEntityType;

type FavoriteCardItem = {
  key: string;
  id: string;
  entityType: FavoriteEntityType;
  path: string;
  name: string;
  eyebrow: string;
  subtitle: string;
  coverImageUrl: string | null;
  badges: string[];
};

type FavoriteCardsBatchResponse = {
  items?: Array<
    | {
        key: string;
        entityType: "property";
        item: PublicPropertyCard;
      }
    | {
        key: string;
        entityType: "excursion" | "tour";
        item: PublicExcursionCard;
      }
    | {
        key: string;
        entityType: "attraction";
        item: PublicAttractionCatalogItem;
      }
    | {
        key: string;
        entityType: "transfer";
        item: PublicTransferCatalogItem;
      }
  >;
};

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const favoriteCardsCache = new Map<string, FavoriteCardItem[]>();
const favoriteCardsRequestCache = new Map<string, Promise<FavoriteCardItem[]>>();

function buildFavoriteKey(item: Pick<LocalFavoriteItem, "entityType" | "id">): string {
  return `${item.entityType}:${item.id}`;
}

function serializeFavoriteSnapshot(items: LocalFavoriteItem[]): string {
  return items.map((item) => buildFavoriteKey(item)).join("|");
}

function formatMoney(value: number, currency: string): string {
  return `${ruNumberFormat.format(value)} ${currency}`;
}

function formatReviewsLabel(value: number): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) {
    return `${value} отзывов`;
  }
  if (last === 1) {
    return `${value} отзыв`;
  }
  if (last >= 2 && last <= 4) {
    return `${value} отзыва`;
  }
  return `${value} отзывов`;
}

function mapPropertyCard(item: PublicPropertyCard): FavoriteCardItem {
  const coverImageUrl =
    item.media.find((media) => media.type === "IMAGE" && media.url.trim().length > 0)?.url ?? null;

  return {
    key: buildFavoriteKey({ entityType: "property", id: item.id }),
    id: item.id,
    entityType: "property",
    path: item.path,
    name: item.name ?? "Объект без названия",
    eyebrow: item.typeLabel ?? getFavoriteEntityCardLabel("property"),
    subtitle: item.locationName ?? "Крым",
    coverImageUrl,
    badges: [
      item.activeRoomsCount > 0 ? `Номеров: ${item.activeRoomsCount}` : "Номера уточняются",
      item.reviewsCount > 0
        ? `Рейтинг ${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
        : "Пока без отзывов",
      item.minNightPrice !== null && item.currency
        ? `от ${formatMoney(item.minNightPrice, item.currency)}`
        : "Цена по запросу",
    ],
  };
}

function mapExcursionCard(
  item: PublicExcursionCard,
  entityType: FavoriteEntityType,
): FavoriteCardItem {
  const routeSummary = buildProgramRouteSummary({
    routePoints: item.routeLocations.map((location) => location.name),
    startPoint: item.startPoint,
    finishPoint: item.finishPoint,
    mainLocationName: item.mainLocationName,
    anchorLocationName: item.anchorCityName,
    locationName: item.locationName,
  });

  return {
    key: buildFavoriteKey({ entityType, id: item.id }),
    id: item.id,
    entityType,
    path: item.path,
    name: item.title ?? getFavoriteEntityCardLabel(entityType),
    eyebrow: item.subtypeLabel
      ? `${getFavoriteEntityCardLabel(entityType)} • ${item.subtypeLabel}`
      : getFavoriteEntityCardLabel(entityType),
    subtitle: routeSummary || item.locationName || "Крым",
    coverImageUrl: item.photoUrls[0] ?? null,
    badges: [
      item.availabilitySummary,
      `Длительность: ${formatProgramDuration(item)}`,
      item.reviewsCount > 0
        ? `Рейтинг ${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
        : "Пока без отзывов",
      formatProgramPrice(item),
      item.categoryName,
      item.districtName,
    ].filter((value): value is string => Boolean(value)),
  };
}

function mapTransferCard(item: PublicTransferCatalogItem): FavoriteCardItem {
  const vehicleModel = item.vehicleModel?.trim() ?? "";
  const visibleVehicleModel = /^\d{5,}$/.test(vehicleModel) ? null : vehicleModel || null;
  const coverImageUrl =
    item.coverImageUrl ??
    item.photoUrls.find((url) => url.trim().length > 0) ??
    item.fleet.find((fleetItem) => fleetItem.photoUrl?.trim())?.photoUrl ??
    null;
  const priceLabel =
    item.priceFrom !== null
      ? `от ${ruNumberFormat.format(item.priceFrom)} ₽${item.priceUnitLabel ? ` ${item.priceUnitLabel}` : ""}`
      : "Цена по запросу";

  return {
    key: buildFavoriteKey({ entityType: "transfer", id: item.id }),
    id: item.id,
    entityType: "transfer",
    path: item.path,
    name: item.title,
    eyebrow: item.transferType
      ? `${getFavoriteEntityCardLabel("transfer")} • ${item.transferType}`
      : getFavoriteEntityCardLabel("transfer"),
    subtitle: item.locationName ?? item.serviceArea ?? "Крым",
    coverImageUrl,
    badges: [
      item.fleet.length > 1 ? `Вариантов: ${item.fleet.length}` : visibleVehicleModel,
      item.seats ? `${item.seats} мест` : null,
      item.luggage ? `${item.luggage} багажа` : null,
      item.reviewsCount > 0
        ? `Рейтинг ${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
        : "Пока без отзывов",
      priceLabel,
    ].filter((value): value is string => Boolean(value)),
  };
}

function mapAttractionCard(item: PublicAttractionCatalogItem): FavoriteCardItem {
  const coverImageUrl =
    item.coverImageUrl ?? item.photoUrls.find((url) => url.trim().length > 0) ?? null;

  return {
    key: buildFavoriteKey({ entityType: "attraction", id: item.id }),
    id: item.id,
    entityType: "attraction",
    path: item.path,
    name: item.title,
    eyebrow: item.category
      ? `${getFavoriteEntityCardLabel("attraction")} • ${item.category}`
      : getFavoriteEntityCardLabel("attraction"),
    subtitle: [item.locationName, item.districtName].filter(Boolean).join(" • ") || "Крым",
    coverImageUrl,
    badges: [
      item.address,
      item.tags[0],
      item.tags[1],
      item.shortDescription ? "Место для прогулки" : null,
    ].filter((value): value is string => Boolean(value)),
  };
}

function orderFavoriteItemsFromSource(
  favorites: LocalFavoriteItem[],
  sourceItems: FavoriteCardItem[],
): FavoriteCardItem[] | null {
  const byKey = new Map(sourceItems.map((item) => [item.key, item]));
  const ordered = favorites
    .map((favorite) => byKey.get(buildFavoriteKey(favorite)))
    .filter((item): item is FavoriteCardItem => Boolean(item));

  return ordered.length === favorites.length ? ordered : null;
}

async function fetchFavoriteItems(favorites: LocalFavoriteItem[]): Promise<FavoriteCardItem[]> {
  const cacheKey = serializeFavoriteSnapshot(favorites);
  const cached = favoriteCardsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = favoriteCardsRequestCache.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = fetch("/api/public/favorites/cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items: favorites }),
  })
    .then(async (response) => {
      if (!response.ok) {
        return [];
      }

      const body = (await response.json()) as FavoriteCardsBatchResponse;
      const items =
        body.items?.map((entry) => {
          if (entry.entityType === "property") {
            return mapPropertyCard(entry.item);
          }

          if (entry.entityType === "transfer") {
            return mapTransferCard(entry.item);
          }

          if (entry.entityType === "attraction") {
            return mapAttractionCard(entry.item);
          }

          return mapExcursionCard(entry.item, entry.entityType);
        }) ?? [];

      favoriteCardsCache.set(cacheKey, items);
      return items;
    })
    .catch(() => [])
    .finally(() => {
      favoriteCardsRequestCache.delete(cacheKey);
    });

  favoriteCardsRequestCache.set(cacheKey, request);
  return request;
}

function getFilterLabel(filter: FavoriteViewFilter): string {
  return filter === "all" ? "Все" : getFavoriteEntityFilterLabel(filter);
}

export function LocalFavoritesPage() {
  const [favorites, setFavorites] = useState<LocalFavoriteItem[]>([]);
  const [items, setItems] = useState<FavoriteCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FavoriteViewFilter>("property");
  const itemsRef = useRef<FavoriteCardItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const sync = () => {
      setFavorites(getLocalFavorites());
    };

    sync();
    return subscribeLocalFavoritesChange(sync);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadItems() {
      if (favorites.length === 0) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      const currentItems = orderFavoriteItemsFromSource(favorites, itemsRef.current);
      if (currentItems) {
        setItems(currentItems);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const loaded = await fetchFavoriteItems(favorites);
      if (isCancelled) {
        return;
      }

      setItems(loaded);
      setIsLoading(false);
    }

    void loadItems();

    return () => {
      isCancelled = true;
    };
  }, [favorites]);

  const counts = useMemo(
    () => ({
      total: items.length,
      property: items.filter((item) => item.entityType === "property").length,
      excursion: items.filter((item) => item.entityType === "excursion").length,
      tour: items.filter((item) => item.entityType === "tour").length,
      attraction: items.filter((item) => item.entityType === "attraction").length,
      transfer: items.filter((item) => item.entityType === "transfer").length,
    }),
    [items],
  );

  const activeFilter = useMemo<FavoriteViewFilter>(() => {
    const fallbackFilter: FavoriteViewFilter =
      counts.property > 0
        ? "property"
        : counts.excursion > 0
          ? "excursion"
          : counts.tour > 0
            ? "tour"
            : counts.attraction > 0
              ? "attraction"
              : counts.transfer > 0
                ? "transfer"
                : "all";

    if (selectedFilter === "all") {
      return selectedFilter;
    }

    if (selectedFilter === "property" && counts.property > 0) {
      return selectedFilter;
    }

    if (selectedFilter === "excursion" && counts.excursion > 0) {
      return selectedFilter;
    }

    if (selectedFilter === "tour" && counts.tour > 0) {
      return selectedFilter;
    }

    if (selectedFilter === "attraction" && counts.attraction > 0) {
      return selectedFilter;
    }

    if (selectedFilter === "transfer" && counts.transfer > 0) {
      return selectedFilter;
    }

    return fallbackFilter;
  }, [
    counts.attraction,
    counts.excursion,
    counts.property,
    counts.tour,
    counts.transfer,
    selectedFilter,
  ]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") {
      return items;
    }

    return items.filter((item) => item.entityType === activeFilter);
  }, [activeFilter, items]);

  const filterOptions = useMemo(
    () =>
      [
        { value: "property", count: counts.property },
        { value: "excursion", count: counts.excursion },
        { value: "tour", count: counts.tour },
        { value: "attraction", count: counts.attraction },
        { value: "transfer", count: counts.transfer },
        { value: "all", count: counts.total },
      ] satisfies Array<{ value: FavoriteViewFilter; count: number }>,
    [
      counts.attraction,
      counts.excursion,
      counts.property,
      counts.total,
      counts.tour,
      counts.transfer,
    ],
  );

  const hasFavorites = counts.total > 0;
  const isEmpty = !isLoading && !hasFavorites;
  const isFilteredEmpty = !isLoading && hasFavorites && filteredItems.length === 0;

  return (
    <div className="space-y-4">
      <header className="rounded-[28px] bg-white/94 p-5 ring-1 ring-olive/10">
        <h1 className="text-3xl text-olive">
          {isLoading ? "Загрузка избранного..." : `Избранное (${counts.total})`}
        </h1>
        <p className="mt-2 text-sm text-olive/70">
          Объекты, экскурсии, туры, досуг и трансферы сохраняются только в этом браузере. Если
          очистить данные браузера, список сбросится.
        </p>

        {hasFavorites ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const isActive = activeFilter === option.value;
              const isDisabled = option.value !== "all" && option.count === 0;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedFilter(option.value)}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "border-primary bg-primary text-white shadow-[0_14px_26px_-18px_rgba(15,118,110,0.48)]"
                      : "border-olive/12 bg-white text-olive hover:bg-cream/55",
                    isDisabled ? "cursor-not-allowed opacity-45 hover:bg-white" : "",
                  ].join(" ")}
                >
                  <span>{getFilterLabel(option.value)}</span>
                  <span
                    className={[
                      "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs",
                      isActive ? "bg-white/18 text-white" : "bg-olive/8 text-olive/70",
                    ].join(" ")}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {isEmpty ? (
        <section className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-6">
          <p className="text-sm text-olive/75">
            Список пока пуст. Добавьте сердечком объекты, экскурсии, туры, досуг или трансферы в
            каталоге.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={housingHubPath}
              className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Открыть жилье
            </Link>
            <Link
              href={excursionsHubPath}
              className="inline-flex rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive hover:bg-cream/55"
            >
              Смотреть экскурсии
            </Link>
            <Link
              href={toursHubPath}
              className="inline-flex rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive hover:bg-cream/55"
            >
              Смотреть туры
            </Link>
            <Link
              href={attractionsHubPath}
              className="inline-flex rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive hover:bg-cream/55"
            >
              Смотреть досуг
            </Link>
            <Link
              href={transfersHubPath}
              className="inline-flex rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive hover:bg-cream/55"
            >
              Смотреть трансферы
            </Link>
          </div>
        </section>
      ) : null}

      {isFilteredEmpty ? (
        <section className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-6 text-sm text-olive/70">
          В разделе «{getFilterLabel(activeFilter)}» пока ничего нет.
        </section>
      ) : null}

      {filteredItems.length > 0 ? (
        <section className="grid gap-3">
          {filteredItems.map((item) => (
            <article key={item.key} className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="overflow-hidden rounded-xl bg-cream">
                  {item.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverImageUrl}
                      alt={item.name}
                      className="h-44 w-full object-cover md:h-full"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-olive/55 md:h-full">
                      Без фото
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-olive/60">{item.eyebrow}</p>
                  <h2 className="mt-1 text-2xl text-olive">{item.name}</h2>
                  <p className="mt-1 text-sm text-olive/70">{item.subtitle}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/72">
                    {item.badges.map((badge) => (
                      <span
                        key={`${item.key}-${badge}`}
                        className="rounded-full bg-cream px-3 py-1"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={item.path}
                      className="inline-flex rounded-xl bg-terra px-4 py-2 text-sm font-semibold text-white hover:bg-terra/88"
                    >
                      Открыть карточку
                    </Link>
                    <FavoriteToggleButton
                      itemId={item.id}
                      entityType={item.entityType}
                      initialIsFavorite
                      onToggle={(next) => {
                        if (!next) {
                          setItems((current) =>
                            current.filter((currentItem) => currentItem.key !== item.key),
                          );
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
