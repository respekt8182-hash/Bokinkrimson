export type SearchParamValue = string | string[] | undefined;
export type SearchParamsInput = Record<string, SearchParamValue>;

export function pickFirstParam(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function normalizeQueryValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function hasQueryValue(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

export function isTruthyQueryValue(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function buildOrderedSearchParams(
  entries: Iterable<[string, string]>,
  preferredOrder: readonly string[] = [],
): URLSearchParams {
  const normalizedEntries = Array.from(entries)
    .map(([key, value]) => [key, normalizeQueryValue(value)] as const)
    .filter(([, value]) => value.length > 0)
    .sort(([leftKey], [rightKey]) => {
      const leftIndex = preferredOrder.indexOf(leftKey);
      const rightIndex = preferredOrder.indexOf(rightKey);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      }

      return leftKey.localeCompare(rightKey, "ru");
    });

  const params = new URLSearchParams();
  for (const [key, value] of normalizedEntries) {
    params.set(key, value);
  }

  return params;
}
