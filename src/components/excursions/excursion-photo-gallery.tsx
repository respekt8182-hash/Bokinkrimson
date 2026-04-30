"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";

interface ExcursionPhotoGalleryProps {
  photoUrls: string[];
  title?: string;
  desktopVariant?: "default" | "object-card";
}

const DEFAULT_GALLERY_TITLE =
  "\u0424\u043e\u0442\u043e \u044d\u043a\u0441\u043a\u0443\u0440\u0441\u0438\u0438";
const GALLERY_PLACEHOLDER_TEXT =
  "\u0424\u043e\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0438 \u044d\u043a\u0441\u043a\u0443\u0440\u0441\u0438\u0438 \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c \u043f\u043e\u0441\u043b\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438.";
const LIGHTBOX_ARIA_LABEL =
  "\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0444\u043e\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0439";
const CLOSE_LABEL = "\u0417\u0430\u043a\u0440\u044b\u0442\u044c";
const PREVIOUS_PHOTO_LABEL =
  "\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0435\u0435 \u0444\u043e\u0442\u043e";
const NEXT_PHOTO_LABEL =
  "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0435 \u0444\u043e\u0442\u043e";
const PHOTO_WORD = "\u0444\u043e\u0442\u043e";
const OBJECT_CARD_IMAGE_SIZES = "(max-width: 768px) 100vw, 50vw";

function getPhotoLabel(index: number): string {
  return `\u0424\u043e\u0442\u043e ${index + 1}`;
}

function getPhotoCounterLabel(index: number, count: number): string {
  return `\u0424\u043e\u0442\u043e ${index + 1} \u0438\u0437 ${count}`;
}

function GalleryPlaceholder({ className, title }: { className?: string; title: string }) {
  return (
    <div
      className={[
        "flex items-center justify-center rounded-3xl bg-gradient-to-br from-cream to-sand/70 text-center text-sm text-olive/45 ring-1 ring-olive/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="max-w-xs px-6">
        <p className="font-medium text-olive/60">{title}</p>
        <p className="mt-1 text-xs text-olive/45">{GALLERY_PLACEHOLDER_TEXT}</p>
      </div>
    </div>
  );
}

export function ExcursionPhotoGallery({
  photoUrls,
  title = DEFAULT_GALLERY_TITLE,
  desktopVariant = "default",
}: ExcursionPhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const visibleUrls = useMemo(
    () => photoUrls.filter((url) => !brokenUrls.includes(url)),
    [brokenUrls, photoUrls],
  );
  const count = visibleUrls.length;
  const safeActiveIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);
  const isLightboxVisible = lightboxOpen && count > 0;

  const handleImageError = useCallback((url: string) => {
    setBrokenUrls((current) => (current.includes(url) ? current : [...current, url]));
  }, []);

  const openLightbox = useCallback(
    (index: number) => {
      if (count === 0) {
        return;
      }
      setActiveIndex(index);
      setLightboxOpen(true);
    },
    [count],
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!isLightboxVisible) {
      return;
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "ArrowRight") {
        next();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isLightboxVisible, closeLightbox, prev, next]);

  useEffect(() => {
    document.body.style.overflow = isLightboxVisible ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isLightboxVisible]);

  useEffect(() => {
    if (!isLightboxVisible || !thumbsRef.current) {
      return;
    }

    const thumb = thumbsRef.current.children[safeActiveIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [isLightboxVisible, safeActiveIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      return;
    }

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) {
        next();
      } else {
        prev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (photoUrls.length === 0 || visibleUrls.length === 0) {
    return <GalleryPlaceholder className="h-72 md:h-[560px]" title={title} />;
  }

  const renderObjectCardDesktopGallery = () => {
    if (count === 1) {
      return (
        <div
          className="gallery-img-wrap hidden cursor-pointer overflow-hidden rounded-3xl md:block"
          style={{ height: "560px" }}
          onClick={() => openLightbox(0)}
        >
          <Image
            src={visibleUrls[0]}
            alt={title}
            fill
            loading="eager"
            sizes={OBJECT_CARD_IMAGE_SIZES}
            className="gallery-img h-full w-full object-cover"
            onError={() => handleImageError(visibleUrls[0])}
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
            <Image
              src={visibleUrls[0]}
              alt={title}
              fill
              loading="eager"
              sizes={OBJECT_CARD_IMAGE_SIZES}
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[0])}
            />
          </div>
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-r-3xl"
            onClick={() => openLightbox(1)}
          >
            <Image
              src={visibleUrls[1]}
              alt={getPhotoLabel(1)}
              fill
              sizes={OBJECT_CARD_IMAGE_SIZES}
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[1])}
            />
          </div>
        </div>
      );
    }

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
          <Image
            src={visibleUrls[0]}
            alt={title}
            fill
            loading="eager"
            sizes={OBJECT_CARD_IMAGE_SIZES}
            className="gallery-img h-full w-full object-cover"
            onError={() => handleImageError(visibleUrls[0])}
          />
        </div>

        {visibleUrls.slice(1, 3).map((url, index) => (
          <div
            key={`object-card-d-${url}`}
            className={`gallery-img-wrap cursor-pointer overflow-hidden ${
              index === 0 ? "rounded-tr-3xl" : "rounded-br-3xl"
            }`}
            onClick={() => openLightbox(index + 1)}
          >
            <Image
              src={url}
              alt={getPhotoLabel(index + 1)}
              fill
              sizes={OBJECT_CARD_IMAGE_SIZES}
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(url)}
            />
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
            style={{ height: "240px" }}
            onClick={() => openLightbox(0)}
          >
            <Image
              src={visibleUrls[0]}
              alt={title}
              fill
              priority
              sizes="100vw"
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[0])}
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
            <Image
              src={visibleUrls[0]}
              alt={title}
              fill
              priority
              sizes="66vw"
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[0])}
            />
          </div>
          <div
            className="gallery-img-wrap cursor-pointer overflow-hidden rounded-r-3xl"
            onClick={() => openLightbox(1)}
          >
            <Image
              src={visibleUrls[1]}
              alt={getPhotoLabel(1)}
              fill
              sizes="44vw"
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[1])}
            />
          </div>
        </div>
      );
    }

    const mobileSideUrls = visibleUrls.slice(1, Math.min(count, 4));
    const mobileRowCount = mobileSideUrls.length >= 3 ? 3 : 2;
    const hiddenPhotosCount = count - (mobileSideUrls.length + 1);

    return (
      <div className="space-y-2 md:hidden">
        <div
          className="grid gap-2"
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
            <Image
              src={visibleUrls[0]}
              alt={title}
              fill
              priority
              sizes="66vw"
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[0])}
            />
          </div>

          {mobileSideUrls.map((url, index) => {
            const isTop = index === 0;
            const isBottom = index === mobileSideUrls.length - 1;
            const shouldShowOverlay = isBottom && hiddenPhotosCount > 0;

            return (
              <div
                key={`m-${url}`}
                className={`gallery-img-wrap relative cursor-pointer overflow-hidden ${
                  isTop ? "rounded-tr-3xl" : isBottom ? "rounded-br-3xl" : ""
                }`}
                onClick={() => openLightbox(index + 1)}
              >
                <Image
                  src={url}
                  alt={getPhotoLabel(index + 1)}
                  fill
                  sizes="44vw"
                  className="gallery-img h-full w-full object-cover"
                  onError={() => handleImageError(url)}
                />

                {shouldShowOverlay ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-br-3xl bg-midnight/52">
                    <span className="gallery-more-badge flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white">
                      +{hiddenPhotosCount} {PHOTO_WORD}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {count > 3 ? (
          <button
            className="gallery-view-all-mobile flex w-full items-center justify-center gap-2 rounded-2xl border border-olive/12 bg-white/82 px-4 py-3 text-xs font-semibold text-olive/70 backdrop-blur-sm"
            onClick={() => openLightbox(0)}
          >
            <AppIcon icon={Images} className="h-4 w-4" />
            {`\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u0441\u0435 ${count} ${PHOTO_WORD}`}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="excursion-gallery-grid overflow-hidden rounded-3xl">
        {desktopVariant === "object-card" ? (
          renderObjectCardDesktopGallery()
        ) : count === 1 ? (
          <div
            className="gallery-img-wrap hidden cursor-pointer overflow-hidden rounded-3xl md:block"
            style={{ height: "560px" }}
            onClick={() => openLightbox(0)}
          >
            <Image
              src={visibleUrls[0]}
              alt={title}
              fill
              priority
              sizes="100vw"
              className="gallery-img h-full w-full object-cover"
              onError={() => handleImageError(visibleUrls[0])}
            />
          </div>
        ) : count === 2 ? (
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
              <Image
                src={visibleUrls[0]}
                alt={title}
                fill
                priority
                sizes="63vw"
                className="gallery-img h-full w-full object-cover"
                onError={() => handleImageError(visibleUrls[0])}
              />
            </div>
            <div
              className="gallery-img-wrap cursor-pointer overflow-hidden rounded-tr-3xl"
              onClick={() => openLightbox(1)}
            >
              <Image
                src={visibleUrls[1]}
                alt={getPhotoLabel(1)}
                fill
                sizes="37vw"
                className="gallery-img h-full w-full object-cover"
                onError={() => handleImageError(visibleUrls[1])}
              />
            </div>
            <div
              className="gallery-img-wrap cursor-pointer overflow-hidden rounded-br-3xl"
              onClick={() => openLightbox(1)}
            >
              <Image
                src={visibleUrls[1]}
                alt={getPhotoLabel(2)}
                fill
                sizes="37vw"
                className="gallery-img h-full w-full object-cover"
                onError={() => handleImageError(visibleUrls[1])}
              />
            </div>
          </div>
        ) : (
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
              <Image
                src={visibleUrls[0]}
                alt={title}
                fill
                priority
                sizes="63vw"
                className="gallery-img h-full w-full object-cover"
                onError={() => handleImageError(visibleUrls[0])}
              />
            </div>

            {visibleUrls.slice(1, 3).map((url, index) => (
              <div
                key={`d-${url}`}
                className={`gallery-img-wrap relative cursor-pointer overflow-hidden ${
                  index === 0 ? "rounded-tr-3xl" : "rounded-br-3xl"
                }`}
                onClick={() => openLightbox(index + 1)}
              >
                <Image
                  src={url}
                  alt={getPhotoLabel(index + 1)}
                  fill
                  sizes="37vw"
                  className="gallery-img h-full w-full object-cover"
                  onError={() => handleImageError(url)}
                />
              </div>
            ))}
          </div>
        )}

        {renderMobileGallery()}
      </div>

      {isLightboxVisible ? (
        <div
          className="gallery-lightbox"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label={LIGHTBOX_ARIA_LABEL}
        >
          <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={safeActiveIndex}
              src={visibleUrls[safeActiveIndex]}
              alt={getPhotoCounterLabel(safeActiveIndex, count)}
              className="gallery-lightbox-img"
              onError={() => handleImageError(visibleUrls[safeActiveIndex])}
            />
          </div>

          <div className="gallery-lightbox-counter">
            {safeActiveIndex + 1} / {count}
          </div>

          <button
            className="gallery-lightbox-close"
            onClick={closeLightbox}
            aria-label={CLOSE_LABEL}
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
                aria-label={PREVIOUS_PHOTO_LABEL}
              >
                <AppIcon icon={ChevronLeft} className="h-5 w-5" />
              </button>
              <button
                className="gallery-lightbox-nav gallery-lightbox-next"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label={NEXT_PHOTO_LABEL}
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
              {visibleUrls.map((url, index) => (
                <button
                  key={`t-${url}`}
                  className={`gallery-lightbox-thumb ${index === safeActiveIndex ? "active" : ""}`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={getPhotoLabel(index)}
                  aria-current={index === safeActiveIndex}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => handleImageError(url)}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
