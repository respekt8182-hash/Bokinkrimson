// Domain/service module for fuzzy.
type TrigramTextResolver<T> = (item: T) => string | null | undefined | Array<string | null | undefined>;

type TrigramRankOptions = {
  limit?: number;
  minScore?: number;
};

export type TrigramRankedItem<T> = {
  item: T;
  score: number;
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTrigramMap(value: string): Map<string, number> {
  const source = `  ${value}  `;
  const map = new Map<string, number>();

  if (source.length < 3) {
    return map;
  }

  for (let index = 0; index <= source.length - 3; index += 1) {
    const trigram = source.slice(index, index + 3);
    map.set(trigram, (map.get(trigram) ?? 0) + 1);
  }

  return map;
}

function trigramDiceCoefficient(query: string, candidate: string): number {
  if (!query || !candidate) {
    return 0;
  }

  if (query === candidate) {
    return 1;
  }

  const queryTrigrams = buildTrigramMap(query);
  const candidateTrigrams = buildTrigramMap(candidate);

  const queryTotal = Array.from(queryTrigrams.values()).reduce((sum, value) => sum + value, 0);
  const candidateTotal = Array.from(candidateTrigrams.values()).reduce((sum, value) => sum + value, 0);
  if (queryTotal === 0 || candidateTotal === 0) {
    return 0;
  }

  let intersection = 0;
  for (const [trigram, count] of queryTrigrams) {
    const candidateCount = candidateTrigrams.get(trigram);
    if (!candidateCount) continue;
    intersection += Math.min(count, candidateCount);
  }

  return (2 * intersection) / (queryTotal + candidateTotal);
}

function scoreCandidate(query: string, candidateRaw: string): number {
  const candidate = normalizeText(candidateRaw);
  if (!candidate) {
    return 0;
  }

  let score = trigramDiceCoefficient(query, candidate);

  if (candidate.startsWith(query)) {
    score += 0.25;
  } else if (candidate.includes(query)) {
    score += 0.12;
  }

  if (candidate.split(" ").some((token) => token.startsWith(query))) {
    score += 0.08;
  }

  if (query.length < 3 && candidate.includes(query)) {
    score += 0.2;
  }

  const lengthPenalty = Math.abs(candidate.length - query.length) / Math.max(candidate.length, query.length, 1);
  score -= lengthPenalty * 0.08;

  return score;
}

function toCandidateTexts(value: string | null | undefined | Array<string | null | undefined>): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => Boolean(item && item.trim()));
  }

  return value && value.trim() ? [value] : [];
}

export function rankByTrigramWithScores<T>(
  queryRaw: string,
  items: readonly T[],
  resolveText: TrigramTextResolver<T>,
  options?: TrigramRankOptions,
): TrigramRankedItem<T>[] {
  const query = normalizeText(queryRaw);
  const limit = Math.max(1, options?.limit ?? items.length);
  const minScore = options?.minScore ?? 0.08;

  if (query.length < 2) {
    return [];
  }

  return items
    .map((item) => {
      const candidates = toCandidateTexts(resolveText(item));
      const score = candidates.reduce((best, candidate) => Math.max(best, scoreCandidate(query, candidate)), 0);
      return { item, score };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function rankByTrigram<T>(
  queryRaw: string,
  items: readonly T[],
  resolveText: TrigramTextResolver<T>,
  options?: TrigramRankOptions,
): T[] {
  return rankByTrigramWithScores(queryRaw, items, resolveText, options).map((entry) => entry.item);
}

export function fuzzySearch(query: string, values: readonly string[], limit = 7): string[] {
  return rankByTrigram(query, values, (value) => value, { limit, minScore: 0.04 });
}
