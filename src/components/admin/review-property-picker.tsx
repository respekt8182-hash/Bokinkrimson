"use client";

import Link from "next/link";
import { ArrowUpDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReviewPropertyPickerItem = {
  id: string;
  number: number;
  name: string;
  locationName: string;
  previewUrl: string | null;
};

type ReviewPropertyPickerProps = {
  items: ReviewPropertyPickerItem[];
  selectedPropertyId: string | null;
  activeStatus: string;
};

type SortMode = "number" | "name" | "location";

function buildPropertyHref(propertyId: string, status: string): string {
  const params = new URLSearchParams();
  if (status !== "PENDING") {
    params.set("status", status);
  }
  params.set("propertyId", propertyId);
  return `/admin/reviews?${params.toString()}`;
}

function formatNumber(value: number): string {
  return String(value).padStart(3, "0");
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function ReviewPropertyPicker({
  items,
  selectedPropertyId,
  activeStatus,
}: ReviewPropertyPickerProps) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("number");

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = normalizedQuery
      ? items.filter((item) => {
          const haystack = [
            item.name,
            item.locationName,
            String(item.number),
            formatNumber(item.number),
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : items;

    return [...filtered].sort((left, right) => {
      if (sortMode === "name") {
        return (
          left.name.localeCompare(right.name, "ru", { sensitivity: "base" }) ||
          left.number - right.number
        );
      }

      if (sortMode === "location") {
        return (
          left.locationName.localeCompare(right.locationName, "ru", { sensitivity: "base" }) ||
          left.name.localeCompare(right.name, "ru", { sensitivity: "base" }) ||
          left.number - right.number
        );
      }

      return left.number - right.number;
    });
  }, [items, query, sortMode]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <label className="grid gap-1.5 text-sm font-semibold text-olive">
          Поиск объекта
          <span className="relative">
            <AppIcon
              icon={Search}
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/42"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название, город или номер"
              className="pr-10 pl-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-olive/54 transition hover:bg-olive/8 hover:text-olive"
                aria-label="Очистить поиск"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            ) : null}
          </span>
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-olive">
          Сортировка
          <span className="relative">
            <AppIcon
              icon={ArrowUpDown}
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/42"
            />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 w-full rounded-xl border border-olive/18 bg-white px-9 pr-3 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/22"
            >
              <option value="number">По номеру</option>
              <option value="name">По названию</option>
              <option value="location">По городу</option>
            </select>
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs font-medium text-olive/56">
        <span>
          Показано {visibleItems.length} из {items.length}
        </span>
        {query ? (
          <Button type="button" variant="ghost" className="px-3 py-1.5" onClick={() => setQuery("")}>
            Сбросить поиск
          </Button>
        ) : null}
      </div>

      {visibleItems.length > 0 ? (
        <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((property) => {
            const active = selectedPropertyId === property.id;

            return (
              <Link
                key={property.id}
                href={buildPropertyHref(property.id, activeStatus)}
                className={cn(
                  "group grid grid-cols-[72px_1fr] gap-3 rounded-2xl border bg-white p-2.5 text-left transition hover:border-primary/24 hover:bg-primary/5",
                  active
                    ? "border-primary/30 bg-primary/8 shadow-[0_12px_34px_rgba(62,99,88,0.12)]"
                    : "border-olive/10",
                )}
              >
                <span className="relative block h-[72px] overflow-hidden rounded-xl bg-cream ring-1 ring-olive/8">
                  {property.previewUrl ? (
                    <span
                      aria-hidden="true"
                      className="block h-full w-full bg-cover bg-center transition duration-300 group-hover:scale-[1.03]"
                      style={{ backgroundImage: `url(${JSON.stringify(property.previewUrl)})` }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-olive/38">
                      Фото
                    </span>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-lg bg-white/92 px-2 py-1 text-[11px] font-bold text-olive shadow-sm ring-1 ring-olive/8">
                    №{formatNumber(property.number)}
                  </span>
                </span>
                <span className="min-w-0 self-center">
                  <span className="line-clamp-2 text-sm font-semibold leading-5 text-olive">
                    {property.name}
                  </span>
                  <span className="mt-1 block truncate text-xs font-medium text-olive/58">
                    {property.locationName}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-olive/16 bg-white px-5 py-6 text-sm text-olive/62">
          По такому запросу объектов не найдено.
        </div>
      )}
    </div>
  );
}
