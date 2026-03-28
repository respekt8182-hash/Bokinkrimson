import Link from "next/link";
import { ExcursionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { CreateExcursionButton } from "@/components/excursions/create-excursion-button";
import { DeleteExcursionButton } from "@/components/excursions/delete-excursion-button";
import { ExcursionStatsButton } from "@/components/excursions/excursion-stats-button";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeExcursion } from "@/lib/excursions";

// Dashboard list page for organizer excursions.
// Mirrors `/dashboard/objects`, but for excursion entities.
export default async function DashboardExcursionsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/excursions");
  }

  const excursions = await db.excursion.findMany({
    where: { ownerId: session.id },
    include: {
      mainLocation: { select: { name: true } },
      anchorLocation: { select: { name: true } },
      district: { select: { name: true } },
      category: { select: { name: true } },
      meetingLocation: { select: { name: true } },
      pickupLocations: { select: { locationId: true } },
      routeLocations: {
        select: { locationId: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const items = excursions.map(serializeExcursion);
  const draftCount = items.filter((item) => item.status === ExcursionStatus.DRAFT).length;
  const moderationCount = items.filter((item) => item.status === ExcursionStatus.PENDING_MODERATION).length;
  const publishedCount = items.filter((item) => item.status === ExcursionStatus.PUBLISHED).length;
  const contactsReadyCount = items.filter(
    (item) =>
      Boolean(item.contactFirstName?.trim()) &&
      Boolean(item.contactLastName?.trim()) &&
      Boolean(item.contactPhone?.trim()),
  ).length;
  const isRegularUser = session.role === "USER";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl text-olive">Экскурсии</h1>
          <p className="mt-1 text-sm text-olive/70">
            Создавайте и редактируйте экскурсии, затем отправляйте их на модерацию для публикации.
          </p>
        </div>
        <CreateExcursionButton />
      </div>

      {isRegularUser ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-olive/10 bg-white px-3 py-2.5">
            <p className="text-xs text-olive/60">Всего экскурсий</p>
            <p className="text-xl font-semibold text-olive">{items.length}</p>
          </div>
          <div className="rounded-xl border border-olive/10 bg-white px-3 py-2.5">
            <p className="text-xs text-olive/60">Черновики</p>
            <p className="text-xl font-semibold text-olive">{draftCount}</p>
          </div>
          <div className="rounded-xl border border-olive/10 bg-white px-3 py-2.5">
            <p className="text-xs text-olive/60">На модерации</p>
            <p className="text-xl font-semibold text-olive">{moderationCount}</p>
          </div>
          <div className="rounded-xl border border-olive/10 bg-white px-3 py-2.5">
            <p className="text-xs text-olive/60">Опубликованы</p>
            <p className="text-xl font-semibold text-olive">{publishedCount}</p>
          </div>
          <div className="rounded-xl border border-olive/10 bg-white px-3 py-2.5">
            <p className="text-xs text-olive/60">Контакты заполнены</p>
            <p className="text-xl font-semibold text-olive">{contactsReadyCount}</p>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-cream p-4 text-sm text-olive/75">
          У вас пока нет экскурсий. Нажмите «Добавить экскурсию», чтобы создать первую карточку.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl text-olive">{item.title ?? "Новая экскурсия"}</h2>
                  <p className="text-xs text-olive/60">{item.locationName ?? "Локация не выбрана"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold text-olive">
                    {item.statusLabel}
                  </span>
                  <span className="rounded-full border border-olive/15 px-3 py-1 text-xs font-semibold text-olive/75">
                    #{index + 1}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Длительность</dt>
                  <dd className="font-medium text-olive">
                    {item.durationMinutes ? `${item.durationMinutes} мин` : "Не указана"}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Цена</dt>
                  <dd className="font-medium text-olive">
                    {item.priceFrom !== null ? `от ${item.priceFrom} ${item.currency}` : "По запросу"}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Рейтинг</dt>
                  <dd className="font-medium text-olive">
                    {item.avgRating.toFixed(1)} ({item.reviewsCount})
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Контакты</dt>
                  <dd className="font-medium text-olive">
                    {item.contactPhone?.trim() ? "Добавлены" : "Не заполнены"}
                  </dd>
                </div>
              </dl>

              {item.moderationNotes ? (
                <p className="mt-3 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                  Комментарий модератора: {item.moderationNotes}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-olive/60">
                  Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/excursions/${item.id}`}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                  >
                    Открыть редактор
                  </Link>
                  {item.status === ExcursionStatus.PUBLISHED && (
                    <ExcursionStatsButton
                      excursionId={item.id}
                      excursionTitle={item.title ?? "Экскурсия"}
                    />
                  )}
                  <DeleteExcursionButton
                    excursionId={item.id}
                    excursionTitle={item.title ?? "Новая экскурсия"}
                    excursionStatus={item.status}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
