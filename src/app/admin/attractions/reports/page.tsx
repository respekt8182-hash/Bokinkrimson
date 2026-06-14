import { AttractionReportStatus } from "@prisma/client";
import { ArrowUpRight, CheckCircle2, Clock3, Search } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  ATTRACTION_REPORT_REASON_LABELS,
  ATTRACTION_REPORT_STATUS_LABELS,
  type AttractionReportStatusCode,
} from "@/lib/attraction-reports";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { hasAdminPermission } from "@/lib/admin-rbac";
import { parseAdminPageParam, paginateAdminItems } from "@/lib/admin-pagination";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";

type AdminAttractionReportsPageProps = {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
};

const STATUS_VALUES = ["PENDING", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const;

const STATUS_COLORS: Record<AttractionReportStatusCode, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-900",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  DISMISSED: "border-slate-200 bg-slate-50 text-slate-700",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(value);
}

function formatDateOnly(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(value);
}

function getReporterName(report: {
  reporter: { firstName: string; lastName: string; phone: string };
}): string {
  const name = `${report.reporter.firstName} ${report.reporter.lastName}`.trim();
  return name || report.reporter.phone;
}

function isStatus(value: string | null | undefined): value is AttractionReportStatusCode {
  return STATUS_VALUES.includes(value as AttractionReportStatusCode);
}

async function updateAttractionReportStatus(formData: FormData) {
  "use server";

  const admin = await verifyAdminSession();
  if (!admin) {
    return;
  }
  if (!hasAdminPermission(admin.role, "content:manage")) {
    return;
  }

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isStatus(status)) {
    return;
  }

  const isClosed = status === "RESOLVED" || status === "DISMISSED";

  await db.attractionReport.update({
    where: { id },
    data: {
      status: status as AttractionReportStatus,
      resolvedByLogin: isClosed ? admin.login : null,
      resolvedAt: isClosed ? new Date() : null,
    },
  });

  revalidatePath("/admin/attractions/reports");
}

export default async function AdminAttractionReportsPage({
  searchParams,
}: AdminAttractionReportsPageProps) {
  const filters = await searchParams;
  const selectedStatus = isStatus(filters.status) ? filters.status : "";
  const query = filters.q?.trim().toLowerCase() ?? "";
  const requestedPage = parseAdminPageParam(filters.page);

  const rows = await db.attractionReport.findMany({
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const statusCounts = rows.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<AttractionReportStatusCode, number>,
  );

  const items = rows.filter((item) => {
    if (selectedStatus && item.status !== selectedStatus) {
      return false;
    }

    if (!query) {
      return true;
    }

    const reporterName = getReporterName(item).toLowerCase();
    return [
      item.attractionTitle,
      item.attractionId,
      item.attractionPath,
      item.reporter.phone,
      reporterName,
      ATTRACTION_REPORT_REASON_LABELS[item.reason],
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const pagination = paginateAdminItems(items, requestedPage);

  const buildFilterLink = (overrides: Record<string, string> = {}): string => {
    const params = new URLSearchParams();
    const status = overrides.status ?? selectedStatus;
    const nextQuery = overrides.q ?? query;
    const page = overrides.page ?? "";
    if (status) params.set("status", status);
    if (nextQuery) params.set("q", nextQuery);
    if (page && page !== "1") params.set("page", page);
    const search = params.toString();
    return search ? `/admin/attractions/reports?${search}` : "/admin/attractions/reports";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Достопримечательности"
        title="Сообщения об ошибках"
        description="Здесь собраны сигналы пользователей о неверной геопозиции, описании, фотографиях и устаревших данных в карточках досуга."
        actions={
          <Link
            href="/admin/attractions"
            className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
          >
            К каталогу
          </Link>
        }
      />

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select name="status" defaultValue={selectedStatus} className={adminInputClass}>
              <option value="">Все статусы</option>
              {STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {ATTRACTION_REPORT_STATUS_LABELS[status]} ({statusCounts[status] ?? 0})
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
              placeholder="Место, телефон, причина"
              className={adminInputClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover md:w-auto"
            >
              <Search className="h-4 w-4" />
              Найти
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <AdminPillLink href={buildFilterLink({ status: "" })} active={!selectedStatus}>
            Все ({rows.length})
          </AdminPillLink>
          {STATUS_VALUES.map((status) => (
            <AdminPillLink
              key={status}
              href={buildFilterLink({ status })}
              active={selectedStatus === status}
            >
              {ATTRACTION_REPORT_STATUS_LABELS[status]} ({statusCounts[status] ?? 0})
            </AdminPillLink>
          ))}
        </div>
      </AdminPanel>

      {items.length === 0 ? (
        <AdminEmptyState
          title="Сообщений нет"
          description="Когда пользователи отметят ошибку в карточке достопримечательности, она появится здесь."
        />
      ) : (
        <div className="space-y-3">
          {pagination.items.map((item) => {
            const status = item.status as AttractionReportStatusCode;
            const reasonLabel = ATTRACTION_REPORT_REASON_LABELS[item.reason];
            const reporterName = getReporterName(item);

            return (
              <article
                key={item.id}
                className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          STATUS_COLORS[status],
                        )}
                      >
                        {ATTRACTION_REPORT_STATUS_LABELS[status]}
                      </span>
                      <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
                        {reasonLabel}
                      </span>
                      {item.cooldownDays > 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          <Clock3 className="h-3.5 w-3.5" />
                          кулдаун {item.cooldownDays} дн.
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-lg font-semibold leading-snug text-olive">
                      {item.attractionTitle}
                    </h2>
                    <p className="mt-1 text-sm text-olive/58">
                      Отправил: {reporterName} · {item.reporter.phone}
                    </p>
                    <p className="mt-1 text-sm text-olive/58">
                      Дата: {formatDate(item.createdAt)} · отчётный день:{" "}
                      {formatDateOnly(item.reportDate)}
                    </p>
                    {item.resolvedByLogin && item.resolvedAt ? (
                      <p className="mt-1 text-sm text-olive/58">
                        Закрыл: {item.resolvedByLogin}, {formatDate(item.resolvedAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/attractions/${item.attractionId}`}
                      className="rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Редактировать
                    </Link>
                    <Link
                      href={item.attractionPath}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary/8 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/12"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      Открыть
                    </Link>
                  </div>
                </div>

                <form
                  action={updateAttractionReportStatus}
                  className="mt-4 flex flex-col gap-2 border-t border-olive/8 pt-4 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <select
                    name="status"
                    defaultValue={status}
                    className={cn(adminInputClass, "sm:max-w-[220px]")}
                  >
                    {STATUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {ATTRACTION_REPORT_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Обновить статус
                  </button>
                </form>
              </article>
            );
          })}

          <AdminPagination
            pagination={pagination}
            hrefForPage={(page) => buildFilterLink({ page: String(page) })}
            label="сообщений"
          />
        </div>
      )}
    </div>
  );
}
