const enabledValues = new Set(["1", "true", "yes", "on"]);

export function isSearchDbPrefilterEnabled(flagName: string): boolean {
  if (isSearchDbPrefilterFallbackForced()) {
    return false;
  }

  return enabledValues.has((process.env[flagName] ?? "").trim().toLowerCase());
}

export function isSearchDbPrefilterFallbackForced(): boolean {
  return enabledValues.has(
    (process.env.SEARCH_DB_PREFILTER_FORCE_FALLBACK ?? "").trim().toLowerCase(),
  );
}

export function readPositiveIntEnv(input: {
  name: string;
  fallback: number;
  min: number;
  max: number;
}): number {
  const parsed = Number.parseInt(process.env[input.name] ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return input.fallback;
  }

  return Math.max(input.min, Math.min(input.max, parsed));
}

export function getSearchDbPrefilterLimit(input: {
  envName: string;
  fallback: number;
  min: number;
  max: number;
  pageSize: number;
  candidateLimit: number;
}): number {
  const configured = readPositiveIntEnv({
    name: input.envName,
    fallback: input.fallback,
    min: input.min,
    max: input.max,
  });

  return Math.min(input.candidateLimit, Math.max(input.pageSize, configured));
}

export function getNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

export type CandidateStageResult = {
  ids: string[] | null;
  enabled: boolean;
  usedFallback: boolean;
  durationMs: number | null;
  idsCount: number | null;
};

export function disabledCandidateStage(): CandidateStageResult {
  return {
    ids: null,
    enabled: false,
    usedFallback: false,
    durationMs: null,
    idsCount: null,
  };
}
