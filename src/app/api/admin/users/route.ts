// API route handler for /api/admin/users.
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { purgeExpiredDeletedUsers } from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";
import { buildOffsetPagination, parsePagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  await purgeExpiredDeletedUsers(db, new Date());
  const pagination = parsePagination({ request, defaultLimit: 25, maxLimit: 100 });

  const [users, total] = await Promise.all([
    db.user.findMany({
      where: {
        role: "USER",
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        _count: {
          select: {
            properties: true,
            excursions: true,
            applications: true,
            payments: true,
            reviews: true,
            passwordResetRequests: true,
          },
        },
      },
    }),
    db.user.count({
      where: {
        role: "USER",
        deletedAt: null,
      },
    }),
  ]);

  return NextResponse.json({
    items: users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      deletedAt: user.deletedAt?.toISOString() ?? null,
      deletionExpiresAt: user.deletionExpiresAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      counts: {
        properties: user._count.properties,
        excursions: user._count.excursions,
        applications: user._count.applications,
        payments: user._count.payments,
        reviews: user._count.reviews,
        passwordResetRequests: user._count.passwordResetRequests,
      },
    })),
    pagination: buildOffsetPagination(pagination, users.length, total),
  });
}
