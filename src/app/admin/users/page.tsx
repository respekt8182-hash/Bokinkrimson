// Next.js page for route /admin/users.
import Link from "next/link";
import { PasswordResetRequestStatus } from "@prisma/client";
import { db } from "@/lib/db";

export default async function AdminUsersPage() {
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
          adminActions: true,
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
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-olive">Пользователи</h1>
      <p className="text-sm text-olive/70">
        Просмотр основных данных пользователей. Блокировка/разблокировка может быть добавлена
        отдельным этапом.
      </p>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/70">
          Пользователи не найдены.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-olive/10 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-cream">
              <tr className="text-left text-olive/70">
                <th className="px-3 py-2">Пользователь</th>
                <th className="px-3 py-2">Контакт</th>
                <th className="px-3 py-2">Роль</th>
                <th className="px-3 py-2">Объекты</th>
                <th className="px-3 py-2">Экскурсии</th>
                <th className="px-3 py-2">Заявки</th>
                <th className="px-3 py-2">Платежи</th>
                <th className="px-3 py-2">Отзывы</th>
                <th className="px-3 py-2">Сбросы</th>
                <th className="px-3 py-2">Дата регистрации</th>
                <th className="px-3 py-2">Профиль</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-olive/10">
                  <td className="px-3 py-2 text-olive">
                    {user.firstName} {user.lastName}
                    <p className="font-mono text-xs text-olive/60">{user.id}</p>
                  </td>
                  <td className="px-3 py-2 text-olive">{user.phone ?? user.email ?? "—"}</td>
                  <td className="px-3 py-2 text-olive">{user.role}</td>
                  <td className="px-3 py-2 text-olive">{user._count.properties}</td>
                  <td className="px-3 py-2 text-olive">{user._count.excursions}</td>
                  <td className="px-3 py-2 text-olive">{user._count.applications}</td>
                  <td className="px-3 py-2 text-olive">{user._count.payments}</td>
                  <td className="px-3 py-2 text-olive">{user._count.reviews}</td>
                  <td className="px-3 py-2 text-olive">
                    {user.passwordResetRequests.length} / {user._count.passwordResetRequests}
                  </td>
                  <td className="px-3 py-2 text-olive">
                    {new Date(user.createdAt).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="inline-flex items-center rounded-xl border border-olive/20 px-3 py-2 text-xs font-semibold text-olive hover:bg-cream"
                    >
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
