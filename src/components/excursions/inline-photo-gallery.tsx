"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";

type InlinePhotoGalleryProps = {
  photoUrls: string[];
  title: string;
  className?: string;
};

function joinClassNames(...items: Array<string | undefined | false>) {
  return items.filter(Boolean).join(" ");
}

const desktopTileBaseClass =
  "group relative overflow-hidden rounded-2xl bg-cream/50 ring-1 ring-olive/10 shadow-[0_14px_34px_-28px_rgba(58,43,35,0.65)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_-28px_rgba(58,43,35,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";

function getDesktopImageSizes(count: number, index: number) {
  if (count === 1) {
    return "(max-width: 1024px) 100vw, 820px";
  }

  if (count === 2) {
    return "(max-width: 1024px) 50vw, 400px";
  }

  return index === 0
    ? "(max-width: 1024px) 100vw, 560px"
    : "(max-width: 1024px) 50vw, 280px";
}

export function InlinePhotoGallery({ photoUrls, title, className }: InlinePhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);

  const visibleUrls = useMemo(
    () => photoUrls.filter((url) => !brokenUrls.includes(url)),
    [brokenUrls, photoUrls],
  );

  const count = visibleUrls.length;
  const safeActiveIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);

  const openLightbox = useCallback(
    (index: number) => {
      if (count === 0) {
        return;
      }

      setActiveIndex(index);
      setIsOpen(true);
    },
    [count],
  );

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showPrev = useCallback(() => {
    setActiveIndex((current) => (current - 1 + count) % count);
  }, [count]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        showPrev();
      } else if (event.key === "ArrowRight") {
        showNext();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLightbox, isOpen, showNext, showPrev]);

  if (count === 0) {
    return null;
  }

  return (
    <>
      <div className={joinClassNames("space-y-3", className)}>
        <div className="flex gap-3 overflow-x-auto pb-1 md:hidden">
          {visibleUrls.map((url, index) => (
            <button
              key={`mobile-${url}-${index}`}
              type="button"
              className="relative aspect-[1.18/1] min-w-[15rem] snap-start overflow-hidden rounded-2xl ring-1 ring-olive/10"
              onClick={() => openLightbox(index)}
            >
              <Image
                src={url}
                alt={`${title} — фото ${index + 1}`}
                fill
                sizes="75vw"
                className="object-cover"
                onError={() =>
                  setBrokenUrls((current) => (current.includes(url) ? current : [...current, url]))
                }
              />
            </button>
          ))}
        </div>

        {count === 1 ? (
          <button
            type="button"
            className={joinClassNames(
              desktopTileBaseClass,
              "hidden aspect-[16/9] w-full md:block",
            )}
            onClick={() => openLightbox(0)}
          >
            <Image
              src={visibleUrls[0]}
              alt={`${title} — фото 1`}
              fill
              sizes={getDesktopImageSizes(count, 0)}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              onError={() =>
                setBrokenUrls((current) =>
                  current.includes(visibleUrls[0]) ? current : [...current, visibleUrls[0]],
                )
              }
            />
          </button>
        ) : count === 2 ? (
          <div className="hidden gap-3 md:grid md:grid-cols-2">
            {visibleUrls.map((url, index) => (
              <button
                key={`desktop-${url}-${index}`}
                type="button"
                className={joinClassNames(desktopTileBaseClass, "aspect-[4/3]")}
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={url}
                  alt={`${title} — фото ${index + 1}`}
                  fill
                  sizes={getDesktopImageSizes(count, index)}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  onError={() =>
                    setBrokenUrls((current) =>
                      current.includes(url) ? current : [...current, url],
                    )
                  }
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="hidden gap-3 md:grid md:auto-rows-[8.5rem] md:grid-cols-2 lg:auto-rows-[9rem] xl:grid-cols-3">
            {visibleUrls.map((url, index) => (
              <button
                key={`desktop-${url}-${index}`}
                type="button"
                className={joinClassNames(
                  desktopTileBaseClass,
                  index === 0
                    ? "min-h-[17.5rem] md:col-span-2 md:row-span-2"
                    : "min-h-[8.5rem]",
                )}
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={url}
                  alt={`${title} — фото ${index + 1}`}
                  fill
                  sizes={getDesktopImageSizes(count, index)}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  onError={() =>
                    setBrokenUrls((current) =>
                      current.includes(url) ? current : [...current, url],
                    )
                  }
                />
                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold leading-none text-olive/70 shadow-sm ring-1 ring-olive/10">
                  {index + 1}/{count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-midnight/78 px-4 py-6 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div
            className="relative flex w-full max-w-5xl flex-col gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 text-white">
              <p className="text-sm font-semibold">
                {title} · {safeActiveIndex + 1}/{count}
              </p>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
                onClick={closeLightbox}
                aria-label="Закрыть просмотр"
              >
                <AppIcon icon={X} className="h-5 w-5" />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] bg-black/35 ring-1 ring-white/10">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={visibleUrls[safeActiveIndex]}
                  alt={`${title} — фото ${safeActiveIndex + 1}`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </div>

              {count > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/60"
                    onClick={showPrev}
                    aria-label="Предыдущее фото"
                  >
                    <AppIcon icon={ChevronLeft} className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/60"
                    onClick={showNext}
                    aria-label="Следующее фото"
                  >
                    <AppIcon icon={ChevronRight} className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
