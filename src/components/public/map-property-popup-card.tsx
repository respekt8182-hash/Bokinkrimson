"use client";

// Client component for map property popup card in the public module.
import { X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { stripSearchParamsFromPath } from "@/lib/seo/url-normalize";

export type MapPopupPropertyItem = {
  id: string;
  title: string;
  path: string;
  pricePerNight: number | null;
  currency: string | null;
  addressShort: string | null;
  photos: string[];
  rating: number | null;
  reviewsCount: number;
  isFavorite: boolean;
};

type MapPropertyPopupCardProps = {
  item: MapPopupPropertyItem;
  className?: string;
  onClose?: () => void;
  variant?: "default" | "compact";
};

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatMoney(value: number, currency: string | null): string {
  const amount = ruNumberFormat.format(value);
  if (currency === "RUB") {
    return `${amount} ₽`;
  }

  return currency ? `${amount} ${currency}` : amount;
}

function formatReviewsLabel(value: number): string {
  const count = Math.max(0, Math.floor(value));
  const mod100 = count % 100;
  const mod10 = count % 10;
  let noun = "отзывов";

  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) {
      noun = "отзыв";
    } else if (mod10 >= 2 && mod10 <= 4) {
      noun = "отзыва";
    }
  }

  return `${count} ${noun}`;
}

export function MapPropertyPopupCard({
  item,
  className,
  onClose,
  variant = "default",
}: MapPropertyPopupCardProps) {
  const photos = useMemo(
    () => Array.from(new Set(item.photos.filter((url) => url.trim().length > 0))).slice(0, 5),
    [item.photos],
  );
  const detailsHref = useMemo(() => stripSearchParamsFromPath(item.path), [item.path]);
  const currentImage = photos[0] ?? null;

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
            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
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
              {item.rating !== null && item.reviewsCount > 0 ? (
                <>
                  <span className="inline-flex h-6 items-center rounded-lg bg-[#58a36b] px-2 text-xs font-bold leading-none text-white">
                    {item.rating.toFixed(1).replace(".", ",")}
                  </span>
                  <span className="truncate text-xs font-medium text-olive/58">
                    {formatReviewsLabel(item.reviewsCount)}
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium text-olive/48">Пока без отзывов</span>
              )}
            </div>

            <h3 className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug text-olive">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-olive/55">
              {item.addressShort ?? "Крым"}
            </p>
            <p className="mt-1.5 text-[15px] font-extrabold leading-tight text-olive">
              {item.pricePerNight !== null
                ? `${formatMoney(item.pricePerNight, item.currency)}`
                : "Цена по запросу"}
              {item.pricePerNight !== null ? (
                <span className="ml-1 text-[11px] font-medium text-olive/48">за 1 сутки</span>
              ) : null}
            </p>
          </div>

          <div className="pointer-events-auto absolute left-4 top-4 z-20">
            <FavoriteToggleButton
              itemId={item.id}
              initialIsFavorite={item.isFavorite}
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
      data-map-popup-card="true"
      className={cn(
        "relative overflow-hidden rounded-[22px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.24)] ring-1 ring-black/5",
        className,
      )}
    >
      <Link
        href={detailsHref}
        aria-label={`Открыть карточку ${item.title}`}
        className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-10 h-[162px] bg-cream/65">
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImage}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-olive/60">
            Без фото
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2">
          <div className="pointer-events-auto">
            <FavoriteToggleButton
              itemId={item.id}
              initialIsFavorite={item.isFavorite}
              variant="icon"
              className="shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
            />
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#202124] text-white shadow-sm transition hover:bg-[#34363a]"
              aria-label="Закрыть карточку"
            >
              <AppIcon icon={X} className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none relative z-10 space-y-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          {item.rating !== null && item.reviewsCount > 0 ? (
            <>
              <span className="inline-flex h-6 items-center rounded-lg bg-[#58a36b] px-2 text-xs font-bold leading-none text-white">
                {item.rating.toFixed(1).replace(".", ",")}
              </span>
              <span className="truncate text-xs font-medium text-olive/58">
                {formatReviewsLabel(item.reviewsCount)}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-olive/48">Пока без отзывов</span>
          )}
        </div>

        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-olive">
          {item.title}
        </h3>
        <p className="line-clamp-1 text-xs text-olive/58">{item.addressShort ?? "Крым"}</p>

        <p className="text-[16px] font-extrabold leading-tight text-olive">
          {item.pricePerNight !== null
            ? `${formatMoney(item.pricePerNight, item.currency)}`
            : "Цена по запросу"}
          {item.pricePerNight !== null ? (
            <span className="ml-1 text-[11px] font-medium text-olive/48">за 1 сутки</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
