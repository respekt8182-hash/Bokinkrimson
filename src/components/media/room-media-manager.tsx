// UI component for room media manager in the media module.
"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { mediaLimits } from "@/lib/constants";
import type { SerializedMedia } from "@/lib/media";
import {
  accommodationPhotoUploadAccept,
  accommodationPhotoUploadFormatsLabel,
  accommodationPhotoUploadLimitsLabel,
  detectSupportedPhotoUploadType,
  getAccommodationPhotoUploadSizeLimitBytes,
  getAccommodationPhotoUploadSizeError,
  getMediaLimitExceededError,
  getUnsupportedAccommodationPhotoFormatError,
} from "@/lib/photo-upload";

type RoomMediaManagerProps = {
  propertyId: string;
  roomId: string;
  initialMedia: SerializedMedia[];
  onChanged?: () => Promise<void> | void;
};

type MediaTypeValue = SerializedMedia["type"];

const MEDIA_IMAGE: MediaTypeValue = "IMAGE";
const roomPhotoAccept = accommodationPhotoUploadAccept;

function bytesToMb(size: number): string {
  return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
}

function getImageMedia(items: SerializedMedia[]): SerializedMedia[] {
  return items.filter((item) => item.type === MEDIA_IMAGE);
}

function normalizeMediaSortOrder(items: SerializedMedia[]): SerializedMedia[] {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

function replaceImageMedia(
  items: SerializedMedia[],
  orderedImages: SerializedMedia[],
): SerializedMedia[] {
  let imageIndex = 0;

  return items.map((item) => {
    if (item.type !== MEDIA_IMAGE) {
      return item;
    }

    const nextImage = orderedImages[imageIndex] ?? item;
    imageIndex += 1;
    return nextImage;
  });
}

export function RoomMediaManager({
  propertyId,
  roomId,
  initialMedia,
  onChanged,
}: RoomMediaManagerProps) {
  const [media, setMedia] = useState<SerializedMedia[]>(initialMedia);
  const [isUploading, setIsUploading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  const imageMedia = useMemo(() => getImageMedia(media), [media]);
  const imageCount = imageMedia.length;

  async function sync() {
    if (onChanged) {
      await onChanged();
    }
  }

  function openFilePicker() {
    if (isUploading || isReordering) {
      return;
    }
    fileInputRef.current?.click();
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    setError("");
    setIsUploading(true);

    try {
      let localMedia = [...media];
      let localImageCount = getImageMedia(localMedia).length;

      for (const file of files) {
        const uploadType = detectSupportedPhotoUploadType({
          mimeType: file.type,
          fileName: file.name,
        });

        if (!uploadType) {
          setError(getUnsupportedAccommodationPhotoFormatError());
          continue;
        }

        if (
          file.size >
          getAccommodationPhotoUploadSizeLimitBytes({
            mimeType: file.type,
            fileName: file.name,
          })
        ) {
          setError(getAccommodationPhotoUploadSizeError());
          continue;
        }

        if (localImageCount >= mediaLimits.room.images) {
          setError(
            getMediaLimitExceededError({
              owner: "room",
              mediaType: MEDIA_IMAGE,
              limit: mediaLimits.room.images,
            }),
          );
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/properties/${propertyId}/rooms/${roomId}/media`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          setError(body.error ?? "Не удалось обработать фото. Попробуйте другое изображение.");
          continue;
        }

        const body = (await response.json()) as { items: SerializedMedia[] };
        localMedia = body.items;
        localImageCount = getImageMedia(body.items).length;
        setMedia(body.items);
      }

      await sync();
    } finally {
      setIsUploading(false);
    }
  }

  async function removeMedia(mediaId: string) {
    if (isReordering) {
      return;
    }

    setError("");
    setRemovingMediaId(mediaId);

    try {
      const response = await fetch(`/api/media/${mediaId}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось удалить фото");
        return;
      }

      setMedia((prev) =>
        prev
          .filter((item) => item.id !== mediaId)
          .map((item, index) => ({ ...item, sortOrder: index + 1 })),
      );
      await sync();
    } finally {
      setRemovingMediaId(null);
    }
  }

  async function reorder(nextOrder: SerializedMedia[]) {
    setIsReordering(true);
    setError("");

    try {
      const response = await fetch(`/api/properties/${propertyId}/rooms/${roomId}/media/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextOrder.map((item) => item.id) }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось изменить порядок фото");
        return false;
      }

      const body = (await response.json()) as { items: SerializedMedia[] };
      setMedia(body.items);
      await sync();
      return true;
    } finally {
      setIsReordering(false);
    }
  }

  async function moveImage(mediaId: string, direction: "left" | "right") {
    if (isReordering) {
      return;
    }

    const currentImageMedia = getImageMedia(media);
    const currentIndex = currentImageMedia.findIndex((item) => item.id === mediaId);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentImageMedia.length) {
      return;
    }

    const reorderedImages = [...currentImageMedia];
    const [movedItem] = reorderedImages.splice(currentIndex, 1);
    reorderedImages.splice(targetIndex, 0, movedItem);

    const previousMedia = media;
    const nextMedia = normalizeMediaSortOrder(replaceImageMedia(media, reorderedImages));

    setMedia(nextMedia);

    const success = await reorder(nextMedia);
    if (!success) {
      setMedia(previousMedia);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-olive/15 bg-cream/40 p-3">
        <div>
          <p className="text-base font-semibold text-olive">Фото</p>
          <p className="mt-1 text-sm text-olive/55">
            Максимум {mediaLimits.room.images} фото для одного номера.
          </p>
        </div>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading || isReordering}
          className="inline-flex h-[62px] w-full items-center justify-center gap-3 rounded-2xl border border-sand bg-white px-4 text-base font-semibold text-olive transition hover:border-olive/32 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-2xl leading-none text-primary">
            +
          </span>
          <span>{isUploading ? "Загрузка..." : "Добавить"}</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={roomPhotoAccept}
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        className="hidden"
        disabled={isUploading || isReordering}
      />

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700">{error}</p>
      ) : null}

      {imageCount > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {imageMedia.map((item, index) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-olive/15 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.originalName ?? `Фото ${index + 1}`}
                className="h-40 w-full object-cover"
              />

              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 text-xs text-olive/70">
                <span className="truncate">Фото #{index + 1}</span>

                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => void moveImage(item.id, "left")}
                    disabled={index === 0 || isReordering || removingMediaId === item.id}
                    className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full [font-size:0] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Переместить фото ${index + 1} влево`}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void removeMedia(item.id)}
                    disabled={removingMediaId === item.id || isReordering}
                    className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full [font-size:0] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Удалить фото ${index + 1}`}
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void moveImage(item.id, "right")}
                    disabled={
                      index === imageMedia.length - 1 || isReordering || removingMediaId === item.id
                    }
                    className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full [font-size:0] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Переместить фото ${index + 1} вправо`}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </button>
                </div>

                <span className="text-right">{bytesToMb(item.fileSize)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
