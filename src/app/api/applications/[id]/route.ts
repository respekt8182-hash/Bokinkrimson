// API route handler for /api/applications/[id].
import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Функция заявок через сайт отключена.",
    },
    { status: 410 },
  );
}
