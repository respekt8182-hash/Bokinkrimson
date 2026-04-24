"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { cn } from "@/lib/cn";
import { propertyTypes } from "@/lib/constants";
import { housingHubPath } from "@/lib/seo/routes";

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export type SidebarFilterOutput = {
  propertyType: string;
  sort: string;
  minRating: string;
  hasPhotos: boolean;
  hasReviews: boolean;
  familyFriendly: boolean;
  petsAllowed: boolean;
  minPrice: string;
  maxPrice: string;
};

export type HousingSearchSidebarFiltersProps = {
  formId?: string;
  onSubmit?: () => void;
  /** If provided, form submission calls this instead of navigating (client-side apply). */
  onApply?: (output: SidebarFilterOutput) => void;
  query: string;
  location: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  guestsAdults?: string;
  guestsChildren?: string;
  propertyType: string;
  sort: string;
  minRating: string;
  hasPhotos: boolean;
  hasReviews: boolean;
  familyFriendly: boolean;
  petsAllowed: boolean;
  minPrice: string;
  maxPrice: string;
  priceBounds: {
    min: number;
    max: number;
  };
};

const PRICE_STEP = 100;

function toNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function HousingSearchSidebarFilters({
  formId = "catalog-left-filters",
  onSubmit,
  onApply,
  query,
  location,
  checkIn,
  checkOut,
  guests,
  guestsAdults,
  guestsChildren,
  propertyType,
  sort,
  minRating,
  hasPhotos,
  hasReviews,
  familyFriendly,
  petsAllowed,
  minPrice,
  maxPrice,
  priceBounds,
}: HousingSearchSidebarFiltersProps) {
  const minBound = Math.max(0, Math.floor(priceBounds.min));
  const rawMaxBound = Math.max(minBound + PRICE_STEP, Math.ceil(priceBounds.max));
  const maxBound = Math.ceil(rawMaxBound / PRICE_STEP) * PRICE_STEP;

  const initialMin = clamp(toNumber(minPrice) ?? minBound, minBound, maxBound);
  const initialMax = clamp(toNumber(maxPrice) ?? maxBound, minBound, maxBound);

  const [rangeMin, setRangeMin] = useState(Math.min(initialMin, initialMax));
  const [rangeMax, setRangeMax] = useState(Math.max(initialMin, initialMax));
  const [photosOnly, setPhotosOnly] = useState(hasPhotos);
  const [reviewsOnly, setReviewsOnly] = useState(hasReviews);
  const [selectedType, setSelectedType] = useState(propertyType);
  const [selectedSort, setSelectedSort] = useState(sort);
  const [selectedMinRating, setSelectedMinRating] = useState(minRating);
  const [childrenFriendlyOnly, setChildrenFriendlyOnly] = useState(familyFriendly);
  const [petsAllowedOnly, setPetsAllowedOnly] = useState(petsAllowed);

  const sliderSpan = Math.max(1, maxBound - minBound);
  const leftPercent = ((rangeMin - minBound) / sliderSpan) * 100;
  const rightPercent = ((rangeMax - minBound) / sliderSpan) * 100;

  const formattedMin = useMemo(() => ruNumberFormat.format(rangeMin), [rangeMin]);
  const formattedMax = useMemo(() => ruNumberFormat.format(rangeMax), [rangeMax]);

  function updateMin(nextValue: number) {
    const normalized = clamp(Math.floor(nextValue / PRICE_STEP) * PRICE_STEP, minBound, rangeMax);
    setRangeMin(normalized);
  }

  function updateMax(nextValue: number) {
    const normalized = clamp(Math.ceil(nextValue / PRICE_STEP) * PRICE_STEP, rangeMin, maxBound);
    setRangeMax(normalized);
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (onApply) {
      e.preventDefault();
      onApply({
        propertyType: selectedType,
        sort: selectedSort,
        minRating: selectedMinRating,
        hasPhotos: photosOnly,
        hasReviews: reviewsOnly,
        familyFriendly: childrenFriendlyOnly,
        petsAllowed: petsAllowedOnly,
        minPrice: rangeMin > minBound ? String(rangeMin) : "",
        maxPrice: rangeMax < maxBound ? String(rangeMax) : "",
      });
    }
    onSubmit?.();
  }

  return (
    <form
      method="GET"
      action={housingHubPath}
      onSubmit={handleFormSubmit}
      className="space-y-3 rounded-2xl bg-white/96 p-3.5 ring-1 ring-olive/10"
      id={formId}
    >
      {query ? <input type="hidden" name="q" value={query} /> : null}
      {location ? <input type="hidden" name="location" value={location} /> : null}
      {checkIn ? <input type="hidden" name="checkIn" value={checkIn} /> : null}
      {checkOut ? <input type="hidden" name="checkOut" value={checkOut} /> : null}
      {guests ? <input type="hidden" name="guests" value={guests} /> : null}
      {guestsAdults ? <input type="hidden" name="guestsAdults" value={guestsAdults} /> : null}
      {guestsChildren ? <input type="hidden" name="guestsChildren" value={guestsChildren} /> : null}
      {selectedType ? <input type="hidden" name="propertyType" value={selectedType} /> : null}
      {selectedSort ? <input type="hidden" name="sort" value={selectedSort} /> : null}
      {selectedMinRating ? <input type="hidden" name="minRating" value={selectedMinRating} /> : null}
      {photosOnly ? <input type="hidden" name="hasPhotos" value="1" /> : null}
      {reviewsOnly ? <input type="hidden" name="hasReviews" value="1" /> : null}
      {childrenFriendlyOnly ? <input type="hidden" name="familyFriendly" value="1" /> : null}
      {petsAllowedOnly ? <input type="hidden" name="petsAllowed" value="1" /> : null}
      {rangeMin > minBound ? <input type="hidden" name="minPrice" value={String(rangeMin)} /> : null}
      {rangeMax < maxBound ? <input type="hidden" name="maxPrice" value={String(rangeMax)} /> : null}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-olive">Фильтры поиска</h2>
        <Link
          href={housingHubPath}
          className="inline-flex h-8 items-center rounded-lg border border-olive/18 px-2.5 text-xs font-semibold text-olive transition hover:bg-cream/70"
        >
          Сбросить
        </Link>
      </div>

      <details open className="rounded-xl border border-olive/14 bg-cream/45 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-olive/70">
          Цена за ночь
        </summary>
        <div className="mt-2.5 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-olive/60">От</span>
              <input
                type="number"
                min={minBound}
                max={maxBound}
                step={PRICE_STEP}
                value={rangeMin}
                onChange={(event) => updateMin(Number(event.target.value))}
                className="h-[38px] w-full rounded-lg border border-olive/16 bg-white px-2.5 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-olive/60">До</span>
              <input
                type="number"
                min={minBound}
                max={maxBound}
                step={PRICE_STEP}
                value={rangeMax}
                onChange={(event) => updateMax(Number(event.target.value))}
                className="h-[38px] w-full rounded-lg border border-olive/16 bg-white px-2.5 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <div className="relative px-1 pt-2">
            <div className="h-1.5 rounded-full bg-olive/12" />
            <div
              className="absolute top-2 h-1.5 rounded-full bg-primary/70"
              style={{ left: `${leftPercent}%`, width: `${Math.max(0, rightPercent - leftPercent)}%` }}
            />
            <input
              type="range"
              min={minBound}
              max={maxBound}
              step={PRICE_STEP}
              value={rangeMin}
              onChange={(event) => updateMin(Number(event.target.value))}
              className="pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
            />
            <input
              type="range"
              min={minBound}
              max={maxBound}
              step={PRICE_STEP}
              value={rangeMax}
              onChange={(event) => updateMax(Number(event.target.value))}
              className="pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
            />
          </div>
          <p className="text-xs text-olive/65">
            {formattedMin} ₽ - {formattedMax} ₽
          </p>
        </div>
      </details>

      <details open className="rounded-xl border border-olive/14 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-olive/70">
          Рейтинг
        </summary>
        <div className="mt-2 grid gap-1.5">
          {[
            { value: "", label: "С любым рейтингом" },
            { value: "4.5", label: "4.5 и выше" },
            { value: "4", label: "4.0 и выше" },
            { value: "3.5", label: "3.5 и выше" },
            { value: "3", label: "3.0 и выше" },
          ].map((option) => (
            <label key={option.value || "any"} className="inline-flex items-center gap-2 text-sm text-olive">
              <input
                type="radio"
                name="rating-local"
                value={option.value}
                checked={selectedMinRating === option.value}
                onChange={() => setSelectedMinRating(option.value)}
                className="h-4 w-4 accent-primary"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>

      <details open className="rounded-xl border border-olive/14 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-olive/70">
          Тип размещения
        </summary>
        <div className="mt-2 grid gap-1.5">
          <label className="inline-flex items-center gap-2 text-sm text-olive">
            <input
              type="radio"
              name="type-local"
              value=""
              checked={selectedType === ""}
              onChange={() => setSelectedType("")}
              className="h-4 w-4 accent-primary"
            />
            <span>Все типы</span>
          </label>
          {propertyTypes.map((type) => (
            <label key={type.id} className="inline-flex items-center gap-2 text-sm text-olive">
              <input
                type="radio"
                name="type-local"
                value={type.id}
                checked={selectedType === type.id}
                onChange={() => setSelectedType(type.id)}
                className="h-4 w-4 accent-primary"
              />
              <span>{type.name}</span>
            </label>
          ))}
        </div>
      </details>

      <details open className="rounded-xl border border-olive/14 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-olive/70">
          Дополнительно
        </summary>
        <div className="mt-2 grid gap-1.5">
          {[
            { id: "photos", label: "Только с фото", checked: photosOnly, set: setPhotosOnly },
            { id: "reviews", label: "Только с отзывами", checked: reviewsOnly, set: setReviewsOnly },
            {
              id: "children",
              label: "Для отдыха с детьми",
              checked: childrenFriendlyOnly,
              set: setChildrenFriendlyOnly,
            },
            {
              id: "pets",
              label: "Можно с животными",
              checked: petsAllowedOnly,
              set: setPetsAllowedOnly,
            },
          ].map((item) => (
            <label key={item.id} className="inline-flex items-center gap-2 text-sm text-olive">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => item.set(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </details>

      <details open className="rounded-xl border border-olive/14 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-olive/70">
          Сортировка
        </summary>
        <div className="mt-2 grid gap-1.5">
          {[
            { value: "", label: "Рекомендованные" },
            { value: "price_asc", label: "Цена: по возрастанию" },
            { value: "price_desc", label: "Цена: по убыванию" },
            { value: "rating_desc", label: "Рейтинг" },
            { value: "popular_desc", label: "Популярность" },
          ].map((option) => (
            <button
              key={option.value || "recommended"}
              type="button"
              onClick={() => setSelectedSort(option.value)}
              className={cn(
                "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-left text-sm transition",
                selectedSort === option.value
                  ? "border-primary/45 bg-primary/12 text-primary"
                  : "border-olive/16 text-olive hover:bg-cream/70",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </details>

      <button
        type="submit"
        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/88"
      >
        Применить фильтры
      </button>
    </form>
  );
}
