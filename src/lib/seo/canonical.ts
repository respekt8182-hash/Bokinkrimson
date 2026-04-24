import { absoluteUrl } from "@/lib/seo/site";
import { buildOrderedSearchParams } from "@/lib/seo/url-normalize";

export function buildCanonicalPath(
  pathname: string,
  entries?: Iterable<[string, string]>,
  preferredOrder: readonly string[] = [],
): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const params = entries ? buildOrderedSearchParams(entries, preferredOrder) : null;
  const query = params?.toString();

  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

export function buildCanonicalUrl(
  pathname: string,
  entries?: Iterable<[string, string]>,
  preferredOrder: readonly string[] = [],
): string {
  return absoluteUrl(buildCanonicalPath(pathname, entries, preferredOrder));
}
