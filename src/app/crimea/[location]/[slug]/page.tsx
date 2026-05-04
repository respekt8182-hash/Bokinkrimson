import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { NearbyExcursionsSectionServer } from "@/components/public/nearby-excursions-section-server";
import { NearbyPropertiesSectionServer } from "@/components/public/nearby-properties-section-server";
import { PublicPropertyBottomSections } from "@/components/public/public-property-bottom-sections";
import { PublicPropertyDetails } from "@/components/public/public-property-details";
import { ViewTracker } from "@/components/public/view-tracker";
import { PropertyReviewsSection } from "@/components/reviews/property-reviews-section";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSession } from "@/lib/auth";
import { DEFAULT_NEARBY_RADIUS_KM } from "@/lib/nearby-public";
import {
  getOwnerPreviewPropertyByIdentifier,
  getPublicPropertyByIdentifier,
} from "@/lib/public-properties";
import { buildSeoDescription, buildWebPageMetadata } from "@/lib/seo/metadata";
import {
  buildExcursionsHubPath,
  buildExcursionsLocationPath,
  buildHousingHubPath,
  buildHousingLocationPath,
  housingHubPath,
} from "@/lib/seo/routes";
import { formatLocationInPrepositional } from "@/lib/seo/site";
import {
  buildBreadcrumbListStructuredData,
  buildFaqStructuredData,
  buildPropertyStructuredData,
} from "@/lib/seo/structured-data";

type PublicPropertyPageProps = {
  params: Promise<{ location: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseCount(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const rubleFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export async function generateMetadata({
  params,
  searchParams,
}: PublicPropertyPageProps): Promise<Metadata> {
  const { location, slug } = await params;
  const query = searchParams ? await searchParams : {};
  const previewRequested = pick(query.preview) === "1";
  const session = previewRequested ? await getSession() : null;
  const previewItem =
    previewRequested && session
      ? await getOwnerPreviewPropertyByIdentifier(slug, session.id, location)
      : null;
  const item = previewItem ?? (await getPublicPropertyByIdentifier(slug, location));

  if (!item) {
    notFound();
  }

  if (!item) {
    return {
      title: "\u041e\u0431\u044a\u0435\u043a\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d",
      robots: { index: false, follow: false },
    };
  }

  const locationPhrase =
    formatLocationInPrepositional(item.locationName) ?? "\u0432 \u041a\u0440\u044b\u043c\u0443";
  const title = `${item.name ?? "\u041e\u0431\u044a\u0435\u043a\u0442 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u044f"} \u2014 \u0436\u0438\u043b\u044c\u0451 ${locationPhrase}`;
  const metadataDescription = buildSeoDescription({
    preferred: [item.description],
    fallbackParts: [
      `${item.typeLabel ?? "\u0416\u0438\u043b\u044c\u0451"} ${locationPhrase}`,
      item.address ? `\u0410\u0434\u0440\u0435\u0441: ${item.address}` : null,
      item.minNightPrice
        ? `\u0426\u0435\u043d\u0430 \u043e\u0442 ${rubleFormatter.format(item.minNightPrice)} \u20bd \u0437\u0430 \u043d\u043e\u0447\u044c`
        : null,
      item.reviewsCount > 0
        ? `${item.reviewsCount} \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0433\u043e\u0441\u0442\u0435\u0439`
        : null,
      "\u0424\u043e\u0442\u043e, \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u043f\u0440\u043e\u0436\u0438\u0432\u0430\u043d\u0438\u044f \u0438 \u043f\u0440\u044f\u043c\u044b\u0435 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430",
    ],
  });
  const images = item.media
    .filter((media) => media.type === "IMAGE")
    .slice(0, 4)
    .map((media) => media.url);

  return {
    ...buildWebPageMetadata({
      title,
      description: metadataDescription,
      path: item.path,
      images,
      robots: previewRequested ? { index: false, follow: false } : undefined,
    }),
  };
}

export default async function PublicPropertyPage({
  params,
  searchParams,
}: PublicPropertyPageProps) {
  const { location, slug } = await params;
  const query = searchParams ? await searchParams : {};
  const previewRequested = pick(query.preview) === "1";
  const checkIn = pick(query.checkIn);
  const checkOut = pick(query.checkOut);
  const guests = pick(query.guests);
  const guestsAdults = pick(query.guestsAdults) || pick(query.adults);
  const guestsChildren = pick(query.guestsChildren) || pick(query.children);
  const session = await getSession();
  const previewItem =
    previewRequested && session
      ? await getOwnerPreviewPropertyByIdentifier(slug, session.id, location, session.id)
      : null;
  const item =
    previewItem ?? (await getPublicPropertyByIdentifier(slug, location, session?.id ?? null));
  const isPreview = previewItem !== null;

  if (!item) {
    notFound();
  }

  const canonicalPath = item.path;
  const currentPath = `/crimea/${location}/${slug}`;
  if (canonicalPath !== currentPath) {
    if (isPreview) {
      redirect(`${canonicalPath}?preview=1`);
    }
    permanentRedirect(canonicalPath);
  }

  const locationSearchHref = item.locationId
    ? buildHousingLocationPath(item.locationId)
    : item.locationName
      ? buildHousingHubPath({ location: item.locationName })
      : housingHubPath;
  const excursionSearchHref = item.locationId
    ? buildExcursionsLocationPath(item.locationId)
    : item.locationName
      ? buildExcursionsHubPath({ location: item.locationName })
      : buildExcursionsHubPath();
  const breadcrumbItems = [
    { name: "\u0413\u043b\u0430\u0432\u043d\u0430\u044f", path: "/" },
    { name: "\u0416\u0438\u043b\u044c\u0451 \u0432 \u041a\u0440\u044b\u043c\u0443", path: housingHubPath },
    ...(item.locationName
      ? [{ name: item.locationName, path: locationSearchHref }]
      : []),
    {
      name: item.name ?? "\u041e\u0431\u044a\u0435\u043a\u0442 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u044f",
      path: item.path,
    },
  ];
  const faqStructuredData = !isPreview ? buildFaqStructuredData(item.faqItems) : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      {!isPreview ? <JsonLd data={buildBreadcrumbListStructuredData(breadcrumbItems)} /> : null}
      {!isPreview ? <JsonLd data={buildPropertyStructuredData(item)} /> : null}
      {faqStructuredData ? <JsonLd data={faqStructuredData} /> : null}
      {!isPreview ? <ViewTracker propertyId={item.id} /> : null}

      {isPreview ? (
        <section className="rounded-2xl border border-primary/20 bg-primary/6 px-4 py-3 text-sm text-olive shadow-sm">
          <p className="font-semibold text-primary">
            {"\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438"}
          </p>
          <p className="mt-1 text-olive/72">
            {
              "\u0421\u0435\u0439\u0447\u0430\u0441 \u043e\u0442\u043a\u0440\u044b\u0442\u0430 owner-only \u0432\u0435\u0440\u0441\u0438\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b. \u0415\u0451 \u0432\u0438\u0434\u0438\u0442\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0432\u044b, \u043f\u043e\u043a\u0430 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043d\u0435 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430."
            }
          </p>
        </section>
      ) : null}

      <nav
        aria-label="Хлебные крошки"
        className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol className="flex min-w-max items-center gap-2 text-sm">
          {breadcrumbItems.map((breadcrumb, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return [
              <li key={`${breadcrumb.path}-${index}`}>
                {isLast ? (
                  <span
                    className="inline-flex max-w-[min(72vw,26rem)] items-center truncate rounded-full bg-gradient-to-r from-cream via-white to-primary/8 px-3.5 py-1.5 font-semibold text-olive ring-1 ring-olive/10"
                    title={breadcrumb.name}
                  >
                    {breadcrumb.name}
                  </span>
                ) : (
                  <Link
                    href={breadcrumb.path}
                    className="inline-flex items-center rounded-full border border-olive/12 bg-white/92 px-3 py-1.5 text-olive/72 shadow-[0_10px_24px_rgba(58,43,35,0.05)] transition hover:border-primary/18 hover:bg-cream hover:text-olive"
                  >
                    {breadcrumb.name}
                  </Link>
                )}
              </li>,
              !isLast ? (
                <li
                  key={`${breadcrumb.path}-${index}-separator`}
                  aria-hidden="true"
                  className="text-base leading-none text-olive/24"
                >
                  ›
                </li>
              ) : null,
            ];
          })}
        </ol>
      </nav>

      <PublicPropertyDetails
        item={item}
        initialIsFavorite={false}
        initialCheckIn={checkIn || null}
        initialCheckOut={checkOut || null}
        initialGuestsCount={parseCount(guests)}
        initialAdultsCount={parseCount(guestsAdults)}
        initialChildrenCount={parseCount(guestsChildren)}
      />

      <PropertyReviewsSection
        submitUrl={`/api/public/properties/${encodeURIComponent(item.id)}/reviews`}
        loadMoreUrl={`/api/public/properties/${encodeURIComponent(item.id)}/reviews`}
        entityPath={item.path}
        entityLabel={"объекта"}
        avgRating={item.avgRating}
        reviewsCount={item.reviewsCount}
        initialReviews={item.reviews}
        initialHasMore={item.reviewsCount > item.reviews.length}
        isAuthenticated={Boolean(session)}
        currentUserId={session?.id ?? null}
        ownerUserId={item.owner.id}
      />

      <PublicPropertyBottomSections item={item} />

      <Suspense fallback={null}>
        <NearbyPropertiesSectionServer
          propertyId={item.id}
          latitude={item.latitude}
          longitude={item.longitude}
          searchHref={locationSearchHref}
          radiusKm={DEFAULT_NEARBY_RADIUS_KM}
        />
      </Suspense>

      <Suspense fallback={null}>
        <NearbyExcursionsSectionServer
          latitude={item.latitude}
          longitude={item.longitude}
          searchHref={excursionSearchHref}
          radiusKm={DEFAULT_NEARBY_RADIUS_KM}
        />
      </Suspense>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white/94 p-3 ring-1 ring-olive/10">
        <Link
          href={locationSearchHref}
          className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
        >
          {"\u041d\u0430\u0437\u0430\u0434 \u0432 \u043a\u0430\u0442\u0430\u043b\u043e\u0433"}
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
        >
          {"\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e"}
        </Link>
      </div>
    </div>
  );
}
