// Next.js page for route /admin/applications.
import { ApplicationEntityType, ApplicationStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import {
  getApplicationEntityTypeLabel,
  getApplicationStatusLabel,
  serializeApplication,
} from "@/lib/applications";
import { getLocationDirectoryItems } from "@/lib/location-directory";

type AdminApplicationsPageProps = {
  searchParams: Promise<{
    status?: string;
    entityType?: string;
    locationId?: string;
    q?: string;
  }>;
};

const applicationStatuses = [
  { id: "ALL", label: "Все статусы" },
  { id: "NEW", label: "Новые" },
  { id: "IN_PROGRESS", label: "В работе" },
  { id: "CLOSED", label: "Закрытые" },
] as const;

const entityTypes = [
  { id: "ALL", label: "Все типы" },
  { id: "PROPERTY", label: "Жилье" },
  { id: "EXCURSION", label: "Экскурсии" },
] as const;

function statusBadgeClass(status: ApplicationStatus): string {
  if (status === ApplicationStatus.NEW) {
    return "bg-terra/15 text-terra";
  }

  if (status === ApplicationStatus.IN_PROGRESS) {
    return "bg-sage/30 text-olive";
  }

  return "bg-primary/15 text-olive";
}

function getLocationFilter(locationId: string): Prisma.ApplicationWhereInput {
  return {
    OR: [
      {
        property: {
          locationId,
        },
      },
      {
        excursion: {
          locationId,
        },
      },
    ],
  };
}

export default async function AdminApplicationsPage({ searchParams }: AdminApplicationsPageProps) {
  const filters = await searchParams;
  const locationDirectory = await getLocationDirectoryItems();
  const selectedStatus =
    filters.status === "ALL"
      ? "ALL"
      : filters.status && Object.values(ApplicationStatus).includes(filters.status as ApplicationStatus)
        ? (filters.status as ApplicationStatus)
        : "ALL";
  const selectedEntityType =
    filters.entityType === "ALL"
      ? "ALL"
      : filters.entityType &&
          Object.values(ApplicationEntityType).includes(filters.entityType as ApplicationEntityType)
        ? (filters.entityType as ApplicationEntityType)
        : "ALL";
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const rows = await db.application.findMany({
    where: {
      ...(selectedStatus !== "ALL" ? { status: selectedStatus } : {}),
      ...(selectedEntityType !== "ALL" ? { entityType: selectedEntityType } : {}),
      ...(selectedLocationId ? getLocationFilter(selectedLocationId) : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      property: {
        select: {
          id: true,
          name: true,
          locationName: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      excursion: {
        select: {
          id: true,
          title: true,
          locationName: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      room: { select: { title: true } },
      guestUser: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          rows,
          (item) => [
            item.contactName,
            item.contactPhone,
            item.contactEmail,
            item.message,
            item.property?.name,
            item.excursion?.title,
            item.property?.locationName,
            item.excursion?.locationName,
            item.guestUser ? `${item.guestUser.firstName} ${item.guestUser.lastName}` : null,
            item.guestUser?.email,
            item.property
              ? `${item.property.owner.firstName} ${item.property.owner.lastName} ${item.property.owner.email}`
              : null,
            item.excursion
              ? `${item.excursion.owner.firstName} ${item.excursion.owner.lastName} ${item.excursion.owner.email}`
              : null,
          ],
          { limit: rows.length, minScore: 0.08 },
        )
      : rows;

  const stats = {
    total: items.length,
    newCount: items.filter((item) => item.status === ApplicationStatus.NEW).length,
    inProgressCount: items.filter((item) => item.status === ApplicationStatus.IN_PROGRESS).length,
    closedCount: items.filter((item) => item.status === ApplicationStatus.CLOSED).length,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-olive">Заявки (админ)</h1>
      <p className="text-sm text-olive/70">
        Просмотр всех заявок по жилью и экскурсиям с фильтрами по статусу, типу и городу.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Всего</p>
          <p className="text-xl font-semibold text-olive">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Новые</p>
          <p className="text-xl font-semibold text-olive">{stats.newCount}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">В работе</p>
          <p className="text-xl font-semibold text-olive">{stats.inProgressCount}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Закрытые</p>
          <p className="text-xl font-semibold text-olive">{stats.closedCount}</p>
        </div>
      </div>

      <form className="grid gap-3 rounded-2xl border border-olive/10 bg-white p-4 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Статус</span>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            {applicationStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Тип</span>
          <select
            name="entityType"
            defaultValue={selectedEntityType}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            {entityTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Город</span>
          <select
            name="locationId"
            defaultValue={selectedLocationId}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            <option value="">Все города</option>
            {locationDirectory.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Поиск (триграммы)</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Контакт, объект, организатор..."
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          />
        </label>
        <button
          type="submit"
          className="md:col-span-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Применить фильтры
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/70">
          Заявки не найдены.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const normalized = serializeApplication(item);
            const ownerLabel =
              item.entityType === ApplicationEntityType.PROPERTY && item.property
                ? `${item.property.owner.firstName} ${item.property.owner.lastName}`
                : item.entityType === ApplicationEntityType.EXCURSION && item.excursion
                  ? `${item.excursion.owner.firstName} ${item.excursion.owner.lastName}`
                  : "Не определен";
            const ownerEmail =
              item.entityType === ApplicationEntityType.PROPERTY && item.property
                ? item.property.owner.email
                : item.entityType === ApplicationEntityType.EXCURSION && item.excursion
                  ? item.excursion.owner.email
                  : "-";
            const locationName =
              item.entityType === ApplicationEntityType.PROPERTY
                ? item.property?.locationName ?? "Не указана"
                : item.excursion?.locationName ?? "Не указана";

            return (
              <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg text-olive">{normalized.entityTitle ?? "Объявление"}</h2>
                    <p className="text-xs text-olive/60">ID заявки: {item.id}</p>
                    <p className="text-xs text-olive/60">
                      Тип: {getApplicationEntityTypeLabel(item.entityType)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}
                  >
                    {getApplicationStatusLabel(item.status)}
                  </span>
                </div>

                <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Даты</dt>
                    <dd className="font-medium text-olive">
                      {normalized.dateFrom} - {normalized.dateTo}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Гости / размещение</dt>
                    <dd className="font-medium text-olive">
                      {item.guestsCount} /{" "}
                      {item.entityType === ApplicationEntityType.PROPERTY
                        ? (item.room?.title ?? "Любой номер")
                        : "Без номера"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Локация</dt>
                    <dd className="font-medium text-olive">{locationName}</dd>
                  </div>
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Создана</dt>
                    <dd className="font-medium text-olive">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 rounded-xl bg-cream/70 p-3 text-sm text-olive/80">
                  <p>
                    <span className="font-semibold text-olive">Контакт:</span> {item.contactName}
                  </p>
                  <p>
                    <span className="font-semibold text-olive">Телефон:</span> {item.contactPhone}
                  </p>
                  <p>
                    <span className="font-semibold text-olive">Email:</span> {item.contactEmail}
                  </p>
                  <p>
                    <span className="font-semibold text-olive">Владелец:</span> {ownerLabel} ({ownerEmail})
                  </p>
                  <p>
                    <span className="font-semibold text-olive">Гость в системе:</span>{" "}
                    {item.guestUser ? `${item.guestUser.firstName} ${item.guestUser.lastName}` : "Не определен"}{" "}
                    ({item.guestUser?.email ?? "-"})
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-olive">Комментарий:</span>{" "}
                    {item.message?.trim() ? item.message : "Без комментария"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

