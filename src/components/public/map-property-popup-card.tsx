"use client";

// Client component for map property popup card in the public module.
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

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
};

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatMoney(value: number, currency: string | null): string {
  const amount = ruNumberFormat.format(value);
  if (currency === "RUB") {
    return `${amount} ₽`;
  }

  return currency ? `${amount} ${currency}` : amount;
}

export function MapPropertyPopupCard({ item, className, onClose }: MapPropertyPopupCardProps) {
  const photos = useMemo(
    () => Array.from(new Set(item.photos.filter((url) => url.trim().length > 0))).slice(0, 5),
    [item.photos],
  );
  const [imageIndex, setImageIndex] = useState(0);
  const safeImageIndex = photos.length > 0 ? imageIndex % photos.length : 0;
  const currentImage = photos.length > 0 ? photos[safeImageIndex] : null;

  function cycleImage(direction: -1 | 1) {
    if (photos.length <= 1) {
      return;
    }

    setImageIndex((prev) =>
      direction === 1 ? (prev + 1) % photos.length : (prev - 1 + photos.length) % photos.length,
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
        {currentImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage}
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
            initialIsFavorite={item.isFavorite}
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

        {photos.length > 1 ? (
          <>
            <div className="icon-badge-soft absolute right-2 top-11 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              {safeImageIndex + 1}/{photos.length}
            </div>

            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => cycleImage(-1)}
                className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full"
              >
                <span className="sr-only">Предыдущее фото</span>
                <AppIcon icon={ChevronLeft} className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => cycleImage(1)}
                className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full"
              >
                <span className="sr-only">Следующее фото</span>
                <AppIcon icon={ChevronRight} className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-olive">
          {item.title}
        </h3>
        <p className="line-clamp-1 text-xs text-olive/68">{item.addressShort ?? "Крым"}</p>

        <div className="rounded-xl bg-cream/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-olive/60">Цена за ночь</p>
          <p className="mt-1 text-lg font-semibold leading-tight text-olive">
            {item.pricePerNight !== null
              ? `${formatMoney(item.pricePerNight, item.currency)} / ночь`
              : "Цена по запросу"}
          </p>

          {item.reviewsCount > 0 && item.rating !== null ? (
            <p className="mt-1 text-xs text-olive/68">
              Рейтинг {item.rating.toFixed(1)} • {item.reviewsCount} отзывов
            </p>
          ) : (
            <p className="mt-1 text-xs text-olive/62">Пока без отзывов</p>
          )}
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
