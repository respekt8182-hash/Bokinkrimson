import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttractionDetails } from "@/components/public/marketplace-catalogs";
import { NearbyExcursionsSectionServer } from "@/components/public/nearby-excursions-section-server";
import { NearbyPropertiesSectionServer } from "@/components/public/nearby-properties-section-server";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicAttractionByIdentifier } from "@/lib/public-marketplace";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { buildWebPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { buildBreadcrumbListStructuredData } from "@/lib/seo/structured-data";

type AttractionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: AttractionDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicAttractionByIdentifier(slug);

  if (!item) {
    return {
      title: "Место досуга не найдено — Крым Вокруг",
    };
  }

  return buildWebPageMetadata({
    title: item.seoTitle,
    description: item.metaDescription,
    path: buildCanonicalPath(item.path),
    images: item.coverImageUrl ? [item.coverImageUrl] : undefined,
  });
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
  const attractionLocationHref = item.locationName
    ? buildCanonicalPath("/attractions", [["location", item.locationName]], ["location"])
    : buildCanonicalPath("/attractions");
  const breadcrumbItems = [
    { name: "Главная", path: "/" },
    { name: "Досуг", path: "/attractions" },
    ...(item.locationName ? [{ name: item.locationName, path: attractionLocationHref }] : []),
    { name: item.title, path: item.path },
  ];
  const jsonLdItems: Array<Record<string, unknown>> = [
    buildBreadcrumbListStructuredData(breadcrumbItems),
    {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      name: item.title,
      description: item.metaDescription,
      image: item.coverImageUrl ? absoluteUrl(item.coverImageUrl) : undefined,
      url: absoluteUrl(item.path),
      address: item.address
        ? {
            "@type": "PostalAddress",
            addressLocality: item.locationName ?? undefined,
            streetAddress: item.address,
            addressRegion: "Крым",
            addressCountry: "RU",
          }
        : undefined,
      geo:
        item.latitude !== null && item.longitude !== null
          ? {
              "@type": "GeoCoordinates",
              latitude: item.latitude,
              longitude: item.longitude,
            }
          : undefined,
    },
  ];

  if (item.faq.length > 0) {
    jsonLdItems.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: item.faq.map((faqItem) => ({
        "@type": "Question",
        name: faqItem.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faqItem.answer,
        },
      })),
    });
  }

  return (
    <>
      <JsonLd data={jsonLdItems} />
      <AttractionDetails item={item} />
      <section className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-10 md:px-6">
        <div id="nearby-housing">
          <NearbyPropertiesSectionServer
            latitude={item.latitude}
            longitude={item.longitude}
            searchHref={nearbyHousingHref}
            radiusKm={15}
            title="Недвижимость рядом"
            actionLabel="Открыть жильё рядом"
            layout="grid"
            className="excursion-card p-6 md:p-7"
            titleClassName="font-heading text-2xl"
          />
        </div>
        <div id="nearby-excursions">
          <NearbyExcursionsSectionServer
            latitude={item.latitude}
            longitude={item.longitude}
            searchHref={nearbyExcursionsHref}
            radiusKm={15}
            title="Экскурсии рядом"
            actionLabel="Открыть экскурсии рядом"
            layout="grid"
            className="excursion-card p-6 md:p-7"
            titleClassName="font-heading text-2xl"
          />
        </div>
      </section>
    </>
  );
}
