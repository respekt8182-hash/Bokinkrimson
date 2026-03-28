"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import {
  getLocalFavoritePropertyIds,
  subscribeLocalFavoritesChange,
} from "@/lib/local-favorites";
import type { PublicPropertyCard } from "@/lib/public-properties";

type FavoriteCardItem = {
  id: string;
  path: string;
  name: string;
  typeLabel: string | null;
  locationName: string | null;
  coverImageUrl: string | null;
  activeRoomsCount: number;
  minNightPrice: number | null;
  currency: string | null;
  avgRating: number;
  reviewsCount: number;
};

function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

function formatReviewsLabel(value: number): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${value} отзывов`;
  if (last === 1) return `${value} отзыв`;
  if (last >= 2 && last <= 4) return `${value} отзыва`;
  return `${value} отзывов`;
}

function mapCard(item: PublicPropertyCard): FavoriteCardItem {
  const coverImageUrl =
    item.media.find((media) => media.type === "IMAGE" && media.url.trim().length > 0)?.url ?? null;

  return {
    id: item.id,
    path: item.path,
    name: item.name ?? "Объект без названия",
    typeLabel: item.typeLabel,
    locationName: item.locationName,
    coverImageUrl,
    activeRoomsCount: item.activeRoomsCount,
    minNightPrice: item.minNightPrice,
    currency: item.currency,
    avgRating: item.avgRating,
    reviewsCount: item.reviewsCount,
  };
}

async function fetchFavoriteItem(propertyId: string): Promise<FavoriteCardItem | null> {
  try {
    const response = await fetch(`/api/public/properties/${encodeURIComponent(propertyId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { item?: PublicPropertyCard };
    if (!body.item) {
      return null;
    }
    return mapCard(body.item);
  } catch {
    return null;
  }
}

export function LocalFavoritesPage() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [items, setItems] = useState<FavoriteCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sync = () => {
      setFavoriteIds(getLocalFavoritePropertyIds());
    };

    sync();
    return subscribeLocalFavoritesChange(sync);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadItems() {
      if (favoriteIds.length === 0) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const loaded = await Promise.all(favoriteIds.map((id) => fetchFavoriteItem(id)));
      if (isCancelled) {
        return;
      }

      const byId = new Map(loaded.filter((item): item is FavoriteCardItem => Boolean(item)).map((item) => [item.id, item]));
      const ordered = favoriteIds.map((id) => byId.get(id)).filter((item): item is FavoriteCardItem => Boolean(item));

      setItems(ordered);
      setIsLoading(false);
    }

    void loadItems();

    return () => {
      isCancelled = true;
    };
  }, [favoriteIds]);

  const hasFavorites = items.length > 0;
  const isEmpty = !isLoading && !hasFavorites;
  const titleText = useMemo(() => {
    if (isLoading) {
      return "Загрузка избранного...";
    }
    return `Избранное (${items.length})`;
  }, [isLoading, items.length]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl text-olive">{titleText}</h1>
        <p className="mt-1 text-sm text-olive/70">
          Избранное хранится только в этом браузере. Если очистить данные браузера, список будет сброшен.
        </p>
      </header>

      {isEmpty ? (
        <section className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-6">
          <p className="text-sm text-olive/75">Список пуст. Добавьте объекты сердечком в каталоге.</p>
          <Link
            href="/search?direction=housing"
            className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Открыть каталог жилья
          </Link>
        </section>
      ) : null}

      {hasFavorites ? (
        <section className="grid gap-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10">
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
                  <p className="text-xs uppercase tracking-wide text-olive/60">
                    {item.typeLabel ?? "Объект размещения"}
                  </p>
                  <h2 className="mt-1 text-2xl text-olive">{item.name}</h2>
                  <p className="mt-1 text-sm text-olive/70">{item.locationName ?? "Крым"}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/72">
                    <span className="rounded-full bg-cream px-3 py-1">Номеров: {item.activeRoomsCount}</span>
                    {item.reviewsCount > 0 ? (
                      <span className="rounded-full bg-cream px-3 py-1">
                        Рейтинг {item.avgRating.toFixed(1)} • {formatReviewsLabel(item.reviewsCount)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-cream px-3 py-1">Пока без отзывов</span>
                    )}
                    <span className="rounded-full bg-cream px-3 py-1">
                      {item.minNightPrice !== null && item.currency
                        ? `от ${formatMoney(item.minNightPrice, item.currency)}`
                        : "Цена по запросу"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={item.path}
                      className="inline-flex rounded-xl bg-terra px-4 py-2 text-sm font-semibold text-white hover:bg-terra/88"
                    >
                      Открыть карточку
                    </Link>
                    <FavoriteToggleButton propertyId={item.id} initialIsFavorite />
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
