import type { Metadata } from "next";
import SearchPage from "@/app/search/page";
import { buildSearchMetadata } from "@/lib/seo/search-metadata";

type RentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: RentPageProps): Promise<Metadata> {
  const params = await searchParams;

  return buildSearchMetadata({
    ...params,
    direction: "housing",
  });
}

export default async function RentPage({ searchParams }: RentPageProps) {
  const params = await searchParams;

  return SearchPage({
    searchParams: Promise.resolve({
      ...params,
      direction: "housing",
    }),
  });
}
