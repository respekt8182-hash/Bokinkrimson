// Bulk room price copy endpoint: copies all active room prices from one calendar year to another.
import { NextResponse } from "next/server";
import { z } from "zod";
import { CopyYearRoomPricesError, copyYearRoomPrices } from "@/lib/chessboard-year-copy";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const copyYearPricesSchema = z
  .object({
    sourceYear: z.number().int().min(2000).max(2100),
    targetYear: z.number().int().min(2000).max(2100),
    replaceExisting: z.boolean().optional().default(false),
  })
  .refine((data) => data.sourceYear !== data.targetYear, {
    message: "Source and target years must be different",
    path: ["targetYear"],
  });

async function getAccessibleProperty(
  propertyId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  return db.property.findFirst({
    where: {
      id: propertyId,
      ownerDeletedAt: null,
      ...(editor?.isAdmin ? {} : { ownerId: editor?.id }),
    },
    select: { id: true },
  });
}

function toCopyYearPriceResponse(error: CopyYearRoomPricesError, sourceYear: number) {
  if (error.code === "NO_ACTIVE_ROOMS") {
    return NextResponse.json({ error: "В объекте нет активных номеров" }, { status: 400 });
  }

  if (error.code === "NO_SOURCE_PRICES") {
    return NextResponse.json(
      { error: `В ${sourceYear} году нет цен для переноса` },
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

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await getAccessibleProperty(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = copyYearPricesSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте годы для переноса цен" }, { status: 400 });
  }

  try {
    const result = await copyYearRoomPrices({
      ...parsed.data,
      propertyId: property.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CopyYearRoomPricesError) {
      return toCopyYearPriceResponse(error, parsed.data.sourceYear);
    }

    throw error;
  }
}
