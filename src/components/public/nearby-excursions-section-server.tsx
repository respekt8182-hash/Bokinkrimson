import { DEFAULT_NEARBY_RADIUS_KM, getNearbyExcursions } from "@/lib/nearby-public";
import { NearbyExcursionsSection } from "@/components/public/nearby-excursions-section";

type NearbyExcursionsSectionServerProps = {
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

export async function NearbyExcursionsSectionServer({
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
}: NearbyExcursionsSectionServerProps) {
  const items = await getNearbyExcursions({
    latitude,
    longitude,
    radiusKm,
    limit: 4,
  });

  return (
    <NearbyExcursionsSection
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
