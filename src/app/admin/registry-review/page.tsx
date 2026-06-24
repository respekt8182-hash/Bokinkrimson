import { PropertyStatus } from "@prisma/client";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { db } from "@/lib/db";

export default async function RegistryReviewAdminPage() {
  const items = await db.property.findMany({
    where: {
      OR: [
        { status: PropertyStatus.REQUIRES_REGISTRY_REVIEW },
        {
          classificationApplicable: true,
          OR: [
            { registryId: null },
            { registryUrl: null },
            { registryStatus: { not: "ACTIVE" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      publicId: true,
      name: true,
      locationName: true,
      status: true,
      registryId: true,
      registryUrl: true,
      registryStatus: true,
      registryCheckedAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Объекты, требующие проверки реестра"
        description="Карточки КСР нельзя публиковать без активной записи, ссылки на реестр и свежей проверки."
      />
      <div className="overflow-hidden rounded-2xl border border-olive/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream/70 text-xs uppercase tracking-wide text-olive/50">
            <tr>
              <th className="px-4 py-3">Объект</th>
              <th className="px-4 py-3">Реестр</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Проверка</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-olive/8">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-olive">{item.name ?? "Без названия"}</p>
                  <p className="text-xs text-olive/55">
                    #{item.publicId ?? item.id} · {item.locationName ?? "Локация не указана"}
                  </p>
                </td>
                <td className="px-4 py-3 text-olive/70">
                  <p>{item.registryId ?? "Номер не указан"}</p>
                  {item.registryUrl ? (
                    <a href={item.registryUrl} target="_blank" rel="noreferrer" className="text-terra hover:underline">
                      запись в реестре
                    </a>
                  ) : (
                    <span className="text-red-600">Ссылка не указана</span>
                  )}
                </td>
                <td className="px-4 py-3">{item.registryStatus}</td>
                <td className="px-4 py-3">
                  {item.registryCheckedAt
                    ? item.registryCheckedAt.toLocaleDateString("ru-RU")
                    : "Не проверялось"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/objects/${item.id}/rules`} className="font-semibold text-primary hover:underline">
                    Проверить
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-olive/55">
                  Нет объектов в очереди проверки реестра.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
