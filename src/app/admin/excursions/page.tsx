import Link from "next/link";
import { ExcursionOfferType, ExcursionStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import { ListingStatsButton } from "@/components/statistics/listing-stats-button";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { purgeExpiredDeletedExcursions } from "@/lib/admin-entity-lifecycle";
import {
  isExcursionSoftDeleteAvailable,
  isExcursionVisibilityControlAvailable,
} from "@/lib/admin-schema-compat";
import { getAdminExcursionStatusLabel } from "@/lib/admin-status";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { getEmptyDraftExpiresAt } from "@/lib/draft-cleanup";
import { EXCURSION_EMPTY_DRAFT_SELECT, isExcursionEmptyDraft } from "@/lib/excursions";
import { rankByTrigram } from "@/lib/fuzzy";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { resolvePaymentPlacementValidUntil } from "@/lib/payments";

type Props = {
  searchParams: Promise<{
    status?: string;
    locationId?: string;
    q?: string;
  }>;
};

const STATUS_LABELS: Record<ExcursionStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликовано",
  NEEDS_FIX: "Нужна доработка",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<ExcursionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_MODERATION: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  NEEDS_FIX: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function AdminExcursionsPage({ searchParams }: Props) {
  const filters = await searchParams;
  const selectedStatus = filters.status?.trim() ?? "";
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  await purgeExpiredDeletedExcursions(db, new Date());
  const [isExcursionVisibilityAvailable, isExcursionSoftDeleteControlsAvailable] =
    await Promise.all([
      isExcursionVisibilityControlAvailable(),
      isExcursionSoftDeleteAvailable(),
    ]);
  const excursionVisibilityUnavailableReason = isExcursionVisibilityAvailable
    ? null
    : "Переключение видимости недоступно, пока база данных не обновлена до миграции публикации.";
  const excursionSoftDeleteUnavailableReason = isExcursionSoftDeleteControlsAvailable
    ? null
    : "Скрытие и восстановление программы недоступны, пока база данных не обновлена до последней миграции.";

  const locationDirectory = await getLocationDirectoryItems();

  const { rows, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-excursions-list",
      unavailableMessage:
        "Admin excursions list: database is unavailable. Rendering empty excursion list.",
      fallbackEligibleMessage:
        "Admin excursions list: database is unavailable or credentials are invalid. Rendering empty excursion list.",
    },
    async () => ({
      rows: await db.excursion.findMany({
        where: {
          ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
          deletedAt: null,
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          ...EXCURSION_EMPTY_DRAFT_SELECT,
          publicId: true,
          offerType: true,
          isPublishedVisible: true,
          deletedAt: true,
          deletionExpiresAt: true,
          updatedAt: true,
          payments: {
            where: { status: "SUCCEEDED" },
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              paidAt: true,
              createdAt: true,
              placementValidUntil: true,
              providerPayload: true,
            },
          },
          owner: {
            select: { firstName: true, phone: true },
          },
          mainLocation: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      isDatabaseFallback: false,
    }),
    { rows: [], isDatabaseFallback: true },
  );

  const filteredRows =
    selectedStatus && selectedStatus in ExcursionStatus
      ? rows.filter((item) => {
          const status = selectedStatus as ExcursionStatus;
          if (status !== ExcursionStatus.PUBLISHED) {
            return item.status === status;
          }

          return (
            item.status === ExcursionStatus.PUBLISHED &&
            item.deletedAt === null &&
            item.isPublishedVisible
          );
        })
      : rows;

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          filteredRows,
          (item) => [
            item.title,
            item.publicId?.toString(),
            item.locationName,
            item.description,
            item.owner.firstName,
          ],
          { limit: filteredRows.length, minScore: 0.08 },
        )
      : filteredRows;

  const statusCounts = rows.reduce(
    (acc, item) => {
      const counterKey =
        item.status === ExcursionStatus.PUBLISHED && (item.deletedAt || !item.isPublishedVisible)
          ? "__hidden_published__"
          : item.status;
      if (counterKey !== "__hidden_published__") {
        acc[counterKey] = (acc[counterKey] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
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
    return search ? `/admin/excursions?${search}` : "/admin/excursions";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Каталог экскурсий"
        description="Карточки экскурсий, статусы публикации и быстрый переход в редактор."
        actions={
          <Link
            href="/admin/excursions/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Новая экскурсия
          </Link>
        }
      />

      {isDatabaseFallback ? (
        <AdminNotice>
          Список временно недоступен. Данные могут быть неполными до восстановления подключения.
        </AdminNotice>
      ) : null}

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select name="status" defaultValue={selectedStatus} className={adminInputClass}>
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({statusCounts[value] ?? 0})
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
            const count = statusCounts[value] ?? 0;
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
              item.status === ExcursionStatus.DRAFT && isExcursionEmptyDraft(item);
            const cleanupAt = isEmptyDraft ? getEmptyDraftExpiresAt(item.updatedAt) : null;
            const isPublished = item.status === ExcursionStatus.PUBLISHED;
            const isPendingDeletion = Boolean(item.deletedAt);
            const latestSucceededPayment = item.payments[0] ?? null;
            const publicationUntil = latestSucceededPayment
              ? resolvePaymentPlacementValidUntil(latestSucceededPayment)
              : null;

            return (
              <article
                key={item.id}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-olive">
                        {item.title || "Экскурсия без названия"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status]}`}
                      >
                        {getAdminExcursionStatusLabel(item.status)}
                      </span>
                      {isPublished && !item.isPublishedVisible && !isPendingDeletion ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Скрыта из публикации
                        </span>
                      ) : null}
                      {isPendingDeletion ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          Удаляется
                        </span>
                      ) : null}
                      <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-olive/60">
                        {item.offerType === ExcursionOfferType.TOUR ? "Тур" : "Экскурсия"}
                      </span>
                      {isEmptyDraft ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Пустой черновик
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-olive/50">
                      ID {item.offerType === ExcursionOfferType.TOUR ? "тура" : "экскурсии"}:{" "}
                      {item.publicId ?? "—"} · Технический ID: {item.id}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Владелец</dt>
                    <dd className="font-medium text-olive">
                      {item.owner.firstName}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Локация</dt>
                    <dd className="font-medium text-olive">
                      {item.mainLocation?.name ?? item.locationName ?? "Не указана"}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Категория</dt>
                    <dd className="font-medium text-olive">{item.category?.name ?? "Не указана"}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Публикация</dt>
                    <dd className="font-medium text-olive">
                      {isPendingDeletion
                        ? "Удаляется"
                        : isPublished
                          ? item.isPublishedVisible
                            ? "Показывается"
                            : "Скрыта"
                          : "Не опубликована"}
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
                    <dt className="text-olive/50">Цена</dt>
                    <dd className="font-medium text-olive">
                      {item.priceFrom
                        ? `от ${Number(item.priceFrom).toLocaleString("ru-RU")} ₽`
                        : "По запросу"}
                    </dd>
                  </div>
                </dl>

                {cleanupAt ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Если этот пустой черновик не трогать, система удалит его автоматически{" "}
                    {cleanupAt.toLocaleString("ru-RU")}.
                  </div>
                ) : null}

                {isPendingDeletion ? (
                  <div className="mt-4 space-y-2 rounded-2xl bg-terra/10 px-4 py-3 text-sm text-olive/85">
                    <p>
                      Программа снята с публикации и ожидает удаления с{" "}
                      <span className="font-semibold">
                        {new Date(item.deletedAt!).toLocaleString("ru-RU")}
                      </span>
                      . Отменить удаление можно до{" "}
                      <span className="font-semibold">
                        {item.deletionExpiresAt
                          ? new Date(item.deletionExpiresAt).toLocaleString("ru-RU")
                          : "—"}
                      </span>
                      .
                    </p>
                    <AdminSoftDeleteAction
                      deleteEndpoint={`/api/admin/excursions/${item.id}`}
                      restoreEndpoint={`/api/admin/excursions/${item.id}/restore`}
                      entityLabel="программу"
                      entityName={item.title ?? "Экскурсия без названия"}
                      isPendingDeletion
                      restoreUntil={item.deletionExpiresAt?.toISOString() ?? null}
                      disabled={!isExcursionSoftDeleteControlsAvailable}
                      disabledReason={excursionSoftDeleteUnavailableReason}
                    />
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-olive/50">
                    Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <ListingStatsButton
                      endpoint={`/api/admin/statistics/listing?entityType=excursion&id=${item.id}`}
                      entityName={item.title ?? "Экскурсия без названия"}
                      storageKey={`admin:excursion:${item.id}`}
                      buttonLabel="Аналитика"
                    />
                    <Link
                      href={`/admin/excursions/${item.id}`}
                      className="rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Редактировать
                    </Link>
                    {item.status === ExcursionStatus.PENDING_MODERATION ? (
                      <Link
                        href={`/admin/moderation/excursions/${item.id}`}
                        className="rounded-2xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-200"
                      >
                        Открыть модерацию
                      </Link>
                    ) : null}
                    {isPublished && !isPendingDeletion ? (
                      <AdminListingVisibilityToggle
                        endpoint={`/api/admin/excursions/${item.id}`}
                        entityLabel="программу"
                        isVisible={item.isPublishedVisible}
                        disabled={!isExcursionVisibilityAvailable}
                        disabledReason={excursionVisibilityUnavailableReason}
                      />
                    ) : null}
                    {isPublished && !isPendingDeletion ? (
                      <AdminSoftDeleteAction
                        deleteEndpoint={`/api/admin/excursions/${item.id}`}
                        restoreEndpoint={`/api/admin/excursions/${item.id}/restore`}
                        entityLabel="программу"
                        entityName={item.title ?? "Экскурсия без названия"}
                        isPendingDeletion={false}
                        restoreUntil={item.deletionExpiresAt?.toISOString() ?? null}
                        disabled={!isExcursionSoftDeleteControlsAvailable}
                        disabledReason={excursionSoftDeleteUnavailableReason}
                        deleteButtonLabel="Удалить"
                      />
                    ) : null}
                    {item.status === ExcursionStatus.DRAFT ? (
                      <AdminDeleteDraftButton
                        endpoint={`/api/admin/excursions/${item.id}`}
                        draftLabel="Черновик экскурсии"
                        entityName={item.title ?? "Экскурсия без названия"}
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
