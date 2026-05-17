import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";
import { TransferDetails } from "@/components/public/marketplace-catalogs";
import { NearbyExcursionsSectionServer } from "@/components/public/nearby-excursions-section-server";
import { NearbyPropertiesSectionServer } from "@/components/public/nearby-properties-section-server";
import { TransferViewTracker } from "@/components/public/transfer-view-tracker";
import { PropertyReviewsSection } from "@/components/reviews/property-reviews-section";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getExternalReviewSummaryWithFallback,
  getMergedExternalReviewList,
} from "@/lib/external-reviews";
import { getLocationDirectoryItems, normalizeLocationName } from "@/lib/location-directory";
import { DEFAULT_NEARBY_RADIUS_KM } from "@/lib/nearby-public";
import {
  getOwnerPreviewTransferByIdentifier,
  getPublicTransferByIdentifier,
  type PublicTransferCatalogItem,
} from "@/lib/public-marketplace";
import { PUBLIC_REVIEWS_PAGE_SIZE, serializeReview } from "@/lib/reviews";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { buildSeoDescription, buildWebPageMetadata } from "@/lib/seo/metadata";
import { buildExcursionsLocationPath } from "@/lib/seo/routes";
import {
  buildBreadcrumbListStructuredData,
  buildTransferStructuredData,
} from "@/lib/seo/structured-data";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";

type TransferDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const rubleFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function buildTransferFleetSummary(item: PublicTransferCatalogItem): string | null {
  const labels = item.fleet
    .map((fleetItem) =>
      [
        fleetItem.title,
        fleetItem.transportKind,
        fleetItem.vehicleClass,
        fleetItem.vehicleModel,
      ]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);

  if (labels.length > 0) {
    return labels.slice(0, 3).join(", ");
  }

  return [item.vehicleClass, item.vehicleModel].filter(Boolean).join(" ") || null;
}

function buildTransferSeoDescription(item: PublicTransferCatalogItem): string {
  const locationPhrase = item.locationName ? `в ${item.locationName}` : "по Крыму";
  const fleetSummary = buildTransferFleetSummary(item);

  return buildSeoDescription({
    preferred: [item.description, item.shortDescription],
    fallbackParts: [
      `${item.transferType ?? "Трансфер"} ${locationPhrase}`,
      fleetSummary ? `Автопарк: ${fleetSummary}` : null,
      item.priceFrom !== null
        ? `Стоимость от ${rubleFormatter.format(item.priceFrom)} ₽${item.priceUnitLabel ? ` ${item.priceUnitLabel}` : ""}`
        : "Стоимость уточняется при обращении",
      item.serviceArea ? `Зона работы: ${item.serviceArea}` : null,
      item.routeExamples ? `Популярные маршруты: ${item.routeExamples}` : null,
      item.reviewsCount > 0 ? `${item.reviewsCount} отзывов пассажиров` : null,
      "Прямые контакты водителя и заявка без комиссии",
    ],
  });
}

export async function generateMetadata({
  params,
  searchParams,
}: TransferDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const previewRequested = pick(query.preview) === "1";
  const session = previewRequested ? await getSession() : null;
  const previewItem =
    previewRequested && session
      ? await getOwnerPreviewTransferByIdentifier(slug, session.id)
      : null;
  const item = previewItem ?? (await getPublicTransferByIdentifier(slug));

  if (!item) {
    return {
      title: "Трансфер не найден",
      robots: { index: false, follow: false },
    };
  }

  const title = `${item.title} — трансферы по Крыму`;
  const description = buildTransferSeoDescription(item);

  return buildWebPageMetadata({
    title,
    description,
    path: buildCanonicalPath(item.path),
    images: item.coverImageUrl ? [item.coverImageUrl] : undefined,
    robots: previewRequested ? { index: false, follow: false } : undefined,
  });
}

export default async function TransferDetailPage({
  params,
  searchParams,
}: TransferDetailPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const previewRequested = pick(query.preview) === "1";
  const session = await getSession();
  const previewItem =
    previewRequested && session
      ? await getOwnerPreviewTransferByIdentifier(slug, session.id)
      : null;
  const item = previewItem ?? (await getPublicTransferByIdentifier(slug));
  const isPreview = previewItem !== null;

  if (!item) {
    notFound();
  }

  const canonicalPath = item.path;
  const currentPath = `/transfers/${slug}`;
  if (canonicalPath !== currentPath) {
    if (isPreview) {
      redirect(`${canonicalPath}?preview=1`);
    }
    permanentRedirect(canonicalPath);
  }

  const transferReviewSupport = await hasTransferReviewSupport();
  const databaseReviews = transferReviewSupport
    ? await db.review.findMany({
        where: {
          entityType: ReviewEntityType.TRANSFER,
          transferId: item.id,
          status: ReviewStatus.ACTIVE,
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          user: {
            select: { firstName: true, avatarUrl: true },
          },
          ...(session
            ? {
                reactions: {
                  where: { userId: session.id },
                  select: { value: true },
                  take: 1,
                },
              }
            : {}),
        },
      })
    : [];
  const reviews = await getMergedExternalReviewList({
    entityType: "transfer",
    entityId: item.id,
    databaseItems: databaseReviews.map(serializeReview),
    databaseTotal: item.reviewsCount,
    currentUserId: session?.id ?? null,
    limit: PUBLIC_REVIEWS_PAGE_SIZE,
  });
  const reviewSummary = await getExternalReviewSummaryWithFallback({
    entityType: "transfer",
    entityId: item.id,
    avgRating: item.avgRating,
    reviewsCount: item.reviewsCount,
  });
  const nearbySearchParams = {
    location: item.locationName ?? "",
    radiusKm: String(DEFAULT_NEARBY_RADIUS_KM),
  };
  const nearbyLocationName = item.locationName ? normalizeLocationName(item.locationName) : null;
  const nearbyLocation = nearbyLocationName
    ? (await getLocationDirectoryItems()).find(
        (location) => normalizeLocationName(location.name) === nearbyLocationName,
      )
    : null;
  const nearbyHousingHref = nearbyLocation
    ? buildCanonicalPath(`/crimea/${nearbyLocation.id}`)
    : buildCanonicalPath(
        "/rent",
        Object.entries(nearbySearchParams).filter(([, value]) => value),
        ["location", "radiusKm"],
      );
  const nearbyExcursionsHref = nearbyLocation
    ? buildExcursionsLocationPath(nearbyLocation.id)
    : buildCanonicalPath(
        "/excursions",
        Object.entries(nearbySearchParams).filter(([, value]) => value),
        ["location", "radiusKm"],
      );
  const transferLocationHref = item.locationName
    ? buildCanonicalPath("/transfers", [["location", item.locationName]], ["location"])
    : buildCanonicalPath("/transfers");
  const breadcrumbItems = [
    { name: "Главная", path: "/" },
    { name: "Трансферы", path: "/transfers" },
    ...(item.locationName ? [{ name: item.locationName, path: transferLocationHref }] : []),
    { name: item.title, path: item.path },
  ];

  return (
    <>
      {!isPreview ? <JsonLd data={buildBreadcrumbListStructuredData(breadcrumbItems)} /> : null}
      {!isPreview ? <JsonLd data={buildTransferStructuredData(item)} /> : null}

      {!isPreview ? <TransferViewTracker transferId={item.id} /> : null}

      {isPreview ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-6 md:pt-8">
          <section className="rounded-2xl border border-primary/20 bg-primary/6 px-4 py-3 text-sm text-olive shadow-sm">
            <p className="font-semibold text-primary">Предпросмотр карточки</p>
            <p className="mt-1 text-olive/72">
              Сейчас открыта owner-only версия страницы. Ее видите только вы, пока карточка не
              опубликована.
            </p>
          </section>
        </div>
      ) : null}

      <TransferDetails item={item} />

      <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6 md:pb-10">
        <PropertyReviewsSection
          submitUrl={`/api/public/transfers/${encodeURIComponent(item.id)}/reviews`}
          loadMoreUrl={`/api/public/transfers/${encodeURIComponent(item.id)}/reviews`}
          entityPath={item.path}
          entityLabel="трансфера"
          avgRating={reviewSummary.avgRating}
          reviewsCount={reviewSummary.reviewsCount}
          initialReviews={reviews.items}
          initialHasMore={!isPreview && reviews.total > reviews.items.length}
          isAuthenticated={Boolean(session)}
          currentUserId={session?.id ?? null}
          ownerUserId={item.owner.id}
          title="Отзывы о поездках"
          promptTitle="Ездили с этим водителем? Поделитесь впечатлениями."
          promptText="Короткий честный отзыв помогает другим пассажирам быстрее выбрать трансфер."
          emptyTitle="Пока нет отзывов о поездках"
          emptyDescription="После первых опубликованных отзывов здесь появятся рейтинг водителя и комментарии пассажиров."
        />

        <section className="grid gap-4 pb-8 lg:grid-cols-2" aria-label="Что рядом">
          <div id="nearby-housing" className="scroll-mt-[132px] md:scroll-mt-[152px] lg:col-span-2">
            <Suspense fallback={null}>
              <NearbyPropertiesSectionServer
                latitude={item.latitude}
                longitude={item.longitude}
                searchHref={nearbyHousingHref}
                radiusKm={DEFAULT_NEARBY_RADIUS_KM}
              />
            </Suspense>
          </div>

          <div id="nearby-excursions" className="scroll-mt-[132px] md:scroll-mt-[152px] lg:col-span-2">
            <Suspense fallback={null}>
              <NearbyExcursionsSectionServer
                latitude={item.latitude}
                longitude={item.longitude}
                searchHref={nearbyExcursionsHref}
                radiusKm={DEFAULT_NEARBY_RADIUS_KM}
                title="Экскурсии поблизости"
                description={`Экскурсии рядом с точкой трансфера в радиусе около ${DEFAULT_NEARBY_RADIUS_KM} км.`}
                emptyDescription={`Экскурсии рядом с точкой трансфера пока не найдены, но можно открыть весь каталог.`}
              />
            </Suspense>
          </div>
        </section>
      </div>
    </>
  );
}
