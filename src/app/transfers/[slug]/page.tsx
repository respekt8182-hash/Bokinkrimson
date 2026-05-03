import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";
import { TransferDetails } from "@/components/public/marketplace-catalogs";
import { NearbyExcursionsSectionServer } from "@/components/public/nearby-excursions-section-server";
import { NearbyPropertiesSectionServer } from "@/components/public/nearby-properties-section-server";
import { TransferViewTracker } from "@/components/public/transfer-view-tracker";
import { PropertyReviewsSection } from "@/components/reviews/property-reviews-section";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocationDirectoryItems, normalizeLocationName } from "@/lib/location-directory";
import { DEFAULT_NEARBY_RADIUS_KM } from "@/lib/nearby-public";
import {
  getOwnerPreviewTransferByIdentifier,
  getPublicTransferByIdentifier,
} from "@/lib/public-marketplace";
import { serializeReview } from "@/lib/reviews";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { buildExcursionsLocationPath } from "@/lib/seo/routes";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";

type TransferDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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

  return {
    title: `${item.title} — трансферы по Крыму`,
    description:
      item.description?.slice(0, 160) ?? `Трансферная услуга ${item.title} в каталоге Крым Вокруг.`,
    alternates: {
      canonical: buildCanonicalPath(item.path),
    },
    robots: previewRequested ? { index: false, follow: false } : undefined,
    openGraph: {
      title: item.title,
      description: item.description ?? undefined,
      images: item.coverImageUrl ? [item.coverImageUrl] : undefined,
    },
  };
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
  const reviews = transferReviewSupport
    ? await db.review.findMany({
        where: {
          entityType: ReviewEntityType.TRANSFER,
          transferId: item.id,
          status: ReviewStatus.ACTIVE,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 9,
        include: {
          user: {
            select: { firstName: true, lastName: true, avatarUrl: true },
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

  return (
    <>
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
          avgRating={item.avgRating}
          reviewsCount={item.reviewsCount}
          initialReviews={reviews.map(serializeReview)}
          initialHasMore={transferReviewSupport && !isPreview && item.reviewsCount > reviews.length}
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
