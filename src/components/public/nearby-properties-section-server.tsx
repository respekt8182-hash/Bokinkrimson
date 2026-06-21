import { unstable_cache } from "next/cache";
import { DEFAULT_NEARBY_RADIUS_KM, getNearbyProperties } from "@/lib/nearby-public";
import { NearbyPropertiesSection } from "@/components/public/nearby-properties-section";

type NearbyPropertiesSectionServerProps = {
  propertyId?: string | null;
  latitude: number | null;
  longitude: number | null;
  searchHref: string;
  radiusKm?: number;
  title?: string;
  description?: string;
  emptyDescription?: string;
  actionLabel?: string;
  layout?: "grid" | "carousel";
  className?: string;
  titleClassName?: string;
};

const getDailyNearbyProperties = unstable_cache(
  async (input: {
    latitude: number;
    longitude: number;
    propertyId?: string;
    radiusKm: number;
    pricingDate: string;
  }) =>
    getNearbyProperties({
      latitude: input.latitude,
      longitude: input.longitude,
      excludeId: input.propertyId,
      radiusKm: input.radiusKm,
      limit: 4,
      randomize: true,
      pricingDate: input.pricingDate,
    }),
  ["daily-nearby-properties"],
  { revalidate: 86_400 },
);

export async function NearbyPropertiesSectionServer({
  propertyId,
  latitude,
  longitude,
  searchHref,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
  title,
  description,
  emptyDescription,
  actionLabel,
  layout,
  className,
  titleClassName,
}: NearbyPropertiesSectionServerProps) {
  const pricingDate = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Europe/Moscow",
  });
  const items =
    latitude === null || longitude === null
      ? []
      : await getDailyNearbyProperties({
          latitude,
          longitude,
          propertyId: propertyId ?? undefined,
          radiusKm,
          pricingDate,
        });

  return (
    <NearbyPropertiesSection
      items={items}
      searchHref={searchHref}
      radiusKm={radiusKm}
      title={title}
      description={description}
      emptyDescription={emptyDescription}
      actionLabel={actionLabel}
      layout={layout}
      className={className}
      titleClassName={titleClassName}
    />
  );
}
