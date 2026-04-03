// API route handler for /api/admin/users.
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: [{ createdAt: "desc" }],
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
  });

  return NextResponse.json({
    items: users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
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
  });
}
