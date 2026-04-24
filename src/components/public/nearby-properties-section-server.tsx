import { DEFAULT_NEARBY_RADIUS_KM, getNearbyProperties } from "@/lib/nearby-public";
import { NearbyPropertiesSection } from "@/components/public/nearby-properties-section";

type NearbyPropertiesSectionServerProps = {
  propertyId?: string | null;
  latitude: number | null;
  longitude: number | null;
  searchHref: string;
  radiusKm?: number;
};

export async function NearbyPropertiesSectionServer({
  propertyId,
  latitude,
  longitude,
  searchHref,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
}: NearbyPropertiesSectionServerProps) {
  const items = await getNearbyProperties({
    latitude,
    longitude,
    excludeId: propertyId ?? undefined,
    radiusKm,
    limit: 4,
    randomize: true,
  });

  return <NearbyPropertiesSection items={items} searchHref={searchHref} radiusKm={radiusKm} />;
}
