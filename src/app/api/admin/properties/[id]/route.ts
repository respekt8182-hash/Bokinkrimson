// API route handler for /api/admin/properties/[id].
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { serializePayment } from "@/lib/payments";
import { serializeProperty } from "@/lib/properties";
import { serializeReview } from "@/lib/reviews";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const adminPropertyInclude = Prisma.validator<Prisma.PropertyInclude>()({
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  },
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  rooms: {
    where: { isActive: true },
    orderBy: [{ updatedAt: "desc" }],
    include: roomInclude,
  },
  amenities: {
    include: { amenity: true },
  },
  customAmenities: true,
  payments: {
    orderBy: [{ createdAt: "desc" }],
    take: 10,
    include: {
      property: {
        select: { name: true },
      },
    },
  },
  reviews: {
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
});

const adminPropertyPatchSchema = z.object({
  action: z.literal("clear_moderation_comment"),
});

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  const property = await db.property.findUnique({
    where: { id },
    include: adminPropertyInclude,
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      ...serializeProperty(property),
      owner: {
        id: property.owner.id,
        firstName: property.owner.firstName,
        lastName: property.owner.lastName,
        email: property.owner.email,
        role: property.owner.role,
        createdAt: property.owner.createdAt.toISOString(),
      },
      rooms: property.rooms.map(serializeRoom),
      payments: property.payments.map(serializePayment),
      reviews: property.reviews.map(serializeReview),
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = adminPropertyPatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректная команда" }, { status: 400 });
  }

  const existing = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      moderationNotes: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.property.update({
      where: { id: existing.id },
      data: {
        moderationNotes: null,
      },
      select: {
        id: true,
        moderationNotes: true,
        updatedAt: true,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "clear_comment",
        targetType: "property",
        targetId: existing.id,
        details: {
          previousComment: existing.moderationNotes,
          nextComment: null,
        },
      },
    });

    return item;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      moderationNotes: updated.moderationNotes,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
