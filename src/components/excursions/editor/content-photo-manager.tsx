"use client";

import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Images,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { accommodationPhotoUploadAccept } from "@/lib/photo-upload";

type ContentPhotoManagerProps = {
  title: string;
  description?: string;
  photoUrls: string[];
  limit: number;
  addLabel: string;
  emptyText: string;
  disabled?: boolean;
  isUploading?: boolean;
  onUpload: (files: FileList | null) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onMakeFirst?: (index: number) => void;
  onRemove: (index: number) => void;
  makeFirstLabel?: string;
  firstBadgeLabel?: string;
};

export function ContentPhotoManager({
  title,
  description,
  photoUrls,
  limit,
  addLabel,
  emptyText,
  disabled = false,
  isUploading = false,
  onUpload,
  onMove,
  onMakeFirst,
  onRemove,
  makeFirstLabel = "Сделать первым",
  firstBadgeLabel = "Первое",
}: ContentPhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const isBusy = disabled || isUploading;
  const activeMenuIndex =
    openMenuIndex !== null && openMenuIndex < photoUrls.length ? openMenuIndex : null;

  useEffect(() => {
    if (activeMenuIndex === null) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        setOpenMenuIndex(null);
        return;
      }

      if (
        !event.target.closest("[data-content-photo-menu-root], [data-content-photo-mobile-menu]")
      ) {
        setOpenMenuIndex(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuIndex(null);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeMenuIndex]);

  return (
    <div className="rounded-2xl border border-olive/10 bg-cream/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <AppIcon icon={Images} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-olive">{title}</p>
              {description ? <p className="text-xs text-olive/55">{description}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-olive/65 ring-1 ring-olive/10">
            {photoUrls.length}/{limit}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy || photoUrls.length >= limit}
            className="gap-2"
          >
            <AppIcon icon={Plus} className="h-4 w-4" />
            {isUploading ? "Загрузка..." : addLabel}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accommodationPhotoUploadAccept}
            className="sr-only"
            onChange={(event) => {
              onUpload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
            disabled={isBusy || photoUrls.length >= limit}
          />
        </div>
      </div>

      {photoUrls.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-olive/18 bg-white/75 px-4 py-4 text-sm text-olive/55">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {photoUrls.map((url, index) => (
            <article
              key={`${url}-${index}`}
              className="group relative overflow-visible rounded-2xl border border-olive/12 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Фото ${index + 1}`} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/22 opacity-80 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" />

                {index === 0 ? (
                  <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-olive shadow-sm ring-1 ring-olive/10">
                    {firstBadgeLabel}
                  </span>
                ) : null}

                <div data-content-photo-menu-root className="absolute right-2 top-2 z-20">
                  <button
                    type="button"
                    data-content-photo-action
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuIndex((current) => (current === index ? null : index));
                    }}
                    disabled={isBusy}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/96 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55"
                    aria-label={`Действия с фото ${index + 1}`}
                  >
                    <AppIcon icon={MoreVertical} className="h-5 w-5" />
                  </button>

                  {activeMenuIndex === index ? (
                    <div
                      data-content-photo-action
                      role="menu"
                      className="absolute right-0 top-12 z-30 hidden w-56 overflow-hidden rounded-2xl bg-white py-2 shadow-[0_20px_60px_rgba(31,30,25,0.18)] ring-1 ring-olive/10 sm:block"
                    >
                      {onMakeFirst ? (
                        <button
                          type="button"
                          role="menuitem"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuIndex(null);
                            onMakeFirst(index);
                          }}
                          disabled={isBusy || index === 0}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                          {makeFirstLabel}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuIndex(null);
                          onRemove(index);
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

                <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center gap-1.5 sm:hidden">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={isBusy || index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Переместить фото ${index + 1} левее`}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </button>
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-black/58 px-2 text-xs font-semibold text-white shadow-sm">
                    {index + 1}/{photoUrls.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={isBusy || index === photoUrls.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/94 text-olive shadow-sm ring-1 ring-olive/10 transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Переместить фото ${index + 1} правее`}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 text-xs font-medium text-olive/65">Фото {index + 1}</span>
                <div className="hidden shrink-0 items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={isBusy || index === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Переместить фото ${index + 1} левее`}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={isBusy || index === photoUrls.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Переместить фото ${index + 1} правее`}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={isBusy}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200 transition hover:bg-red-100 hover:text-red-700",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                    aria-label={`Удалить фото ${index + 1}`}
                    title="Удалить фото"
                  >
                    <AppIcon icon={Trash2} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeMenuIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <div data-content-photo-mobile-menu className="sm:hidden">
              <button
                type="button"
                data-content-photo-action
                aria-label="Закрыть меню действий"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuIndex(null);
                }}
                className="fixed inset-0 z-[9998] cursor-default bg-olive/28 backdrop-blur-[2px]"
              />
              <div
                data-content-photo-action
                role="menu"
                className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-[9999] overflow-hidden rounded-[24px] bg-white py-2 shadow-[0_20px_60px_rgba(31,30,25,0.22)] ring-1 ring-olive/10"
              >
                <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-olive/12" />
                {onMakeFirst ? (
                  <button
                    type="button"
                    role="menuitem"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuIndex(null);
                      onMakeFirst(activeMenuIndex);
                    }}
                    disabled={isBusy || activeMenuIndex === 0}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <AppIcon icon={ImageIcon} className="h-4 w-4 text-olive/70" />
                    {makeFirstLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuIndex(null);
                    onRemove(activeMenuIndex);
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
