import { TransferStatus } from "@prisma/client";
import { ArrowUpRight, Car } from "lucide-react";
import Link from "next/link";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { ListingStatsButton } from "@/components/statistics/listing-stats-button";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import { buildPublicTransferPath } from "@/lib/public-marketplace";
import { applyPublishedTransferSnapshotToRow } from "@/lib/transfer-public-snapshot";
import {
  deriveTransferSummaryFromFleet,
  getTransferFleet,
  getTransferStatusLabel,
  getTransferWorkflowStatus,
} from "@/lib/transfers";

type AdminTransfersPageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<TransferStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_MODERATION: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function AdminTransfersPage({ searchParams }: AdminTransfersPageProps) {
  const filters = await searchParams;
  const selectedStatus = filters.status?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const rows = await db.transfer.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: { select: { firstName: true, phone: true, avatarUrl: true } },
      location: { select: { name: true } },
      district: { select: { name: true } },
    },
  });

  const statusCounts = rows.reduce(
    (acc, item) => {
      const workflowStatus = getTransferWorkflowStatus(item.status, item.pendingEditStatus ?? null);
      acc[workflowStatus] = (acc[workflowStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<TransferStatus, number>,
  );

  const statusFiltered =
    selectedStatus && selectedStatus in TransferStatus
      ? rows.filter(
          (item) =>
            getTransferWorkflowStatus(item.status, item.pendingEditStatus ?? null) ===
            selectedStatus,
        )
      : rows;
  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          statusFiltered,
          (item) => [
            item.title,
            item.transferType,
            item.vehicleClass,
            item.vehicleModel,
            item.location?.name,
            item.locationName,
            item.routeExamples,
            item.owner.firstName,
            item.owner.phone,
          ],
          { limit: statusFiltered.length, minScore: 0.08 },
        )
      : statusFiltered;

  const buildFilterLink = (overrides: Record<string, string> = {}): string => {
    const params = new URLSearchParams();
    const status = overrides.status ?? selectedStatus;
    const nextQuery = overrides.q ?? query;
    if (status) params.set("status", status);
    if (nextQuery) params.set("q", nextQuery);
    const search = params.toString();
    return search ? `/admin/transfers?${search}` : "/admin/transfers";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Трансферы"
        description="Карточки водителей, автомобилей и маршрутов. Водители создают их в личном кабинете, администратор проверяет и публикует."
      />

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select name="status" defaultValue={selectedStatus} className={adminInputClass}>
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({statusCounts[value as TransferStatus] ?? 0})
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
              placeholder="Водитель, город, авто, маршрут"
              className={adminInputClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover md:w-auto"
            >
              Найти
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <AdminPillLink href={buildFilterLink({ status: "" })} active={!selectedStatus}>
            Все ({rows.length})
          </AdminPillLink>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <AdminPillLink
              key={value}
              href={buildFilterLink({ status: value })}
              active={selectedStatus === value}
            >
              {label} ({statusCounts[value as TransferStatus] ?? 0})
            </AdminPillLink>
          ))}
        </div>
      </AdminPanel>

      {items.length === 0 ? (
        <AdminEmptyState
          title="Трансферы не найдены"
          description="Измените фильтры или дождитесь, пока водитель создаст карточку."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const workflowStatus = getTransferWorkflowStatus(
              item.status,
              item.pendingEditStatus ?? null,
            );
            const publicItem = applyPublishedTransferSnapshotToRow(item);
            const publicPath =
              item.status === TransferStatus.PUBLISHED && item.isPublishedVisible
                ? buildPublicTransferPath({ id: item.id, title: publicItem.title })
                : null;
            const summary = deriveTransferSummaryFromFleet(item);
            const firstPhoto = summary.primaryVehicle?.photoUrl ?? item.photoUrls[0] ?? null;
            const fleet = getTransferFleet(item);

            return (
              <article
                key={item.id}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-cream ring-1 ring-olive/10">
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstPhoto}
                          alt={item.title ?? "Трансфер"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Car className="h-6 w-6 text-olive/35" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-olive">
                          {item.title || "Трансфер без названия"}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[workflowStatus]}`}
                        >
                          {getTransferStatusLabel(item.status, item.pendingEditStatus ?? null)}
                        </span>
                        {!item.isPublishedVisible ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            Скрыт из публикации
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-olive/58">
                        {item.owner.firstName}
                        {item.owner.phone ? ` • ${item.owner.phone}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-olive/58">
                        {item.location?.name ?? item.locationName ?? "Город не указан"}
                        {item.vehicleModel ? ` • ${item.vehicleModel}` : ""}
                        {item.transferType ? ` • ${item.transferType}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-olive/65">
                        <span className="rounded-full border border-olive/12 px-2.5 py-1">
                          {(item.priceFrom ?? summary.priceFrom)
                            ? `от ${Number(item.priceFrom ?? summary.priceFrom).toLocaleString("ru-RU")} ₽`
                            : "Цена не указана"}
                        </span>
                        {fleet.length > 1 ? (
                          <span className="rounded-full border border-olive/12 px-2.5 py-1">
                            Автопарк: {fleet.length}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-dashed border-olive/12 px-2.5 py-1 text-olive/45">
                          {item.reviewsCount > 0 && Number(item.avgRating) > 0
                            ? `${Number(item.avgRating).toFixed(1)} • ${item.reviewsCount} отзывов`
                            : "Пока без рейтинга"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ListingStatsButton
                      endpoint={`/api/admin/statistics/listing?entityType=transfer&id=${item.id}`}
                      entityName={item.title || "Трансфер без названия"}
                      storageKey={`admin:transfer:${item.id}`}
                      buttonLabel="Аналитика"
                    />
                    <Link
                      href={`/admin/transfers/${item.id}`}
                      className="rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Проверить
                    </Link>
                    {item.status === TransferStatus.PUBLISHED ? (
                      <AdminListingVisibilityToggle
                        endpoint={`/api/admin/transfers/${item.id}`}
                        entityLabel="трансфер"
                        isVisible={item.isPublishedVisible}
                      />
                    ) : null}
                    {publicPath ? (
                      <Link
                        href={publicPath}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary/8 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/12"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Открыть
                      </Link>
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
