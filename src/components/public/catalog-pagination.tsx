"use client";

import { cn } from "@/lib/cn";

type CatalogPaginationProps = {
  page: number;
  totalPages: number;
  disabled?: boolean;
  className?: string;
  onPageChange: (page: number) => void;
};

type PaginationItem = number | "ellipsis";

function buildPaginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (page >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

export function CatalogPagination({
  page,
  totalPages,
  disabled = false,
  className,
  onPageChange,
}: CatalogPaginationProps) {
  const safeTotalPages = Math.max(1, Math.floor(totalPages));
  const safePage = Math.min(Math.max(1, Math.floor(page)), safeTotalPages);

  if (safeTotalPages <= 1) {
    return null;
  }

  const items = buildPaginationItems(safePage, safeTotalPages);
  const canGoNext = safePage < safeTotalPages;

  return (
    <nav
      className={cn("flex flex-wrap items-center justify-center gap-2 pt-5", className)}
      aria-label="Страницы каталога"
    >
      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm font-semibold text-olive/42"
            aria-hidden="true"
          >
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            disabled={disabled || item === safePage}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition disabled:cursor-default",
              item === safePage
                ? "border-transparent bg-olive/10 text-olive shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                : "border-olive/10 bg-white/82 text-olive/78 shadow-[0_8px_22px_rgba(15,23,42,0.07)] hover:border-olive/18 hover:bg-white hover:text-olive disabled:opacity-55",
            )}
            aria-current={item === safePage ? "page" : undefined}
            aria-label={`Открыть страницу ${item}`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(safePage + 1)}
        disabled={disabled || !canGoNext}
        className="inline-flex h-9 items-center justify-center rounded-full border border-olive/10 bg-white/88 px-4 text-sm font-semibold text-olive shadow-[0_8px_22px_rgba(15,23,42,0.07)] transition hover:border-olive/18 hover:bg-white disabled:cursor-default disabled:opacity-45"
      >
        Далее &gt;
      </button>
    </nav>
  );
}
