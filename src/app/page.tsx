import { Suspense } from "react";
import type { Metadata } from "next";
import { HomeSearchShowcase } from "@/components/home/home-search-showcase";
import { PopularPropertiesSectionServer } from "@/components/home/popular-properties-section.server";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { getHomeCityShowcaseItems } from "@/lib/home-cities";
import { getHomeStats } from "@/lib/home-stats";
import { getLocationDirectoryItems } from "@/lib/location-directory";

export const metadata: Metadata = {
  title: {
    absolute: "Жильё у моря и экскурсии по Крыму — Крым Вокруг",
  },
  description:
    "Крым Вокруг — маркетплейс жилья у моря и экскурсий по Крыму. Сервис берет оплату только за размещение объявления на платформе: без комиссии с каждого клиента или бронирования, поэтому владельцы и организаторы могут предлагать более честные цены.",
  alternates: {
    canonical: buildCanonicalPath("/"),
  },
  openGraph: {
    type: "website",
    title: "Жильё у моря и экскурсии по Крыму — Крым Вокруг",
    description:
      "Маркетплейс жилья у моря и экскурсий по Крыму без комиссии с каждого клиента или бронирования.",
    url: "/",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "Жильё у моря и экскурсии по Крыму — Крым Вокруг",
    description:
      "Маркетплейс жилья у моря и экскурсий по Крыму без комиссии с каждого клиента или бронирования.",
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
