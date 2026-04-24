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
            className="relative hidden aspect-[16/9] overflow-hidden rounded-3xl ring-1 ring-olive/10 md:block"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={visibleUrls[0]}
              alt={`${title} — фото 1`}
              fill
              sizes="(max-width: 1024px) 100vw, 820px"
              className="object-cover"
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
                className="relative aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-olive/10"
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={url}
                  alt={`${title} — фото ${index + 1}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover"
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
          <div className="hidden gap-3 md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
            <button
              type="button"
              className="relative min-h-[18rem] overflow-hidden rounded-3xl ring-1 ring-olive/10"
              onClick={() => openLightbox(0)}
            >
              <Image
                src={visibleUrls[0]}
                alt={`${title} — фото 1`}
                fill
                sizes="(max-width: 1024px) 100vw, 520px"
                className="object-cover"
                onError={() =>
                  setBrokenUrls((current) =>
                    current.includes(visibleUrls[0]) ? current : [...current, visibleUrls[0]],
                  )
                }
              />
            </button>
            <div className="grid gap-3">
              {visibleUrls.slice(1, 3).map((url, index) => (
                <button
                  key={`desktop-${url}-${index + 1}`}
                  type="button"
                  className="relative min-h-[8.5rem] overflow-hidden rounded-3xl ring-1 ring-olive/10"
                  onClick={() => openLightbox(index + 1)}
                >
                  <Image
                    src={url}
                    alt={`${title} — фото ${index + 2}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 320px"
                    className="object-cover"
                    onError={() =>
                      setBrokenUrls((current) =>
                        current.includes(url) ? current : [...current, url],
                      )
                    }
                  />
                  {index === 1 && count > 3 ? (
                    <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-midnight/45 via-transparent to-transparent p-4">
                      <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-olive shadow-sm">
                        +{count - 3} фото
                      </span>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
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
