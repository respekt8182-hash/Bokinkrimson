// Next.js page for route /admin/messages.
import { AdminMessageSourceType } from "@prisma/client";
import { AdminMessageDeleteButton } from "@/components/admin/admin-message-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatCard,
} from "@/components/admin/admin-ui";
import { serializeAdminMessage } from "@/lib/admin-messages";
import { db } from "@/lib/db";

export default async function AdminMessagesPage() {
  const rows = await db.adminMessage.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      senderUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      excursion: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    take: 300,
  });

  const items = rows.map(serializeAdminMessage);
  const objectCount = items.filter((item) => item.sourceType === AdminMessageSourceType.OBJECT).length;
  const excursionCount = items.filter((item) => item.sourceType === AdminMessageSourceType.EXCURSION).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Сообщения"
        description="Сообщения из карточек жилья и экскурсий."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Всего" value={items.length} />
        <AdminStatCard label="По жилью" value={objectCount} />
        <AdminStatCard label="По экскурсиям" value={excursionCount} />
      </div>

      {items.length === 0 ? (
        <AdminEmptyState title="Сообщений пока нет" description="Новые обращения появятся здесь." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const contextLabel =
              item.sourceType === AdminMessageSourceType.OBJECT
                ? item.context.propertyName ?? `Объект ${item.context.propertyId ?? "-"}`
                : item.context.excursionTitle ?? `Экскурсия ${item.context.excursionId ?? "-"}`;

            return (
              <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-olive/60">ID: {item.id}</p>
                    <h2 className="text-lg text-olive">{item.sourceTypeLabel}: {contextLabel}</h2>
                    <p className="text-sm text-olive/70">
                      От: {item.sender.firstName} {item.sender.lastName} ({item.sender.email})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-olive/60">{new Date(item.createdAt).toLocaleString("ru-RU")}</p>
                    <div className="mt-2">
                      <AdminMessageDeleteButton messageId={item.id} />
                    </div>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-line rounded-xl bg-cream/70 p-3 text-sm text-olive/85">
                  {item.message}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
