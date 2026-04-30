import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatProgramPrice } from "@/lib/excursion-offers";
import type { NearbyExcursionItem } from "@/lib/nearby-public";

type NearbyExcursionsSectionProps = {
  items: NearbyExcursionItem[];
  searchHref: string;
  radiusKm?: number;
  title?: string;
  description?: string;
  emptyDescription?: string;
  actionLabel?: string;
  layout?: "grid" | "carousel";
  className?: string;
  titleClassName?: string;
};

function formatDistance(distanceKm: number): string {
  return `~ ${distanceKm.toFixed(1)} км`;
}

export function NearbyExcursionsSection({
  items,
  searchHref,
  radiusKm = 10,
  title = "Экскурсии поблизости",
  description,
  emptyDescription,
  actionLabel = "Смотреть экскурсии",
  layout = "grid",
  className,
  titleClassName,
}: NearbyExcursionsSectionProps) {
  const hasItems = items.length > 0;

  return (
    <section className={cn("rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5", className)}>
      <h2 className={cn("text-xl font-semibold text-olive", titleClassName)}>{title}</h2>
      <p className="mt-2 text-sm leading-6 text-olive/75">
        {hasItems
          ? (description ??
            `Подобрали ближайшие экскурсии рядом с объектом в радиусе около ${radiusKm} км.`)
          : (emptyDescription ??
            `Рядом с этим объектом пока не нашли экскурсии в радиусе около ${radiusKm} км, но можно открыть весь каталог.`)}
      </p>

      {hasItems ? (
        <div
          className={
            layout === "carousel"
              ? "-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-2"
              : "mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          }
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              className={
                layout === "carousel"
                  ? "group min-w-[248px] flex-[0_0_248px] snap-start overflow-hidden rounded-2xl border border-olive/8 bg-cream/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(15,118,110,0.12)] sm:min-w-[272px]"
                  : "group overflow-hidden rounded-2xl border border-olive/8 bg-cream/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(15,118,110,0.12)]"
              }
            >
              {item.coverImageUrl ? (
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center bg-sand/60 text-xs text-olive/35">
                  Без фото
                </div>
              )}

              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-sm font-semibold text-olive">{item.title}</p>
                <p className="line-clamp-2 text-xs text-olive/55">{item.routeSummary}</p>
                <div className="flex items-center justify-between gap-2 text-xs text-olive/55">
                  <span>{formatDistance(item.distanceKm)}</span>
                  <span className="truncate">{item.availabilitySummary}</span>
                </div>
                <p className="text-xs font-bold text-primary">{formatProgramPrice(item)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <Link
        href={searchHref}
        className="mt-4 inline-flex rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
