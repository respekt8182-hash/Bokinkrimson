import { Suspense } from "react";
import type { Metadata } from "next";
import {
  HomeSearchShowcase,
  type HomeHeroAttractionCard,
} from "@/components/home/home-search-showcase";
import { HomeGuideSections } from "@/components/home/home-guide-sections";
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
    absolute: "Крым Вокруг — достопримечательности, маршруты и жильё в Крыму",
  },
  description:
    "Бесплатный путеводитель по достопримечательностям Крыма: города, история, маршруты, необычные места, музеи, природа, а также жильё, экскурсии, туры и трансферы для планирования поездки.",
  alternates: {
    canonical: buildCanonicalPath("/"),
  },
  openGraph: {
    type: "website",
    title: "Крым Вокруг — достопримечательности, маршруты и жильё в Крыму",
    description:
      "Бесплатный путеводитель по достопримечательностям, городам, истории, маршрутам и необычным местам Крыма.",
    url: "/",
    locale: "ru_RU",
    images: [defaultSocialImageMetadata],
  },
  twitter: {
    card: "summary_large_image",
    title: "Крым Вокруг — достопримечательности, маршруты и жильё в Крыму",
    description:
      "Бесплатный путеводитель по достопримечательностям, городам, истории, маршрутам и необычным местам Крыма.",
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
  const [cities, locationDirectory, homeStats, heroAttractionCards, attractions] =
    await Promise.all([
      getHomeCityShowcaseItems(),
      getLocationDirectoryItems(),
      getHomeStats(),
      getDailyHeroAttractionCards(),
      getStaticAttractions(),
    ]);

  return (
    <div className="home-page-bg">
      <div className="mx-auto w-full max-w-6xl px-3 pb-7 pt-0 min-[390px]:px-4 md:px-6 md:pb-10 md:pt-0">
        <HomeSearchShowcase
          cities={cities}
          locationSuggestions={locationDirectory.map((item) => item.name)}
          publishedPropertiesCount={homeStats.publishedPropertiesCount}
          publishedExcursionsCount={homeStats.publishedExcursionsCount}
          publishedToursCount={homeStats.publishedToursCount}
          publishedTransfersCount={homeStats.publishedTransfersCount}
          publishedAttractionsCount={homeStats.publishedAttractionsCount}
          heroAttractionCards={heroAttractionCards}
        />

        <Suspense fallback={null}>
          <HomeGuideSections cities={cities} attractions={attractions} />
        </Suspense>

        <Suspense fallback={null}>
          <PopularPropertiesSectionServer />
        </Suspense>
      </div>
    </div>
  );
}
