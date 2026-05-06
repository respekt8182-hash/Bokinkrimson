"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { useCarouselImagePreload } from "@/hooks/use-carousel-image-preload";
import { cn } from "@/lib/cn";
import type { PopularPropertyItem } from "@/lib/popular-properties";

const SWIPE_THRESHOLD = 50;
const EMPTY_SET = new Set<string>();

const ruNumberFormat = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function formatMoney(value: number, currency: string): string {
  const amount = ruNumberFormat.format(value);
  if (currency === "RUB") return `${amount} ₽`;
  return `${amount} ${currency}`;
}

/* ── Single property card ─────────────────────────────────────────── */

function PopularPropertyCard({
  item,
  prioritizeImage,
}: {
  item: PopularPropertyItem;
  prioritizeImage: boolean;
}) {
  const images = useMemo(() => item.imageUrls.slice(0, 8), [item.imageUrls]);
  const [imageIndex, setImageIndex] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [referenceOptimizedSrc, setReferenceOptimizedSrc] = useState<string | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(EMPTY_SET);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeHandled = useRef(false);

  const visibleImages = useMemo(
    () => images.filter((url) => !brokenUrls.has(url)),
    [brokenUrls, images],
  );
  const safeImageIndex =
    visibleImages.length > 0
      ? ((imageIndex % visibleImages.length) + visibleImages.length) % visibleImages.length
      : 0;
  const currentImage = visibleImages[safeImageIndex] ?? null;
  const readyImages = useCarouselImagePreload(visibleImages, safeImageIndex, {
    enabled: visibleImages.length > 1,
    preloadCount: 2,
    referenceOptimizedSrc,
  });
  const isImageLoaded =
    currentImage !== null && (loadedUrl === currentImage || readyImages.has(currentImage));
  const shouldShowSkeleton = !isImageLoaded && loadedUrl === null;
  const totalDots = Math.min(visibleImages.length, 5);

  function cycleImage(dir: -1 | 1) {
    if (visibleImages.length <= 1) return;
    setImageIndex((prev) =>
      dir === 1
        ? (prev + 1) % visibleImages.length
        : (prev - 1 + visibleImages.length) % visibleImages.length,
    );
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (visibleImages.length <= 1) return;
    swipeHandled.current = false;
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (visibleImages.length <= 1) return;
    touchEndX.current = e.targetTouches[0]?.clientX ?? null;
  }
  function handleTouchEnd() {
    if (visibleImages.length <= 1 || touchStartX.current === null || touchEndX.current === null)
      return;
    const dist = touchStartX.current - touchEndX.current;
    if (Math.abs(dist) >= SWIPE_THRESHOLD) {
      swipeHandled.current = true;
      cycleImage(dist > 0 ? 1 : -1);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  }
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!swipeHandled.current) return;
    e.preventDefault();
    swipeHandled.current = false;
  }
  function handleImageError() {
    if (!currentImage) return;
    setLoadedUrl(null);
    setBrokenUrls((prev) => {
      if (prev.has(currentImage)) return prev;
      const next = new Set(prev);
      next.add(currentImage);
      return next;
    });
  }

  // Price display
  const priceLabel = item.minNightPrice
    ? `от ${formatMoney(item.minNightPrice, item.currency ?? "RUB")}`
    : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* ── Image carousel ─────────────────────────────────────── */}
      <Link
        href={item.path}
        className="relative aspect-[4/3] w-full overflow-hidden bg-sand"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {currentImage ? (
          <>
            <Image
              src={currentImage}
              alt={item.name}
              priority={prioritizeImage}
              loading={prioritizeImage ? "eager" : "lazy"}
              fetchPriority={prioritizeImage ? "high" : "low"}
              width={400}
              height={300}
              quality={72}
              sizes="(min-width: 1280px) 280px, (min-width: 1024px) 22vw, (min-width: 640px) 50vw, 100vw"
              onLoad={(event) => {
                setLoadedUrl(currentImage);
                setReferenceOptimizedSrc(event.currentTarget.currentSrc || event.currentTarget.src);
              }}
              onError={handleImageError}
              className={cn(
                "h-full w-full object-cover transition-opacity duration-400",
                isImageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
            {shouldShowSkeleton && (
              <div className="catalog-skeleton absolute inset-0" aria-hidden />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-olive/40">
            Без фото
          </div>
        )}

        {/* Arrow buttons (desktop hover) */}
        {visibleImages.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cycleImage(-1);
              }}
              className="absolute left-1.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
            >
              <AppIcon icon={ChevronLeft} className="h-4 w-4 text-olive" />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cycleImage(1);
              }}
              className="absolute right-1.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
            >
              <AppIcon icon={ChevronRight} className="h-4 w-4 text-olive" />
            </button>
          </>
        )}

        {/* Dots */}
        {visibleImages.length > 1 && (
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {Array.from({ length: totalDots }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === safeImageIndex % totalDots ? "w-4 bg-white" : "w-1.5 bg-white/60",
                )}
              />
            ))}
          </div>
        )}
      </Link>

      {/* Favorite button */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <FavoriteToggleButton itemId={item.id} initialIsFavorite={false} variant="icon" />
      </div>

      {/* ── Card body ──────────────────────────────────────────── */}
      <Link href={item.path} className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-olive sm:text-base">
          {item.name}
        </h3>
        {item.locationName && (
          <p className="mt-0.5 line-clamp-1 text-xs text-olive/72 sm:text-sm">
            {item.locationName}
          </p>
        )}

        <div className="mt-auto pt-2">
          {priceLabel ? (
            <>
              <p className="text-sm font-bold text-olive sm:text-base">{priceLabel}</p>
            </>
          ) : (
            <p className="text-xs text-olive/68 sm:text-sm">
              Цены не указаны, уточняйте у владельца
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────────── */

type PopularPropertiesSectionProps = {
  items: PopularPropertyItem[];
};

export function PopularPropertiesSection({ items }: PopularPropertiesSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-10 sm:mt-14">
      <h2 className="font-heading text-2xl font-bold text-olive sm:text-3xl md:text-4xl">
        Последние добавленные объекты
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-3 xs:grid-cols-2 sm:mt-6 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {items.map((item, index) => (
          <PopularPropertyCard key={item.id} item={item} prioritizeImage={index < 4} />
        ))}
      </div>
    </section>
  );
}
