import { Suspense } from "react";
import type { Metadata } from "next";
import { HomeSearchShowcase } from "@/components/home/home-search-showcase";
import { PopularPropertiesSectionServer } from "@/components/home/popular-properties-section.server";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { getHomeCityShowcaseItems } from "@/lib/home-cities";
import { getHomeStats } from "@/lib/home-stats";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Жильё, экскурсии, досуг и трансферы по Крыму — Крым Вокруг",
  },
  description:
    "Крым Вокруг — маркетплейс жилья у моря, экскурсий, досуга и трансферов по Крыму. До 20 июня 2026 включительно размещение бесплатно, без комиссии с каждого клиента или бронирования.",
  alternates: {
    canonical: buildCanonicalPath("/"),
  },
  openGraph: {
    type: "website",
    title: "Жильё, экскурсии, досуг и трансферы по Крыму — Крым Вокруг",
    description:
      "Маркетплейс жилья, экскурсий, досуга и трансферов по Крыму без комиссии с каждого клиента или бронирования.",
    url: "/",
    locale: "ru_RU",
    images: [defaultSocialImageMetadata],
  },
  twitter: {
    card: "summary_large_image",
    title: "Жильё, экскурсии, досуг и трансферы по Крыму — Крым Вокруг",
    description:
      "Маркетплейс жилья, экскурсий, досуга и трансферов по Крыму без комиссии с каждого клиента или бронирования.",
    images: [defaultSocialImageMetadata.url],
  },
};

export default async function HomePage() {
  const [cities, locationDirectory, homeStats] = await Promise.all([
    getHomeCityShowcaseItems(),
    getLocationDirectoryItems(),
    getHomeStats(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <HomeSearchShowcase
        cities={cities}
        locationSuggestions={locationDirectory.map((item) => item.name)}
        publishedPropertiesCount={homeStats.publishedPropertiesCount}
        publishedExcursionsCount={homeStats.publishedExcursionsCount}
      />

      <Suspense fallback={null}>
        <PopularPropertiesSectionServer />
      </Suspense>
    </div>
  );
}
