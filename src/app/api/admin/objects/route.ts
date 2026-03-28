// API route handler for /api/admin/objects.
import { PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import {
  buildPropertyWorkflowStatusWhere,
  getPropertyWorkflowStatusLabel,
} from "@/lib/properties";

export async function GET(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const statusParam = searchParams.get("status");
  const locationId = searchParams.get("locationId")?.trim() ?? "";
  const query = searchParams.get("q")?.trim() ?? "";

  const status =
    statusParam === "ALL"
      ? null
      : statusParam && Object.values(PropertyStatus).includes(statusParam as PropertyStatus)
        ? (statusParam as PropertyStatus)
        : null;

  const rows = await db.property.findMany({
    where: {
      ...(status ? buildPropertyWorkflowStatusWhere(status) : {}),
      ...(locationId ? { locationId } : {}),
      OR: [{ ownerDeletedAt: null }, { ownerDeletionExpiresAt: { gt: now } }],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          rows,
          (item) => [
            item.name,
            item.locationName,
            item.address,
            item.description,
            item.type,
            `${item.owner.firstName} ${item.owner.lastName}`,
            item.owner.email,
          ],
          { limit: rows.length, minScore: 0.08 },
        )
      : rows;

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      locationId: item.locationId,
      locationName: item.locationName,
      status: item.status,
      statusLabel: getPropertyWorkflowStatusLabel(
        item.status,
        item.moderationNotes,
        item.pendingEditStatus,
      ),
      moderationNotes: item.moderationNotes,
      avgRating: Number(item.avgRating),
      reviewsCount: item.reviewsCount,
      owner: {
        id: item.owner.id,
        name: `${item.owner.firstName} ${item.owner.lastName}`,
        email: item.owner.email,
      },
      activeRoomsCount: item.rooms.length,
      ownerDeletedAt: item.ownerDeletedAt ? item.ownerDeletedAt.toISOString() : null,
      ownerDeletionExpiresAt: item.ownerDeletionExpiresAt
        ? item.ownerDeletionExpiresAt.toISOString()
        : null,
      updatedAt: item.updatedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
