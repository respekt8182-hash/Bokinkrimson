// Next.js page for route /admin/moderation.
import Link from "next/link";
import { PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import {
  buildPropertyWorkflowStatusWhere,
  getPropertyWorkflowStatusLabel,
} from "@/lib/properties";

type ModerationQueuePageProps = {
  searchParams: Promise<{
    status?: string;
    locationId?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
  }>;
};

const moderationStatuses = [
  { id: "PENDING_MODERATION", label: "На модерации" },
  { id: "REJECTED", label: "Отклонены" },
  { id: "PUBLISHED", label: "Опубликованы" },
  { id: "DRAFT", label: "Черновики" },
  { id: "ALL", label: "Все статусы" },
] as const;

function toDateStart(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDateEnd(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export default async function ModerationQueuePage({ searchParams }: ModerationQueuePageProps) {
  const filters = await searchParams;
  const locationDirectory = await getLocationDirectoryItems();
  const selectedStatus =
    filters.status === "ALL"
      ? "ALL"
      : filters.status && Object.values(PropertyStatus).includes(filters.status as PropertyStatus)
        ? (filters.status as PropertyStatus)
        : "ALL";
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const rows = await db.property.findMany({
    where: {
      ...(selectedStatus !== "ALL" ? buildPropertyWorkflowStatusWhere(selectedStatus) : {}),
      ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
      ...(dateFrom || dateTo
        ? {
            updatedAt: {
              ...(toDateStart(dateFrom) ? { gte: toDateStart(dateFrom)! } : {}),
              ...(toDateEnd(dateTo) ? { lte: toDateEnd(dateTo)! } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          rows,
          (item) => [
            item.name,
            item.locationName,
            item.address,
            item.description,
            item.type,
            `${item.owner.firstName} ${item.owner.lastName}`,
            item.owner.email,
          ],
          { limit: rows.length, minScore: 0.08 },
        )
      : rows;

  const locationBuckets = items.reduce(
    (accumulator, item) => {
      if (!item.locationId || !item.locationName) {
        return accumulator;
      }

      const existing = accumulator.get(item.locationId);
      if (existing) {
        existing.count += 1;
      } else {
        accumulator.set(item.locationId, {
          id: item.locationId,
          name: item.locationName,
          count: 1,
        });
      }
      return accumulator;
    },
    new Map<string, { id: string; name: string; count: number }>(),
  );

  const sortedLocationBuckets = Array.from(locationBuckets.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.name.localeCompare(right.name, "ru");
  });

  const buildFilterLink = (locationId: string): string => {
    const params = new URLSearchParams();
    if (selectedStatus) params.set("status", selectedStatus);
    if (locationId) params.set("locationId", locationId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (query) params.set("q", query);
    const search = params.toString();
    return search ? `/admin/moderation?${search}` : "/admin/moderation";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-olive">Очередь модерации</h1>
      <p className="text-sm text-olive/70">
        Проверяйте карточки объектов, оставляйте комментарии и публикуйте готовые объявления.
      </p>
      <div className="rounded-xl bg-cream px-3 py-2 text-sm text-olive/80">
        Для модерации экскурсий используйте отдельную очередь:{" "}
        <Link href="/admin/moderation/excursions" className="font-semibold text-terra hover:underline">
          /admin/moderation/excursions
        </Link>
      </div>

      <form className="grid gap-3 rounded-2xl border border-olive/10 bg-white p-4 md:grid-cols-5">
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Статус</span>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            {moderationStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Локация</span>
          <select
            name="locationId"
            defaultValue={selectedLocationId}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            <option value="">Все локации</option>
            {locationDirectory.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Дата с</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Дата по</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Поиск</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Название, адрес, владелец..."
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          />
        </label>
        <button
          type="submit"
          className="md:col-span-5 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Применить фильтры
        </button>
      </form>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-olive/70">
          Подкаталоги по городам
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={buildFilterLink("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !selectedLocationId ? "bg-primary text-white" : "bg-cream text-olive hover:bg-sage/35"
            }`}
          >
            Все ({items.length})
          </Link>
          {sortedLocationBuckets.map((bucket) => (
            <Link
              key={bucket.id}
              href={buildFilterLink(bucket.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedLocationId === bucket.id
                  ? "bg-primary text-white"
                  : "bg-cream text-olive hover:bg-sage/35"
              }`}
            >
              {bucket.name} ({bucket.count})
            </Link>
          ))}
        </div>
      </section>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/70">
          По текущим фильтрам объектов не найдено.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg text-olive">{item.name ?? "Объект без названия"}</h2>
                  <p className="text-xs text-olive/60">ID: {item.id}</p>
                </div>
                <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold text-olive">
                  {getPropertyWorkflowStatusLabel(
                    item.status,
                    item.moderationNotes,
                    item.pendingEditStatus,
                  )}
                </span>
              </div>

              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Владелец</dt>
                  <dd className="font-medium text-olive">
                    {item.owner.firstName} {item.owner.lastName}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Email владельца</dt>
                  <dd className="font-medium text-olive">{item.owner.email}</dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Локация</dt>
                  <dd className="font-medium text-olive">{item.locationName ?? "Не указана"}</dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Активных номеров</dt>
                  <dd className="font-medium text-olive">{item.rooms.length}</dd>
                </div>
              </dl>

              <p className="mt-3 text-sm text-olive/75">
                Рейтинг: {Number(item.avgRating).toFixed(1)} ({item.reviewsCount} отзывов)
              </p>

              {item.moderationNotes ? (
                <p className="mt-3 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                  Последний комментарий модератора: {item.moderationNotes}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-olive/60">
                  Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                </p>
                <Link
                  href={`/admin/moderation/${item.id}`}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Открыть карточку модерации
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
