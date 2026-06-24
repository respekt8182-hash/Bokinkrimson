// API route handler for /api/public/properties/[identifier]/applications.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Запросы владельцу через сайт временно отключены. Свяжитесь с владельцем напрямую по контактам в карточке. Это не является подтверждением бронирования.",
    },
    { status: 410 },
  );
}
