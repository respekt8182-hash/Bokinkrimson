import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttractionDetails } from "@/components/public/marketplace-catalogs";
import { NearbyExcursionsSectionServer } from "@/components/public/nearby-excursions-section-server";
import { NearbyPropertiesSectionServer } from "@/components/public/nearby-properties-section-server";
import { getPublicAttractionByIdentifier } from "@/lib/public-marketplace";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type AttractionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: AttractionDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicAttractionByIdentifier(slug);

  if (!item) {
    return {
      title: "Достопримечательность не найдена — Крым Вокруг",
    };
  }

  return {
    title: `${item.title} — достопримечательности Крыма`,
    description:
      item.shortDescription ??
      item.description?.slice(0, 160) ??
      `Информация о достопримечательности ${item.title} в каталоге Крым Вокруг.`,
    alternates: {
      canonical: buildCanonicalPath(item.path),
    },
    openGraph: {
      title: item.title,
      description: item.shortDescription ?? item.description ?? undefined,
      images: item.coverImageUrl ? [item.coverImageUrl] : undefined,
    },
  };
}

export default async function AttractionDetailPage({ params }: AttractionDetailPageProps) {
  const { slug } = await params;
  const item = await getPublicAttractionByIdentifier(slug);

  if (!item) {
    notFound();
  }

  const nearbySearchParams = {
    location: item.locationName ?? "",
    radiusKm: "15",
  };
  const nearbyHousingHref = buildCanonicalPath(
    "/rent",
    Object.entries(nearbySearchParams).filter(([, value]) => value),
    ["location", "radiusKm"],
  );
  const nearbyExcursionsHref = buildCanonicalPath(
    "/excursions",
    Object.entries(nearbySearchParams).filter(([, value]) => value),
    ["location", "radiusKm"],
  );

  return (
    <>
      <AttractionDetails item={item} />
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-8 md:px-6 lg:grid-cols-2">
        <NearbyPropertiesSectionServer
          latitude={item.latitude}
          longitude={item.longitude}
          searchHref={nearbyHousingHref}
          radiusKm={15}
        />
        <NearbyExcursionsSectionServer
          latitude={item.latitude}
          longitude={item.longitude}
          searchHref={nearbyExcursionsHref}
          radiusKm={15}
        />
      </section>
    </>
  );
}
