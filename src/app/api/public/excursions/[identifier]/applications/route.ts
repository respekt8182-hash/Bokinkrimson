// API route handler for /api/public/excursions/[identifier]/applications.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Заявки на экскурсии через сайт отключены. Свяжитесь с организатором напрямую по контактам в карточке.",
    },
    { status: 410 },
  );
}
