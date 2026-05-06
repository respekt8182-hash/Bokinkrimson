"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/cn";
import { formatProgramDuration, formatProgramPrice } from "@/lib/excursion-offers";
import { getFavoriteEntityTypeFromOfferType } from "@/lib/favorite-entities";
import { formatPublicPersonName, getPublicPersonInitial } from "@/lib/public-display-name";
import type { PublicExcursionCatalogItem } from "@/lib/public-excursions";
import { stripSearchParamsFromPath } from "@/lib/seo/url-normalize";

type MapExcursionPopupCardProps = {
  item: PublicExcursionCatalogItem;
  className?: string;
  onClose?: () => void;
  variant?: "default" | "compact";
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
  variant = "default",
}: MapExcursionPopupCardProps) {
  const detailsHref = stripSearchParamsFromPath(item.path);
  const locationLabel =
    item.locationName || item.mainLocationName || item.districtName || item.routeSummary || "Крым";
  const metaLabel =
    item.avgRating > 0 && item.reviewsCount > 0
      ? `Рейтинг ${item.avgRating.toFixed(1)} • ${pluralizeReviews(item.reviewsCount)}`
      : hasMeaningfulDuration(item)
        ? `Длительность ${formatProgramDuration(item)}`
        : item.hasAvailableSession
          ? "Есть места"
          : "Программа по запросу";

  const ownerName = formatPublicPersonName(item.owner, "?");
  const ownerInitials = getPublicPersonInitial(item.owner);

  if (variant === "compact") {
    return (
      <article
        data-map-popup-card="true"
        className={cn(
          "relative overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.22)]",
          className,
        )}
      >
        <Link
          href={detailsHref}
          aria-label={`Открыть карточку ${item.title}`}
          className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
        />

        <div className="pointer-events-none relative z-10 flex min-h-[128px] gap-3 p-3">
          <div className="pointer-events-none relative h-[104px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-cream/65">
            {item.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverImageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-olive/55">
                Без фото
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 py-0.5 pr-1">
            <div className="flex min-w-0 items-center gap-2">
              {item.avgRating > 0 && item.reviewsCount > 0 ? (
                <>
                  <span className="inline-flex h-6 items-center rounded-lg bg-[#58a36b] px-2 text-xs font-bold leading-none text-white">
                    {item.avgRating.toFixed(1).replace(".", ",")}
                  </span>
                  <span className="truncate text-xs font-medium text-olive/58">
                    {pluralizeReviews(item.reviewsCount)}
                  </span>
                </>
              ) : (
                <span className="truncate text-xs font-medium text-olive/58">{metaLabel}</span>
              )}
            </div>

            <h3 className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug text-olive">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-olive/55">{locationLabel}</p>
            <p className="mt-1.5 text-[15px] font-extrabold leading-tight text-olive">
              {formatProgramPrice(item)}
              {item.avgRating > 0 && item.reviewsCount > 0 && hasMeaningfulDuration(item) ? (
                <span className="ml-1 text-[11px] font-medium text-olive/48">
                  {formatProgramDuration(item)}
                </span>
              ) : null}
            </p>
          </div>

          <div className="pointer-events-auto absolute left-4 top-4 z-20">
            <FavoriteToggleButton
              itemId={item.id}
              entityType={getFavoriteEntityTypeFromOfferType(item.offerType)}
              initialIsFavorite={false}
              variant="icon"
              className="h-8 w-8 shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
            />
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-olive/70 shadow-sm backdrop-blur transition hover:text-olive"
              aria-label="Закрыть карточку"
            >
              <AppIcon icon={X} className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </article>
    );
  }

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
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full bg-cream ring-1 ring-olive/10">
            <AvatarImage
              src={item.owner.avatarUrl}
              alt={ownerName}
              className="h-full w-full object-cover"
            >
              <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-olive/60">
                {ownerInitials || "?"}
              </span>
            </AvatarImage>
          </span>
          <span className="truncate text-xs font-semibold text-olive/70">{ownerName}</span>
        </div>

        <div className="rounded-xl bg-cream/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-olive/60">Стоимость</p>
          <p className="mt-1 text-lg font-semibold leading-tight text-olive">
            {formatProgramPrice(item)}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-olive/68">{metaLabel}</p>
        </div>

        <Link
          href={detailsHref}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-terra px-4 text-sm font-semibold text-white transition hover:bg-terra/88"
        >
          Подробнее
        </Link>
      </div>
    </article>
  );
}
