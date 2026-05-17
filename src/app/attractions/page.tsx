import type { Metadata } from "next";
import { AttractionCatalog } from "@/components/public/marketplace-catalogs";
import {
  getAttractionMarketplaceDirectoryData,
  getPublicAttractionCatalog,
} from "@/lib/public-marketplace";
import { parseBoundsParam } from "@/lib/search-contracts";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type AttractionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Досуг и достопримечательности Крыма",
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
  const boundsParam = pick(params.bounds);
  const bounds = parseBoundsParam(boundsParam);
  const radiusKm = Number.parseFloat(pick(params.radiusKm) || "20");
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

  const [result, directory] = await Promise.all([
    getPublicAttractionCatalog({
      ...catalogQuery,
      bounds,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 30,
    }),
    getAttractionMarketplaceDirectoryData(),
  ]);

  return (
    <AttractionCatalog
      result={result}
      categories={directory.attractionCategories}
      locationSuggestions={directory.attractionLocationSuggestions}
      activeBounds={boundsParam || null}
      catalogActiveTotal={directory.attractionTotal}
    />
  );
}
