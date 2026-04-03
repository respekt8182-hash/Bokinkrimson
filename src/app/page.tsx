// Landing page entry: preloads home city cards and location suggestions for the unified search showcase.
import { HomeSearchShowcase } from "@/components/home/home-search-showcase";
import { PopularPropertiesSection } from "@/components/home/popular-properties-section";
import { getHomeCityShowcaseItems } from "@/lib/home-cities";
import { getHomeStats } from "@/lib/home-stats";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getPopularProperties } from "@/lib/popular-properties";

export default async function HomePage() {
  const [cities, locationDirectory, homeStats, popularProperties] =
    await Promise.all([
      getHomeCityShowcaseItems(),
      getLocationDirectoryItems(),
      getHomeStats(),
      getPopularProperties(),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <HomeSearchShowcase
        cities={cities}
        locationSuggestions={locationDirectory.map((item) => item.name)}
        publishedPropertiesCount={homeStats.publishedPropertiesCount}
        publishedExcursionsCount={homeStats.publishedExcursionsCount}
      />
      <PopularPropertiesSection items={popularProperties} />
    </div>
  );
}
