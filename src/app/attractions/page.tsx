import type { Metadata } from "next";
import { AttractionCatalog } from "@/components/public/marketplace-catalogs";
import { getMarketplaceDirectoryData, getPublicAttractionCatalog } from "@/lib/public-marketplace";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type AttractionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Досуг и достопримечательности Крыма - Крым Вокруг",
  description:
    "Статический каталог достопримечательностей Крыма: дворцы, парки, смотровые точки, маршруты, фото, карта и практическая информация.",
  alternates: {
    canonical: buildCanonicalPath("/attractions"),
  },
};

export const dynamic = "force-dynamic";

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AttractionsPage({ searchParams }: AttractionsPageProps) {
  const params = await searchParams;
  const radiusKm = Number.parseFloat(pick(params.radiusKm) || "30");
  const page = Number.parseInt(pick(params.page) || "1", 10);
  const sortRaw = pick(params.sort);
  const sort =
    sortRaw === "distance_asc" || sortRaw === "newest" || sortRaw === "name_asc"
      ? sortRaw
      : "relevance";

  const catalogQuery = {
    query: pick(params.q) || pick(params.query),
    location: pick(params.location),
    category: pick(params.category),
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    sort,
  } as const;

  const [result, mapResult, directory] = await Promise.all([
    getPublicAttractionCatalog({
      ...catalogQuery,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 30,
    }),
    getPublicAttractionCatalog({
      ...catalogQuery,
      page: 1,
      pageSize: 5000,
      allowLargePageSize: true,
    }),
    getMarketplaceDirectoryData(),
  ]);

  return (
    <AttractionCatalog
      result={result}
      mapItems={mapResult.items}
      categories={directory.attractionCategories}
      locationSuggestions={directory.attractionLocationSuggestions}
    />
  );
}
