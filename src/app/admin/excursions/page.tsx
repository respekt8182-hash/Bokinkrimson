// Admin page: all excursions with filters and management actions.
import Link from "next/link";
import { ExcursionStatus, ExcursionOfferType } from "@prisma/client";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";

type Props = {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
};

const STATUS_LABELS: Record<ExcursionStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликована",
  NEEDS_FIX: "Нужна доработка",
  REJECTED: "Отклонена",
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
  const query = filters.q?.trim() ?? "";

  const rows = await db.excursion.findMany({
    where: {
      ...(selectedStatus && selectedStatus in ExcursionStatus
        ? { status: selectedStatus as ExcursionStatus }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: {
        select: { firstName: true, lastName: true, phone: true },
      },
      mainLocation: { select: { name: true } },
      category: { select: { name: true } },
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
            item.description,
            `${item.owner.firstName} ${item.owner.lastName}`,
          ],
          { limit: rows.length, minScore: 0.08 },
        )
      : rows;

  const statusCounts = rows.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-olive">Экскурсии и туры</h1>
          <p className="mt-1 text-sm text-olive/55">
            Все экскурсии и туры. Создание, редактирование, назначение владельцев.
          </p>
        </div>
        <Link
          href="/admin/excursions/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Создать
        </Link>
      </div>

      {/* Filters */}
      <form className="grid gap-3 rounded-2xl border border-olive/10 bg-white p-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Статус</span>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({statusCounts[value] ?? 0})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Поиск</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Название, локация, владелец..."
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white md:col-span-2"
        >
          Применить
        </button>
      </form>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/excursions"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !selectedStatus ? "bg-primary text-white" : "bg-cream text-olive hover:bg-sand"
          }`}
        >
          Все ({rows.length})
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => {
          const count = statusCounts[value] ?? 0;
          if (count === 0) return null;
          return (
            <Link
              key={value}
              href={`/admin/excursions?status=${value}${query ? `&q=${query}` : ""}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedStatus === value
                  ? "bg-primary text-white"
                  : "bg-cream text-olive hover:bg-sand"
              }`}
            >
              {label} ({count})
            </Link>
          );
        })}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-olive/30 p-6 text-center text-sm text-olive/60">
          Экскурсии не найдены.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-olive/10 bg-white p-4 transition-colors hover:border-olive/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-olive">
                      {item.title || "Без названия"}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_COLORS[item.status]
                      }`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-olive/60">
                      {item.offerType === ExcursionOfferType.TOUR ? "Тур" : "Экскурсия"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-olive/50">ID: {item.id}</p>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl bg-cream/80 px-3 py-2">
                  <dt className="text-olive/50">Владелец</dt>
                  <dd className="font-medium text-olive">
                    {item.owner.firstName} {item.owner.lastName}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream/80 px-3 py-2">
                  <dt className="text-olive/50">Локация</dt>
                  <dd className="font-medium text-olive">
                    {item.mainLocation?.name ?? item.locationName ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream/80 px-3 py-2">
                  <dt className="text-olive/50">Категория</dt>
                  <dd className="font-medium text-olive">{item.category?.name ?? "—"}</dd>
                </div>
                <div className="rounded-xl bg-cream/80 px-3 py-2">
                  <dt className="text-olive/50">Цена</dt>
                  <dd className="font-medium text-olive">
                    {item.priceFrom ? `от ${Number(item.priceFrom).toLocaleString("ru-RU")} ₽` : "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-olive/50">
                  Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/excursions/${item.id}`}
                    className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
                  >
                    Редактировать
                  </Link>
                  {item.status === ExcursionStatus.PENDING_MODERATION && (
                    <Link
                      href={`/admin/moderation/excursions/${item.id}`}
                      className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
                    >
                      Модерация
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
