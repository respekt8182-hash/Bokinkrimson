"use client";

import { ChevronLeft, ChevronRight, Images, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
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
  onRemove: (index: number) => void;
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
  onRemove,
}: ContentPhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-2xl border border-olive/10 bg-cream/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            disabled={disabled || isUploading || photoUrls.length >= limit}
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
            disabled={disabled || isUploading || photoUrls.length >= limit}
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
              className="rounded-2xl border border-olive/12 bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Фото ${index + 1}`}
                className="h-40 w-full rounded-t-2xl object-cover"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 text-xs font-medium text-olive/65">
                  Фото {index + 1}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={disabled || isUploading || index === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:opacity-35"
                    aria-label={`Переместить фото ${index + 1} левее`}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={disabled || isUploading || index === photoUrls.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:opacity-35"
                    aria-label={`Переместить фото ${index + 1} правее`}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={disabled || isUploading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-40"
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
    </div>
  );
}
