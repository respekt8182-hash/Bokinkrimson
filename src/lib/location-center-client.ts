export type LocationCenterItem = {
  name: string;
  latitude: number;
  longitude: number;
  zoom?: number | null;
};

export async function fetchLocationCenter(
  location: string,
  signal?: AbortSignal,
): Promise<LocationCenterItem | null> {
  const normalizedLocation = location.trim();
  if (!normalizedLocation) {
    return null;
  }

  const response = await fetch(
    `/api/location-center?location=${encodeURIComponent(normalizedLocation)}`,
    {
      signal,
    },
  );

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { item?: LocationCenterItem | null };
  if (
    !body.item ||
    !Number.isFinite(body.item.latitude) ||
    !Number.isFinite(body.item.longitude)
  ) {
    return null;
  }

  return body.item;
}
