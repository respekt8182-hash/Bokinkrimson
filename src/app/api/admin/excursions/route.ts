// API route: GET all excursions for admin list.
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const items = await db.excursion.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: { select: { firstName: true, lastName: true, phone: true } },
      mainLocation: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: items.map((e) => ({
      id: e.id,
      title: e.title,
      offerType: e.offerType,
      status: e.status,
      locationName: e.mainLocation?.name ?? e.locationName,
      categoryName: e.category?.name,
      priceFrom: e.priceFrom ? Number(e.priceFrom) : null,
      owner: `${e.owner.firstName} ${e.owner.lastName}`,
      updatedAt: e.updatedAt.toISOString(),
    })),
  });
}
