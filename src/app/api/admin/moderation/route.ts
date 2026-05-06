// API route handler for /api/admin/moderation.
import { PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import { buildOffsetPagination, parsePagination } from "@/lib/pagination";
import {
  buildPropertyWorkflowStatusWhere,
  getPropertyWorkflowStatusLabel,
} from "@/lib/properties";

function toDateStart(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDateEnd(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const locationId = searchParams.get("locationId")?.trim() ?? "";
  const query = searchParams.get("q")?.trim() ?? "";
  const dateFrom = toDateStart(searchParams.get("dateFrom"));
  const dateTo = toDateEnd(searchParams.get("dateTo"));
  const pagination = parsePagination({ request, defaultLimit: 25, maxLimit: 100 });

  const status =
    statusParam === "ALL"
      ? null
      : statusParam && Object.values(PropertyStatus).includes(statusParam as PropertyStatus)
        ? (statusParam as PropertyStatus)
        : PropertyStatus.PENDING_MODERATION;

  const rows = await db.property.findMany({
    where: {
      ...(status ? buildPropertyWorkflowStatusWhere(status) : {}),
      ...(locationId ? { locationId } : {}),
      ...(dateFrom || dateTo
        ? {
            updatedAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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

  const pagedItems = items.slice(pagination.offset, pagination.offset + pagination.limit);

  return NextResponse.json({
    items: pagedItems.map((item) => ({
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
      updatedAt: item.updatedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
    pagination: buildOffsetPagination(pagination, pagedItems.length, items.length),
  });
}
