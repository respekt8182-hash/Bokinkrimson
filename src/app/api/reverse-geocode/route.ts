// API route handler for /api/reverse-geocode.
import { NextResponse } from "next/server";
import { getEditorSession } from "@/lib/editor-access";
import { resolveLocationDirectoryItemFromText } from "@/lib/location-directory";
import { isCoordinateInCrimea } from "@/lib/properties";
import { reverseGeocode } from "@/lib/yandex-geocoder";

export async function GET(request: Request) {
  const session = await getEditorSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lng"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Координаты должны быть числами" }, { status: 400 });
  }

  if (!isCoordinateInCrimea(latitude, longitude)) {
    return NextResponse.json(
      { error: "Координаты должны находиться в пределах Крыма" },
      { status: 400 },
    );
  }

  const result = await reverseGeocode(latitude, longitude);

  if (!result) {
    return NextResponse.json(
      { error: "Не удалось определить адрес по координатам. Проверьте API-ключ геокодера." },
      { status: 422 },
    );
  }

  const preciseLocation = await resolveLocationDirectoryItemFromText(
    result.address,
    result.localityDisplayName ?? result.localityName,
  ).catch(() => null);

  return NextResponse.json({
    item: preciseLocation
      ? {
          ...result,
          localityName: preciseLocation.name,
          localityDisplayName: preciseLocation.name,
        }
      : result,
  });
}
