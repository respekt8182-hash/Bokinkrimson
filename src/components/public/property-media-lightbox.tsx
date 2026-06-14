"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { PublicPropertyCard } from "@/lib/public-properties";

type Media = PublicPropertyCard["media"][number];

type PropertyMediaLightboxProps = {
  photos: Media[];
  initialIndex: number;
  onClose: () => void;
};

export function PropertyMediaLightbox({
  photos,
  initialIndex,
  onClose,
}: PropertyMediaLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const count = photos.length;
  const safeActiveIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
  const activeMedia = photos[safeActiveIndex];
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useBodyScrollLock(count > 0);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % count);
  }, [count]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        prev();
      } else if (event.key === "ArrowRight") {
        next();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, onClose, prev]);

  useEffect(() => {
    const thumb = thumbsRef.current?.children[safeActiveIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [safeActiveIndex]);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      return;
    }

    const dx = event.changedTouches[0].clientX - touchStartX.current;
    const dy = event.changedTouches[0].clientY - touchStartY.current;

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

  if (!portalRoot || !activeMedia) {
    return null;
  }

  return createPortal(
    <div
      className="gallery-lightbox"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографий"
    >
      <div className="gallery-lightbox-content" onClick={(event) => event.stopPropagation()}>
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

      <button className="gallery-lightbox-close" onClick={onClose} aria-label="Закрыть">
        <AppIcon icon={X} className="h-5 w-5" />
      </button>

      {count > 1 ? (
        <>
          <button
            className="gallery-lightbox-nav gallery-lightbox-prev"
            onClick={(event) => {
              event.stopPropagation();
              prev();
            }}
            aria-label="Предыдущее фото"
          >
            <AppIcon icon={ChevronLeft} className="h-5 w-5" />
          </button>
          <button
            className="gallery-lightbox-nav gallery-lightbox-next"
            onClick={(event) => {
              event.stopPropagation();
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
          onClick={(event) => event.stopPropagation()}
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              className={`gallery-lightbox-thumb ${index === safeActiveIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Фото ${index + 1}`}
              aria-current={index === safeActiveIndex}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    portalRoot,
  );
}
