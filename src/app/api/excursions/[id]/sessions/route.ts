// API route handler for /api/excursions/[id]/sessions.
import { ExcursionScheduleMode, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertExcursionSessionsSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureOwner(excursionId: string, ownerId: string) {
  const row = await db.excursion.findUnique({
    where: { id: excursionId },
    select: { id: true, ownerId: true },
  });

  if (!row || row.ownerId !== ownerId) {
    return null;
  }

  return row;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await ensureOwner(id, session.id);
  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const items = await db.excursionSession.findMany({
    where: { excursionId: id },
    orderBy: [{ startAt: "asc" }],
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt ? item.endAt.toISOString() : null,
      capacity: item.capacity,
      priceOverride: item.priceOverride === null ? null : Number(item.priceOverride),
      status: item.status,
      bookingDeadlineMinutes: item.bookingDeadlineMinutes,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await ensureOwner(id, session.id);
  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = upsertExcursionSessionsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность сеансов" }, { status: 400 });
  }

  const sessions = parsed.data.sessions.map((item) => ({
    excursionId: id,
    startAt: new Date(item.startAt),
    endAt: item.endAt ? new Date(item.endAt) : null,
    capacity: item.capacity ?? null,
    priceOverride:
      item.priceOverride === undefined || item.priceOverride === null
        ? null
        : new Prisma.Decimal(item.priceOverride),
    status: item.status ?? undefined,
    bookingDeadlineMinutes: item.bookingDeadlineMinutes ?? null,
  }));

  await db.$transaction(async (tx) => {
    await tx.excursionSession.deleteMany({
      where: { excursionId: id },
    });

    if (sessions.length > 0) {
      await tx.excursionSession.createMany({
        data: sessions.map((item) => ({
          excursionId: item.excursionId,
          startAt: item.startAt,
          endAt: item.endAt,
          capacity: item.capacity,
          priceOverride: item.priceOverride,
          status: item.status,
          bookingDeadlineMinutes: item.bookingDeadlineMinutes,
        })),
      });
    }

    await tx.excursion.update({
      where: { id },
      data: {
        scheduleMode: sessions.length > 0 ? ExcursionScheduleMode.SESSIONS : undefined,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
