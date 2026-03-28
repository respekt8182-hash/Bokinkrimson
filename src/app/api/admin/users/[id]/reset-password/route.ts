// API route handler for /api/admin/users/[id]/reset-password.
import { PasswordResetRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureAuthDatabaseAvailable,
  getAuthDatabaseUnavailableMessage,
  isAuthDatabaseUnavailable,
} from "@/lib/auth-route-db";
import { getAdminSession } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateTemporaryPassword } from "@/lib/passwords";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Новый пароль должен содержать минимум 8 символов").optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const unavailableResponse = await ensureAuthDatabaseAvailable({
    routeId: "admin-user-reset-password",
    routeLabel: "Admin reset password",
  });
  if (unavailableResponse) {
    return unavailableResponse;
  }

  const { id } = await context.params;

  let customPassword: string | undefined;
  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  if (payload !== null) {
    const body = resetPasswordSchema.safeParse(payload);
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Проверьте корректность нового пароля" },
        { status: 400 },
      );
    }

    customPassword = body.data.newPassword;
  }

  try {
    const existingUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const temporaryPassword = customPassword ?? generateTemporaryPassword(10);
    const passwordHash = await hashPassword(temporaryPassword);
    const now = new Date();

    const completedRequestsCount = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { passwordHash },
      });

      const updatedRequests = await tx.passwordResetRequest.updateMany({
        where: {
          userId: existingUser.id,
          status: PasswordResetRequestStatus.PENDING,
        },
        data: {
          status: PasswordResetRequestStatus.COMPLETED,
          processedById: admin.id,
          processedAt: now,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: "reset_password",
          targetType: "user",
          targetId: existingUser.id,
          details: {
            email: existingUser.email,
            role: existingUser.role,
            completedRequestsCount: updatedRequests.count,
          },
        },
      });

      return updatedRequests.count;
    });

    return NextResponse.json({
      item: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        role: existingUser.role,
        completedRequestsCount,
        resetAt: now.toISOString(),
        resetByAdminId: admin.id,
      },
      temporaryPassword,
    });
  } catch (error) {
    if (isAuthDatabaseUnavailable(error)) {
      return NextResponse.json(
        { error: getAuthDatabaseUnavailableMessage() },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Не удалось сбросить пароль" }, { status: 500 });
  }
}
