import Link from "next/link";
import { cn } from "@/lib/cn";
import type { AdminPaginationResult } from "@/lib/admin-pagination";

type AdminPaginationProps = {
  pagination: AdminPaginationResult<unknown>;
  hrefForPage: (page: number) => string;
  label?: string;
  className?: string;
};

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  return [...pages].sort((left, right) => left - right);
}

export function AdminPagination({
  pagination,
  hrefForPage,
  label = "записей",
  className,
}: AdminPaginationProps) {
  if (pagination.totalItems <= pagination.pageSize) {
    return null;
  }

  const visiblePages = getVisiblePages(pagination.currentPage, pagination.totalPages);

  return (
    <nav
      className={cn(
        "flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 text-sm shadow-[0_12px_34px_rgba(58,43,35,0.06)] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      aria-label="Пагинация админского списка"
    >
      <p className="font-medium text-olive/62">
        {pagination.from}-{pagination.to} из {pagination.totalItems} {label}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefForPage(Math.max(1, pagination.currentPage - 1))}
          aria-disabled={pagination.currentPage === 1}
          className={cn(
            "rounded-full border px-3 py-1.5 font-semibold transition",
            pagination.currentPage === 1
              ? "pointer-events-none border-olive/8 bg-cream/55 text-olive/35"
              : "border-olive/12 bg-white text-olive hover:border-primary/18 hover:text-primary",
          )}
        >
          Назад
        </Link>

        {visiblePages.map((page, index) => {
          const previousPage = visiblePages[index - 1];
          const showGap = previousPage !== undefined && page - previousPage > 1;

          return (
            <span key={page} className="inline-flex items-center gap-2">
              {showGap ? <span className="text-olive/35">...</span> : null}
              <Link
                href={hrefForPage(page)}
                aria-current={page === pagination.currentPage ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 font-semibold transition",
                  page === pagination.currentPage
                    ? "bg-primary text-white"
                    : "border border-olive/12 bg-white text-olive hover:border-primary/18 hover:text-primary",
                )}
              >
                {page}
              </Link>
            </span>
          );
        })}

        <Link
          href={hrefForPage(Math.min(pagination.totalPages, pagination.currentPage + 1))}
          aria-disabled={pagination.currentPage === pagination.totalPages}
          className={cn(
            "rounded-full border px-3 py-1.5 font-semibold transition",
            pagination.currentPage === pagination.totalPages
              ? "pointer-events-none border-olive/8 bg-cream/55 text-olive/35"
              : "border-olive/12 bg-white text-olive hover:border-primary/18 hover:text-primary",
          )}
        >
          Вперёд
        </Link>
      </div>
    </nav>
  );
}
