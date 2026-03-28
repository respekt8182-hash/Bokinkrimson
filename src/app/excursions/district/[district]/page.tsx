// Next.js page for route /excursions/district/[district].
import type { Metadata } from "next";
import { PublicExcursionList } from "@/components/excursions/public-excursion-list";
import { getPublicExcursionCatalog } from "@/lib/public-excursions";

type ExcursionsByDistrictPageProps = {
  params: Promise<{ district: string }>;
};

export async function generateMetadata({
  params,
}: ExcursionsByDistrictPageProps): Promise<Metadata> {
  const { district } = await params;
  const result = await getPublicExcursionCatalog({
    districtId: district,
    pageSize: 1,
  });

  const districtName = result.filters.districtName;
  if (!districtName) {
    return {
      title: "Экскурсии по округу",
      robots: { index: false, follow: false },
    };
  }

  const title = `Экскурсии по ${districtName}`;
  const description = `Каталог экскурсий по направлению ${districtName} в Крыму.`;

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
    },
  };
}

export default async function ExcursionsByDistrictPage({
  params,
}: ExcursionsByDistrictPageProps) {
  const { district } = await params;
  const result = await getPublicExcursionCatalog({
    districtId: district,
    pageSize: 24,
  });

  const districtName = result.filters.districtName ?? "округу Крыма";

  return (
    <PublicExcursionList
      title={`Экскурсии по ${districtName}`}
      description={`Подборка экскурсий по направлению ${districtName}.`}
      result={result}
    />
  );
}
