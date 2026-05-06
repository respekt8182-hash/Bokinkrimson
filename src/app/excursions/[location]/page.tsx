import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicExcursionList } from "@/components/excursions/public-excursion-list";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getExcursionSeoDirectoryData,
  getPublicExcursionCatalog,
  getResolvedExcursionLocationBySlug,
} from "@/lib/public-excursions";
import { defaultSocialImageUrl } from "@/lib/seo/metadata";
import { formatLocationInPrepositional } from "@/lib/seo/site";
import {
  buildBreadcrumbListStructuredData,
  buildCollectionPageStructuredData,
} from "@/lib/seo/structured-data";
import { excursionsHubPath } from "@/lib/seo/routes";

type ExcursionsByLocationPageProps = {
  params: Promise<{ location: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const directory = await getExcursionSeoDirectoryData();
  return directory.cities.map((item) => ({
    location: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: ExcursionsByLocationPageProps): Promise<Metadata> {
  const { location } = await params;
  const resolvedLocation = await getResolvedExcursionLocationBySlug(location);

  if (!resolvedLocation) {
    return {
      title: "Экскурсии не найдены",
      robots: { index: false, follow: false },
    };
  }

  const locationPhrase =
    formatLocationInPrepositional(resolvedLocation.name) ?? `в городе ${resolvedLocation.name}`;
  const title = `Экскурсии ${locationPhrase}`;
  const description = `Маршруты ${locationPhrase} и по соседним локациям Крыма: продолжительность, стоимость, формат участия и прямой контакт с организатором.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/excursions/${resolvedLocation.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/excursions/${resolvedLocation.slug}`,
      type: "website",
      images: [defaultSocialImageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultSocialImageUrl],
    },
  };
}

export default async function ExcursionsByLocationPage({ params }: ExcursionsByLocationPageProps) {
  const { location } = await params;
  const resolvedLocation = await getResolvedExcursionLocationBySlug(location);

  if (!resolvedLocation) {
    notFound();
  }

  const [result, directory] = await Promise.all([
    getPublicExcursionCatalog({
      locationId: resolvedLocation.slug,
      radiusKm: 20,
      pageSize: 24,
    }),
    getExcursionSeoDirectoryData(),
  ]);
  const locationPhrase =
    formatLocationInPrepositional(resolvedLocation.name) ?? `в городе ${resolvedLocation.name}`;
  const title = `Экскурсии ${locationPhrase}`;
  const description = `Собрали экскурсии с отправлением ${locationPhrase}, а также маршруты по соседним локациям в радиусе 20 км.`;
  const path = `/excursions/${resolvedLocation.slug}`;
  const breadcrumbs = [
    { name: "Главная", path: "/" },
    { name: "Экскурсии по Крыму", path: excursionsHubPath },
    { name: resolvedLocation.name, path },
  ];
  const linkGroups = [
    {
      title: "Другие города",
      links: directory.cities
        .filter((item) => item.slug !== resolvedLocation.slug)
        .slice(0, 8)
        .map((item) => ({
          label: item.name,
          href: `/excursions/${item.slug}`,
        })),
    },
    {
      title: "Категории",
      links: directory.categories.slice(0, 8).map((item) => ({
        label: item.name,
        href: `/excursions/category/${item.slug}`,
      })),
    },
    {
      title: "Районы",
      links: directory.districts.slice(0, 8).map((item) => ({
        label: item.name,
        href: `/excursions/district/${item.slug}`,
      })),
    },
  ];

  return (
    <>
      <JsonLd data={buildBreadcrumbListStructuredData(breadcrumbs)} />
      <JsonLd
        data={buildCollectionPageStructuredData({
          path,
          name: title,
          description,
          items: result.items.slice(0, 12).map((item) => ({
            name: item.title,
            path: item.path,
            image: item.coverImageUrl,
          })),
        })}
      />

      <PublicExcursionList
        title={title}
        description={description}
        result={result}
        breadcrumbs={breadcrumbs}
        linkGroups={linkGroups}
      />
    </>
  );
}
