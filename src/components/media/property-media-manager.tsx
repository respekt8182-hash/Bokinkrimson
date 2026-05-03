// UI component for property media manager in the media module.
"use client";

import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  MoreVertical,
  Plus,
  Trash2,
  TvMinimalPlay,
} from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { mediaLimits } from "@/lib/constants";
import { cn } from "@/lib/cn";
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
  onChanged?: () => Promise<void> | void;
};

type MediaTypeValue = SerializedMedia["type"];
type PointerDragState = {
  pointerId: number;
  mediaId: string;
  startX: number;
  startY: number;
  started: boolean;
  timerId: number | null;
  element: HTMLElement;
};

const MEDIA_IMAGE: MediaTypeValue = "IMAGE";
const MEDIA_VIDEO: MediaTypeValue = "VIDEO";
const propertyMediaAccept = `${accommodationPhotoUploadAccept},video/*`;

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

function getImageMedia(items: SerializedMedia[]): SerializedMedia[] {
  return items.filter((item) => item.type === MEDIA_IMAGE);
}

function normalizeMediaSortOrder(items: SerializedMedia[]): SerializedMedia[] {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

function hasSameOrder(left: SerializedMedia[] | null, right: SerializedMedia[]): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item.id === right[index]?.id);
}

function moveMediaById(
  items: SerializedMedia[],
  draggedId: string,
  targetId: string,
): SerializedMedia[] {
  if (draggedId === targetId) {
    return items;
  }

  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);

  if (fromIndex === -1 || toIndex === -1) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return items;
  }
  next.splice(toIndex, 0, moved);

  return normalizeMediaSortOrder(next);
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

function moveImageToCover(items: SerializedMedia[], mediaId: string): SerializedMedia[] {
  const images = getImageMedia(items);
  const selectedIndex = images.findIndex((item) => item.id === mediaId);

  if (selectedIndex <= 0) {
    return items;
  }

  const selected = images[selectedIndex];
  if (!selected) {
    return items;
  }

  const orderedImages = [selected, ...images.filter((item) => item.id !== mediaId)];
  return normalizeMediaSortOrder(replaceImageMedia(items, orderedImages));
}

function getMediaLabel(item: SerializedMedia, index: number): string {
  return `${item.type === MEDIA_IMAGE ? "Фото" : "Видео"} ${index + 1}`;
}

export function PropertyMediaManager({
  propertyId,
  initialMedia,
  onChanged,
}: PropertyMediaManagerProps) {
  const [media, setMedia] = useState<SerializedMedia[]>(initialMedia);
  const [isUploading, setIsUploading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const [dragOverMediaId, setDragOverMediaId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestMediaRef = useRef<SerializedMedia[]>(initialMedia);
  const dragOriginOrderRef = useRef<SerializedMedia[] | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);

  useEffect(() => {
    setMedia(initialMedia);
    latestMediaRef.current = initialMedia;
  }, [initialMedia]);

  useEffect(() => {
    latestMediaRef.current = media;
  }, [media]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        setOpenMenuId(null);
        return;
      }

      if (!event.target.closest("[data-media-menu-root]")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openMenuId]);

  const imageMedia = useMemo(() => getImageMedia(media), [media]);
  const counts = useMemo(
    () => ({
      images: imageMedia.length,
      videos: media.filter((item) => item.type === MEDIA_VIDEO).length,
    }),
    [imageMedia.length, media],
  );
  const coverImageId = imageMedia[0]?.id ?? null;
  const isBusy = isUploading || isReordering || removingMediaId !== null;

  async function sync() {
    if (onChanged) {
      await onChanged();
    }
  }

  function setMediaOrder(nextMedia: SerializedMedia[]) {
    latestMediaRef.current = nextMedia;
    setMedia(nextMedia);
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
    setOpenMenuId(null);

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
        setMediaOrder(body.items);
        localCounts.images = body.items.filter((item) => item.type === MEDIA_IMAGE).length;
        localCounts.videos = body.items.filter((item) => item.type === MEDIA_VIDEO).length;
      }

      await sync();
    } finally {
      setIsUploading(false);
    }
  }

  function openFilePicker() {
    if (isBusy) {
      return;
    }
    fileInputRef.current?.click();
  }

  async function removeMedia(mediaId: string) {
    if (isBusy) {
      return;
    }

    setError("");
    setOpenMenuId(null);
    setRemovingMediaId(mediaId);

    try {
      const response = await fetch(`/api/media/${mediaId}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось удалить файл");
        return;
      }

      setMediaOrder(
        latestMediaRef.current
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
      const response = await fetch(`/api/properties/${propertyId}/media/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextOrder.map((item) => item.id) }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось изменить порядок");
        return false;
      }

      const body = (await response.json()) as { items: SerializedMedia[] };
      setMediaOrder(body.items);
      await sync();
      return true;
    } finally {
      setIsReordering(false);
    }
  }

  async function persistOrder(nextOrder: SerializedMedia[], previousOrder: SerializedMedia[]) {
    if (hasSameOrder(previousOrder, nextOrder)) {
      return;
    }

    const success = await reorder(nextOrder);
    if (!success) {
      setMediaOrder(previousOrder);
    }
  }

  async function makeCover(mediaId: string) {
    if (isBusy || mediaId === coverImageId) {
      return;
    }

    const previous = latestMediaRef.current;
    const next = moveImageToCover(previous, mediaId);

    if (hasSameOrder(previous, next)) {
      setOpenMenuId(null);
      return;
    }

    setOpenMenuId(null);
    setMediaOrder(next);
    await persistOrder(next, previous);
  }

  async function moveMediaStep(mediaId: string, direction: "left" | "right") {
    if (isBusy) {
      return;
    }

    const previous = latestMediaRef.current;
    const currentIndex = previous.findIndex((item) => item.id === mediaId);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= previous.length) {
      return;
    }

    const next = [...previous];
    const [moved] = next.splice(currentIndex, 1);
    if (!moved) {
      return;
    }

    next.splice(targetIndex, 0, moved);
    const normalized = normalizeMediaSortOrder(next);
    setOpenMenuId(null);
    setMediaOrder(normalized);
    await persistOrder(normalized, previous);
  }

  function applyDragTarget(targetId: string) {
    const draggedId = draggedMediaId ?? pointerDragRef.current?.mediaId ?? null;
    if (!draggedId || draggedId === targetId) {
      return;
    }

    setDragOverMediaId(targetId);
    setMedia((previous) => {
      const next = moveMediaById(previous, draggedId, targetId);
      latestMediaRef.current = next;
      return next;
    });
  }

  async function finishDrag() {
    const previous = dragOriginOrderRef.current;
    const next = latestMediaRef.current;

    dragOriginOrderRef.current = null;
    setDraggedMediaId(null);
    setDragOverMediaId(null);

    if (previous) {
      await persistOrder(next, previous);
    }
  }

  function clearPointerTimer(state: PointerDragState) {
    if (state.timerId !== null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }
  }

  function beginPointerDrag(state: PointerDragState) {
    if (isBusy || pointerDragRef.current !== state) {
      return;
    }

    state.started = true;
    dragOriginOrderRef.current = latestMediaRef.current;
    setDraggedMediaId(state.mediaId);
    setDragOverMediaId(state.mediaId);
    setOpenMenuId(null);

    try {
      state.element.setPointerCapture(state.pointerId);
    } catch {
      // Pointer capture is best-effort; drag still works without it.
    }
  }

  function handleCardPointerDown(event: ReactPointerEvent<HTMLElement>, mediaId: string) {
    if (
      event.pointerType === "mouse" ||
      event.button !== 0 ||
      isBusy ||
      (event.currentTarget !== event.target &&
        (event.target as HTMLElement).closest("[data-media-action]"))
    ) {
      return;
    }

    const state: PointerDragState = {
      pointerId: event.pointerId,
      mediaId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      timerId: null,
      element: event.currentTarget,
    };

    state.timerId = window.setTimeout(() => beginPointerDrag(state), 170);
    pointerDragRef.current = state;
  }

  function handleCardPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = pointerDragRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
    if (!state.started) {
      if (distance > 10) {
        clearPointerTimer(state);
        pointerDragRef.current = null;
      }
      return;
    }

    event.preventDefault();

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetCard =
      target instanceof Element
        ? (target.closest("[data-property-media-id]") as HTMLElement | null)
        : null;
    const targetId = targetCard?.dataset.propertyMediaId;

    if (targetId) {
      applyDragTarget(targetId);
    }
  }

  function handleCardPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const state = pointerDragRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    clearPointerTimer(state);
    pointerDragRef.current = null;

    if (!state.started) {
      return;
    }

    event.preventDefault();

    try {
      state.element.releasePointerCapture(state.pointerId);
    } catch {
      // No action needed if the browser already released it.
    }

    void finishDrag();
  }

  function handleCardDragStart(event: DragEvent<HTMLElement>, mediaId: string) {
    if (
      isBusy ||
      (event.currentTarget !== event.target &&
        (event.target as HTMLElement).closest("[data-media-action]"))
    ) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", mediaId);
    dragOriginOrderRef.current = latestMediaRef.current;
    setDraggedMediaId(mediaId);
    setDragOverMediaId(mediaId);
    setOpenMenuId(null);
  }

  const mediaCountLabel =
    media.length === 0
      ? "Фотографий пока нет"
      : `${counts.images} фото${counts.videos > 0 ? `, ${counts.videos} видео` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-olive/55">{mediaCountLabel}</p>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isBusy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-olive transition hover:bg-sand/70 focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <AppIcon icon={Plus} className="h-4 w-4" />
          <span>{isUploading ? "Загрузка..." : "Добавить фото"}</span>
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
          disabled={isBusy}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {media.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] lg:gap-4">
          {media.map((item, index) => {
            const isCover = item.id === coverImageId;
            const isDragging = item.id === draggedMediaId;
            const isDragTarget = item.id === dragOverMediaId && !isDragging;
            const isRemoving = item.id === removingMediaId;
            const label = getMediaLabel(item, index);

            return (
              <article
                key={item.id}
                data-property-media-id={item.id}
                draggable={!isBusy}
                onDragStart={(event) => handleCardDragStart(event, item.id)}
                onDragOver={(event) => {
                  if (!draggedMediaId) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  applyDragTarget(item.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void finishDrag();
                }}
                onDragEnd={() => void finishDrag()}
                onPointerDown={(event) => handleCardPointerDown(event, item.id)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={handleCardPointerUp}
                onPointerCancel={handleCardPointerUp}
                className={cn(
                  "group relative aspect-[4/3] overflow-visible rounded-2xl bg-cream transition duration-200",
                  "cursor-grab select-none active:cursor-grabbing",
                  isDragging ? "scale-[0.98] opacity-70 ring-2 ring-primary/35" : "",
                  isDragTarget ? "ring-2 ring-primary/25" : "",
                  isBusy && !isDragging ? "cursor-not-allowed" : "",
                )}
                aria-label={`${label}. Перетащите, чтобы изменить порядок.`}
              >
                <div className="absolute inset-0 overflow-hidden rounded-2xl bg-cream">
                  {item.type === MEDIA_IMAGE ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.originalName ?? label}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="h-full w-full bg-black object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/22 via-transparent to-black/12 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100" />
                </div>

                {isCover ? (
                  <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white px-3 py-1 text-xs font-semibold text-olive shadow-sm ring-1 ring-olive/10">
                    Обложка
                  </span>
                ) : null}

                {item.type === MEDIA_VIDEO ? (
                  <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/58 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                    <AppIcon icon={TvMinimalPlay} className="h-3.5 w-3.5" />
                    Видео
                  </span>
                ) : null}

                <div
                  data-media-action
                  className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-center gap-1.5 sm:hidden"
                >
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void moveMediaStep(item.id, "left");
                    }}
                    disabled={index === 0 || isBusy}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Переместить медиа ${index + 1} левее`}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </button>
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-black/58 px-2 text-xs font-semibold text-white shadow-sm">
                    {index + 1}/{media.length}
                  </span>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void moveMediaStep(item.id, "right");
                    }}
                    disabled={index === media.length - 1 || isBusy}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Переместить медиа ${index + 1} правее`}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </button>
                </div>

                <div data-media-menu-root className="absolute right-2 top-2 z-20">
                  <button
                    type="button"
                    data-media-action
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((current) => (current === item.id ? null : item.id));
                    }}
                    disabled={isBusy && !isRemoving}
                    className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100"
                    aria-label={`Действия с медиа ${index + 1}`}
                  >
                    <AppIcon icon={MoreVertical} className="h-5 w-5" />
                  </button>

                  {openMenuId === item.id ? (
                    <div
                      data-media-action
                      className="fixed inset-x-4 top-1/2 z-50 w-auto -translate-y-1/2 overflow-hidden rounded-2xl bg-white py-2 shadow-[0_20px_60px_rgba(31,30,25,0.18)] ring-1 ring-olive/10 sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:z-auto sm:w-56 sm:translate-y-0"
                    >
                      {item.type === MEDIA_IMAGE ? (
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            void makeCover(item.id);
                          }}
                          disabled={isCover || isBusy}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                          Сделать обложкой
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeMedia(item.id);
                        }}
                        disabled={isBusy}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <AppIcon icon={Trash2} className="h-4 w-4" />
                        Удалить
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-olive/16 bg-cream/45 px-4 py-8 text-center text-sm text-olive/55">
          Добавьте фото объекта, чтобы оно появилось в карточке и галерее.
        </div>
      )}
    </div>
  );
}
