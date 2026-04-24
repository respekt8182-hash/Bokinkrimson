"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { formatProgramDuration, formatProgramPrice } from "@/lib/excursion-offers";
import { getFavoriteEntityTypeFromOfferType } from "@/lib/favorite-entities";
import type { PublicExcursionCatalogItem } from "@/lib/public-excursions";

type MapExcursionPopupCardProps = {
  item: PublicExcursionCatalogItem;
  className?: string;
  onClose?: () => void;
};

function pluralizeReviews(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} отзывов`;
  }
  if (mod10 === 1) {
    return `${count} отзыв`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} отзыва`;
  }

  return `${count} отзывов`;
}

function hasMeaningfulDuration(item: PublicExcursionCatalogItem): boolean {
  return (
    (item.durationMinutes ?? 0) > 0 ||
    (item.durationDays ?? 0) > 0 ||
    (item.durationNights ?? 0) > 0
  );
}

export function MapExcursionPopupCard({
  item,
  className,
  onClose,
}: MapExcursionPopupCardProps) {
  const locationLabel =
    item.locationName ||
    item.mainLocationName ||
    item.districtName ||
    item.routeSummary ||
    "Крым";
  const metaLabel =
    item.avgRating > 0 && item.reviewsCount > 0
      ? `Рейтинг ${item.avgRating.toFixed(1)} • ${pluralizeReviews(item.reviewsCount)}`
      : hasMeaningfulDuration(item)
        ? `Длительность ${formatProgramDuration(item)}`
        : item.hasAvailableSession
          ? "Есть места"
          : "Программа по запросу";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-olive/20 bg-white shadow-[0_18px_40px_rgba(17,29,16,0.28)]",
        className,
      )}
    >
      <div className="relative h-36 bg-cream/65">
        {item.coverImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.coverImageUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-olive/60">
            Без фото
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2">
          <FavoriteToggleButton
            itemId={item.id}
            entityType={getFavoriteEntityTypeFromOfferType(item.offerType)}
            initialIsFavorite={false}
            variant="icon"
          />

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full text-olive/90"
              aria-label="Закрыть карточку"
            >
              <AppIcon icon={X} className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-olive">
          {item.title}
        </h3>
        <p className="line-clamp-1 text-xs text-olive/68">{locationLabel}</p>

        <div className="rounded-xl bg-cream/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-olive/60">Стоимость</p>
          <p className="mt-1 text-lg font-semibold leading-tight text-olive">
            {formatProgramPrice(item)}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-olive/68">{metaLabel}</p>
        </div>

        <Link
          href={item.path}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-terra px-4 text-sm font-semibold text-white transition hover:bg-terra/88"
        >
          Подробнее
        </Link>
      </div>
    </article>
  );
}
