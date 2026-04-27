import type { Metadata } from "next";
import { AttractionCatalog } from "@/components/public/marketplace-catalogs";
import { getMarketplaceDirectoryData, getPublicAttractionCatalog } from "@/lib/public-marketplace";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type AttractionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Достопримечательности Крыма — Крым Вокруг",
  description:
    "Каталог достопримечательностей Крыма с поиском по названию, городу и расстоянию от выбранной локации.",
  alternates: {
    canonical: buildCanonicalPath("/attractions"),
  },
};

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

  const [result, directory] = await Promise.all([
    getPublicAttractionCatalog({
      query: pick(params.q) || pick(params.query),
      location: pick(params.location),
      category: pick(params.category),
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
      sort,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 30,
    }),
    getMarketplaceDirectoryData(),
  ]);

  return <AttractionCatalog result={result} categories={directory.attractionCategories} />;
}
