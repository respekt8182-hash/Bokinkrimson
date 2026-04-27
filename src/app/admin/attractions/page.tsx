import { AttractionStatus } from "@prisma/client";
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import { buildPublicAttractionPath } from "@/lib/public-marketplace";

type AdminAttractionsPageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const STATUS_LABELS: Record<AttractionStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  HIDDEN: "Скрыто",
};

const STATUS_COLORS: Record<AttractionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  HIDDEN: "bg-slate-100 text-slate-700",
};

export default async function AdminAttractionsPage({ searchParams }: AdminAttractionsPageProps) {
  const filters = await searchParams;
  const selectedStatus = filters.status?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const rows = await db.attraction.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      location: { select: { name: true } },
      district: { select: { name: true } },
    },
  });

  const statusCounts = rows.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<AttractionStatus, number>,
  );

  const statusFiltered =
    selectedStatus && selectedStatus in AttractionStatus
      ? rows.filter((item) => item.status === selectedStatus)
      : rows;
  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          statusFiltered,
          (item) => [
            item.title,
            item.category,
            item.location?.name,
            item.locationName,
            item.district?.name,
            item.shortDescription,
            item.description,
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
    return search ? `/admin/attractions?${search}` : "/admin/attractions";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Достопримечательности"
        description="Ручной каталог мест, которые публикует администратор: природные точки, объекты, общественные места и другие интересные локации."
        actions={
          <Link
            href="/admin/attractions/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Новое место
          </Link>
        }
      />

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select name="status" defaultValue={selectedStatus} className={adminInputClass}>
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({statusCounts[value as AttractionStatus] ?? 0})
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
              placeholder="Название, город, категория"
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
              {label} ({statusCounts[value as AttractionStatus] ?? 0})
            </AdminPillLink>
          ))}
        </div>
      </AdminPanel>

      {items.length === 0 ? (
        <AdminEmptyState
          title="Мест не найдено"
          description="Измените фильтр или создайте новую достопримечательность."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const publicPath =
              item.status === AttractionStatus.PUBLISHED && item.isPublishedVisible
                ? buildPublicAttractionPath({ id: item.id, title: item.title })
                : null;

            return (
              <article
                key={item.id}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-olive">
                        {item.title || "Достопримечательность без названия"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      {!item.isPublishedVisible ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Скрыта из публикации
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-olive/58">
                      {item.location?.name ?? item.locationName ?? "Локация не указана"}
                      {item.category ? ` • ${item.category}` : ""}
                      {item.district?.name ? ` • ${item.district.name}` : ""}
                    </p>
                    {item.shortDescription ? (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-olive/68">
                        {item.shortDescription}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/attractions/${item.id}`}
                      className="rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Редактировать
                    </Link>
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
