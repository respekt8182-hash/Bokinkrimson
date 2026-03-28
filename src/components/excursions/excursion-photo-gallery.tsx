"use client";

// Client component for excursion photo gallery in the excursions module.
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppIcon } from "@/components/ui/app-icon";

interface ExcursionPhotoGalleryProps {
  photoUrls: string[];
  title?: string;
}

export function ExcursionPhotoGallery({ photoUrls, title = "Фото экскурсии" }: ExcursionPhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const openLightbox = useCallback((index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length);
  }, [photoUrls.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % photoUrls.length);
  }, [photoUrls.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, closeLightbox, prev, next]);

  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen || !thumbsRef.current) return;
    const thumb = thumbsRef.current.children[activeIndex] as HTMLElement;
    if (thumb) {
      thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeIndex, lightboxOpen]);

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

  if (photoUrls.length === 0) return null;

  const count = photoUrls.length;

  return (
    <>
      {/* ── Gallery Grid ── */}
      <div className="excursion-gallery-grid overflow-hidden rounded-3xl">

        {/* ── Desktop ── */}
        {count === 1 ? (
          <div
            className="gallery-img-wrap hidden cursor-pointer overflow-hidden rounded-3xl md:block"
            style={{ height: "500px" }}
            onClick={() => openLightbox(0)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrls[0]} alt={title} loading="lazy" decoding="async" className="gallery-img h-full w-full object-cover" />
          </div>
        ) : count === 2 ? (
          <div
            className="hidden md:grid md:gap-2.5"
            style={{ gridTemplateColumns: "1.7fr 1fr", height: "500px" }}
          >
            <div className="gallery-img-wrap cursor-pointer overflow-hidden rounded-l-3xl" onClick={() => openLightbox(0)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrls[0]} alt={title} loading="lazy" decoding="async" className="gallery-img h-full w-full object-cover" />
            </div>
            <div className="gallery-img-wrap cursor-pointer overflow-hidden rounded-r-3xl" onClick={() => openLightbox(1)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrls[1]} alt="Фото 2" loading="lazy" decoding="async" className="gallery-img h-full w-full object-cover" />
            </div>
          </div>
        ) : (
          <div
            className="hidden md:grid md:gap-2.5"
            style={{ gridTemplateColumns: "1.7fr 1fr", gridTemplateRows: "1fr 1fr", height: "500px" }}
          >
            {/* Main large photo */}
            <div className="gallery-img-wrap row-span-2 cursor-pointer overflow-hidden rounded-l-3xl" onClick={() => openLightbox(0)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrls[0]} alt={title} loading="lazy" decoding="async" className="gallery-img h-full w-full object-cover" />
            </div>

            {/* Right column */}
            {photoUrls.slice(1, 3).map((url, i) => (
              <div
                key={`d-${i}`}
                className={`gallery-img-wrap relative cursor-pointer overflow-hidden ${i === 0 ? "rounded-tr-3xl" : "rounded-br-3xl"}`}
                onClick={() => openLightbox(i + 1)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Фото ${i + 2}`} loading="lazy" decoding="async" className="gallery-img h-full w-full object-cover" />

                {/* "View all" overlay on last visible grid cell */}
                {i === 1 && count > 3 && (
                  <div className="gallery-show-all-overlay absolute inset-0 flex items-end justify-end p-4">
                    <button
                      className="gallery-show-all-btn flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox(3);
                      }}
                    >
                      <AppIcon icon={Images} className="h-4 w-4" />
                      Все {count} фото
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Mobile ── */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          {photoUrls.slice(0, Math.min(count, 3)).map((url, i) => (
            <div
              key={`m-${i}`}
              className={`gallery-img-wrap relative cursor-pointer overflow-hidden rounded-2xl ${
                i === 0 || (count === 2 && i === 1) ? "col-span-2" : ""
              }`}
              onClick={() => openLightbox(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Фото ${i + 1}`}
                loading="lazy"
                decoding="async"
                className={`gallery-img w-full object-cover ${
                  i === 0 ? "h-60" : count === 2 && i === 1 ? "h-44" : "h-40"
                }`}
              />
              {/* "+N more" overlay on the last shown photo */}
              {i === 2 && count > 3 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-midnight/55">
                  <span className="gallery-more-badge flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white">
                    +{count - 3} фото
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* View-all button */}
          {count > 1 && (
            <button
              className="gallery-view-all-mobile col-span-2 mt-0.5 flex items-center justify-center gap-2 rounded-2xl border border-olive/12 bg-white/80 px-4 py-3 text-xs font-semibold text-olive/70 backdrop-blur-sm"
              onClick={() => openLightbox(0)}
            >
              <AppIcon icon={Images} className="h-4 w-4" />
              Посмотреть все {count} фото
            </button>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          className="gallery-lightbox"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фотографий"
        >
          {/* Main image */}
          <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={activeIndex}
              src={photoUrls[activeIndex]}
              alt={`Фото ${activeIndex + 1} из ${count}`}
              className="gallery-lightbox-img"
            />
          </div>

          {/* Counter */}
          <div className="gallery-lightbox-counter">
            {activeIndex + 1} / {count}
          </div>

          {/* Close */}
          <button className="gallery-lightbox-close" onClick={closeLightbox} aria-label="Закрыть">
            <AppIcon icon={X} className="h-5 w-5" />
          </button>

          {/* Navigation arrows */}
          {count > 1 && (
            <>
              <button
                className="gallery-lightbox-nav gallery-lightbox-prev"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Предыдущее фото"
              >
                <AppIcon icon={ChevronLeft} className="h-5 w-5" />
              </button>
              <button
                className="gallery-lightbox-nav gallery-lightbox-next"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Следующее фото"
              >
                <AppIcon icon={ChevronRight} className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Thumbnail strip */}
          {count > 1 && (
            <div className="gallery-lightbox-thumbs" ref={thumbsRef} onClick={(e) => e.stopPropagation()}>
              {photoUrls.map((url, i) => (
                <button
                  key={`t-${i}`}
                  className={`gallery-lightbox-thumb ${i === activeIndex ? "active" : ""}`}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Фото ${i + 1}`}
                  aria-current={i === activeIndex}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
