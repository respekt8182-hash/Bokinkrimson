// API route handler for /api/admin/properties/[id]/registry-moderation.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const moderateRegistrySchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    comment: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.action === "reject" && (data.comment?.trim().length ?? 0) < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для отклонения укажите комментарий минимум 5 символов",
        path: ["comment"],
      });
    }
  });

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      registryNumber: true,
      registryNumberPending: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  if (!existing.registryNumberPending) {
    return NextResponse.json({ error: "На проверке нет номера КСР" }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = moderateRegistrySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте корректность действия и комментария по КСР" },
      { status: 400 },
    );
  }

  const action = parsed.data.action;
  const comment = parsed.data.comment?.trim() || null;

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.property.update({
      where: { id: existing.id },
      data:
        action === "approve"
          ? {
              registryNumber: existing.registryNumberPending,
              registryNumberPending: null,
              registryModerationSubmittedAt: null,
              moderatedById: admin.id,
              moderatedAt: new Date(),
              moderationNotes: comment,
            }
          : {
              registryNumberPending: null,
              registryModerationSubmittedAt: null,
              moderatedById: admin.id,
              moderatedAt: new Date(),
              moderationNotes: comment ?? "Номер КСР отклонен модератором",
            },
      select: {
        id: true,
        registryNumber: true,
        registryNumberPending: true,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: action === "approve" ? "registry_approve" : "registry_reject",
        targetType: "property",
        targetId: existing.id,
        details: {
          previousRegistryNumber: existing.registryNumber,
          pendingRegistryNumber: existing.registryNumberPending,
          nextRegistryNumber: action === "approve" ? existing.registryNumberPending : existing.registryNumber,
          comment,
        },
      },
    });

    return next;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      registryNumber: updated.registryNumber,
      registryNumberPending: updated.registryNumberPending,
      message: action === "approve" ? "КСР подтвержден" : "КСР отклонен",
    },
  });
}
