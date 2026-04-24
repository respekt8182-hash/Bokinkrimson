import { PasswordResetRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  ensureAuthDatabaseAvailable,
  getAuthDatabaseUnavailableMessage,
  isAuthDatabaseUnavailable,
} from "@/lib/auth-route-db";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";
import {
  createSecurityToken,
  hashSecurityToken,
  sendSecurityEmail,
} from "@/lib/security-emails";

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

  try {
    const existingUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!existingUser || existingUser.role !== "USER") {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (existingUser.deletedAt) {
      return NextResponse.json(
        { error: "Нельзя сбросить пароль профиля, который ожидает удаления" },
        { status: 409 },
      );
    }

    if (!existingUser.email) {
      return NextResponse.json(
        { error: "У пользователя нет подтвержденного email для доставки ссылки сброса" },
        { status: 409 },
      );
    }

    const resetToken = createSecurityToken();
    const tokenHash = hashSecurityToken(resetToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: existingUser.id,
          usedAt: null,
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: existingUser.id,
          tokenHash,
          expiresAt,
          issuedByAdminId: admin.id,
        },
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

      await writeAdminAuditLog(tx, {
        adminUserId: admin.id,
        action: "reset_password_issue_token",
        targetType: "user",
        targetId: existingUser.id,
        details: {
          email: existingUser.email,
          role: existingUser.role,
          completedRequestsCount: updatedRequests.count,
          expiresAt: expiresAt.toISOString(),
          outcome: "issued",
        },
      });
    });

    const resetUrl = new URL("/auth/reset-password", request.url);
    resetUrl.searchParams.set("token", resetToken);

    await sendSecurityEmail({
      to: existingUser.email,
      subject: "Сброс пароля",
      text: [
        "Для вашей учетной записи был запрошен сброс пароля.",
        `Перейдите по ссылке: ${resetUrl.toString()}`,
        `Ссылка действует до ${expiresAt.toISOString()}.`,
        "Если вы не запрашивали сброс, проигнорируйте это письмо.",
      ].join("\n\n"),
    });

    return NextResponse.json({
      item: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        role: existingUser.role,
        resetIssuedAt: now.toISOString(),
        resetExpiresAt: expiresAt.toISOString(),
        resetByAdminId: admin.id,
      },
    });
  } catch (error) {
    if (isAuthDatabaseUnavailable(error)) {
      return NextResponse.json(
        { error: getAuthDatabaseUnavailableMessage() },
        { status: 503 },
      );
    }

    if (isDatabaseSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error:
            "Сброс пароля временно недоступен: база данных еще не обновлена до последней миграции.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Не удалось сбросить пароль" }, { status: 500 });
  }
}
