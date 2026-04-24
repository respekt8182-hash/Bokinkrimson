import Link from "next/link";
import { PropertyStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  adminInputClass,
} from "@/components/admin/admin-ui";
import {
  getAdminPropertyBaseStatusLabel,
  getAdminPropertyPendingEditLabel,
} from "@/lib/admin-status";
import { isPropertyPublicationControlAvailable } from "@/lib/admin-schema-compat";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { getEmptyDraftExpiresAt } from "@/lib/draft-cleanup";
import { rankByTrigram } from "@/lib/fuzzy";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { resolvePaymentPlacementValidUntil } from "@/lib/payments";
import { isPropertyEmptyDraft } from "@/lib/properties";

type Props = {
  searchParams: Promise<{
    status?: string;
    locationId?: string;
    q?: string;
  }>;
};

const STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<PropertyStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_MODERATION: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

function matchesPropertyWorkflowStatus(
  item: {
    status: PropertyStatus;
    ownerDeletedAt: Date | null;
    isPublishedVisible: boolean;
  },
  status: PropertyStatus,
) {
  if (status === PropertyStatus.PUBLISHED) {
    return (
      item.status === PropertyStatus.PUBLISHED &&
      item.ownerDeletedAt === null &&
      item.isPublishedVisible
    );
  }

  return item.status === status;
}

export default async function AdminObjectsPage({ searchParams }: Props) {
  const filters = await searchParams;
  const now = new Date();
  const selectedStatus = filters.status?.trim() ?? "";
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  await purgeExpiredDeletedProperties(db, now);
  const isPropertyVisibilityControlAvailable = await isPropertyPublicationControlAvailable();
  const propertyVisibilityUnavailableReason = isPropertyVisibilityControlAvailable
    ? null
    : "Переключение видимости недоступно, пока база данных не обновлена до миграции публикации.";

  const locationDirectory = await getLocationDirectoryItems();

  const { rows, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-objects-list",
      unavailableMessage:
        "Admin objects list: database is unavailable. Rendering empty property list.",
      fallbackEligibleMessage:
        "Admin objects list: database is unavailable or credentials are invalid. Rendering empty property list.",
    },
    async () => ({
      rows: await db.property.findMany({
        where: {
          ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
          ownerDeletedAt: null,
        },
        orderBy: [{ updatedAt: "desc" }],
        include: {
          owner: {
            select: { firstName: true, lastName: true, email: true, phone: true },
          },
          amenities: {
            select: { amenityId: true },
          },
          customAmenities: {
            select: { name: true },
          },
          documents: {
            select: { id: true },
          },
          media: {
            where: { roomId: null },
            select: { id: true },
          },
          payments: {
            where: { status: "SUCCEEDED" },
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              paidAt: true,
              createdAt: true,
              placementValidUntil: true,
            },
            take: 1,
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
    selectedStatus && selectedStatus in PropertyStatus
      ? rows.filter((item) =>
          matchesPropertyWorkflowStatus(item, selectedStatus as PropertyStatus),
        )
      : rows;

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
            `${item.owner.firstName} ${item.owner.lastName}`,
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

  const buildFilterLink = (overrides: Record<string, string> = {}): string => {
    const params = new URLSearchParams();
    const status = overrides.status ?? selectedStatus;
    const locationId = overrides.locationId ?? selectedLocationId;
    const nextQuery = overrides.q ?? query;
    if (status) params.set("status", status);
    if (locationId) params.set("locationId", locationId);
    if (nextQuery) params.set("q", nextQuery);
    const search = params.toString();
    return search ? `/admin/objects?${search}` : "/admin/objects";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Жильё и размещение"
        description="Карточки жилья, владельцы, статусы и быстрый переход в редактор."
        actions={
          <Link
            href="/admin/objects/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Новое жильё
          </Link>
        }
      />

      {isDatabaseFallback ? (
        <AdminNotice>
          Список временно недоступен. Данные могут появиться не сразу после восстановления
          подключения.
        </AdminNotice>
      ) : null}

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select name="status" defaultValue={selectedStatus} className={adminInputClass}>
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => {
                const status = value as PropertyStatus;

                return (
                  <option key={value} value={value}>
                    {label} ({statusCounts[status] ?? 0})
                  </option>
                );
              })}
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
            <span className="text-sm font-medium text-olive">Поиск</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Название, локация, владелец"
              className={adminInputClass}
            />
          </label>

          <button
            type="submit"
            className="md:col-span-3 inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Применить фильтры
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <AdminPillLink href={buildFilterLink({ status: "" })} active={!selectedStatus}>
            Все ({rows.length})
          </AdminPillLink>
          {Object.entries(STATUS_LABELS).map(([value, label]) => {
            const status = value as PropertyStatus;
            const count = statusCounts[status] ?? 0;
            if (count === 0) return null;

            return (
              <AdminPillLink
                key={value}
                href={buildFilterLink({ status: value })}
                active={selectedStatus === value}
              >
                {label} ({count})
              </AdminPillLink>
            );
          })}
        </div>
      </AdminPanel>

      {items.length === 0 ? (
        <AdminEmptyState
          title="Карточек не найдено"
          description={
            isDatabaseFallback
              ? "Попробуйте открыть раздел позже."
              : "Измените фильтры или очистите поиск."
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isEmptyDraft =
              item.status === PropertyStatus.DRAFT && isPropertyEmptyDraft(item);
            const cleanupAt = isEmptyDraft ? getEmptyDraftExpiresAt(item.updatedAt) : null;
            const isPublished = item.status === PropertyStatus.PUBLISHED;
            const isPendingDeletion = Boolean(item.ownerDeletedAt);
            const latestSucceededPayment = item.payments[0] ?? null;
            const publicationUntil = latestSucceededPayment
              ? resolvePaymentPlacementValidUntil(latestSucceededPayment)
              : null;
            const pendingEditLabel = isPublished
              ? getAdminPropertyPendingEditLabel(item.pendingEditStatus, item.moderationNotes)
              : null;
            const showModerationLink =
              item.status === PropertyStatus.PENDING_MODERATION ||
              item.pendingEditStatus === PropertyStatus.PENDING_MODERATION;
            const primaryStatusLabel = getAdminPropertyBaseStatusLabel(item.status);

            return (
              <article
                key={item.id}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-olive">
                        {item.name ?? "Жильё без названия"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status]}`}
                      >
                        {primaryStatusLabel}
                      </span>
                      {pendingEditLabel ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          {pendingEditLabel}
                        </span>
                      ) : null}
                      {isPublished && !item.isPublishedVisible && !isPendingDeletion ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Скрыт из публикации
                        </span>
                      ) : null}
                      {isPendingDeletion ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          Удаляется
                        </span>
                      ) : null}
                      {item.type ? (
                        <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-olive/60">
                          {item.type}
                        </span>
                      ) : null}
                      {isEmptyDraft ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Пустой черновик
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-olive/50">ID: {item.id}</p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Владелец</dt>
                    <dd className="font-medium text-olive">
                      {item.owner.firstName} {item.owner.lastName}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Локация</dt>
                    <dd className="font-medium text-olive">{item.locationName ?? "Не указана"}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Номеров</dt>
                    <dd className="font-medium text-olive">{item.rooms.length}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Размещение</dt>
                    <dd className="font-medium text-olive">
                      {isPendingDeletion
                        ? "Удаляется"
                        : isPublished
                          ? item.isPublishedVisible
                            ? "Показывается"
                            : "Скрыто"
                          : "Не опубликован"}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Оплачено до</dt>
                    <dd className="font-medium text-olive">
                      {publicationUntil ? publicationUntil.toLocaleDateString("ru-RU") : "—"}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Последнее изменение</dt>
                    <dd className="font-medium text-olive">
                      {new Date(item.updatedAt).toLocaleString("ru-RU")}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Рейтинг</dt>
                    <dd className="font-medium text-olive">
                      {Number(item.avgRating).toFixed(1)} ({item.reviewsCount} отз.)
                    </dd>
                  </div>
                </dl>

                {cleanupAt ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Если этот пустой черновик не трогать, система удалит его автоматически{" "}
                    {cleanupAt.toLocaleString("ru-RU")}.
                  </div>
                ) : null}

                {item.ownerDeletedAt ? (
                  <div className="mt-4 space-y-2 rounded-2xl bg-terra/10 px-4 py-3 text-sm text-olive/85">
                    <p>
                      Карточка снята с публикации и ожидает удаления с{" "}
                      <span className="font-semibold">
                        {new Date(item.ownerDeletedAt).toLocaleString("ru-RU")}
                      </span>
                      . Отменить удаление можно до{" "}
                      <span className="font-semibold">
                        {item.ownerDeletionExpiresAt
                          ? new Date(item.ownerDeletionExpiresAt).toLocaleString("ru-RU")
                          : "—"}
                      </span>
                      .
                    </p>
                    <AdminSoftDeleteAction
                      deleteEndpoint={`/api/admin/properties/${item.id}`}
                      restoreEndpoint={`/api/admin/properties/${item.id}/restore`}
                      entityLabel="объект"
                      entityName={item.name ?? "Объект без названия"}
                      isPendingDeletion
                      restoreUntil={item.ownerDeletionExpiresAt?.toISOString() ?? null}
                    />
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-olive/50">
                    Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/objects/${item.id}`}
                      className="rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Редактировать
                    </Link>
                    {showModerationLink ? (
                      <Link
                        href={`/admin/moderation/${item.id}`}
                        className="rounded-2xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-200"
                      >
                        Открыть модерацию
                      </Link>
                    ) : null}
                    {isPublished && !isPendingDeletion ? (
                      <AdminListingVisibilityToggle
                        endpoint={`/api/admin/properties/${item.id}`}
                        entityLabel="объект"
                        isVisible={item.isPublishedVisible}
                        disabled={!isPropertyVisibilityControlAvailable}
                        disabledReason={propertyVisibilityUnavailableReason}
                      />
                    ) : null}
                    {isPublished && !isPendingDeletion ? (
                      <AdminSoftDeleteAction
                        deleteEndpoint={`/api/admin/properties/${item.id}`}
                        restoreEndpoint={`/api/admin/properties/${item.id}/restore`}
                        entityLabel="объект"
                        entityName={item.name ?? "Объект без названия"}
                        isPendingDeletion={false}
                        restoreUntil={item.ownerDeletionExpiresAt?.toISOString() ?? null}
                        deleteButtonLabel="Удалить"
                      />
                    ) : null}
                    {item.status === PropertyStatus.DRAFT ? (
                      <AdminDeleteDraftButton
                        endpoint={`/api/admin/properties/${item.id}`}
                        draftLabel="Черновик объекта"
                        entityName={item.name ?? "Объект без названия"}
                        buttonClassName="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                      />
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
