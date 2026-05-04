import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteManagedUrlFromStorage } from "@/lib/storage";
import { getTransferFleet, getTransferPhotoUrlsFromFleet } from "@/lib/transfers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DeleteTransferPayload = {
  acknowledged?: boolean;
};

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

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: DeleteTransferPayload | null = null;

  try {
    payload = (await request.json()) as DeleteTransferPayload;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!payload?.acknowledged) {
    return NextResponse.json({ error: "Подтвердите удаление карточки трансфера" }, { status: 400 });
  }

  const { id } = await context.params;
  const existing = await db.transfer.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
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

  if (!existing || existing.ownerId !== session.id) {
    return NextResponse.json({ error: "Трансфер не найден" }, { status: 404 });
  }

  const urls = collectTransferPhotoUrls(existing);

  await db.$transaction([
    db.viewLog.deleteMany({
      where: { entityType: "transfer", entityId: existing.id },
    }),
    db.transfer.delete({
      where: { id: existing.id },
    }),
  ]);

  if (urls.length > 0) {
    await Promise.all(urls.map((url) => deleteManagedUrlFromStorage(url).catch(() => null)));
  }

  return NextResponse.json({ message: "Трансфер удален" });
}
