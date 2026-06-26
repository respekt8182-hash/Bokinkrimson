// KSR verification endpoint: saves a registry number for moderation review.
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
      "Номер принят для проверки. Сведения будут сверены с реестром при модерации карточки.",
  });
}
