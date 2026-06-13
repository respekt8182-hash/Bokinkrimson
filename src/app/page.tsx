import { Suspense } from "react";
import type { Metadata } from "next";
import {
  HomeSearchShowcase,
  type HomeHeroAttractionCard,
} from "@/components/home/home-search-showcase";
import { PopularPropertiesSectionServer } from "@/components/home/popular-properties-section.server";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { getHomeCityShowcaseItems } from "@/lib/home-cities";
import { getHomeStats } from "@/lib/home-stats";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";
import { getStaticAttractions } from "@/lib/static-attractions";

export const revalidate = 600;

export const metadata: Metadata = {
  title: {
    absolute: "Жильё, экскурсии, досуг и трансферы по Крыму — Крым Вокруг",
  },
  description:
    "Крым Вокруг — маркетплейс жилья у моря, экскурсий, досуга и трансферов по Крыму. Идёт набор в ранний доступ: размещение бесплатно до 1 мая 2027, без комиссии с каждого клиента или бронирования.",
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

async function getDailyHeroAttractionCards(): Promise<HomeHeroAttractionCard[]> {
  const attractions = await getStaticAttractions();
  const candidates = attractions
    .map((attraction) => {
      const image = attraction.gallery.find(
        (item) => item.url.trim().length > 0 && !item.url.includes("zaglushka"),
      );

      if (!image) {
        return null;
      }

      return {
        title: attraction.title,
        imageSrc: image.url,
        href: `/attractions/${attraction.slug}`,
        locationName: attraction.locationName,
      };
    })
    .filter((item): item is HomeHeroAttractionCard => Boolean(item));

  if (candidates.length <= 4) {
    return candidates;
  }

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const step = 7;
  return Array.from({ length: 4 }, (_, index) => {
    const candidateIndex = (dayIndex + index * step) % candidates.length;
    return candidates[candidateIndex];
  });
}

export default async function HomePage() {
  const [cities, locationDirectory, homeStats, heroAttractionCards] = await Promise.all([
    getHomeCityShowcaseItems(),
    getLocationDirectoryItems(),
    getHomeStats(),
    getDailyHeroAttractionCards(),
  ]);

  return (
    <div className="home-page-bg">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-0 md:px-6 md:pb-10 md:pt-0">
        <HomeSearchShowcase
          cities={cities}
          locationSuggestions={locationDirectory.map((item) => item.name)}
          publishedPropertiesCount={homeStats.publishedPropertiesCount}
          publishedExcursionsCount={homeStats.publishedExcursionsCount}
          publishedTransfersCount={homeStats.publishedTransfersCount}
          publishedAttractionsCount={homeStats.publishedAttractionsCount}
          heroAttractionCards={heroAttractionCards}
        />

        <Suspense fallback={null}>
          <PopularPropertiesSectionServer />
        </Suspense>
      </div>
    </div>
  );
}
