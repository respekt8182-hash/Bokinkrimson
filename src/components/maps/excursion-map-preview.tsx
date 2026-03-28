"use client";

// Client map preview for excursion pages with quick link and fullscreen Yandex map modal.
import { useEffect, useState } from "react";
import { YandexMapViewer } from "@/components/maps/yandex-map-viewer";

type ExcursionMapPreviewProps = {
  latitude: number;
  longitude: number;
  addressLabel: string;
  className?: string;
};

export function ExcursionMapPreview({
  latitude,
  longitude,
  addressLabel,
  className = "h-64 w-full",
}: ExcursionMapPreviewProps) {
  const [isMapOpened, setIsMapOpened] = useState(false);

  const previewUrl = `https://yandex.ru/map-widget/v1/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude},pm2rdm&z=13`;
  const yandexMapsUrl = `https://yandex.ru/maps/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude}&z=13&l=map`;

  useEffect(() => {
    if (!isMapOpened) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMapOpened(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMapOpened]);

  return (
    <>
      <div className={`group relative block ${className} overflow-hidden border-t border-olive/10 text-left`}>
        <iframe
          src={previewUrl}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ border: "none" }}
          title="Карта локации"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight/60 via-midnight/25 to-midnight/10" />
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <div className="flex flex-wrap items-center justify-center">
            <a
              href={yandexMapsUrl}
              aria-label={`Открыть на Яндекс.Картах: ${addressLabel}`}
              className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(15,118,110,0.55)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/45"
            >
              Открыть на Яндекс.Картах
            </a>
          </div>
        </div>
      </div>
      {isMapOpened ? (
        <div
          className="fixed inset-0 z-[90] bg-midnight/55 p-3 backdrop-blur-[1px] sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsMapOpened(false);
            }
          }}
        >
          <section className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white/97 p-3 ring-1 ring-olive/10 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-olive">Карта локации</p>
                <p className="text-xs text-olive/65">На карте: точка экскурсии</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMapOpened(false)}
                className="inline-flex h-9 items-center rounded-xl border border-olive/16 bg-white px-3 text-xs font-semibold text-olive transition hover:bg-cream/70"
              >
                × Закрыть карту
              </button>
            </div>
            <div className="relative mt-3 min-h-0 flex-1">
              <YandexMapViewer
                latitude={latitude}
                longitude={longitude}
                className="h-[calc(100dvh-190px)] min-h-[360px] w-full"
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
