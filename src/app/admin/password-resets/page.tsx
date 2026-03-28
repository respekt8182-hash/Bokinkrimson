// Next.js page for route /admin/password-resets.
import Link from "next/link";
import { PasswordResetRequestStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AdminPasswordResetInline } from "@/components/admin/admin-password-reset-inline";

export default async function AdminPasswordResetsPage() {
  const [pendingCount, pending, completed] = await Promise.all([
    db.passwordResetRequest.count({
      where: { status: PasswordResetRequestStatus.PENDING },
    }),
    db.passwordResetRequest.findMany({
      where: { status: PasswordResetRequestStatus.PENDING },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    db.passwordResetRequest.findMany({
      where: { status: PasswordResetRequestStatus.COMPLETED },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        processedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-olive">Сбросы паролей</h1>
        <p className="mt-1 text-sm text-olive/70">
          Новые запросы появляются после нажатия пользователем «Забыли пароль». Введите новый пароль
          и нажмите «Подтвердить».
        </p>
      </div>

      {/* Pending */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-olive">Ожидают обработки</h2>
          <span className="rounded-full bg-terra/15 px-2.5 py-0.5 text-sm font-semibold text-terra">
            {pendingCount}
          </span>
        </div>

        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/70">
            Запросов на сброс пароля пока нет.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm"
              >
                <div className="mb-3">
                  <p className="font-semibold text-olive">
                    {req.user.firstName} {req.user.lastName}
                  </p>
                  <p className="text-xs text-olive/65">{req.user.email}</p>
                  <p className="mt-1 text-xs text-olive/50">
                    {new Date(req.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <AdminPasswordResetInline userId={req.user.id} userEmail={req.user.email} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-olive">Обработанные</h2>
          <div className="overflow-x-auto rounded-2xl border border-olive/10 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-cream">
                <tr className="text-left text-xs text-olive/60">
                  <th className="px-3 py-2">Дата запроса</th>
                  <th className="px-3 py-2">Пользователь</th>
                  <th className="px-3 py-2">Обработан</th>
                  <th className="px-3 py-2">Администратор</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {completed.map((req) => (
                  <tr key={req.id} className="border-t border-olive/10">
                    <td className="px-3 py-2 text-olive/70">
                      {new Date(req.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-olive">
                      {req.user.firstName} {req.user.lastName}
                      <p className="text-xs text-olive/60">{req.user.email}</p>
                    </td>
                    <td className="px-3 py-2 text-olive/70">
                      {req.processedAt
                        ? new Date(req.processedAt).toLocaleString("ru-RU")
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-olive/70">
                      {req.processedBy
                        ? `${req.processedBy.firstName} ${req.processedBy.lastName}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${req.user.id}`}
                        className="text-xs text-olive/50 hover:text-olive hover:underline"
                      >
                        Профиль
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
