"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { PublicPropertyCard } from "@/lib/public-properties";

type Media = PublicPropertyCard["media"][number];

interface PropertyMediaGalleryProps {
  media: Media[];
  title?: string;
}

function MediaItem({
  media,
  alt,
  className,
  loading = "lazy",
  sizes,
}: {
  media: Media;
  alt: string;
  className: string;
  loading?: "lazy" | "eager";
  sizes?: string;
}) {
  return (
    <Image
      src={media.url}
      alt={alt}
      fill
      loading={loading}
      sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
      className={className}
    />
  );
}

export function PropertyMediaGallery({
  media,
  title = "Фото объекта",
}: PropertyMediaGalleryProps) {
  const photos = media.filter((item) => item.type === "IMAGE").slice(0, 10);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const openLightbox = useCallback((index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  const count = photos.length;
  const safeActiveIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
  const isLightboxVisible = lightboxOpen && count > 0;
  useBodyScrollLock(isLightboxVisible);

  useEffect(() => {
    if (!isLightboxVisible) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isLightboxVisible, closeLightbox, prev, next]);

  useEffect(() => {
    if (!isLightboxVisible || !thumbsRef.current) return;

    const thumb = thumbsRef.current.children[safeActiveIndex] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [isLightboxVisible, safeActiveIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (count === 0) return null;

  const activeMedia = photos[safeActiveIndex];
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const desktopPreviewPhotos = photos.slice(1, 5);

  const renderDesktopGallery = () => {
    if (count === 1) {
      return (
        <div
          className="gallery-img-wrap hidden cursor-pointer overflow-hidden rounded-3xl md:block"
          style={{ height: "560px" }}
          onClick={() => openLightbox(0)}
        >
          <MediaItem
            media={photos[0]}
            alt={title}
            loading="eager"
            className="gallery-img h-full w-full object-cover"
          />
        </div>
      );
    }

    if (count === 2) {
      return (
        <div
          className="hidden md:grid md:gap-2.5"
          style={{ gridTemplateColumns: "1.7fr 1fr", height: "560px" }}
        >
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-l-3xl"
            onClick={() => openLightbox(0)}
          >
            <MediaItem
              media={photos[0]}
              alt={title}
              loading="eager"
              className="gallery-img h-full w-full object-cover"
            />
          </div>
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-r-3xl"
            onClick={() => openLightbox(1)}
          >
            <MediaItem
              media={photos[1]}
              alt="Фото 2"
              className="gallery-img h-full w-full object-cover"
            />
          </div>
        </div>
      );
    }

    if (count === 3) {
      return (
        <div
          className="hidden md:grid md:gap-2.5"
          style={{
            gridTemplateColumns: "1.7fr 1fr",
            gridTemplateRows: "1fr 1fr",
            height: "560px",
          }}
        >
          <div
            className="gallery-img-wrap row-span-2 cursor-pointer overflow-hidden rounded-l-3xl"
            onClick={() => openLightbox(0)}
          >
            <MediaItem
              media={photos[0]}
              alt={title}
              loading="eager"
              className="gallery-img h-full w-full object-cover"
            />
          </div>

          {photos.slice(1, 3).map((photo, i) => (
            <div
              key={photo.id}
              className={`gallery-img-wrap cursor-pointer overflow-hidden ${
                i === 0 ? "rounded-tr-3xl" : "rounded-br-3xl"
              }`}
              onClick={() => openLightbox(i + 1)}
            >
              <MediaItem
                media={photo}
                alt={`Фото ${i + 2}`}
                className="gallery-img h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    if (count === 4) {
      return (
        <div
          className="hidden md:grid md:gap-2.5"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            height: "560px",
          }}
        >
          <div
            className="gallery-img-wrap row-span-2 cursor-pointer overflow-hidden rounded-l-3xl"
            onClick={() => openLightbox(0)}
          >
            <MediaItem
              media={photos[0]}
              alt={title}
              loading="eager"
              className="gallery-img h-full w-full object-cover"
            />
          </div>

          {photos.slice(1, 4).map((photo, i) => (
            <div
              key={photo.id}
              className={`gallery-img-wrap cursor-pointer overflow-hidden ${
                i === 1 ? "rounded-tr-3xl" : i === 2 ? "col-span-2 rounded-br-3xl" : ""
              }`}
              onClick={() => openLightbox(i + 1)}
            >
              <MediaItem
                media={photo}
                alt={`Фото ${i + 2}`}
                className="gallery-img h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        className="hidden md:grid md:gap-2.5"
        style={{
          gridTemplateColumns: "2fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          height: "560px",
        }}
      >
        <div
          className="gallery-img-wrap row-span-2 cursor-pointer overflow-hidden rounded-l-3xl"
          onClick={() => openLightbox(0)}
        >
          <MediaItem
            media={photos[0]}
            alt={title}
            loading="eager"
            className="gallery-img h-full w-full object-cover"
          />
        </div>

        {desktopPreviewPhotos.map((photo, i) => (
          <div
            key={photo.id}
            className={`gallery-img-wrap relative cursor-pointer overflow-hidden ${
              i === 1 ? "rounded-tr-3xl" : i === 3 ? "rounded-br-3xl" : ""
            }`}
            onClick={() => openLightbox(i + 1)}
          >
            <MediaItem
              media={photo}
              alt={`Фото ${i + 2}`}
              className="gallery-img h-full w-full object-cover"
            />

            {i === 3 && count > 5 ? (
              <div className="gallery-show-all-overlay absolute inset-0 flex items-end justify-end p-4">
                <button
                  className="gallery-show-all-btn flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLightbox(4);
                  }}
                >
                  <AppIcon icon={Images} className="h-4 w-4" />
                  Все {count} фото
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const renderMobileGallery = () => {
    if (count === 1) {
      return (
        <div className="md:hidden">
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-3xl"
            onClick={() => openLightbox(0)}
          >
            <MediaItem
              media={photos[0]}
              alt={title}
              loading="eager"
              className="gallery-img h-64 w-full object-cover"
            />
          </div>
        </div>
      );
    }

    if (count === 2) {
      return (
        <div
          className="grid gap-2 md:hidden"
          style={{ gridTemplateColumns: "1.45fr 1fr", height: "240px" }}
        >
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-l-3xl"
            onClick={() => openLightbox(0)}
          >
            <MediaItem
              media={photos[0]}
              alt={title}
              loading="eager"
              className="gallery-img h-full w-full object-cover"
            />
          </div>
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-r-3xl"
            onClick={() => openLightbox(1)}
          >
            <MediaItem
              media={photos[1]}
              alt="Фото 2"
              className="gallery-img h-full w-full object-cover"
            />
          </div>
        </div>
      );
    }

    const mobileSidePhotos = photos.slice(1, Math.min(count, 4));
    const mobileRowCount = mobileSidePhotos.length >= 3 ? 3 : 2;
    const hiddenPhotosCount = count - (mobileSidePhotos.length + 1);

    return (
      <div
        className="grid gap-2 md:hidden"
        style={{
          gridTemplateColumns: "1.45fr 1fr",
          gridTemplateRows: `repeat(${mobileRowCount}, minmax(0, 1fr))`,
          height: mobileRowCount === 3 ? "276px" : "240px",
        }}
      >
        <div
          className="gallery-img-wrap cursor-pointer overflow-hidden rounded-l-3xl"
          style={{ gridRow: `span ${mobileRowCount}` }}
          onClick={() => openLightbox(0)}
        >
          <MediaItem
            media={photos[0]}
            alt={title}
            loading="eager"
            className="gallery-img h-full w-full object-cover"
          />
        </div>

        {mobileSidePhotos.map((photo, i) => {
          const isTop = i === 0;
          const isBottom = i === mobileSidePhotos.length - 1;
          const shouldShowOverlay = isBottom && hiddenPhotosCount > 0;

          return (
            <div
              key={photo.id}
              className={`gallery-img-wrap relative cursor-pointer overflow-hidden ${
                isTop ? "rounded-tr-3xl" : isBottom ? "rounded-br-3xl" : ""
              }`}
              onClick={() => openLightbox(i + 1)}
            >
              <MediaItem
                media={photo}
                alt={`Фото ${i + 2}`}
                className="gallery-img h-full w-full object-cover"
              />

              {shouldShowOverlay ? (
                <div className="absolute inset-0 flex items-center justify-center bg-midnight/50">
                  <span className="gallery-more-badge flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white">
                    +{hiddenPhotosCount} фото
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="excursion-gallery-grid overflow-hidden rounded-3xl">
        {renderDesktopGallery()}
        {renderMobileGallery()}
      </div>

      {isLightboxVisible && portalRoot
        ? createPortal(
            <div
              className="gallery-lightbox"
              onClick={closeLightbox}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              role="dialog"
              aria-modal="true"
              aria-label="Просмотр фотографий"
            >
              <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={safeActiveIndex}
                  src={activeMedia.url}
                  alt={`Фото ${safeActiveIndex + 1} из ${count}`}
                  className="gallery-lightbox-img"
                />
              </div>

              <div className="gallery-lightbox-counter">
                {safeActiveIndex + 1} / {count}
              </div>

              <button
                className="gallery-lightbox-close"
                onClick={closeLightbox}
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-5 w-5" />
              </button>

              {count > 1 ? (
                <>
                  <button
                    className="gallery-lightbox-nav gallery-lightbox-prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      prev();
                    }}
                    aria-label="Предыдущее фото"
                  >
                    <AppIcon icon={ChevronLeft} className="h-5 w-5" />
                  </button>
                  <button
                    className="gallery-lightbox-nav gallery-lightbox-next"
                    onClick={(e) => {
                      e.stopPropagation();
                      next();
                    }}
                    aria-label="Следующее фото"
                  >
                    <AppIcon icon={ChevronRight} className="h-5 w-5" />
                  </button>
                </>
              ) : null}

              {count > 1 ? (
                <div
                  className="gallery-lightbox-thumbs"
                  ref={thumbsRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  {photos.map((photo, i) => (
                    <button
                      key={photo.id}
                      className={`gallery-lightbox-thumb ${i === safeActiveIndex ? "active" : ""}`}
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Фото ${i + 1}`}
                      aria-current={i === safeActiveIndex}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>,
            portalRoot,
          )
        : null}
    </>
  );
}
