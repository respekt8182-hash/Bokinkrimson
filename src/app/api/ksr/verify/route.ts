// KSR verification endpoint: currently returns manual-review response when automatic registry lookup is unavailable.
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const number = (searchParams.get("number") ?? "").trim();

  if (!number) {
    return NextResponse.json(
      { message: "Введите номер записи в реестре для проверки." },
      { status: 400 },
    );
  }

  if (number.length < 3) {
    return NextResponse.json(
      { message: "Номер записи в реестре слишком короткий для проверки." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    verified: false,
    source: "manual_review",
    message:
      "Автоматическая проверка на tourism.fsa.gov.ru сейчас недоступна. Номер сохранен и будет проверен администратором при модерации.",
  });
}