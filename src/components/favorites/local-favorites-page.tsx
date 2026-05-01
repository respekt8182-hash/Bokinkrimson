"use client";

import Link from "next/link";
import { ArrowRight, Compass, Heart, Hotel, Landmark, MapPin, Route, Van } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
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
const favoriteEntityIcons: Record<FavoriteEntityType, LucideIcon> = {
  property: Hotel,
  excursion: Compass,
  tour: Route,
  attraction: Landmark,
  transfer: Van,
};

const favoriteEntityToneClass: Record<FavoriteEntityType, string> = {
  property: "bg-foam text-primary",
  excursion: "bg-cyan-50 text-accent",
  tour: "bg-amber-50 text-warning",
  attraction: "bg-emerald-50 text-success",
  transfer: "bg-orange-50 text-terra",
};

const quickLinks = [
  { href: housingHubPath, label: "Жилье", icon: Hotel },
  { href: excursionsHubPath, label: "Экскурсии", icon: Compass },
  { href: toursHubPath, label: "Туры", icon: Route },
  { href: attractionsHubPath, label: "Досуг", icon: Landmark },
  { href: transfersHubPath, label: "Трансферы", icon: Van },
] satisfies Array<{ href: string; label: string; icon: LucideIcon }>;

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

function getFilterIcon(filter: FavoriteViewFilter): LucideIcon {
  return filter === "all" ? Heart : favoriteEntityIcons[filter];
}

function getFavoriteCardBadgeLabel(entityType: FavoriteEntityType): string {
  return entityType === "property" ? "Объект" : getFavoriteEntityCardLabel(entityType);
}

function FavoriteCardsSkeleton() {
  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Загрузка избранного">
      {[0, 1, 2, 3].map((item) => (
        <article
          key={item}
          className="grid overflow-hidden rounded-2xl border border-white/80 bg-white/82 shadow-[0_16px_46px_-36px_rgba(58,43,35,0.38)] sm:grid-cols-[210px_minmax(0,1fr)]"
        >
          <div className="catalog-skeleton h-52 rounded-none sm:h-auto" />
          <div className="space-y-4 p-5">
            <div className="catalog-skeleton h-4 w-28" />
            <div className="catalog-skeleton h-7 w-4/5" />
            <div className="catalog-skeleton h-4 w-1/2" />
            <div className="flex gap-2">
              <div className="catalog-skeleton h-7 w-24 rounded-full" />
              <div className="catalog-skeleton h-7 w-32 rounded-full" />
            </div>
            <div className="catalog-skeleton h-11 w-40 rounded-full" />
          </div>
        </article>
      ))}
    </section>
  );
}

function EmptyFavoritesState() {
  return (
    <section className="overflow-hidden rounded-2xl border border-dashed border-primary/20 bg-white/92 p-5 shadow-[0_18px_52px_-42px_rgba(58,43,35,0.42)] sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AppIcon icon={Heart} className="h-5 w-5" filled />
          </div>
          <h2 className="mt-4 text-2xl text-olive">Пока ничего не сохранено</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-olive/68">
            Добавляйте сердечком жилье, экскурсии, туры, досуг и трансферы, чтобы вернуться к ним из
            этого списка.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group inline-flex min-h-14 items-center justify-between rounded-2xl border border-olive/10 bg-cream/70 px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/20 hover:bg-white hover:text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <AppIcon icon={item.icon} className="h-4 w-4" />
                {item.label}
              </span>
              <AppIcon
                icon={ArrowRight}
                className="h-4 w-4 transition group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LocalFavoritesPage() {
  const [favorites, setFavorites] = useState<LocalFavoriteItem[]>([]);
  const [items, setItems] = useState<FavoriteCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FavoriteViewFilter>("all");
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
        { value: "all", count: counts.total },
        { value: "property", count: counts.property },
        { value: "excursion", count: counts.excursion },
        { value: "tour", count: counts.tour },
        { value: "attraction", count: counts.attraction },
        { value: "transfer", count: counts.transfer },
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
    <div className="space-y-5 sm:space-y-6">
      {hasFavorites ? (
        <header className="overflow-hidden rounded-2xl border border-white/85 bg-white/88 shadow-[0_24px_68px_-48px_rgba(58,43,35,0.42)] backdrop-blur">
          <div className="bg-cream/48 px-5 py-4 sm:px-7">
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {filterOptions.map((option) => {
                const isActive = activeFilter === option.value;
                const isDisabled = option.value !== "all" && option.count === 0;
                const Icon = getFilterIcon(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelectedFilter(option.value)}
                    aria-pressed={isActive}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                      isActive
                        ? "border-primary bg-primary text-white shadow-[0_16px_28px_-20px_rgba(15,118,110,0.55)]"
                        : "border-white/85 bg-white text-olive shadow-[0_10px_26px_-24px_rgba(58,43,35,0.35)] hover:border-primary/18 hover:text-primary",
                      isDisabled &&
                        "cursor-not-allowed opacity-45 hover:border-white/85 hover:text-olive",
                    )}
                  >
                    <AppIcon icon={Icon} className="h-4 w-4" />
                    <span>{getFilterLabel(option.value)}</span>
                    <span
                      className={cn(
                        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold",
                        isActive ? "bg-white/18 text-white" : "bg-olive/8 text-olive/70",
                      )}
                    >
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>
      ) : null}

      {isLoading ? <FavoriteCardsSkeleton /> : null}
      {isEmpty ? <EmptyFavoritesState /> : null}

      {isFilteredEmpty ? (
        <section className="rounded-2xl border border-dashed border-primary/20 bg-white/92 p-6 text-sm text-olive/70 shadow-[0_18px_52px_-42px_rgba(58,43,35,0.42)]">
          В разделе «{getFilterLabel(activeFilter)}» пока ничего нет. Выберите другой тип или
          откройте весь список.
        </section>
      ) : null}

      {!isLoading && filteredItems.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Список избранного">
          {filteredItems.map((item, index) => {
            const Icon = favoriteEntityIcons[item.entityType];

            return (
              <article
                key={item.key}
                className="catalog-card-enter group relative overflow-hidden rounded-2xl border border-white/85 bg-white/94 shadow-[0_18px_52px_-42px_rgba(58,43,35,0.46)] transition hover:-translate-y-0.5 hover:border-primary/16 hover:shadow-[0_26px_64px_-44px_rgba(15,118,110,0.45)]"
                style={{ animationDelay: `${Math.min(index, 6) * 0.04}s` }}
              >
                <div className="grid h-full sm:grid-cols-[210px_minmax(0,1fr)]">
                  <div className="relative min-h-52 overflow-hidden bg-cream sm:min-h-full">
                    <Link
                      href={item.path}
                      aria-label={`Открыть карточку ${item.name}`}
                      className="absolute inset-0 z-10"
                    />
                    {item.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.coverImageUrl}
                        alt={item.name}
                        className="h-full min-h-52 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:absolute sm:inset-0"
                      />
                    ) : (
                      <div className="flex h-full min-h-52 items-center justify-center text-sm text-olive/55">
                        Без фото
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/28 to-transparent" />
                    <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-olive shadow-sm backdrop-blur">
                      <AppIcon icon={Icon} className="h-3.5 w-3.5" />
                      {getFavoriteCardBadgeLabel(item.entityType)}
                    </div>
                    <div className="absolute right-3 top-3 z-20">
                      <FavoriteToggleButton
                        itemId={item.id}
                        entityType={item.entityType}
                        initialIsFavorite
                        variant="icon"
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

                  <div className="flex min-w-0 flex-col p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-primary/74">{item.eyebrow}</p>
                      <h2 className="mt-1 line-clamp-2 text-xl leading-snug text-olive [overflow-wrap:anywhere]">
                        {item.name}
                      </h2>
                      <p className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-olive/64">
                        <AppIcon icon={MapPin} className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="line-clamp-2 [overflow-wrap:anywhere]">
                          {item.subtitle}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-olive/72">
                      {item.badges.slice(0, 5).map((badge, badgeIndex) => (
                        <span
                          key={`${item.key}-${badge}`}
                          className={cn(
                            "rounded-full px-3 py-1.5 font-medium",
                            badgeIndex === 0
                              ? favoriteEntityToneClass[item.entityType]
                              : "bg-cream text-olive/70",
                          )}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                      <Link
                        href={item.path}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_-22px_rgba(15,118,110,0.7)] transition hover:bg-primary-hover"
                      >
                        Открыть
                        <AppIcon icon={ArrowRight} className="h-4 w-4" />
                      </Link>
                      <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                        <AppIcon icon={Heart} className="h-3.5 w-3.5" filled />В избранном
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
