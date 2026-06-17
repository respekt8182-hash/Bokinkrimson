import { Prisma, TransferStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { deleteManagedUrlFromStorage } from "@/lib/storage";
import { getTransferFleet, getTransferPhotoUrlsFromFleet } from "@/lib/transfers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_BOOL_FIELDS = ["isPublishedVisible"] as const;

function collectTransferPhotoUrls(transfer: {
  fleet: unknown;
  photoUrls: string[];
  vehicleClass: string | null;
  vehicleModel: string | null;
  seats: number | null;
  luggage: number | null;
  priceFrom: number | string | { toString(): string } | null;
  priceUnitLabel: string | null;
}): string[] {
  const urls = [
    ...transfer.photoUrls,
    ...getTransferPhotoUrlsFromFleet(getTransferFleet(transfer)),
  ];

  return Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)));
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  for (const field of ALLOWED_BOOL_FIELDS) {
    if (field in payload) {
      data[field] = Boolean(payload[field]);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const existing = await db.transfer.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Трансфер не найден" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.transfer.update({
      where: { id },
      data: data as Prisma.TransferUpdateInput,
      select: {
        id: true,
        title: true,
        status: true,
        isPublishedVisible: true,
        updatedAt: true,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_edit",
        targetType: "transfer",
        targetId: id,
        details: { fields: Object.keys(data), title: existing.title },
      },
    });

    return item;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      isPublishedVisible: updated.isPublishedVisible,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await db.transfer.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      photoUrls: true,
      fleet: true,
      vehicleClass: true,
      vehicleModel: true,
      seats: true,
      luggage: true,
      priceFrom: true,
      priceUnitLabel: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Трансфер не найден" }, { status: 404 });
  }

  if (existing.status !== TransferStatus.DRAFT) {
    return NextResponse.json(
      { error: "Принудительно удалить можно только черновик трансфера." },
      { status: 409 },
    );
  }

  const urls = collectTransferPhotoUrls(existing);

  await db.$transaction(async (tx) => {
    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_delete",
        targetType: "transfer",
        targetId: id,
        details: { title: existing.title },
      },
    });

    await tx.viewLog.deleteMany({
      where: { entityType: "transfer", entityId: existing.id },
    });

    await tx.transfer.delete({ where: { id: existing.id } });
  });

  if (urls.length > 0) {
    await Promise.all(urls.map((url) => deleteManagedUrlFromStorage(url).catch(() => null)));
  }

  return NextResponse.json({ ok: true, mode: "hard" });
}
