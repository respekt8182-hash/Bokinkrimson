export type CatalogGeoPoint = {
  latitude: number;
  longitude: number;
};

export type CatalogSearchMatchKind = "primary" | "nearby";

export const NEARBY_CATALOG_RADIUS_KM = 20;

const EARTH_RADIUS_KM = 6371;
const DISTANCE_EPSILON_KM = 0.000001;

function isFinitePoint(point: CatalogGeoPoint | null): point is CatalogGeoPoint {
  return point !== null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

export function calculateDistanceKm(
  center: CatalogGeoPoint | null,
  point: CatalogGeoPoint | null,
): number | null {
  if (!isFinitePoint(center) || !isFinitePoint(point)) {
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(point.latitude - center.latitude);
  const dLng = toRadians(point.longitude - center.longitude);
  const lat1 = toRadians(center.latitude);
  const lat2 = toRadians(point.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function isWithinRadiusKm(distanceKm: number | null, radiusKm: number): boolean {
  return (
    distanceKm !== null &&
    Number.isFinite(distanceKm) &&
    Number.isFinite(radiusKm) &&
    distanceKm <= radiusKm + DISTANCE_EPSILON_KM
  );
}

export function roundDistanceKm(distanceKm: number | null): number | null {
  return distanceKm === null ? null : Number(distanceKm.toFixed(1));
}

export function parseNearbyCatalogRadiusKm(value: number | undefined): number {
  return Number.isFinite(value)
    ? Math.max(5, Math.min(NEARBY_CATALOG_RADIUS_KM, Math.round(value ?? NEARBY_CATALOG_RADIUS_KM)))
    : NEARBY_CATALOG_RADIUS_KM;
}
