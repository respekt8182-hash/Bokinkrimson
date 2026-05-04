import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicExcursionList } from "@/components/excursions/public-excursion-list";
import { JsonLd } from "@/components/seo/JsonLd";
import { getExcursionSeoDirectoryData, getPublicExcursionCatalog } from "@/lib/public-excursions";
import { defaultSocialImageUrl } from "@/lib/seo/metadata";
import {
  buildBreadcrumbListStructuredData,
  buildCollectionPageStructuredData,
} from "@/lib/seo/structured-data";
import { excursionsHubPath } from "@/lib/seo/routes";

type ExcursionsByDistrictPageProps = {
  params: Promise<{ district: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const directory = await getExcursionSeoDirectoryData();
  return directory.districts.map((item) => ({
    district: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: ExcursionsByDistrictPageProps): Promise<Metadata> {
  const { district } = await params;
  const directory = await getExcursionSeoDirectoryData();
  const districtItem = directory.districts.find((item) => item.slug === district) ?? null;

  if (!districtItem) {
    return {
      title: "Район экскурсий не найден",
      robots: { index: false, follow: false },
    };
  }

  const title = `Экскурсии в районе «${districtItem.name}»`;
  const description = `Каталог экскурсий по району «${districtItem.name}»: направления, длительность, формат участия и условия бронирования по Крыму.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/excursions/district/${district}`,
    },
    openGraph: {
      title,
      description,
      url: `/excursions/district/${district}`,
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

export default async function ExcursionsByDistrictPage({
  params,
}: ExcursionsByDistrictPageProps) {
  const { district } = await params;
  const directory = await getExcursionSeoDirectoryData();
  const districtItem = directory.districts.find((item) => item.slug === district) ?? null;

  if (!districtItem) {
    notFound();
  }

  const result = await getPublicExcursionCatalog({
    districtId: district,
    pageSize: 24,
  });
  const districtName = districtItem.name;

  const title = `Экскурсии в районе «${districtName}»`;
  const description = `Подборка экскурсий по району «${districtName}» и соседним локациям Крыма: маршруты, стоимость, продолжительность и условия участия.`;
  const path = `/excursions/district/${district}`;
  const breadcrumbs = [
    { name: "Главная", path: "/" },
    { name: "Экскурсии по Крыму", path: excursionsHubPath },
    { name: districtName, path },
  ];
  const linkGroups = [
    {
      title: "Другие районы",
      links: directory.districts
        .filter((item) => item.slug !== district)
        .slice(0, 8)
        .map((item) => ({
          label: item.name,
          href: `/excursions/district/${item.slug}`,
        })),
    },
    {
      title: "Города",
      links: directory.cities.slice(0, 8).map((item) => ({
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
