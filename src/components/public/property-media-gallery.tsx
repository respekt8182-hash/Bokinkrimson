"use client";

import { Images } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import type { PublicPropertyCard } from "@/lib/public-properties";

type Media = PublicPropertyCard["media"][number];

const PropertyMediaLightbox = dynamic(
  () =>
    import("@/components/public/property-media-lightbox").then(
      (module) => module.PropertyMediaLightbox,
    ),
  { ssr: false },
);

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
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setLightboxInitialIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const count = photos.length;
  const isLightboxVisible = lightboxOpen && count > 0;

  if (count === 0) return null;

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

      {isLightboxVisible ? (
        <PropertyMediaLightbox
          photos={photos}
          initialIndex={lightboxInitialIndex}
          onClose={closeLightbox}
        />
      ) : null}
    </>
  );
}
