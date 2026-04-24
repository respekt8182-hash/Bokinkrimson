import { getPopularProperties } from "@/lib/popular-properties";

export async function PopularPropertiesSectionServer() {
  const { PopularPropertiesSection } = await import("@/components/home/popular-properties-section");
  const items = await getPopularProperties();

  if (items.length === 0) {
    return null;
  }

  return <PopularPropertiesSection items={items} />;
}
