import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NearbyPropertyItem } from "@/lib/nearby-public";

type NearbyPropertiesSectionProps = {
  items: NearbyPropertyItem[];
  searchHref: string;
  radiusKm?: number;
  className?: string;
  titleClassName?: string;
  title?: string;
  description?: string;
  emptyDescription?: string;
  actionLabel?: string;
  layout?: "grid" | "carousel";
};

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function formatMoney(value: number, currency: string): string {
  const amount = moneyFormatter.format(value);
  return currency === "RUB" ? `${amount} ₽` : `${amount} ${currency}`;
}

function formatDistance(distanceKm: number): string {
  return `~ ${distanceKm.toFixed(1)} км`;
}

export function NearbyPropertiesSection({
  items,
  searchHref,
  radiusKm = 10,
  className,
  titleClassName,
  title = "Недвижимость поблизости",
  description,
  emptyDescription,
  actionLabel = "Смотреть недвижимость",
  layout = "grid",
}: NearbyPropertiesSectionProps) {
  const hasItems = items.length > 0;

  return (
    <section className={cn("rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5", className)}>
      <h2 className={cn("text-xl font-semibold text-olive", titleClassName)}>{title}</h2>
      <p className="mt-2 text-sm leading-6 text-olive/75">
        {hasItems
          ? (description ?? `Показываем варианты жилья поблизости в радиусе около ${radiusKm} км.`)
          : (emptyDescription ??
            `Поблизости пока не нашли жильё в радиусе около ${radiusKm} км, но можно открыть каталог по локации.`)}
      </p>

      {hasItems ? (
        <div
          className={cn(
            "mt-4",
            layout === "carousel"
              ? "-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2"
              : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
          )}
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              className={cn(
                "group overflow-hidden rounded-2xl border border-olive/8 bg-cream/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(15,118,110,0.12)]",
                layout === "carousel" &&
                  "min-w-[248px] flex-[0_0_248px] snap-start sm:min-w-[272px]",
              )}
            >
              {item.coverImageUrl ? (
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.coverImageUrl}
                    alt={item.name}
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
                <p className="line-clamp-2 text-sm font-semibold text-olive">{item.name}</p>
                <div className="flex items-center justify-between gap-2 text-xs text-olive/55">
                  <span className="truncate">{item.locationName ?? "Крым"}</span>
                  <span>{formatDistance(item.distanceKm)}</span>
                </div>
                <p className="text-xs font-bold text-primary">
                  {item.minNightPrice !== null && item.currency
                    ? `от ${formatMoney(item.minNightPrice, item.currency)}`
                    : "Цена по запросу"}
                </p>
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
