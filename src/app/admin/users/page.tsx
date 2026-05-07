// Next.js page for route /admin/users.
import Link from "next/link";
import { PasswordResetRequestStatus, Prisma } from "@prisma/client";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { purgeExpiredDeletedUsers } from "@/lib/admin-entity-lifecycle";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { getObjectPaymentDisplay } from "@/lib/object-placement-status";
import {
  formatUserActivityTime,
  getUserActivityStatus,
  USER_ACTIVITY_COLUMNS,
} from "@/lib/user-activity";
import {
  USER_INACTIVE_WINDOW_MS,
  USER_ONLINE_WINDOW_MS,
  USER_RECENT_WINDOW_MS,
  USER_WEEK_WINDOW_MS,
} from "@/lib/user-activity-constants";

type ActivityFilter = "all" | "online" | "recent" | "week" | "inactive" | "never";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    activity?: string | string[];
  }>;
};

const activityFilters: Array<{ key: ActivityFilter; label: string; description: string }> = [
  { key: "all", label: "Все", description: "Без фильтра активности" },
  { key: "online", label: "Онлайн", description: "Были активны за последние 5 минут" },
  { key: "recent", label: "Сегодня", description: "Были на сайте за сутки" },
  { key: "week", label: "7 дней", description: "Появлялись на этой неделе" },
  { key: "inactive", label: "Давно", description: "Нет визитов больше 30 дней" },
  { key: "never", label: "Не заходили", description: "Активность ещё не фиксировалась" },
];

function parseActivityFilter(value: string | string[] | undefined): ActivityFilter {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    candidate === "online" ||
    candidate === "recent" ||
    candidate === "week" ||
    candidate === "inactive" ||
    candidate === "never"
  ) {
    return candidate;
  }

  return "all";
}

function buildActivityWhere(filter: ActivityFilter, now: Date): Prisma.UserWhereInput {
  switch (filter) {
    case "online":
      return { lastSeenAt: { gte: new Date(now.getTime() - USER_ONLINE_WINDOW_MS) } };
    case "recent":
      return { lastSeenAt: { gte: new Date(now.getTime() - USER_RECENT_WINDOW_MS) } };
    case "week":
      return { lastSeenAt: { gte: new Date(now.getTime() - USER_WEEK_WINDOW_MS) } };
    case "inactive":
      return {
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(now.getTime() - USER_INACTIVE_WINDOW_MS) } },
        ],
      };
    case "never":
      return { lastSeenAt: null };
    default:
      return {};
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

function getActivityFilterHref(filter: ActivityFilter): string {
  return filter === "all" ? "/admin/users" : `/admin/users?activity=${filter}`;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const now = new Date();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activityFilter = parseActivityFilter(resolvedSearchParams.activity);
  const isUserActivityAvailable = await areDatabaseColumnsAvailable("User", USER_ACTIVITY_COLUMNS);
  await purgeExpiredDeletedUsers(db, now);

  const users = await db.user.findMany({
    where: {
      role: "USER",
      deletedAt: null,
      ...(isUserActivityAvailable ? buildActivityWhere(activityFilter, now) : {}),
    },
    orderBy:
      isUserActivityAvailable && activityFilter !== "all"
        ? [{ lastSeenAt: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
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

      {!isUserActivityAvailable ? (
        <AdminNotice tone="warning">
          Статистика активности появится после применения миграции базы данных. До этого сайт
          продолжит работать без записи визитов.
        </AdminNotice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {activityFilters.map((filter) => {
          const isActive = activityFilter === filter.key;

          return (
            <Link
              key={filter.key}
              href={getActivityFilterHref(filter.key)}
              title={filter.description}
              className={`inline-flex items-center rounded-2xl border px-3.5 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-olive/12 bg-white text-olive/75 hover:border-primary/18 hover:text-primary"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

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
            const activityStatus = getUserActivityStatus(user.lastSeenAt, now);

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

                <div className="rounded-2xl border border-olive/10 bg-white/72 px-3 py-3">
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
                    <div className="rounded-xl bg-cream/80 px-3 py-2">
                      <dt className="text-olive/50">Последний визит</dt>
                      <dd className="mt-0.5 font-semibold text-olive">
                        {formatUserActivityTime(user.lastSeenAt, now)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-cream/80 px-3 py-2">
                      <dt className="text-olive/50">Последний вход</dt>
                      <dd className="mt-0.5 font-semibold text-olive">
                        {formatAbsoluteActivityDate(user.lastLoginAt)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-cream/80 px-3 py-2">
                      <dt className="text-olive/50">Последний выход</dt>
                      <dd className="mt-0.5 font-semibold text-olive">
                        {formatAbsoluteActivityDate(user.lastLogoutAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

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
