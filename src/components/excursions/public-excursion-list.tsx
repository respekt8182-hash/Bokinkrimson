// UI component for public excursion list in the excursions module.
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { SeoBreadcrumbs, type SeoBreadcrumbItem } from "@/components/seo/seo-breadcrumbs";
import { SeoHubLinks, type SeoHubLinkGroup } from "@/components/seo/seo-hub-links";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  formatProgramDuration,
  formatProgramPrice,
  getOfferTypeLabel,
} from "@/lib/excursion-offers";
import { getFavoriteEntityTypeFromOfferType } from "@/lib/favorite-entities";
import type { PublicExcursionCatalogResult } from "@/lib/public-excursions";
import Link from "next/link";

type PublicExcursionListProps = {
  title: string;
  description?: string | null;
  result: PublicExcursionCatalogResult;
  breadcrumbs?: SeoBreadcrumbItem[];
  linkGroups?: SeoHubLinkGroup[];
};

export function PublicExcursionList({
  title,
  description,
  result,
  breadcrumbs = [],
  linkGroups = [],
}: PublicExcursionListProps) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      <SeoBreadcrumbs items={breadcrumbs} />

      <section className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5">
        <h1 className="text-3xl text-olive">{title}</h1>
        {description ? <p className="mt-2 text-sm text-olive/75">{description}</p> : null}
        <p className="mt-1 text-xs text-olive/60">Найдено программ: {result.total}.</p>
      </section>

      <SeoHubLinks groups={linkGroups} />

      {result.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-6 text-sm text-olive/70">
          По выбранным параметрам программы не найдены.
        </section>
      ) : (
        <section className="grid gap-4">
          {result.items.map((item) => {
            const ownerName =
              [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ") || "?";
            const ownerInitials =
              `${item.owner.firstName.slice(0, 1)}${item.owner.lastName.slice(0, 1)}`
                .trim()
                .toUpperCase();

            return (
              <article key={item.id} className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="relative overflow-hidden rounded-xl bg-cream">
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

                    <div className="absolute right-2 top-2 z-10">
                      <FavoriteToggleButton
                        itemId={item.id}
                        entityType={getFavoriteEntityTypeFromOfferType(item.offerType)}
                        initialIsFavorite={false}
                        variant="icon"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {getOfferTypeLabel(item.offerType)}
                      </span>
                      {item.subtypeLabel ? (
                        <span className="rounded-full border border-olive/10 px-3 py-1 text-xs font-medium text-olive/70">
                          {item.subtypeLabel}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1 text-2xl text-olive">{item.title}</h2>
                    <p className="mt-1 text-sm text-olive/70">{item.routeSummary}</p>

                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-cream ring-1 ring-olive/10">
                        <AvatarImage
                          src={item.owner.avatarUrl}
                          alt={ownerName}
                          className="h-full w-full object-cover"
                        >
                          <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-olive/60">
                            {ownerInitials || "?"}
                          </span>
                        </AvatarImage>
                      </span>
                      <span className="truncate text-xs font-semibold text-olive/70">
                        {ownerName}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/70">
                      <span className="rounded-full bg-cream px-3 py-1">
                        {item.availabilitySummary}
                      </span>
                      <span className="rounded-full bg-cream px-3 py-1">
                        Длительность: {formatProgramDuration(item)}
                      </span>
                      <span className="rounded-full bg-cream px-3 py-1">
                        Рейтинг: {item.avgRating.toFixed(1)} ({item.reviewsCount})
                      </span>
                      <span className="rounded-full bg-cream px-3 py-1">
                        {formatProgramPrice(item)}
                      </span>
                      {item.districtName ? (
                        <span className="rounded-full bg-cream px-3 py-1">{item.districtName}</span>
                      ) : null}
                      {item.categoryName ? (
                        <span className="rounded-full bg-cream px-3 py-1">{item.categoryName}</span>
                      ) : null}
                      {item.hasAccommodation ? (
                        <span className="rounded-full bg-cream px-3 py-1">С проживанием</span>
                      ) : null}
                      {item.pickupAvailable ? (
                        <span className="rounded-full bg-cream px-3 py-1">С трансфером</span>
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
            );
          })}
        </section>
      )}
    </div>
  );
}
