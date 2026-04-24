// API route: GET all excursions for admin list.
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { purgeExpiredDeletedExcursions } from "@/lib/admin-entity-lifecycle";
import { getAdminExcursionStatusLabel } from "@/lib/admin-status";
import { db } from "@/lib/db";
import { buildOffsetPagination, parsePagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  await purgeExpiredDeletedExcursions(db, new Date());
  const pagination = parsePagination({ request, defaultLimit: 25, maxLimit: 100 });

  const [items, total] = await Promise.all([
    db.excursion.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        owner: { select: { firstName: true, lastName: true, phone: true } },
        mainLocation: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    db.excursion.count({
      where: {
        deletedAt: null,
      },
    }),
  ]);

  return NextResponse.json({
    items: items.map((e) => ({
      id: e.id,
      title: e.title,
      offerType: e.offerType,
      status: e.status,
      statusLabel: getAdminExcursionStatusLabel(e.status),
      locationName: e.mainLocation?.name ?? e.locationName,
      categoryName: e.category?.name,
      priceFrom: e.priceFrom ? Number(e.priceFrom) : null,
      owner: `${e.owner.firstName} ${e.owner.lastName}`,
      isPublishedVisible: e.isPublishedVisible,
      deletedAt: e.deletedAt?.toISOString() ?? null,
      deletionExpiresAt: e.deletionExpiresAt?.toISOString() ?? null,
      updatedAt: e.updatedAt.toISOString(),
    })),
    pagination: buildOffsetPagination(pagination, items.length, total),
  });
}
