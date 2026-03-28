// UI component for property media manager in the media module.
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { mediaLimits } from "@/lib/constants";
import {
  accommodationVideoUploadDurationLimitSeconds,
  accommodationVideoUploadSizeLimitBytes,
  getAccommodationVideoUploadDurationError,
  getAccommodationVideoUploadSizeError,
  type SerializedMedia,
} from "@/lib/media";
import {
  accommodationPhotoUploadAccept,
  detectSupportedPhotoUploadType,
  getAccommodationPhotoUploadSizeLimitBytes,
  getAccommodationPhotoUploadSizeError,
  getMediaLimitExceededError,
  getUnsupportedAccommodationPhotoFormatError,
  getUploadFileExtension,
} from "@/lib/photo-upload";

type PropertyMediaManagerProps = {
  propertyId: string;
  initialMedia: SerializedMedia[];
  onChanged?: () => Promise<void>;
};

type MediaTypeValue = SerializedMedia["type"];
const MEDIA_IMAGE: MediaTypeValue = "IMAGE";
const MEDIA_VIDEO: MediaTypeValue = "VIDEO";
const propertyMediaAccept = `${accommodationPhotoUploadAccept},video/*`;

function bytesToMb(size: number): string {
  return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
}

function detectFileMediaType(file: File): MediaTypeValue | null {
  if (file.type.startsWith("image/")) return MEDIA_IMAGE;
  if (file.type.startsWith("video/")) return MEDIA_VIDEO;

  const ext = getUploadFileExtension(file.name);
  if (["jpg", "jpeg", "png", "heic", "heif", "webp"].includes(ext)) return MEDIA_IMAGE;
  if (["mp4", "mov", "webm", "m4v", "avi", "mkv"].includes(ext)) return MEDIA_VIDEO;
  return null;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();

      if (!Number.isFinite(duration)) {
        reject(new Error("unknown-video-duration"));
        return;
      }

      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("video-metadata-read-failed"));
    };
    video.src = objectUrl;
  });
}

export function PropertyMediaManager({
  propertyId,
  initialMedia,
  onChanged,
}: PropertyMediaManagerProps) {
  const [media, setMedia] = useState<SerializedMedia[]>(initialMedia);
  const [isUploading, setIsUploading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  async function sync() {
    if (onChanged) {
      await onChanged();
    }
  }

  function getCounts(items: SerializedMedia[]) {
    return {
      images: items.filter((item) => item.type === MEDIA_IMAGE).length,
      videos: items.filter((item) => item.type === MEDIA_VIDEO).length,
    };
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setError("");
    setIsUploading(true);

    try {
      let localMedia = [...media];
      const localCounts = getCounts(localMedia);

      for (const file of files) {
        const mediaType = detectFileMediaType(file);
        if (!mediaType) {
          setError("Поддерживаются только изображения и видео");
          continue;
        }

        if (mediaType === MEDIA_IMAGE) {
          const imageType = detectSupportedPhotoUploadType({
            mimeType: file.type,
            fileName: file.name,
          });

          if (!imageType) {
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
        }

        if (mediaType === MEDIA_VIDEO) {
          if (file.size > accommodationVideoUploadSizeLimitBytes) {
            setError(getAccommodationVideoUploadSizeError());
            continue;
          }

          try {
            const duration = await getVideoDuration(file);
            if (duration > accommodationVideoUploadDurationLimitSeconds) {
              setError(getAccommodationVideoUploadDurationError());
              continue;
            }
          } catch {
            setError("Не удалось определить длительность видео. Попробуйте другой файл.");
            continue;
          }
        }

        if (mediaType === MEDIA_IMAGE && localCounts.images >= mediaLimits.property.images) {
          setError(
            getMediaLimitExceededError({
              owner: "property",
              mediaType: MEDIA_IMAGE,
              limit: mediaLimits.property.images,
            }),
          );
          continue;
        }

        if (mediaType === MEDIA_VIDEO && localCounts.videos >= mediaLimits.property.videos) {
          setError(
            getMediaLimitExceededError({
              owner: "property",
              mediaType: MEDIA_VIDEO,
              limit: mediaLimits.property.videos,
            }),
          );
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/properties/${propertyId}/media`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          setError(body.error ?? "Ошибка загрузки файла");
          continue;
        }

        const body = (await response.json()) as { items: SerializedMedia[] };
        localMedia = body.items;
        setMedia(body.items);
        localCounts.images = body.items.filter((item) => item.type === MEDIA_IMAGE).length;
        localCounts.videos = body.items.filter((item) => item.type === MEDIA_VIDEO).length;
      }

      await sync();
    } finally {
      setIsUploading(false);
    }
  }

  function openFilePicker() {
    if (isUploading || isReordering) {
      return;
    }
    fileInputRef.current?.click();
  }

  async function removeMedia(mediaId: string) {
    setError("");
    const response = await fetch(`/api/media/${mediaId}`, { method: "DELETE" });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Не удалось удалить файл");
      return;
    }

    setMedia((prev) =>
      prev
        .filter((item) => item.id !== mediaId)
        .map((item, index) => ({ ...item, sortOrder: index + 1 })),
    );
    await sync();
  }

  async function reorder(nextOrder: SerializedMedia[]) {
    setIsReordering(true);
    setError("");

    try {
      const response = await fetch(`/api/properties/${propertyId}/media/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextOrder.map((item) => item.id) }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось изменить порядок");
        return;
      }

      const body = (await response.json()) as { items: SerializedMedia[] };
      setMedia(body.items);
      await sync();
    } finally {
      setIsReordering(false);
    }
  }

  async function move(mediaId: string, direction: "up" | "down") {
    const index = media.findIndex((item) => item.id === mediaId);
    if (index === -1) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= media.length) return;

    const next = [...media];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    const normalized = next.map((value, idx) => ({ ...value, sortOrder: idx + 1 }));
    setMedia(normalized);
    await reorder(normalized);
  }

  const counts = getCounts(media);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="block text-sm font-medium text-olive">Загрузить файлы</span>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading || isReordering}
          className="inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl border border-sand bg-white px-4 py-3 text-base font-semibold text-olive transition hover:border-olive/32 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[62px]"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-2xl leading-none text-primary">
            +
          </span>
          <span>{isUploading ? "Загрузка..." : "Добавить фото и видео"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={propertyMediaAccept}
          onChange={(event) => {
            void uploadFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          className="sr-only"
          disabled={isUploading || isReordering}
        />
      </div>

      {media.length > 0 ? (
        <p className="text-xs text-olive/60">
          Сейчас загружено: {counts.images} фото, {counts.videos} видео.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {media.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {media.map((item, index) => (
            <article key={item.id} className="rounded-2xl border border-olive/15 bg-white p-3.5 sm:p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-olive/70">
                  {item.type === MEDIA_IMAGE ? "Фото" : "Видео"} #{index + 1}
                </span>
                <span className="text-xs text-olive/60">{bytesToMb(item.fileSize)}</span>
              </div>

              {item.type === MEDIA_IMAGE ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.originalName ?? "property media"}
                    className="h-40 w-full rounded-xl object-cover sm:h-44"
                  />
                </>
              ) : (
                <video
                  src={item.url}
                  controls
                  className="h-40 w-full rounded-xl bg-black/80 object-cover sm:h-44"
                />
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant="ghost"
                  onClick={() => void move(item.id, "up")}
                  disabled={index === 0 || isReordering}
                  className="w-full sm:w-auto"
                >
                  Вверх
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void move(item.id, "down")}
                  disabled={index === media.length - 1 || isReordering}
                  className="w-full sm:w-auto"
                >
                  Вниз
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void removeMedia(item.id)}
                  disabled={isUploading || isReordering}
                  className="col-span-2 w-full sm:col-span-1 sm:w-auto"
                >
                  Удалить
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
