import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SearchPage from "@/app/search/page";
import { getLocationDirectoryItems, normalizeLocationName } from "@/lib/location-directory";
import { getPublicCatalog } from "@/lib/public-properties";
import { buildSearchMetadata } from "@/lib/seo/search-metadata";

type HousingLocationPageProps = {
  params: Promise<{ location: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveHousingLocation(locationParam: string) {
  const directory = await getLocationDirectoryItems();

  return (
    directory.find(
      (item) =>
        item.id === locationParam ||
        normalizeLocationName(item.name) === normalizeLocationName(locationParam),
    ) ?? null
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: HousingLocationPageProps): Promise<Metadata> {
  const { location } = await params;
  const resolvedLocation = await resolveHousingLocation(location);

  if (!resolvedLocation) {
    notFound();
  }

  const query = await searchParams;

  return buildSearchMetadata({
    ...query,
    direction: "housing",
    location: resolvedLocation.name,
  });
}

export default async function HousingLocationPage({
  params,
  searchParams,
}: HousingLocationPageProps) {
  const { location } = await params;
  const resolvedLocation = await resolveHousingLocation(location);

  if (!resolvedLocation) {
    notFound();
  }

  const preview = await getPublicCatalog({
    location: resolvedLocation.name,
    pageSize: 1,
    trackSearchImpressions: false,
  });

  if (preview.total === 0) {
    notFound();
  }

  const query = await searchParams;

  return SearchPage({
    searchParams: Promise.resolve({
      ...query,
      direction: "housing",
      location: resolvedLocation.name,
    }),
  });
}
