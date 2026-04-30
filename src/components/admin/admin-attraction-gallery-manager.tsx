"use client";

import {
  ArrowBigUp,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { type DragEvent, useState } from "react";
import { adminInputClass, adminTextareaClass } from "@/components/admin/admin-ui";
import { cn } from "@/lib/cn";

type GalleryImage = {
  url: string;
  alt: string;
};

type GalleryItem = GalleryImage & {
  id: string;
};

type AdminAttractionGalleryManagerProps = {
  images: GalleryImage[];
  fallbackAlt: string;
};

function buildItems(images: GalleryImage[]): GalleryItem[] {
  return images.map((image, index) => ({
    ...image,
    id: `${index}-${image.url || "empty"}`,
  }));
}

function createEmptyItem(): GalleryItem {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: "",
    alt: "",
  };
}

function moveItem(items: GalleryItem[], fromIndex: number, toIndex: number): GalleryItem[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length) {
    return items;
  }

  const normalizedTarget = Math.min(toIndex, items.length - 1);
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (!item) {
    return items;
  }
  next.splice(normalizedTarget, 0, item);
  return next;
}

export function AdminAttractionGalleryManager({
  images,
  fallbackAlt,
}: AdminAttractionGalleryManagerProps) {
  const [items, setItems] = useState<GalleryItem[]>(() => buildItems(images));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function updateItem(id: string, patch: Partial<GalleryImage>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function moveByIndex(index: number, direction: -1 | 1) {
    setItems((current) => moveItem(current, index, index + direction));
  }

  function moveToTop(index: number) {
    setItems((current) => moveItem(current, index, 0));
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function addItem() {
    const item = createEmptyItem();
    setItems((current) => [...current, item]);
    setExpandedIds((current) => new Set(current).add(item.id));
  }

  function setExpanded(id: string, expanded: boolean) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    setItems((current) => {
      const fromIndex = current.findIndex((item) => item.id === draggedId);
      const toIndex = current.findIndex((item) => item.id === targetId);
      return moveItem(current, fromIndex, toIndex);
    });
    setDraggedId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-olive">Ранжирование фото</p>
          <p className="mt-0.5 text-xs text-olive/55">
            Первое фото используется как обложка карточки.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-2 rounded-2xl border border-primary/18 bg-primary/8 px-3.5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/12"
        >
          <Plus className="h-4 w-4" />
          Добавить фото
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive/18 bg-cream/45 px-4 py-5 text-sm text-olive/55">
          Фотографий пока нет.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <article
              key={item.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, item.id)}
              className={cn(
                "grid grid-cols-[42px_118px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-olive/10 bg-cream/55 p-3 transition sm:grid-cols-[42px_118px_minmax(0,1fr)_auto]",
                draggedId === item.id ? "border-primary/28 bg-primary/8 opacity-70" : "",
              )}
            >
              <div className="flex items-center gap-2 sm:flex-col sm:gap-1">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-white text-xs font-bold text-olive/65 ring-1 ring-olive/10">
                  {index + 1}
                </span>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDraggedId(item.id);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-xl text-olive/45 transition hover:bg-white hover:text-olive active:cursor-grabbing"
                  aria-label={`Перетащить фото ${index + 1}`}
                  title="Перетащить"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>

              <div className="relative overflow-hidden rounded-xl bg-white">
                {item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.alt || fallbackAlt}
                    className="aspect-[4/3] w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center text-olive/32">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm">
                    обложка
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <input type="hidden" name="galleryOrder" value={index + 1} />
                <p className="truncate text-sm font-semibold text-olive">
                  {item.alt || item.url || "Новое фото"}
                </p>
                <p className="mt-1 truncate text-xs text-olive/50">
                  {item.url || "Ссылка не указана"}
                </p>
              </div>

              <div className="col-span-3 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col">
                <button
                  type="button"
                  onClick={() => moveToTop(index)}
                  disabled={index === 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-olive/10 bg-white text-olive/55 transition hover:border-primary/18 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={`Сделать фото ${index + 1} обложкой`}
                  title="Сделать обложкой"
                >
                  <ArrowBigUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveByIndex(index, -1)}
                  disabled={index === 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-olive/10 bg-white text-olive/55 transition hover:border-primary/18 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={`Поднять фото ${index + 1}`}
                  title="Выше"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveByIndex(index, 1)}
                  disabled={index === items.length - 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-olive/10 bg-white text-olive/55 transition hover:border-primary/18 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={`Опустить фото ${index + 1}`}
                  title="Ниже"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 transition hover:bg-red-50"
                  aria-label={`Убрать фото ${index + 1}`}
                  title="Убрать"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <details
                open={expandedIds.has(item.id)}
                onToggle={(event) => setExpanded(item.id, event.currentTarget.open)}
                className="col-span-3 rounded-xl border border-olive/8 bg-white/72 px-3 py-2 sm:col-span-4"
              >
                <summary className="cursor-pointer text-xs font-semibold text-olive/58">
                  Поля фотографии
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-olive/52">Фото</span>
                    <input
                      name="galleryUrl"
                      value={item.url}
                      onChange={(event) => updateItem(item.id, { url: event.target.value })}
                      placeholder="/attractions/place/photo.webp"
                      className={adminInputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-olive/52">Alt</span>
                    <input
                      name="galleryAlt"
                      value={item.alt}
                      onChange={(event) => updateItem(item.id, { alt: event.target.value })}
                      placeholder={fallbackAlt}
                      className={adminInputClass}
                    />
                  </label>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}

      <details className="rounded-2xl border border-olive/10 bg-white/70 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-olive">
          Вставить несколько ссылок
        </summary>
        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold text-olive/52">Каждая ссылка с новой строки</span>
          <textarea
            name="extraGalleryUrls"
            placeholder="/attractions/new-place/photo.webp"
            className={adminTextareaClass}
          />
        </label>
      </details>
    </div>
  );
}
