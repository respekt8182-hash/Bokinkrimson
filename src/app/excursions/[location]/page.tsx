// Next.js page for route /excursions/[location].
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicExcursionList } from "@/components/excursions/public-excursion-list";
import {
  getPublicExcursionCatalog,
  getResolvedExcursionLocationBySlug,
} from "@/lib/public-excursions";

type ExcursionsByLocationPageProps = {
  params: Promise<{ location: string }>;
};

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

  const title = `Экскурсии в ${resolvedLocation.name}`;
  const description = `Подборка экскурсий в районе ${resolvedLocation.name} и рядом по Крыму.`;

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
    },
  };
}

export default async function ExcursionsByLocationPage({
  params,
}: ExcursionsByLocationPageProps) {
  const { location } = await params;
  const resolvedLocation = await getResolvedExcursionLocationBySlug(location);

  if (!resolvedLocation) {
    notFound();
  }

  const result = await getPublicExcursionCatalog({
    locationId: resolvedLocation.slug,
    radiusKm: 35,
    pageSize: 24,
  });

  return (
    <PublicExcursionList
      title={`Экскурсии в ${resolvedLocation.name}`}
      description={`Маршруты с якорем на ${resolvedLocation.name} и экскурсии в радиусе 35 км.`}
      result={result}
    />
  );
}
