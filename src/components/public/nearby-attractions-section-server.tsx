import { NearbyAttractionsSection } from "@/components/public/nearby-attractions-section";
import { DEFAULT_NEARBY_RADIUS_KM, getNearbyAttractions } from "@/lib/nearby-public";

type NearbyAttractionsSectionServerProps = {
  attractionId?: string | null;
  latitude: number | null;
  longitude: number | null;
  searchHref: string;
  radiusKm?: number;
  limit?: number;
  title?: string;
  description?: string;
  emptyDescription?: string;
  actionLabel?: string;
  layout?: "grid" | "carousel";
  className?: string;
  titleClassName?: string;
};

export async function NearbyAttractionsSectionServer({
  attractionId,
  latitude,
  longitude,
  searchHref,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
  limit = 4,
  title,
  description,
  emptyDescription,
  actionLabel,
  layout,
  className,
  titleClassName,
}: NearbyAttractionsSectionServerProps) {
  const items = await getNearbyAttractions({
    latitude,
    longitude,
    excludeId: attractionId ?? undefined,
    radiusKm,
    limit,
  });

  return (
    <NearbyAttractionsSection
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
