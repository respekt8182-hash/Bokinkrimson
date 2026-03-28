// Next.js page for route /crimea/[location]/[slug].
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicPropertyDetails } from "@/components/public/public-property-details";
import { PublicPropertyBottomSections } from "@/components/public/public-property-bottom-sections";
import { PropertyReviewsSection } from "@/components/reviews/property-reviews-section";
import { ViewTracker } from "@/components/public/view-tracker";
import { getSession } from "@/lib/auth";
import { getPublicCatalog, getPublicPropertyByIdentifier } from "@/lib/public-properties";

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

export async function generateMetadata({ params }: PublicPropertyPageProps): Promise<Metadata> {
  const { location, slug } = await params;
  const item = await getPublicPropertyByIdentifier(slug, location);

  if (!item) {
    return {
      title: "Объект не найден",
      robots: { index: false, follow: false },
    };
  }

  const title = `${item.name ?? "Объект"} — ${item.locationName ?? "Крым"}`;
  const description = (
    item.description?.trim() || `Размещение в ${item.locationName ?? "Крыму"}`
  ).slice(0, 160);
  const images = item.media
    .filter((media) => media.type === "IMAGE")
    .slice(0, 4)
    .map((media) => media.url);

  return {
    title,
    description,
    alternates: {
      canonical: item.path,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: item.path,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function PublicPropertyPage({ params, searchParams }: PublicPropertyPageProps) {
  const { location, slug } = await params;
  const query = searchParams ? await searchParams : {};
  const checkIn = pick(query.checkIn);
  const checkOut = pick(query.checkOut);
  const guests = pick(query.guests);
  const guestsAdults = pick(query.guestsAdults) || pick(query.adults);
  const guestsChildren = pick(query.guestsChildren) || pick(query.children);
  const session = await getSession();
  const item = await getPublicPropertyByIdentifier(slug, location, session?.id ?? null);

  if (!item) {
    notFound();
  }

  const canonicalPath = item.path;
  const currentPath = `/crimea/${location}/${slug}`;
  if (canonicalPath !== currentPath) {
    redirect(canonicalPath);
  }

  const similarCatalog = await getPublicCatalog({
    locationId: item.locationId ?? undefined,
    type: item.type ?? undefined,
    pageSize: 9,
    sort: "rating_desc",
  });
  const similarItems = similarCatalog.items.filter((entry) => entry.id !== item.id).slice(0, 6);

  const propertyTypeName = item.typeLabel ?? "Объект размещения";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <ViewTracker propertyId={item.id} />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-olive/60">
        <Link href="/" className="transition hover:text-olive">
          Главная
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/search?direction=housing" className="transition hover:text-olive">
          Жильё в Крыму
        </Link>
        {item.locationName ? (
          <>
            <span aria-hidden="true">›</span>
            <Link
              href={`/search?direction=housing&location=${encodeURIComponent(item.locationName)}`}
              className="transition hover:text-olive"
            >
              {item.locationName}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">›</span>
        <span className="text-olive/80">{propertyTypeName}</span>
        <span aria-hidden="true">›</span>
        <span className="max-w-[200px] truncate font-medium text-olive/90" title={item.name ?? undefined}>
          {item.name ?? "Объект"}
        </span>
      </nav>

      <PublicPropertyDetails
        item={item}
        similarItems={similarItems}
        initialIsFavorite={false}
        initialCheckIn={checkIn || null}
        initialCheckOut={checkOut || null}
        initialGuestsCount={parseCount(guests)}
        initialAdultsCount={parseCount(guestsAdults)}
        initialChildrenCount={parseCount(guestsChildren)}
      />

      <PropertyReviewsSection
        submitUrl={`/api/public/properties/${encodeURIComponent(item.slug)}/reviews`}
        loadMoreUrl={`/api/public/properties/${encodeURIComponent(item.slug)}/reviews`}
        entityPath={item.path}
        entityLabel="объекта"
        avgRating={item.avgRating}
        reviewsCount={item.reviewsCount}
        initialReviews={item.reviews}
        initialHasMore={item.reviewsCount > item.reviews.length}
        isAuthenticated={Boolean(session)}
        currentUserId={session?.id ?? null}
        ownerUserId={item.owner.id}
      />

      <PublicPropertyBottomSections item={item} />

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white/94 p-3 ring-1 ring-olive/10">
        <Link
          href={`/search?direction=housing&location=${encodeURIComponent(item.locationName ?? "")}`}
          className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
        >
          Назад в каталог
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}

