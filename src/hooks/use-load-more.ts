"use client";

// Client hook that manages incremental pagination state for public catalog lists.
import { useCallback, useMemo, useState } from "react";
import type { SearchResponse } from "@/types/catalog";

type UseLoadMoreConfig = {
  initialData: SearchResponse;
  loadPage: (page: number) => Promise<SearchResponse>;
};

export function useLoadMore(config: UseLoadMoreConfig) {
  const [items, setItems] = useState(config.initialData.items);
  const [total, setTotal] = useState(config.initialData.total);
  const [page, setPage] = useState(config.initialData.page);
  const [pageSize, setPageSize] = useState(config.initialData.pageSize);
  const [totalPages, setTotalPages] = useState(config.initialData.totalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasMore = useMemo(() => page < totalPages, [page, totalPages]);

  const replaceAll = useCallback((next: SearchResponse) => {
    setItems(next.items);
    setTotal(next.total);
    setPage(next.page);
    setPageSize(next.pageSize);
    setTotalPages(next.totalPages);
    setError("");
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return null;
    }

    setLoading(true);
    setError("");
    try {
      const next = await config.loadPage(page + 1);
      setItems((prev) => [...prev, ...next.items]);
      setTotal(next.total);
      setPage(next.page);
      setPageSize(next.pageSize);
      setTotalPages(next.totalPages);
      return next;
    } catch {
      setError("Не удалось загрузить следующую страницу");
      return null;
    } finally {
      setLoading(false);
    }
  }, [config, hasMore, loading, page]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore,
    loading,
    error,
    replaceAll,
    loadMore,
  };
}

