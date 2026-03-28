// Landing page entry: preloads home city cards and location suggestions for the unified search showcase.
import { HomeSearchShowcase } from "@/components/home/home-search-showcase";
import { getHomeCityShowcaseItems } from "@/lib/home-cities";
import { getLocationDirectoryItems } from "@/lib/location-directory";

export default async function HomePage() {
  const [cities, locationDirectory] = await Promise.all([
    getHomeCityShowcaseItems(),
    getLocationDirectoryItems(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <HomeSearchShowcase
        cities={cities}
        locationSuggestions={locationDirectory.map((item) => item.name)}
      />
    </div>
  );
}
