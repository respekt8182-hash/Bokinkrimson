type PaginationInput = {
  request: Request;
  defaultLimit?: number;
  maxLimit?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export function parsePagination({
  request,
  defaultLimit = 20,
  maxLimit = 50,
}: PaginationInput): PaginationParams {
  const { searchParams } = new URL(request.url);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? String(defaultLimit), 10);

  return {
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
    limit:
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, maxLimit)
        : defaultLimit,
  };
}

export function buildOffsetPagination(
  params: PaginationParams,
  returnedCount: number,
  total: number,
) {
  const nextOffset = params.offset + returnedCount;

  return {
    offset: params.offset,
    limit: params.limit,
    nextOffset,
    hasMore: nextOffset < total,
    total,
  };
}
