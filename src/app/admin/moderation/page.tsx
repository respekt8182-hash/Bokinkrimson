import Link from "next/link";
import { PropertyStatus } from "@prisma/client";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getPropertyWorkflowStatusLabel } from "@/lib/properties";

type ModerationQueuePageProps = {
  searchParams: Promise<{
    status?: string;
    locationId?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
  }>;
};

const DEFAULT_STATUS = PropertyStatus.PENDING_MODERATION;

const moderationStatuses = [
  { id: PropertyStatus.PENDING_MODERATION, label: "На модерации" },
  { id: PropertyStatus.REJECTED, label: "Отклонено" },
  { id: PropertyStatus.PUBLISHED, label: "Опубликовано" },
  { id: PropertyStatus.DRAFT, label: "Черновик" },
  { id: "ALL", label: "Все статусы" },
] as const;

function matchesPropertyWorkflowStatus(
  item: { status: PropertyStatus; pendingEditStatus: PropertyStatus | null },
  status: PropertyStatus,
) {
  if (status === PropertyStatus.PUBLISHED) {
    return item.status === PropertyStatus.PUBLISHED && item.pendingEditStatus === null;
  }

  return (
    item.status === status ||
    (item.status === PropertyStatus.PUBLISHED && item.pendingEditStatus === status)
  );
}

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
        : DEFAULT_STATUS;
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const { rows, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-moderation-queue",
      unavailableMessage:
        "Admin moderation queue: database is unavailable. Rendering empty moderation list.",
      fallbackEligibleMessage:
        "Admin moderation queue: database is unavailable or credentials are invalid. Rendering empty moderation list.",
    },
    async () => ({
      rows: await db.property.findMany({
        where: {
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
              email: true,
            },
          },
          rooms: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      }),
      isDatabaseFallback: false,
    }),
    { rows: [], isDatabaseFallback: true },
  );

  const filteredRows =
    selectedStatus === "ALL"
      ? rows
      : rows.filter((item) => matchesPropertyWorkflowStatus(item, selectedStatus));

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          filteredRows,
          (item) => [
            item.name,
            item.locationName,
            item.address,
            item.description,
            item.type,
            item.owner.firstName,
            item.owner.email,
          ],
          { limit: filteredRows.length, minScore: 0.08 },
        )
      : filteredRows;

  const statusCounts = Object.values(PropertyStatus).reduce(
    (accumulator, status) => ({
      ...accumulator,
      [status]: rows.filter((item) => matchesPropertyWorkflowStatus(item, status)).length,
    }),
    {} as Record<PropertyStatus, number>,
  );

  const locationBuckets = items.reduce((accumulator, item) => {
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
  }, new Map<string, { id: string; name: string; count: number }>());

  const sortedLocationBuckets = Array.from(locationBuckets.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.name.localeCompare(right.name, "ru");
  });

  const buildFilterLink = (overrides: Record<string, string> = {}): string => {
    const params = new URLSearchParams();
    const status = overrides.status ?? String(selectedStatus);
    const locationId = overrides.locationId ?? selectedLocationId;
    const nextDateFrom = overrides.dateFrom ?? dateFrom;
    const nextDateTo = overrides.dateTo ?? dateTo;
    const nextQuery = overrides.q ?? query;
    if (status) params.set("status", status);
    if (locationId) params.set("locationId", locationId);
    if (nextDateFrom) params.set("dateFrom", nextDateFrom);
    if (nextDateTo) params.set("dateTo", nextDateTo);
    if (nextQuery) params.set("q", nextQuery);
    const search = params.toString();
    return search ? `/admin/moderation?${search}` : "/admin/moderation";
  };

  const isDefaultPendingView =
    selectedStatus === DEFAULT_STATUS && !selectedLocationId && !dateFrom && !dateTo && !query;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Модерация жилья"
        description="Очередь карточек, которые требуют проверки и решения модератора."
      />

      {isDatabaseFallback ? (
        <AdminNotice>Очередь временно недоступна. Попробуйте обновить страницу позже.</AdminNotice>
      ) : null}

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select name="status" defaultValue={selectedStatus} className={adminInputClass}>
              {moderationStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                  {" ("}
                  {status.id === "ALL" ? rows.length : (statusCounts[status.id] ?? 0)}
                  {")"}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Локация</span>
            <select name="locationId" defaultValue={selectedLocationId} className={adminInputClass}>
              <option value="">Все локации</option>
              {locationDirectory.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Дата с</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className={adminInputClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Дата по</span>
            <input type="date" name="dateTo" defaultValue={dateTo} className={adminInputClass} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Поиск</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Название, адрес, владелец"
              className={adminInputClass}
            />
          </label>

          <button
            type="submit"
            className="md:col-span-5 inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Применить фильтры
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {moderationStatuses.map((status) => (
            <AdminPillLink
              key={status.id}
              href={buildFilterLink({ status: String(status.id) })}
              active={selectedStatus === status.id}
            >
              {status.label}
            </AdminPillLink>
          ))}
        </div>
      </AdminPanel>

      {sortedLocationBuckets.length > 0 ? (
        <AdminPanel title="Локации">
          <div className="flex flex-wrap gap-2">
            <AdminPillLink href={buildFilterLink({ locationId: "" })} active={!selectedLocationId}>
              Все ({items.length})
            </AdminPillLink>
            {sortedLocationBuckets.map((bucket) => (
              <AdminPillLink
                key={bucket.id}
                href={buildFilterLink({ locationId: bucket.id })}
                active={selectedLocationId === bucket.id}
              >
                {bucket.name} ({bucket.count})
              </AdminPillLink>
            ))}
          </div>
        </AdminPanel>
      ) : null}

      {items.length === 0 ? (
        <AdminEmptyState
          title={isDefaultPendingView ? "Новых карточек на проверке нет" : "Карточек не найдено"}
          description={
            isDatabaseFallback
              ? "Попробуйте открыть очередь позже."
              : isDefaultPendingView
                ? "Очередь чистая. Новые материалы появятся здесь автоматически."
                : "Измените фильтры или очистите поиск."
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const ownerEmail = item.owner.email?.trim();

            return (
              <article
                key={item.id}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-olive">
                      {item.name ?? "Жильё без названия"}
                    </h2>
                    <p className="mt-1 text-xs text-olive/50">ID: {item.id}</p>
                  </div>
                  <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold text-olive">
                    {getPropertyWorkflowStatusLabel(
                      item.status,
                      item.moderationNotes,
                      item.pendingEditStatus,
                    )}
                  </span>
                </div>

                <dl className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                  <div className="rounded-2xl bg-cream px-3 py-3">
                    <dt className="text-olive/60">Владелец</dt>
                    <dd className="font-medium text-olive">
                      {item.owner.firstName}
                    </dd>
                  </div>
                  {ownerEmail ? (
                    <div className="rounded-2xl bg-cream px-3 py-3">
                      <dt className="text-olive/60">Email</dt>
                      <dd className="font-medium text-olive">{ownerEmail}</dd>
                    </div>
                  ) : null}
                  <div className="rounded-2xl bg-cream px-3 py-3">
                    <dt className="text-olive/60">Локация</dt>
                    <dd className="font-medium text-olive">{item.locationName ?? "Не указана"}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream px-3 py-3">
                    <dt className="text-olive/60">Номеров</dt>
                    <dd className="font-medium text-olive">{item.rooms.length}</dd>
                  </div>
                </dl>

                {item.moderationNotes ? (
                  <p className="mt-4 rounded-2xl bg-terra/10 px-4 py-3 text-sm text-olive/85">
                    Последний комментарий модератора: {item.moderationNotes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-olive/50">
                    Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                  </p>
                  <Link
                    href={`/admin/moderation/${item.id}`}
                    className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  >
                    Открыть карточку
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
