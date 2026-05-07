// Next.js page for route /admin/users/[id].
import Link from "next/link";
import { PasswordResetRequestStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminResetPasswordAction } from "@/components/admin/admin-reset-password-action";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import { AdminNotice } from "@/components/admin/admin-ui";
import { purgeExpiredDeletedUsers } from "@/lib/admin-entity-lifecycle";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import {
  formatUserActivityTime,
  getUserActivityStatus,
  USER_ACTIVITY_COLUMNS,
} from "@/lib/user-activity";

type AdminUserProfilePageProps = {
  params: Promise<{ id: string }>;
};

function getStatusLabel(status: PasswordResetRequestStatus): string {
  switch (status) {
    case PasswordResetRequestStatus.PENDING:
      return "Ожидает";
    case PasswordResetRequestStatus.COMPLETED:
      return "Закрыт";
    default:
      return status;
  }
}

function formatAbsoluteActivityDate(date: Date | null | undefined): string {
  return date
    ? date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

export default async function AdminUserProfilePage({ params }: AdminUserProfilePageProps) {
  const { id } = await params;
  const now = new Date();
  const isUserActivityAvailable = await areDatabaseColumnsAvailable("User", USER_ACTIVITY_COLUMNS);
  await purgeExpiredDeletedUsers(db, now);

  const user = await db.user.findFirst({
    where: { id, role: "USER" },
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
      passwordResetRequests: {
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          status: true,
          processedAt: true,
          processedById: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const pendingResetCount = user.passwordResetRequests.filter(
    (request) => request.status === PasswordResetRequestStatus.PENDING,
  ).length;
  const isPendingDeletion = Boolean(user.deletedAt);
  const activityStatus = getUserActivityStatus(user.lastSeenAt, now);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/users"
          className="inline-flex items-center rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
        >
          К списку пользователей
        </Link>
        <Link
          href="/admin/password-resets"
          className="inline-flex items-center rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
        >
          К сбросам паролей
        </Link>
      </div>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl text-olive">
                {user.firstName}
              </h1>
              {isPendingDeletion ? (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  Удаляется
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-olive/70">
              {user.phone}
              {user.email ? ` · ${user.email}` : ""}
            </p>
          </div>

          <AdminSoftDeleteAction
            deleteEndpoint={`/api/admin/users/${user.id}`}
            restoreEndpoint={`/api/admin/users/${user.id}/restore`}
            entityLabel="профиль"
            entityName={user.firstName}
            isPendingDeletion={isPendingDeletion}
            restoreUntil={user.deletionExpiresAt?.toISOString() ?? null}
            deleteButtonLabel="Удалить профиль"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/70">
          <span className="rounded-full bg-cream px-2 py-1">
            Регистрация: {new Date(user.createdAt).toLocaleString("ru-RU")}
          </span>
          <span className="rounded-full bg-cream px-2 py-1">
            Запросов на сброс: {user._count.passwordResetRequests}
          </span>
          <span className="rounded-full bg-cream px-2 py-1">Ожидает: {pendingResetCount}</span>
        </div>
        {!isUserActivityAvailable ? (
          <AdminNotice className="mt-4" tone="warning">
            Статистика активности появится после применения миграции базы данных.
          </AdminNotice>
        ) : null}
        <div className="mt-4 rounded-2xl border border-olive/10 bg-cream/70 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${activityStatus.toneClassName}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${activityStatus.dotClassName}`}
                aria-hidden="true"
              />
              {isUserActivityAvailable ? activityStatus.label : "Нет данных"}
            </span>
            <span className="text-xs text-olive/55">
              {isUserActivityAvailable
                ? activityStatus.description
                : "Нужно применить миграцию для записи активности"}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl bg-white/80 px-3 py-2">
              <dt className="text-olive/50">Последний визит</dt>
              <dd className="mt-0.5 font-semibold text-olive">
                {formatUserActivityTime(user.lastSeenAt, now)}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2">
              <dt className="text-olive/50">Последний вход</dt>
              <dd className="mt-0.5 font-semibold text-olive">
                {formatAbsoluteActivityDate(user.lastLoginAt)}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2">
              <dt className="text-olive/50">Последний выход</dt>
              <dd className="mt-0.5 font-semibold text-olive">
                {formatAbsoluteActivityDate(user.lastLogoutAt)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-olive/85 sm:grid-cols-3">
          <p>Объекты: {user._count.properties}</p>
          <p>Экскурсии: {user._count.excursions}</p>
          <p>Заявки: {user._count.applications}</p>
          <p>Платежи: {user._count.payments}</p>
          <p>Отзывы: {user._count.reviews}</p>
        </div>
        {isPendingDeletion ? (
          <AdminNotice className="mt-4" tone="warning">
            Профиль скрыт и ожидает окончательного удаления. Отменить удаление можно до{" "}
            {user.deletionExpiresAt ? user.deletionExpiresAt.toLocaleString("ru-RU") : "—"}.
          </AdminNotice>
        ) : null}
      </section>

      {!isPendingDeletion ? (
        <AdminResetPasswordAction userId={user.id} userEmail={user.email} />
      ) : null}

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">История запросов на сброс</h2>
        {user.passwordResetRequests.length === 0 ? (
          <p className="mt-2 text-sm text-olive/70">Запросов на сброс пока нет.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-olive/65">
                  <th className="py-1 pr-4">Создан</th>
                  <th className="py-1 pr-4">Статус</th>
                  <th className="py-1 pr-4">Обработан</th>
                  <th className="py-1">Администратор</th>
                </tr>
              </thead>
              <tbody>
                {user.passwordResetRequests.map((request) => (
                  <tr key={request.id} className="border-t border-olive/10">
                    <td className="py-2 pr-4 text-olive">
                      {new Date(request.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="py-2 pr-4 text-olive">{getStatusLabel(request.status)}</td>
                    <td className="py-2 pr-4 text-olive">
                      {request.processedAt
                        ? new Date(request.processedAt).toLocaleString("ru-RU")
                        : "-"}
                    </td>
                    <td className="py-2 text-olive">
                      {request.processedById ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
