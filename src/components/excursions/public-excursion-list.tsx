// UI component for public excursion list in the excursions module.
﻿import Link from "next/link";
import type { PublicExcursionCatalogResult } from "@/lib/public-excursions";

type PublicExcursionListProps = {
  title: string;
  description?: string | null;
  result: PublicExcursionCatalogResult;
};

function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) {
    return "Не указана";
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours === 0) {
    return `${restMinutes} мин`;
  }
  if (restMinutes === 0) {
    return `${hours} ч`;
  }
  return `${hours} ч ${restMinutes} мин`;
}

export function PublicExcursionList({ title, description, result }: PublicExcursionListProps) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      <section className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5">
        <h1 className="text-3xl text-olive">{title}</h1>
        {description ? <p className="mt-2 text-sm text-olive/75">{description}</p> : null}
        <p className="mt-1 text-xs text-olive/60">Найдено экскурсий: {result.total}.</p>
      </section>

      {result.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-6 text-sm text-olive/70">
          По выбранным параметрам экскурсии не найдены.
        </section>
      ) : (
        <section className="grid gap-4">
          {result.items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="overflow-hidden rounded-xl bg-cream">
                  {item.coverImageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.coverImageUrl}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="h-44 w-full object-cover md:h-full"
                      />
                    </>
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-olive/55 md:h-full">
                      Без фото
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-olive/60">Экскурсия</p>
                  <h2 className="mt-1 text-2xl text-olive">{item.title}</h2>
                  <p className="mt-1 text-sm text-olive/70">
                    {item.mainLocationName
                      ? `${item.mainLocationName}${
                          item.anchorCityName ? ` (рядом с ${item.anchorCityName})` : ""
                        }`
                      : item.locationName ?? "Крым"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/70">
                    <span className="rounded-full bg-cream px-3 py-1">
                      Длительность: {formatDuration(item.durationMinutes)}
                    </span>
                    <span className="rounded-full bg-cream px-3 py-1">
                      Рейтинг: {item.avgRating.toFixed(1)} ({item.reviewsCount})
                    </span>
                    <span className="rounded-full bg-cream px-3 py-1">
                      {item.priceFrom !== null
                        ? `от ${formatMoney(item.priceFrom, item.currency)}`
                        : "Цена по запросу"}
                    </span>
                    {item.districtName ? (
                      <span className="rounded-full bg-cream px-3 py-1">{item.districtName}</span>
                    ) : null}
                    {item.categoryName ? (
                      <span className="rounded-full bg-cream px-3 py-1">{item.categoryName}</span>
                    ) : null}
                    {item.distanceKm !== null ? (
                      <span className="rounded-full bg-cream px-3 py-1">
                        ~ {item.distanceKm.toFixed(1)} км
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <Link
                      href={item.path}
                      className="inline-flex rounded-xl bg-terra px-4 py-2 text-sm font-semibold text-white hover:bg-terra/88"
                    >
                      Открыть карточку
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
