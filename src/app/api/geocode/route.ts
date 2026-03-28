// API route handler for /api/geocode.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isCoordinateInCrimea } from "@/lib/properties";
import { geocodeAddress } from "@/lib/yandex-geocoder";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";

  if (address.length < 5) {
    return NextResponse.json({ error: "Введите адрес длиной минимум 5 символов" }, { status: 400 });
  }

  const result = await geocodeAddress(address);

  if (!result) {
    return NextResponse.json(
      { error: "Не удалось получить координаты. Проверьте API-ключ геокодера и адрес." },
      { status: 422 },
    );
  }

  if (!isCoordinateInCrimea(result.latitude, result.longitude)) {
    return NextResponse.json(
      { error: "Адрес должен находиться в пределах Крыма" },
      { status: 400 },
    );
  }

  return NextResponse.json({ item: result });
}
