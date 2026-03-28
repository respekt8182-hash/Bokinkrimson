// Next.js page for route /admin/users/[id].
import Link from "next/link";
import { PasswordResetRequestStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminResetPasswordAction } from "@/components/admin/admin-reset-password-action";
import { db } from "@/lib/db";

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

export default async function AdminUserProfilePage({ params }: AdminUserProfilePageProps) {
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          properties: true,
          excursions: true,
          applications: true,
          payments: true,
          reviews: true,
          adminActions: true,
          passwordResetRequests: true,
        },
      },
      passwordResetRequests: {
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        include: {
          processedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
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
        <h1 className="text-2xl text-olive">
          {user.firstName} {user.lastName}
        </h1>
        <p className="mt-1 text-sm text-olive/70">{user.phone}{user.email ? ` · ${user.email}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/70">
          <span className="rounded-full bg-cream px-2 py-1">Роль: {user.role}</span>
          <span className="rounded-full bg-cream px-2 py-1">
            Регистрация: {new Date(user.createdAt).toLocaleString("ru-RU")}
          </span>
          <span className="rounded-full bg-cream px-2 py-1">
            Запросов на сброс: {user._count.passwordResetRequests}
          </span>
          <span className="rounded-full bg-cream px-2 py-1">Ожидает: {pendingResetCount}</span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-olive/85 sm:grid-cols-3">
          <p>Объекты: {user._count.properties}</p>
          <p>Экскурсии: {user._count.excursions}</p>
          <p>Заявки: {user._count.applications}</p>
          <p>Платежи: {user._count.payments}</p>
          <p>Отзывы: {user._count.reviews}</p>
          <p>Админ-действия: {user._count.adminActions}</p>
        </div>
      </section>

      <AdminResetPasswordAction userId={user.id} userEmail={user.email} />

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
                      {request.processedBy
                        ? `${request.processedBy.firstName} ${request.processedBy.lastName}`
                        : "-"}
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
