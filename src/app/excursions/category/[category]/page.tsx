// Next.js page for route /excursions/category/[category].
import type { Metadata } from "next";
import { PublicExcursionList } from "@/components/excursions/public-excursion-list";
import { getPublicExcursionCatalog } from "@/lib/public-excursions";

type ExcursionsByCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({
  params,
}: ExcursionsByCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const result = await getPublicExcursionCatalog({
    categoryId: category,
    pageSize: 1,
  });

  const categoryName = result.filters.categoryName;
  if (!categoryName) {
    return {
      title: "Экскурсии по категории",
      robots: { index: false, follow: false },
    };
  }

  const title = `${categoryName} в Крыму`;
  const description = `Экскурсии категории «${categoryName}» в Крыму: подборка маршрутов и активностей.`;

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
    },
  };
}

export default async function ExcursionsByCategoryPage({
  params,
}: ExcursionsByCategoryPageProps) {
  const { category } = await params;
  const result = await getPublicExcursionCatalog({
    categoryId: category,
    pageSize: 24,
  });

  const categoryName = result.filters.categoryName ?? "категории";

  return (
    <PublicExcursionList
      title={`Экскурсии: ${categoryName}`}
      description={`Подборка экскурсий категории «${categoryName}» по Крыму.`}
      result={result}
    />
  );
}
