// API route handler for /api/public/properties/[identifier]/applications.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Заявки на объекты через сайт отключены. Свяжитесь с владельцем напрямую по контактам в карточке.",
    },
    { status: 410 },
  );
}
