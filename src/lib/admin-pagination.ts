export const ADMIN_LIST_PAGE_SIZE = 10;

export type AdminPaginationResult<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  from: number;
  to: number;
};

export function parseAdminPageParam(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(candidate ?? "1", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function paginateAdminItems<T>(
  items: T[],
  requestedPage: number,
  pageSize = ADMIN_LIST_PAGE_SIZE,
): AdminPaginationResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const offset = (currentPage - 1) * pageSize;
  const pageItems = items.slice(offset, offset + pageSize);

  return {
    items: pageItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    from: totalItems === 0 ? 0 : offset + 1,
    to: offset + pageItems.length,
  };
}

export function buildAdminPagination<T>(
  items: T[],
  requestedPage: number,
  totalItems: number,
  pageSize = ADMIN_LIST_PAGE_SIZE,
): AdminPaginationResult<T> {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const offset = (currentPage - 1) * pageSize;

  return {
    items,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    from: totalItems === 0 ? 0 : offset + 1,
    to: offset + items.length,
  };
}
