// Admin endpoint: copies room price periods for every active object from one year to another.
import { NextResponse } from "next/server";
import { z } from "zod";
import { CopyYearRoomPricesError, copyYearRoomPrices } from "@/lib/chessboard-year-copy";
import { getAdminSession } from "@/lib/admin-auth";

const adminCopyYearPricesSchema = z
  .object({
    sourceYear: z.number().int().min(2000).max(2100),
    targetYear: z.number().int().min(2000).max(2100),
    replaceExisting: z.boolean().optional().default(false),
  })
  .refine((data) => data.sourceYear !== data.targetYear, {
    message: "Source and target years must be different",
    path: ["targetYear"],
  });

function toAdminCopyYearResponse(error: CopyYearRoomPricesError, sourceYear: number) {
  if (error.code === "NO_ACTIVE_ROOMS") {
    return NextResponse.json(
      { error: "В системе нет активных номеров для переноса шахматки" },
      { status: 400 },
    );
  }

  if (error.code === "NO_SOURCE_PRICES") {
    return NextResponse.json(
      { error: `В ${sourceYear} году не найдены цены для переноса` },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error:
        "В целевом году уже есть цены. Включите замену существующих цен или выберите другой год.",
      conflictsCount: error.details.conflictsCount ?? 0,
      conflictPreview: error.details.conflictPreview ?? [],
    },
    { status: 409 },
  );
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = adminCopyYearPricesSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте годы для переноса шахматки" }, { status: 400 });
  }

  try {
    const result = await copyYearRoomPrices(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CopyYearRoomPricesError) {
      return toAdminCopyYearResponse(error, parsed.data.sourceYear);
    }

    throw error;
  }
}
