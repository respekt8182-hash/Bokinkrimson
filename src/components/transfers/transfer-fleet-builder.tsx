"use client";

import {
  BriefcaseBusiness,
  Bus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import {
  accommodationPhotoUploadAccept,
  detectSupportedPhotoUploadType,
  getAccommodationPhotoUploadSizeError,
  getAccommodationPhotoUploadSizeLimitBytes,
  getUnsupportedAccommodationPhotoFormatError,
} from "@/lib/photo-upload";
import {
  createEmptyTransferFleetItem,
  createTransferFleetId,
  getTransferPhotoUrlsFromFleet,
  maxTransferServiceTags,
  maxTransferVehiclePhotoUrls,
  type TransferFleetItem,
  transferPriceUnitOptions,
  transferServiceTagOptions,
  transferTransportKindOptions,
} from "@/lib/transfers";

type TransferFleetBuilderProps = {
  transferId: string;
  initialFleet: TransferFleetItem[];
  initialServiceTags: string[];
  onChange?: (fleet: TransferFleetItem[], serviceTags: string[]) => void;
};

const inputClass =
  "w-full rounded-2xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

const textareaClass = `${inputClass} min-h-[96px] resize-y`;
const transferPhotoAccept = accommodationPhotoUploadAccept;

type TransferVehiclePhotoGalleryProps = {
  transferId: string;
  vehicleTitle: string;
  vehicleIndex: number;
  photoUrls: string[];
  onChange: (photoUrls: string[]) => void;
};

type PointerDragState = {
  pointerId: number;
  photoUrl: string;
  startX: number;
  startY: number;
  started: boolean;
  timerId: number | null;
  element: HTMLElement;
};

function stringifyFleet(items: TransferFleetItem[]): string {
  return JSON.stringify(items);
}

function stringifyServiceTags(items: string[]): string {
  return JSON.stringify(items);
}

function normalizeVehiclePhotoUrls(photoUrls: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const candidate of photoUrls) {
    const url = candidate.trim();
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    next.push(url);
  }

  return next.slice(0, maxTransferVehiclePhotoUrls);
}

function hasSamePhotoOrder(left: string[] | null, right: string[]): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((url, index) => url === right[index]);
}

function movePhotoByUrl(photoUrls: string[], draggedUrl: string, targetUrl: string): string[] {
  if (draggedUrl === targetUrl) {
    return photoUrls;
  }

  const fromIndex = photoUrls.indexOf(draggedUrl);
  const toIndex = photoUrls.indexOf(targetUrl);
  if (fromIndex === -1 || toIndex === -1) {
    return photoUrls;
  }

  const next = [...photoUrls];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return photoUrls;
  }

  next.splice(toIndex, 0, moved);
  return next;
}

function movePhotoStepByUrl(
  photoUrls: string[],
  photoUrl: string,
  direction: "left" | "right",
): string[] {
  const currentIndex = photoUrls.indexOf(photoUrl);
  if (currentIndex === -1) {
    return photoUrls;
  }

  const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= photoUrls.length) {
    return photoUrls;
  }

  const next = [...photoUrls];
  const [moved] = next.splice(currentIndex, 1);
  if (!moved) {
    return photoUrls;
  }

  next.splice(targetIndex, 0, moved);
  return next;
}

function movePhotoToCover(photoUrls: string[], photoUrl: string): string[] {
  const selectedIndex = photoUrls.indexOf(photoUrl);
  if (selectedIndex <= 0) {
    return photoUrls;
  }

  return [photoUrl, ...photoUrls.filter((url) => url !== photoUrl)];
}

function TransferVehiclePhotoGallery({
  transferId,
  vehicleTitle,
  vehicleIndex,
  photoUrls: initialPhotoUrls,
  onChange,
}: TransferVehiclePhotoGalleryProps) {
  const [photoUrls, setPhotoUrls] = useState<string[]>(normalizeVehiclePhotoUrls(initialPhotoUrls));
  const [isUploading, setIsUploading] = useState(false);
  const [openMenuUrl, setOpenMenuUrl] = useState<string | null>(null);
  const [draggedPhotoUrl, setDraggedPhotoUrl] = useState<string | null>(null);
  const [dragOverPhotoUrl, setDragOverPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestPhotoUrlsRef = useRef<string[]>(normalizeVehiclePhotoUrls(initialPhotoUrls));
  const dragOriginOrderRef = useRef<string[] | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);

  useEffect(() => {
    const normalized = normalizeVehiclePhotoUrls(initialPhotoUrls);
    latestPhotoUrlsRef.current = normalized;
    setPhotoUrls(normalized);
  }, [initialPhotoUrls]);

  const activeMenuUrl = openMenuUrl && photoUrls.includes(openMenuUrl) ? openMenuUrl : null;
  const activeMenuIndex = activeMenuUrl ? photoUrls.indexOf(activeMenuUrl) : -1;
  const activeMenuIsCover = activeMenuIndex === 0;
  const isBusy = isUploading;
  const countLabel =
    photoUrls.length === 0
      ? "Фотографий пока нет"
      : `${photoUrls.length} из ${maxTransferVehiclePhotoUrls} фото`;

  useEffect(() => {
    if (!activeMenuUrl) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        setOpenMenuUrl(null);
        return;
      }

      if (
        !event.target.closest(
          "[data-transfer-vehicle-photo-menu-root], [data-transfer-vehicle-photo-mobile-menu]",
        )
      ) {
        setOpenMenuUrl(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuUrl(null);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeMenuUrl]);

  function commitPhotoUrls(nextPhotoUrls: string[]) {
    const normalized = normalizeVehiclePhotoUrls(nextPhotoUrls);
    latestPhotoUrlsRef.current = normalized;
    setPhotoUrls(normalized);
    onChange(normalized);
  }

  function openFilePicker() {
    if (isBusy || photoUrls.length >= maxTransferVehiclePhotoUrls) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function uploadFile(file: File): Promise<string | null> {
    const uploadType = detectSupportedPhotoUploadType({
      mimeType: file.type,
      fileName: file.name,
    });

    if (!uploadType) {
      setError(getUnsupportedAccommodationPhotoFormatError());
      return null;
    }

    if (
      file.size >
      getAccommodationPhotoUploadSizeLimitBytes({
        mimeType: file.type,
        fileName: file.name,
      })
    ) {
      setError(getAccommodationPhotoUploadSizeError());
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/transfers/${transferId}/photos`, {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !body.url) {
        setError(body.error ?? "Не удалось загрузить фото транспорта.");
        return null;
      }

      return body.url;
    } catch {
      setError("Не удалось загрузить фото транспорта.");
      return null;
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || isBusy) {
      return;
    }

    setError("");
    setOpenMenuUrl(null);
    setIsUploading(true);

    try {
      let localPhotoUrls = [...latestPhotoUrlsRef.current];

      for (const file of Array.from(fileList)) {
        if (localPhotoUrls.length >= maxTransferVehiclePhotoUrls) {
          setError(`Можно добавить не больше ${maxTransferVehiclePhotoUrls} фото транспорта.`);
          break;
        }

        const uploadedUrl = await uploadFile(file);
        if (!uploadedUrl) {
          continue;
        }

        localPhotoUrls = normalizeVehiclePhotoUrls([...localPhotoUrls, uploadedUrl]);
        commitPhotoUrls(localPhotoUrls);
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function replacePhoto(targetUrl: string, file: File | null) {
    if (!file || isBusy) {
      return;
    }

    setError("");
    setOpenMenuUrl(null);
    setIsUploading(true);

    try {
      const uploadedUrl = await uploadFile(file);
      if (!uploadedUrl) {
        return;
      }

      commitPhotoUrls(
        latestPhotoUrlsRef.current.map((url) => (url === targetUrl ? uploadedUrl : url)),
      );
    } finally {
      setIsUploading(false);
    }
  }

  function removePhoto(photoUrl: string) {
    if (isBusy) {
      return;
    }

    setOpenMenuUrl(null);
    setError("");
    commitPhotoUrls(latestPhotoUrlsRef.current.filter((url) => url !== photoUrl));
  }

  function makeCover(photoUrl: string) {
    if (isBusy) {
      return;
    }

    const previous = latestPhotoUrlsRef.current;
    const next = movePhotoToCover(previous, photoUrl);

    if (hasSamePhotoOrder(previous, next)) {
      setOpenMenuUrl(null);
      return;
    }

    setOpenMenuUrl(null);
    commitPhotoUrls(next);
  }

  function movePhotoStep(photoUrl: string, direction: "left" | "right") {
    if (isBusy) {
      return;
    }

    const previous = latestPhotoUrlsRef.current;
    const next = movePhotoStepByUrl(previous, photoUrl, direction);
    if (hasSamePhotoOrder(previous, next)) {
      return;
    }

    setOpenMenuUrl(null);
    commitPhotoUrls(next);
  }

  function applyDragTarget(targetUrl: string) {
    const draggedUrl = draggedPhotoUrl ?? pointerDragRef.current?.photoUrl ?? null;
    if (!draggedUrl || draggedUrl === targetUrl) {
      return;
    }

    setDragOverPhotoUrl(targetUrl);
    setPhotoUrls((previous) => {
      const next = movePhotoByUrl(previous, draggedUrl, targetUrl);
      latestPhotoUrlsRef.current = next;
      onChange(next);
      return next;
    });
  }

  function finishDrag() {
    const previous = dragOriginOrderRef.current;
    const next = latestPhotoUrlsRef.current;

    dragOriginOrderRef.current = null;
    setDraggedPhotoUrl(null);
    setDragOverPhotoUrl(null);

    if (previous && !hasSamePhotoOrder(previous, next)) {
      commitPhotoUrls(next);
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
    dragOriginOrderRef.current = latestPhotoUrlsRef.current;
    setDraggedPhotoUrl(state.photoUrl);
    setDragOverPhotoUrl(state.photoUrl);
    setOpenMenuUrl(null);

    try {
      state.element.setPointerCapture(state.pointerId);
    } catch {
      // Pointer capture is best-effort; drag still works without it.
    }
  }

  function handleCardPointerDown(event: ReactPointerEvent<HTMLElement>, photoUrl: string) {
    const target = event.target instanceof Element ? event.target : null;
    if (
      event.pointerType === "mouse" ||
      event.button !== 0 ||
      isBusy ||
      (event.currentTarget !== event.target &&
        target?.closest("[data-transfer-vehicle-photo-action]"))
    ) {
      return;
    }

    const state: PointerDragState = {
      pointerId: event.pointerId,
      photoUrl,
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
        ? (target.closest("[data-transfer-vehicle-photo-url]") as HTMLElement | null)
        : null;
    const targetUrl = targetCard?.dataset.transferVehiclePhotoUrl;

    if (targetUrl) {
      applyDragTarget(targetUrl);
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

    finishDrag();
  }

  function handleCardDragStart(event: DragEvent<HTMLElement>, photoUrl: string) {
    const target = event.target instanceof Element ? event.target : null;
    if (
      isBusy ||
      (event.currentTarget !== event.target &&
        target?.closest("[data-transfer-vehicle-photo-action]"))
    ) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", photoUrl);
    dragOriginOrderRef.current = latestPhotoUrlsRef.current;
    setDraggedPhotoUrl(photoUrl);
    setDragOverPhotoUrl(photoUrl);
    setOpenMenuUrl(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-olive/55">{countLabel}</p>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isBusy || photoUrls.length >= maxTransferVehiclePhotoUrls}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-olive shadow-sm ring-1 ring-olive/10 transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppIcon icon={Plus} className="h-4 w-4" />
          <span>{isUploading ? "Загрузка..." : "Добавить фото"}</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={transferPhotoAccept}
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        className="sr-only"
        disabled={isBusy}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>
      ) : null}

      {photoUrls.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {photoUrls.map((photoUrl, index) => {
            const isCover = index === 0;
            const isDragging = photoUrl === draggedPhotoUrl;
            const isDragTarget = photoUrl === dragOverPhotoUrl && !isDragging;
            const label = `${vehicleTitle || `Транспорт ${vehicleIndex + 1}`} - фото ${index + 1}`;

            return (
              <article
                key={`${photoUrl}-${index}`}
                data-transfer-vehicle-photo-url={photoUrl}
                draggable={!isBusy}
                onDragStart={(event) => handleCardDragStart(event, photoUrl)}
                onDragOver={(event) => {
                  if (!draggedPhotoUrl) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  applyDragTarget(photoUrl);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  finishDrag();
                }}
                onDragEnd={finishDrag}
                onPointerDown={(event) => handleCardPointerDown(event, photoUrl)}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={label}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/22 via-transparent to-black/12 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100" />
                </div>

                {isCover ? (
                  <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-olive shadow-sm ring-1 ring-olive/10">
                    Обложка
                  </span>
                ) : null}

                <div
                  data-transfer-vehicle-photo-action
                  className="absolute inset-x-1.5 bottom-1.5 z-20 flex items-center justify-center gap-1 sm:hidden"
                >
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      movePhotoStep(photoUrl, "left");
                    }}
                    disabled={index === 0 || isBusy}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/94 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Переместить фото ${index + 1} левее`}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </button>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-black/58 px-2 text-[11px] font-semibold text-white shadow-sm">
                    {index + 1}/{photoUrls.length}
                  </span>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      movePhotoStep(photoUrl, "right");
                    }}
                    disabled={index === photoUrls.length - 1 || isBusy}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/94 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Переместить фото ${index + 1} правее`}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </button>
                </div>

                <div
                  data-transfer-vehicle-photo-menu-root
                  className="absolute right-1.5 top-1.5 z-20"
                >
                  <button
                    type="button"
                    data-transfer-vehicle-photo-action
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuUrl((current) => (current === photoUrl ? null : photoUrl));
                    }}
                    disabled={isBusy}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100"
                    aria-label={`Действия с фото ${index + 1}`}
                  >
                    <AppIcon icon={MoreVertical} className="h-5 w-5" />
                  </button>

                  {activeMenuUrl === photoUrl ? (
                    <div
                      data-transfer-vehicle-photo-action
                      role="menu"
                      className="absolute right-0 top-11 z-30 hidden w-56 overflow-hidden rounded-2xl bg-white py-2 shadow-[0_20px_60px_rgba(31,30,25,0.18)] ring-1 ring-olive/10 sm:block"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          makeCover(photoUrl);
                        }}
                        disabled={isCover || isBusy}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                        Сделать обложкой
                      </button>
                      <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream">
                        <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                        Заменить фото
                        <input
                          type="file"
                          accept={transferPhotoAccept}
                          className="sr-only"
                          disabled={isBusy}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            void replacePhoto(photoUrl, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        role="menuitem"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          removePhoto(photoUrl);
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
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isBusy}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-olive/16 bg-cream/70 px-4 text-center text-sm text-olive/48 transition hover:border-primary/25 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <AppIcon icon={Bus} className="h-7 w-7" />
          <span>Добавьте фото транспорта</span>
        </button>
      )}

      {activeMenuUrl && typeof document !== "undefined"
        ? createPortal(
            <div data-transfer-vehicle-photo-mobile-menu className="sm:hidden">
              <button
                type="button"
                data-transfer-vehicle-photo-action
                aria-label="Закрыть меню действий"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuUrl(null);
                }}
                className="fixed inset-0 z-[9998] cursor-default bg-olive/28 backdrop-blur-[2px]"
              />
              <div
                data-transfer-vehicle-photo-action
                role="menu"
                className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-[9999] overflow-hidden rounded-[24px] bg-white py-2 shadow-[0_20px_60px_rgba(31,30,25,0.22)] ring-1 ring-olive/10"
              >
                <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-olive/12" />
                <button
                  type="button"
                  role="menuitem"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    makeCover(activeMenuUrl);
                  }}
                  disabled={activeMenuIsCover || isBusy}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                  Сделать обложкой
                </button>
                <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream">
                  <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                  Заменить фото
                  <input
                    type="file"
                    accept={transferPhotoAccept}
                    className="sr-only"
                    disabled={isBusy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      void replacePhoto(activeMenuUrl, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  role="menuitem"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    removePhoto(activeMenuUrl);
                  }}
                  disabled={isBusy}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <AppIcon icon={Trash2} className="h-4 w-4" />
                  Удалить
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function TransferFleetBuilder({
  transferId,
  initialFleet,
  initialServiceTags,
  onChange,
}: TransferFleetBuilderProps) {
  const [fleet, setFleet] = useState<TransferFleetItem[]>(
    initialFleet.length > 0 ? initialFleet : [createEmptyTransferFleetItem()],
  );
  const [serviceTags, setServiceTags] = useState<string[]>(initialServiceTags);
  const [customTag, setCustomTag] = useState("");

  const photoUrls = useMemo(() => getTransferPhotoUrlsFromFleet(fleet), [fleet]);
  const tagLimitReached = serviceTags.length >= maxTransferServiceTags;

  useEffect(() => {
    onChange?.(fleet, serviceTags);
  }, [fleet, onChange, serviceTags]);

  function updateFleetItem(id: string, patch: Partial<TransferFleetItem>) {
    setFleet((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addFleetItem() {
    setFleet((current) => [
      ...current,
      {
        ...createEmptyTransferFleetItem(),
        id: createTransferFleetId("vehicle"),
        title: `Транспорт ${current.length + 1}`,
      },
    ]);
  }

  function removeFleetItem(id: string) {
    setFleet((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.length > 0 ? next : [createEmptyTransferFleetItem()];
    });
  }

  function moveFleetItem(id: string, direction: "up" | "down") {
    setFleet((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function toggleServiceTag(tag: string) {
    setServiceTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      if (current.length >= maxTransferServiceTags) {
        return current;
      }

      return [...current, tag];
    });
  }

  function addCustomTag() {
    const normalized = customTag.trim();
    if (!normalized) {
      return;
    }

    setServiceTags((current) => {
      if (current.includes(normalized) || current.length >= maxTransferServiceTags) {
        return current;
      }

      return [...current, normalized];
    });
    setCustomTag("");
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="fleetJson" value={stringifyFleet(fleet)} />
      <input type="hidden" name="serviceTagsJson" value={stringifyServiceTags(serviceTags)} />
      <input type="hidden" name="photoUrls" value={photoUrls.join("\n")} />

      <div className="rounded-[24px] bg-[#f7f4eb] p-4 ring-1 ring-olive/8">
        <div className="flex justify-end">
          <span className="rounded-full border border-dashed border-olive/16 px-3 py-1 text-xs font-semibold text-olive/55">
            {serviceTags.length > 0
              ? `${serviceTags.length}/${maxTransferServiceTags} тегов`
              : "Теги помогут в поиске"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {transferServiceTagOptions.map((tag) => {
            const active = serviceTags.includes(tag);
            const disabled = !active && tagLimitReached;

            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleServiceTag(tag)}
                disabled={disabled}
                className={
                  active
                    ? "rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white"
                    : "rounded-full border border-olive/12 bg-white px-3.5 py-2 text-xs font-semibold text-olive/72 transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:border-olive/8 disabled:text-olive/35"
                }
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomTag();
              }
            }}
            placeholder="Добавить свой тег услуги"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={tagLimitReached || customTag.trim().length === 0}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-primary/24 bg-primary/8 px-4 text-sm font-semibold text-primary transition hover:bg-primary/12 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AppIcon icon={Plus} className="h-4 w-4" />
            Добавить тег
          </button>
        </div>

        <p className="mt-3 text-xs text-olive/52">
          {tagLimitReached
            ? `Лимит достигнут: оставьте не больше ${maxTransferServiceTags} тегов.`
            : `Можно выбрать еще ${maxTransferServiceTags - serviceTags.length} тегов.`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-olive">Автопарк и транспорт</p>
            <p className="mt-1 text-sm leading-6 text-olive/62">
              Добавьте один автомобиль или целый автопарк. Первый транспорт станет главным в
              карточке и пойдет в каталог как основа предложения.
            </p>
          </div>
          <button
            type="button"
            onClick={addFleetItem}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <AppIcon icon={Plus} className="h-4 w-4" />
            Добавить транспорт
          </button>
        </div>

        <div className="space-y-4">
          {fleet.map((item, index) => (
            <article
              key={item.id}
              className="rounded-[26px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-olive">
                    {item.title || `Транспорт ${index + 1}`}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-olive/54">
                    Заполните тип транспорта, модель, цену, вместимость и добавьте фотографии.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveFleetItem(item.id, "up")}
                    disabled={index === 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-olive/12 bg-white text-olive transition hover:border-primary/22 hover:text-primary disabled:opacity-40"
                    aria-label="Поднять выше"
                  >
                    <AppIcon icon={ChevronUp} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFleetItem(item.id, "down")}
                    disabled={index === fleet.length - 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-olive/12 bg-white text-olive transition hover:border-primary/22 hover:text-primary disabled:opacity-40"
                    aria-label="Опустить ниже"
                  >
                    <AppIcon icon={ChevronDown} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFleetItem(item.id)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    <AppIcon icon={Trash2} className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <TransferVehiclePhotoGallery
                    transferId={transferId}
                    vehicleIndex={index}
                    vehicleTitle={item.title || item.vehicleModel || "Транспорт"}
                    photoUrls={item.photoUrls}
                    onChange={(nextPhotoUrls) =>
                      updateFleetItem(item.id, {
                        photoUrls: nextPhotoUrls,
                        photoUrl: nextPhotoUrls[0] ?? null,
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">Название транспорта</span>
                    <input
                      value={item.title}
                      onChange={(event) => updateFleetItem(item.id, { title: event.target.value })}
                      placeholder="Например: Семейный минивэн"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Вид транспорта</span>
                    <select
                      value={item.transportKind}
                      onChange={(event) =>
                        updateFleetItem(item.id, { transportKind: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Выберите вид</option>
                      {transferTransportKindOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Класс</span>
                    <input
                      value={item.vehicleClass}
                      onChange={(event) =>
                        updateFleetItem(item.id, { vehicleClass: event.target.value })
                      }
                      placeholder="Комфорт, бизнес, туристический"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">Модель или описание</span>
                    <input
                      value={item.vehicleModel}
                      onChange={(event) =>
                        updateFleetItem(item.id, { vehicleModel: event.target.value })
                      }
                      placeholder="Hyundai Staria, Mercedes Sprinter, УАЗ Патриот"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-olive">
                      <AppIcon icon={Users} className="h-4 w-4 text-primary" />
                      Пассажиры
                    </span>
                    <input
                      value={item.seats ?? ""}
                      onChange={(event) =>
                        updateFleetItem(item.id, {
                          seats:
                            event.target.value.trim() === ""
                              ? null
                              : Number.parseInt(event.target.value, 10) || null,
                        })
                      }
                      inputMode="numeric"
                      placeholder="4"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-olive">
                      <AppIcon icon={BriefcaseBusiness} className="h-4 w-4 text-primary" />
                      Багажные места
                    </span>
                    <input
                      value={item.luggage ?? ""}
                      onChange={(event) =>
                        updateFleetItem(item.id, {
                          luggage:
                            event.target.value.trim() === ""
                              ? null
                              : Number.parseInt(event.target.value, 10) || null,
                        })
                      }
                      inputMode="numeric"
                      placeholder="2"
                      className={inputClass}
                    />
                    <span className="block text-xs leading-5 text-olive/50">
                      Считайте стандартные чемоданы/сумки, а не килограммы.
                    </span>
                  </label>

                  <label className="space-y-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-olive">
                      <AppIcon icon={WalletCards} className="h-4 w-4 text-primary" />
                      Цена от, ₽
                    </span>
                    <input
                      value={item.priceFrom ?? ""}
                      onChange={(event) =>
                        updateFleetItem(item.id, {
                          priceFrom:
                            event.target.value.trim() === ""
                              ? null
                              : Number(event.target.value.replace(",", ".")) || null,
                        })
                      }
                      inputMode="decimal"
                      placeholder="2000"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Единица цены</span>
                    <select
                      value={item.priceUnitLabel}
                      onChange={(event) =>
                        updateFleetItem(item.id, { priceUnitLabel: event.target.value })
                      }
                      className={inputClass}
                    >
                      {transferPriceUnitOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">Уточнение по багажу</span>
                    <input
                      value={item.luggageNote}
                      onChange={(event) =>
                        updateFleetItem(item.id, { luggageNote: event.target.value })
                      }
                      placeholder="Например: 2 чемодана + ручная кладь, лыжи по согласованию"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">
                      Что важно знать о транспорте
                    </span>
                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        updateFleetItem(item.id, { description: event.target.value })
                      }
                      placeholder="Детское кресло, кондиционер, помощь с багажом, высокий клиренс, поездки ночью, встреча с табличкой"
                      className={textareaClass}
                    />
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
