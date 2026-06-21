export function getCatalogPageFromSearch(search: string): number {
  const rawPage = Number.parseInt(new URLSearchParams(search).get("page") ?? "1", 10);

  return Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
}
