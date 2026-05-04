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

type ExcursionsByCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const directory = await getExcursionSeoDirectoryData();
  return directory.categories.map((item) => ({
    category: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: ExcursionsByCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const directory = await getExcursionSeoDirectoryData();
  const categoryItem = directory.categories.find((item) => item.slug === category) ?? null;

  if (!categoryItem) {
    return {
      title: "Категория экскурсий не найдена",
      robots: { index: false, follow: false },
    };
  }

  const title = `Экскурсии категории «${categoryItem.name}» в Крыму`;
  const description = `Подборка экскурсий категории «${categoryItem.name}»: форматы программ, цены, длительность и популярные локации по Крыму.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/excursions/category/${category}`,
    },
    openGraph: {
      title,
      description,
      url: `/excursions/category/${category}`,
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

export default async function ExcursionsByCategoryPage({
  params,
}: ExcursionsByCategoryPageProps) {
  const { category } = await params;
  const directory = await getExcursionSeoDirectoryData();
  const categoryItem = directory.categories.find((item) => item.slug === category) ?? null;

  if (!categoryItem) {
    notFound();
  }

  const result = await getPublicExcursionCatalog({
    categoryId: category,
    pageSize: 24,
  });
  const categoryName = categoryItem.name;

  const title = `Экскурсии категории «${categoryName}» в Крыму`;
  const description = `Собрали программы категории «${categoryName}» по разным городам и районам Крыма: маршруты, стоимость, длительность и условия участия.`;
  const path = `/excursions/category/${category}`;
  const breadcrumbs = [
    { name: "Главная", path: "/" },
    { name: "Экскурсии по Крыму", path: excursionsHubPath },
    { name: categoryName, path },
  ];
  const linkGroups = [
    {
      title: "Другие категории",
      links: directory.categories
        .filter((item) => item.slug !== category)
        .slice(0, 8)
        .map((item) => ({
          label: item.name,
          href: `/excursions/category/${item.slug}`,
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
