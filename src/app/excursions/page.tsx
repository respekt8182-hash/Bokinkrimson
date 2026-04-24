import type { Metadata } from "next";
import SearchPage from "@/app/search/page";
import { buildSearchMetadata } from "@/lib/seo/search-metadata";

type ExcursionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ExcursionsPageProps): Promise<Metadata> {
  const params = await searchParams;

  return buildSearchMetadata({
    ...params,
    direction: "excursions",
  });
}

export default async function ExcursionsPage({ searchParams }: ExcursionsPageProps) {
  const params = await searchParams;

  return SearchPage({
    searchParams: Promise.resolve({
      ...params,
      direction: "excursions",
    }),
  });
}
