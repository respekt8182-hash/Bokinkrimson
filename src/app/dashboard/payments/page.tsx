// Next.js page for route /dashboard/payments.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPropertyWorkflowStatusLabel } from "@/lib/properties";

export default async function DashboardPaymentsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/payments");
  }

  const properties = await db.property.findMany({
    where: {
      ownerId: session.id,
      ownerDeletedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      pendingEditStatus: true,
      moderationNotes: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl text-olive">Оплата</h1>
        <p className="text-sm text-olive/70">Выберите объект и перейдите в его платежный раздел.</p>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive/30 bg-cream p-4 text-sm text-olive/75">
          У вас пока нет объектов для оплаты.
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map((item) => (
            <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold text-olive">{item.name ?? "Объект без названия"}</p>
                  <p className="text-xs text-olive/65">
                    Статус: {getPropertyWorkflowStatusLabel(item.status, item.moderationNotes, item.pendingEditStatus)} • Обновлено:{" "}
                    {new Date(item.updatedAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <Link
                  href={`/dashboard/objects/${item.id}/payment`}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Открыть оплату
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
