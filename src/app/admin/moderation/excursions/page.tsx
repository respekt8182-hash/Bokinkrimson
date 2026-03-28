// Next.js page for route /admin/moderation/excursions.
import Link from "next/link";
import { ExcursionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getExcursionStatusLabel } from "@/lib/excursions";
import { rankByTrigram } from "@/lib/fuzzy";
import { getLocationDirectoryItems } from "@/lib/location-directory";

type ExcursionModerationQueuePageProps = {
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
  { id: "NEEDS_FIX", label: "Требуют правки" },
  { id: "REJECTED", label: "Отклонены" },
  { id: "PUBLISHED", label: "Опубликованы" },
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

function buildFilterLink(input: {
  status: ExcursionStatus | "ALL";
  locationId: string;
  dateFrom: string;
  dateTo: string;
  q: string;
}): string {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.locationId) params.set("locationId", input.locationId);
  if (input.dateFrom) params.set("dateFrom", input.dateFrom);
  if (input.dateTo) params.set("dateTo", input.dateTo);
  if (input.q) params.set("q", input.q);
  const query = params.toString();
  return query ? `/admin/moderation/excursions?${query}` : "/admin/moderation/excursions";
}

export default async function ExcursionModerationQueuePage({
  searchParams,
}: ExcursionModerationQueuePageProps) {
  const filters = await searchParams;
  const locationDirectory = await getLocationDirectoryItems();
  const selectedStatus =
    filters.status === "ALL"
      ? "ALL"
      : filters.status && Object.values(ExcursionStatus).includes(filters.status as ExcursionStatus)
        ? (filters.status as ExcursionStatus)
        : "ALL";
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const rows = await db.excursion.findMany({
    where: {
      ...(selectedStatus !== "ALL" ? { status: selectedStatus } : {}),
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
    },
  });

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          rows,
          (item) => [
            item.title,
            item.locationName,
            item.startPoint,
            item.description,
            item.routeDescription,
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

      const id = item.locationId;
      const name = item.locationName;
      const existing = accumulator.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        accumulator.set(id, { id, name, count: 1 });
      }
      return accumulator;
    },
    new Map<string, { id: string; name: string; count: number }>(),
  );

  const sortedLocationBuckets = Array.from(locationBuckets.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.name.localeCompare(right.name, "ru");
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-olive">Модерация экскурсий</h1>
      <p className="text-sm text-olive/70">
        Проверяйте экскурсии, запрашивайте правки и публикуйте карточки в каталоге.
      </p>

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
          <span className="text-sm font-medium text-olive">Поиск (триграммы)</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Название, локация, организатор..."
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-olive/70">Подкаталоги по городам</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={buildFilterLink({
              status: selectedStatus,
              locationId: "",
              dateFrom,
              dateTo,
              q: query,
            })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !selectedLocationId
                ? "bg-primary text-white"
                : "bg-cream text-olive hover:bg-sage/35"
            }`}
          >
            Все ({items.length})
          </Link>
          {sortedLocationBuckets.map((bucket) => (
            <Link
              key={bucket.id}
              href={buildFilterLink({
                status: selectedStatus,
                locationId: bucket.id,
                dateFrom,
                dateTo,
                q: query,
              })}
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
          По текущим фильтрам экскурсии не найдены.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg text-olive">{item.title ?? "Экскурсия без названия"}</h2>
                  <p className="text-xs text-olive/60">ID: {item.id}</p>
                </div>
                <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold text-olive">
                  {getExcursionStatusLabel(item.status)}
                </span>
              </div>

              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Организатор</dt>
                  <dd className="font-medium text-olive">
                    {item.owner.firstName} {item.owner.lastName}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Email организатора</dt>
                  <dd className="font-medium text-olive">{item.owner.email}</dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Локация</dt>
                  <dd className="font-medium text-olive">{item.locationName ?? "Не указана"}</dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Цена</dt>
                  <dd className="font-medium text-olive">
                    {item.priceFrom ? `от ${Number(item.priceFrom).toFixed(0)} ${item.currency}` : "По запросу"}
                  </dd>
                </div>
              </dl>

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
                  href={`/admin/moderation/excursions/${item.id}`}
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

