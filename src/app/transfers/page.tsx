import type { Metadata } from "next";
import { TransferCatalog } from "@/components/public/marketplace-catalogs";
import { getMarketplaceDirectoryData, getPublicTransferCatalog } from "@/lib/public-marketplace";
import { parseBoundsParam } from "@/lib/search-contracts";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type TransfersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Трансферы по Крыму",
  description: "Каталог трансферов по Крыму: водители, автомобили, маршруты, цены и контакты.",
  alternates: {
    canonical: buildCanonicalPath("/transfers"),
  },
};

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const params = await searchParams;
  const boundsParam = pick(params.bounds);
  const bounds = parseBoundsParam(boundsParam);
  const radiusKm = Number.parseFloat(pick(params.radiusKm) || "20");
  const minPrice = Number.parseFloat(pick(params.minPrice));
  const maxPrice = Number.parseFloat(pick(params.maxPrice));
  const page = Number.parseInt(pick(params.page) || "1", 10);
  const sortRaw = pick(params.sort);
  const sort =
    sortRaw === "distance_asc" ||
    sortRaw === "price_asc" ||
    sortRaw === "price_desc" ||
    sortRaw === "rating_desc" ||
    sortRaw === "popular_desc" ||
    sortRaw === "newest"
      ? sortRaw
      : "relevance";

  const catalogQuery = {
    query: pick(params.q) || pick(params.query),
    location: pick(params.location),
    transferType: pick(params.transferType),
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    sort,
  } as const;

  const [result, mapResult, directory] = await Promise.all([
    getPublicTransferCatalog({
      ...catalogQuery,
      bounds,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 30,
    }),
    getPublicTransferCatalog({
      ...catalogQuery,
      page: 1,
      pageSize: 5000,
      allowLargePageSize: true,
    }),
    getMarketplaceDirectoryData(),
  ]);

  return (
    <TransferCatalog
      result={result}
      mapItems={mapResult.items}
      transferTypes={directory.transferTypes}
      locationSuggestions={directory.transferLocationSuggestions}
      activeBounds={boundsParam || null}
      catalogActiveTotal={directory.transferTotal}
    />
  );
}
