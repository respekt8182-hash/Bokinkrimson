// Next.js page for route /admin/users.
import Link from "next/link";
import { PasswordResetRequestStatus } from "@prisma/client";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { purgeExpiredDeletedUsers } from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";
import { getObjectPaymentDisplay } from "@/lib/object-placement-status";

export default async function AdminUsersPage() {
  const now = new Date();
  await purgeExpiredDeletedUsers(db, now);

  const users = await db.user.findMany({
    where: { role: "USER", deletedAt: null },
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
      passwordResetRequests: {
        where: {
          status: PasswordResetRequestStatus.PENDING,
        },
        select: {
          id: true,
        },
      },
      properties: {
        where: { ownerDeletedAt: null },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          name: true,
          locationName: true,
          paymentStatus: true,
          tariffType: true,
          paidFrom: true,
          paidUntil: true,
          paidAmount: true,
          paidAt: true,
          payments: {
            where: { status: "SUCCEEDED" },
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            select: {
              amount: true,
              tariffCode: true,
              tariffType: true,
              paidFrom: true,
              paidAt: true,
              createdAt: true,
              placementValidUntil: true,
              providerPayload: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Пользователи"
        description="Аккаунты владельцев, активность и быстрое управление профилем без перегруженной таблицы."
      />

      {users.length === 0 ? (
        <AdminEmptyState
          title="Пользователи не найдены"
          description="Новые аккаунты появятся здесь автоматически."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {users.map((user) => {
            const isPendingDeletion = Boolean(user.deletedAt);
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

            return (
              <AdminPanel key={user.id} className="p-5" contentClassName="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-olive">
                        {fullName}
                      </h2>
                      {isPendingDeletion ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          Удаляется
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-olive/70">
                      {user.phone}
                      {user.email ? ` • ${user.email}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-olive/45">{user.id}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Профиль
                    </Link>
                    <AdminSoftDeleteAction
                      deleteEndpoint={`/api/admin/users/${user.id}`}
                      restoreEndpoint={`/api/admin/users/${user.id}/restore`}
                      entityLabel="профиль"
                      entityName={fullName}
                      isPendingDeletion={isPendingDeletion}
                      restoreUntil={user.deletionExpiresAt?.toISOString() ?? null}
                      deleteButtonLabel="Удалить"
                    />
                  </div>
                </div>

                {isPendingDeletion ? (
                  <AdminNotice tone="warning">
                    Профиль снят с доступа {user.deletedAt?.toLocaleString("ru-RU")}. Отменить удаление можно до{" "}
                    {user.deletionExpiresAt
                      ? user.deletionExpiresAt.toLocaleString("ru-RU")
                      : "—"}
                    .
                  </AdminNotice>
                ) : null}

                <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Объекты</dt>
                    <dd className="font-medium text-olive">{user._count.properties}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Экскурсии и туры</dt>
                    <dd className="font-medium text-olive">{user._count.excursions}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Заявки</dt>
                    <dd className="font-medium text-olive">{user._count.applications}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Платежи</dt>
                    <dd className="font-medium text-olive">{user._count.payments}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Отзывы</dt>
                    <dd className="font-medium text-olive">{user._count.reviews}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Сбросы пароля</dt>
                    <dd className="font-medium text-olive">
                      {user.passwordResetRequests.length} активн. / {user._count.passwordResetRequests} всего
                    </dd>
                  </div>
                </div>

                <p className="text-xs text-olive/55">
                  Зарегистрирован: {new Date(user.createdAt).toLocaleString("ru-RU")}
                </p>

                {user.properties.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-olive/50">
                      Связанные объекты
                    </p>
                    {user.properties.map((property) => {
                      const payment = getObjectPaymentDisplay({
                        paymentStatus: property.paymentStatus,
                        tariffType: property.tariffType,
                        paidFrom: property.paidFrom,
                        paidUntil: property.paidUntil,
                        paidAmount: property.paidAmount,
                        paidAt: property.paidAt,
                        latestPayment: property.payments[0] ?? null,
                        now,
                      });

                      return (
                        <div
                          key={property.id}
                          className="rounded-2xl border border-olive/10 bg-white/70 px-3 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/admin/objects/${property.id}`}
                              className="font-semibold text-olive hover:text-primary"
                            >
                              {property.name ?? "Объект без названия"}
                            </Link>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${payment.toneClassName}`}
                            >
                              {payment.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-olive/55">
                            {property.locationName ?? "Локация не указана"} · {payment.tariffLabel}
                            {payment.paidUntil
                              ? ` · до ${payment.paidUntil.toLocaleDateString("ru-RU")}`
                              : ""}
                            {payment.paidAmount !== null
                              ? ` · ${payment.paidAmount.toLocaleString("ru-RU")} ₽`
                              : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
