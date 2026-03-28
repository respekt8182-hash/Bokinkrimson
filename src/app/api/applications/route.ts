// API route handler for /api/applications.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Функция заявок через сайт отключена.",
    },
    { status: 410 },
  );
}
