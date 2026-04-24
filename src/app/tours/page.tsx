import type { Metadata } from "next";
import SearchPage from "@/app/search/page";
import { buildSearchMetadata } from "@/lib/seo/search-metadata";

type ToursPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ToursPageProps): Promise<Metadata> {
  const params = await searchParams;

  return buildSearchMetadata({
    ...params,
    direction: "tours",
  });
}

export default async function ToursPage({ searchParams }: ToursPageProps) {
  const params = await searchParams;

  return SearchPage({
    searchParams: Promise.resolve({
      ...params,
      direction: "tours",
    }),
  });
}
