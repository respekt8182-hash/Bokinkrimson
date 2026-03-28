// API route handler for /api/excursions/[id]/schedule-rules.
import { ExcursionScheduleMode, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertExcursionScheduleRulesSchema } from "@/lib/schemas";

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

function toDateOnly(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
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

  const [rules, exceptions] = await Promise.all([
    db.excursionScheduleRule.findMany({
      where: { excursionId: id },
      orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
    }),
    db.excursionScheduleException.findMany({
      where: { excursionId: id },
      orderBy: [{ date: "asc" }],
    }),
  ]);

  return NextResponse.json({
    rules: rules.map((item) => ({
      id: item.id,
      dateFrom: item.dateFrom ? item.dateFrom.toISOString().slice(0, 10) : null,
      dateTo: item.dateTo ? item.dateTo.toISOString().slice(0, 10) : null,
      weekdays: item.weekdays,
      timeStarts: item.timeStarts,
      durationMinutes: item.durationMinutes,
      capacityDefault: item.capacityDefault,
      priceOverride: item.priceOverride === null ? null : Number(item.priceOverride),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    exceptions: exceptions.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      isClosed: item.isClosed,
      overrideTimeStarts: item.overrideTimeStarts,
      overrideCapacity: item.overrideCapacity,
      overridePrice: item.overridePrice === null ? null : Number(item.overridePrice),
      notes: item.notes,
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

  const parsed = upsertExcursionScheduleRulesSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность правил расписания" }, { status: 400 });
  }

  const rules = parsed.data.rules.map((item) => ({
    excursionId: id,
    dateFrom: toDateOnly(item.dateFrom),
    dateTo: toDateOnly(item.dateTo),
    weekdays: item.weekdays,
    timeStarts: item.timeStarts,
    durationMinutes: item.durationMinutes ?? null,
    capacityDefault: item.capacityDefault ?? null,
    priceOverride:
      item.priceOverride === undefined || item.priceOverride === null
        ? null
        : new Prisma.Decimal(item.priceOverride),
  }));

  const exceptions = (parsed.data.exceptions ?? []).map((item) => ({
    excursionId: id,
    date: new Date(`${item.date}T00:00:00.000Z`),
    isClosed: item.isClosed ?? false,
    overrideTimeStarts: item.overrideTimeStarts ?? [],
    overrideCapacity: item.overrideCapacity ?? null,
    overridePrice:
      item.overridePrice === undefined || item.overridePrice === null
        ? null
        : new Prisma.Decimal(item.overridePrice),
    notes: item.notes ?? null,
  }));

  await db.$transaction(async (tx) => {
    await tx.excursionScheduleRule.deleteMany({
      where: { excursionId: id },
    });
    await tx.excursionScheduleException.deleteMany({
      where: { excursionId: id },
    });

    if (rules.length > 0) {
      await tx.excursionScheduleRule.createMany({
        data: rules.map((item) => ({
          excursionId: item.excursionId,
          dateFrom: item.dateFrom,
          dateTo: item.dateTo,
          weekdays: item.weekdays,
          timeStarts: item.timeStarts,
          durationMinutes: item.durationMinutes,
          capacityDefault: item.capacityDefault,
          priceOverride: item.priceOverride,
        })),
      });
    }

    if (exceptions.length > 0) {
      await tx.excursionScheduleException.createMany({
        data: exceptions.map((item) => ({
          excursionId: item.excursionId,
          date: item.date,
          isClosed: item.isClosed,
          overrideTimeStarts: item.overrideTimeStarts,
          overrideCapacity: item.overrideCapacity,
          overridePrice: item.overridePrice,
          notes: item.notes,
        })),
      });
    }

    await tx.excursion.update({
      where: { id },
      data: {
        scheduleMode:
          parsed.data.scheduleMode ??
          (rules.length > 0 ? ExcursionScheduleMode.RULES : ExcursionScheduleMode.TEXT),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
