import { logger } from "@/lib/logger";

type SearchPerfValue = boolean | number | string | null | undefined;

export type SearchPerformanceFields = Record<string, SearchPerfValue>;

type SearchPerformanceTimer = (fields?: SearchPerformanceFields) => void;

const enabledValues = new Set(["1", "true", "yes", "on"]);
const sensitiveKeyPattern = /(?:query|email|phone|address|token|password|secret)/i;

function isSearchPerformanceLoggingEnabled(): boolean {
  return enabledValues.has((process.env.SEARCH_PERF_LOGS ?? "").trim().toLowerCase());
}

function getNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function formatFieldValue(key: string, value: SearchPerfValue): string | null {
  if (value === undefined) {
    return null;
  }

  if (sensitiveKeyPattern.test(key)) {
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      return `${key}=${String(value)}`;
    }

    return `${key}=[redacted]`;
  }

  return `${key}=${String(value).replace(/\s+/g, "_")}`;
}

function formatFields(fields: SearchPerformanceFields): string {
  return Object.entries(fields)
    .flatMap(([key, value]) => {
      const formatted = formatFieldValue(key, value);
      return formatted ? [formatted] : [];
    })
    .join(" ");
}

export function createSearchPerformanceTimer(
  name: string,
  initialFields: SearchPerformanceFields = {},
): SearchPerformanceTimer {
  if (!isSearchPerformanceLoggingEnabled()) {
    return () => undefined;
  }

  const startedAt = getNowMs();

  return (fields: SearchPerformanceFields = {}) => {
    const durationMs = Math.round(getNowMs() - startedAt);
    const formattedFields = formatFields({
      durationMs,
      ...initialFields,
      ...fields,
    });

    logger.info(`[search-perf] ${name}${formattedFields ? ` ${formattedFields}` : ""}`);
  };
}

export function hasSearchFilters(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return value !== null && value !== undefined && value !== false;
  });
}
