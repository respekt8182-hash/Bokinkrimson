export type RankingVertical = "property" | "excursion" | "tour" | "transfer";

export type RankingSortMode =
  | "relevance"
  | "recommended"
  | "rating_desc"
  | "popular_desc"
  | "price_asc"
  | "price_desc"
  | "distance_asc"
  | "duration_asc"
  | "newest";

export type RankingBehaviorMetrics = {
  impressions?: number | null;
  cardViews?: number | null;
  favorites?: number | null;
  phoneClicks?: number | null;
  messengerClicks?: number | null;
  emailClicks?: number | null;
  createBookingClicks?: number | null;
};

export type RankingComponentScores = {
  intentScore: number;
  availabilityScore: number;
  completenessScore: number;
  freshnessScore: number;
};

export type RankingCandidateInput = {
  id: string;
  ownerId?: string | null;
  vertical: RankingVertical;
  avgRating: number;
  reviewsCount: number;
  activeReviewDates?: Date[];
  createdAt: Date;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  componentScores: RankingComponentScores;
  behaviorMetrics?: RankingBehaviorMetrics | null;
  exposureCount?: number | null;
  fraudSuspicious?: boolean;
};

export type RankingPoolContext = {
  now?: Date;
  searchFingerprint?: string;
  periodIndex?: number;
  rotationPeriodHours?: number;
  impressionsMedian?: number;
  targetTestImpressions?: number;
};

export type RankingSignals = {
  finalScore: number;
  baseScore: number;
  intentScore: number;
  rankRating: number;
  reviewScore: number;
  ratingScore: number;
  reviewTrustScore: number;
  reviewRecencyScore: number;
  behaviorScore: number;
  cardViewRate: number | null;
  contactRate: number | null;
  bookingIntentRate: number | null;
  availabilityScore: number;
  completenessScore: number;
  freshnessScore: number;
  explorationBoost: number;
  rotationBoost: number;
  overExposurePenalty: number;
  diversityPenalty: number;
  eligibleForExploration: boolean;
  explanation: Record<string, number | boolean | string | null>;
};

export type RankedItem<T> = T & {
  ranking: RankingSignals;
};

export type RankedSortableItem<T> = RankedItem<T> & {
  sortValues?: {
    price?: number | null;
    distance?: number | null;
    duration?: number | null;
    publishedAt?: Date | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  };
};

const verticalPriorWeights: Record<RankingVertical, number> = {
  property: 8,
  excursion: 5,
  tour: 5,
  transfer: 6,
};

const verticalPriorRatings: Record<RankingVertical, number> = {
  property: 4.35,
  excursion: 4.4,
  tour: 4.4,
  transfer: 4.35,
};

const verticalBaseWeights: Record<
  RankingVertical,
  {
    intentScore: number;
    reviewScore: number;
    behaviorScore: number;
    availabilityScore: number;
    completenessScore: number;
    freshnessScore: number;
  }
> = {
  property: {
    intentScore: 0.15,
    reviewScore: 0.25,
    behaviorScore: 0.25,
    availabilityScore: 0.2,
    completenessScore: 0.1,
    freshnessScore: 0.05,
  },
  excursion: {
    intentScore: 0.2,
    reviewScore: 0.25,
    behaviorScore: 0.15,
    availabilityScore: 0.25,
    completenessScore: 0.1,
    freshnessScore: 0.05,
  },
  tour: {
    intentScore: 0.2,
    reviewScore: 0.25,
    behaviorScore: 0.15,
    availabilityScore: 0.25,
    completenessScore: 0.1,
    freshnessScore: 0.05,
  },
  transfer: {
    intentScore: 0.3,
    reviewScore: 0.2,
    behaviorScore: 0.15,
    availabilityScore: 0.2,
    completenessScore: 0.1,
    freshnessScore: 0.05,
  },
};

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function safeCount(value: number | null | undefined): number {
  return Number.isFinite(value ?? NaN) ? Math.max(0, Number(value)) : 0;
}

function daysBetween(left: Date, right: Date): number {
  return Math.max(0, (left.getTime() - right.getTime()) / 86_400_000);
}

export function getRankingPriorRating(vertical: RankingVertical): number {
  return verticalPriorRatings[vertical];
}

export function getRankingPriorWeight(vertical: RankingVertical): number {
  return verticalPriorWeights[vertical];
}

export function calculateRankRating(input: {
  avgRating: number;
  reviewsCount: number;
  vertical: RankingVertical;
  priorRating?: number;
  priorWeight?: number;
}): number {
  const reviewsCount = safeCount(input.reviewsCount);
  const priorRating = input.priorRating ?? getRankingPriorRating(input.vertical);
  const priorWeight = input.priorWeight ?? getRankingPriorWeight(input.vertical);
  const avgRating = reviewsCount > 0 ? clamp(input.avgRating, 0.5, 5) : priorRating;

  return (avgRating * reviewsCount + priorRating * priorWeight) / (reviewsCount + priorWeight);
}

export function calculateRatingScore(rankRating: number): number {
  return clamp(((rankRating - 3.5) / (5 - 3.5)) * 100, 0, 100);
}

export function calculateReviewTrustScore(reviewsCount: number): number {
  return clamp((Math.log1p(safeCount(reviewsCount)) / Math.log1p(30)) * 100, 0, 100);
}

export function calculateReviewRecencyScore(reviewDates: Date[] | undefined, now = new Date()): number {
  if (!reviewDates || reviewDates.length === 0) {
    return 50;
  }

  const totalWeight = reviewDates.reduce((sum, date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return sum;
    }

    return sum + Math.exp(-daysBetween(now, date) / 365);
  }, 0);

  return clamp((totalWeight / reviewDates.length) * 100, 0, 100);
}

export function calculateReviewScore(input: {
  avgRating: number;
  reviewsCount: number;
  vertical: RankingVertical;
  activeReviewDates?: Date[];
  now?: Date;
}): {
  rankRating: number;
  ratingScore: number;
  reviewTrustScore: number;
  reviewRecencyScore: number;
  reviewScore: number;
} {
  const rankRating = calculateRankRating(input);
  const ratingScore = calculateRatingScore(rankRating);
  const reviewTrustScore = calculateReviewTrustScore(input.reviewsCount);
  const reviewRecencyScore = calculateReviewRecencyScore(input.activeReviewDates, input.now);
  const reviewScore = clamp(
    ratingScore * 0.7 + reviewTrustScore * 0.2 + reviewRecencyScore * 0.1,
    0,
    100,
  );

  return {
    rankRating,
    ratingScore,
    reviewTrustScore,
    reviewRecencyScore,
    reviewScore,
  };
}

export function summarizeActiveReviewsForRanking(
  reviews: Array<{ rating: number; status: string; createdAt?: Date | string | null }>,
): { avgRating: number; reviewsCount: number; activeReviewDates: Date[] } {
  const active = reviews.filter((review) => review.status === "ACTIVE");
  const reviewsCount = active.length;
  const avgRating =
    reviewsCount > 0
      ? active.reduce((sum, review) => sum + clamp(Number(review.rating), 0.5, 5), 0) /
        reviewsCount
      : 0;
  const activeReviewDates = active.flatMap((review) => {
    if (!review.createdAt) {
      return [];
    }

    const date = review.createdAt instanceof Date ? review.createdAt : new Date(review.createdAt);
    return Number.isNaN(date.getTime()) ? [] : [date];
  });

  return { avgRating, reviewsCount, activeReviewDates };
}

export function smoothRate(
  successes: number,
  trials: number,
  priorRate: number,
  priorWeight: number,
): number {
  const safeTrials = safeCount(trials);
  return (safeCount(successes) + clamp(priorRate, 0, 1) * safeCount(priorWeight)) /
    (safeTrials + safeCount(priorWeight));
}

export function rateLiftScore(actualRate: number, baselineRate: number): number {
  const lift = clamp(actualRate, 0.000001, Number.MAX_SAFE_INTEGER) /
    clamp(baselineRate, 0.000001, Number.MAX_SAFE_INTEGER);

  return clamp(50 + 25 * Math.log(lift), 0, 100);
}

export function calculateBehaviorScore(
  metrics: RankingBehaviorMetrics | null | undefined,
  baseline?: Partial<{
    cardViewRate: number;
    favoriteRate: number;
    contactRate: number;
    bookingIntentRate: number;
  }>,
): {
  behaviorScore: number;
  cardViewRate: number | null;
  favoriteRate: number | null;
  contactRate: number | null;
  bookingIntentRate: number | null;
  cardViewLiftScore: number;
  favoriteLiftScore: number;
  contactLiftScore: number;
  bookingIntentLiftScore: number;
} {
  const impressions = safeCount(metrics?.impressions);
  const cardViews = safeCount(metrics?.cardViews);
  const favorites = safeCount(metrics?.favorites);
  const phoneClicks = safeCount(metrics?.phoneClicks);
  const messengerClicks = safeCount(metrics?.messengerClicks);
  const emailClicks = safeCount(metrics?.emailClicks);
  const createBookingClicks = safeCount(metrics?.createBookingClicks);
  const weightedContactActions =
    phoneClicks * 1 + messengerClicks * 1 + emailClicks * 0.8 + createBookingClicks * 2.5;

  const smoothedCardViewRate =
    impressions > 0 ? smoothRate(cardViews, impressions, baseline?.cardViewRate ?? 0.08, 50) : null;
  const smoothedFavoriteRate =
    impressions > 0 ? smoothRate(favorites, impressions, baseline?.favoriteRate ?? 0.012, 80) : null;
  const smoothedContactRate =
    cardViews > 0 ? smoothRate(weightedContactActions, cardViews, baseline?.contactRate ?? 0.08, 30) : null;
  const smoothedBookingIntentRate =
    cardViews > 0
      ? smoothRate(createBookingClicks, cardViews, baseline?.bookingIntentRate ?? 0.015, 30)
      : null;

  const cardViewLiftScore =
    smoothedCardViewRate === null
      ? 50
      : rateLiftScore(smoothedCardViewRate, baseline?.cardViewRate ?? 0.08);
  const favoriteLiftScore =
    smoothedFavoriteRate === null
      ? 50
      : rateLiftScore(smoothedFavoriteRate, baseline?.favoriteRate ?? 0.012);
  const contactLiftScore =
    smoothedContactRate === null
      ? 50
      : rateLiftScore(smoothedContactRate, baseline?.contactRate ?? 0.08);
  const bookingIntentLiftScore =
    smoothedBookingIntentRate === null
      ? 50
      : rateLiftScore(smoothedBookingIntentRate, baseline?.bookingIntentRate ?? 0.015);

  const behaviorScore = clamp(
    cardViewLiftScore * 0.3 +
      favoriteLiftScore * 0.2 +
      contactLiftScore * 0.3 +
      bookingIntentLiftScore * 0.2,
    0,
    100,
  );

  return {
    behaviorScore,
    cardViewRate: smoothedCardViewRate,
    favoriteRate: smoothedFavoriteRate,
    contactRate: smoothedContactRate,
    bookingIntentRate: smoothedBookingIntentRate,
    cardViewLiftScore,
    favoriteLiftScore,
    contactLiftScore,
    bookingIntentLiftScore,
  };
}

export function calculateBaseScore(
  vertical: RankingVertical,
  scores: RankingComponentScores & { reviewScore: number; behaviorScore: number },
): number {
  const weights = verticalBaseWeights[vertical];

  return clamp(
    clamp(scores.intentScore, 0, 100) * weights.intentScore +
      clamp(scores.reviewScore, 0, 100) * weights.reviewScore +
      clamp(scores.behaviorScore, 0, 100) * weights.behaviorScore +
      clamp(scores.availabilityScore, 0, 100) * weights.availabilityScore +
      clamp(scores.completenessScore, 0, 100) * weights.completenessScore +
      clamp(scores.freshnessScore, 0, 100) * weights.freshnessScore,
    0,
    100,
  );
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return hash >>> 0;
}

export function getRotationPeriodIndex(now = new Date(), rotationPeriodHours = 72): number {
  const periodMs = Math.max(1, rotationPeriodHours) * 60 * 60 * 1000;
  return Math.floor(now.getTime() / periodMs);
}

export function stableRandom01(seed: string): number {
  return (stableHash(seed) % 1_000_000) / 1_000_000;
}

export function calculateRotationBoost(input: {
  entityId: string;
  vertical: RankingVertical;
  searchFingerprint: string;
  periodIndex: number;
}): number {
  const stableRandom = stableRandom01(
    `${input.vertical}:${input.entityId}:${input.searchFingerprint}:${input.periodIndex}`,
  );

  return (stableRandom - 0.5) * 4;
}

export function buildSearchFingerprint(parts: Record<string, unknown>): string {
  const normalized = Object.keys(parts)
    .sort()
    .map((key) => [key, normalizeFingerprintValue(parts[key])] as const);

  return String(stableHash(JSON.stringify(normalized)));
}

function normalizeFingerprintValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== "object") {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFingerprintValue);
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = normalizeFingerprintValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

export function isExplorationEligible(input: {
  completenessScore: number;
  baseScore: number;
  avgRating: number;
  reviewsCount: number;
  fraudSuspicious?: boolean;
}): boolean {
  if (input.fraudSuspicious) {
    return false;
  }

  if (input.completenessScore < 70 || input.baseScore < 55) {
    return false;
  }

  if (safeCount(input.reviewsCount) >= 3 && input.avgRating < 3.5) {
    return false;
  }

  return true;
}

export function calculateExplorationBoost(input: {
  eligible: boolean;
  ageDays: number;
  impressionsSincePublished: number;
  impressionsLast7d: number;
  impressionsMedian: number;
  completenessScore: number;
  targetTestImpressions?: number;
}): number {
  if (!input.eligible) {
    return 0;
  }

  const targetTestImpressions = Math.max(1, input.targetTestImpressions ?? 120);
  const newBoost =
    input.completenessScore >= 75
      ? Math.max(0, 10 * (1 - input.ageDays / 30) * (1 - input.impressionsSincePublished / targetTestImpressions))
      : 0;
  const expectedImpressions = Math.max(1, input.impressionsMedian);
  const exposureDebt = clamp(
    (expectedImpressions - safeCount(input.impressionsLast7d)) / expectedImpressions,
    0,
    1,
  );
  const underexposedBoost = exposureDebt * 12;

  return clamp(Math.max(newBoost, underexposedBoost), 0, 12);
}

export function calculateOverExposurePenalty(input: {
  impressionsLast7d: number;
  expectedImpressions: number;
  behaviorScore: number;
}): number {
  const expected = Math.max(1, input.expectedImpressions);
  const ratio = safeCount(input.impressionsLast7d) / expected;
  if (ratio <= 1.5) {
    return 0;
  }

  const rawPenalty = clamp((ratio - 1.5) * 3, 0, 8);
  const behaviorRelief = clamp((input.behaviorScore - 60) / 40, 0, 1);
  return rawPenalty * (1 - behaviorRelief * 0.65);
}

export function scoreRankingCandidate(
  candidate: RankingCandidateInput,
  poolContext: RankingPoolContext = {},
): RankingSignals {
  const now = poolContext.now ?? new Date();
  const publishedAt = candidate.publishedAt ?? candidate.createdAt;
  const ageDays = daysBetween(now, publishedAt);
  const review = calculateReviewScore({
    avgRating: candidate.avgRating,
    reviewsCount: candidate.reviewsCount,
    vertical: candidate.vertical,
    activeReviewDates: candidate.activeReviewDates,
    now,
  });
  const behavior = calculateBehaviorScore(candidate.behaviorMetrics);
  const baseScore = calculateBaseScore(candidate.vertical, {
    ...candidate.componentScores,
    reviewScore: review.reviewScore,
    behaviorScore: behavior.behaviorScore,
  });
  const eligibleForExploration = isExplorationEligible({
    completenessScore: candidate.componentScores.completenessScore,
    baseScore,
    avgRating: candidate.avgRating,
    reviewsCount: candidate.reviewsCount,
    fraudSuspicious: candidate.fraudSuspicious,
  });
  const impressions = safeCount(candidate.exposureCount ?? candidate.behaviorMetrics?.impressions);
  const impressionsMedian = Math.max(1, poolContext.impressionsMedian ?? 1);
  const explorationBoost = calculateExplorationBoost({
    eligible: eligibleForExploration,
    ageDays,
    impressionsSincePublished: impressions,
    impressionsLast7d: impressions,
    impressionsMedian,
    completenessScore: candidate.componentScores.completenessScore,
    targetTestImpressions: poolContext.targetTestImpressions,
  });
  const periodIndex =
    poolContext.periodIndex ??
    getRotationPeriodIndex(now, poolContext.rotationPeriodHours ?? 72);
  const rotationBoost = calculateRotationBoost({
    entityId: candidate.id,
    vertical: candidate.vertical,
    searchFingerprint: poolContext.searchFingerprint ?? "default",
    periodIndex,
  });
  const overExposurePenalty = calculateOverExposurePenalty({
    impressionsLast7d: impressions,
    expectedImpressions: impressionsMedian,
    behaviorScore: behavior.behaviorScore,
  });
  const finalScore = clamp(
    baseScore + explorationBoost + rotationBoost - overExposurePenalty,
    0,
    120,
  );

  return {
    finalScore,
    baseScore,
    intentScore: clamp(candidate.componentScores.intentScore, 0, 100),
    rankRating: review.rankRating,
    reviewScore: review.reviewScore,
    ratingScore: review.ratingScore,
    reviewTrustScore: review.reviewTrustScore,
    reviewRecencyScore: review.reviewRecencyScore,
    behaviorScore: behavior.behaviorScore,
    cardViewRate: behavior.cardViewRate,
    contactRate: behavior.contactRate,
    bookingIntentRate: behavior.bookingIntentRate,
    availabilityScore: clamp(candidate.componentScores.availabilityScore, 0, 100),
    completenessScore: clamp(candidate.componentScores.completenessScore, 0, 100),
    freshnessScore: clamp(candidate.componentScores.freshnessScore, 0, 100),
    explorationBoost,
    rotationBoost,
    overExposurePenalty,
    diversityPenalty: 0,
    eligibleForExploration,
    explanation: {
      finalScore,
      baseScore,
      rankRating: review.rankRating,
      avgRating: candidate.avgRating,
      reviewsCount: candidate.reviewsCount,
      reviewScore: review.reviewScore,
      behaviorScore: behavior.behaviorScore,
      cardViewRate: behavior.cardViewRate,
      contactRate: behavior.contactRate,
      bookingIntentRate: behavior.bookingIntentRate,
      availabilityScore: candidate.componentScores.availabilityScore,
      completenessScore: candidate.componentScores.completenessScore,
      freshnessScore: candidate.componentScores.freshnessScore,
      explorationBoost,
      rotationBoost,
      overExposurePenalty,
      eligibleForExploration,
    },
  };
}

function compareNumberDesc(left: number, right: number): number {
  const diff = right - left;
  return Math.abs(diff) > 0.00001 ? diff : 0;
}

function compareNullableNumberAsc(left: number | null | undefined, right: number | null | undefined): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  const diff = left - right;
  return Math.abs(diff) > 0.00001 ? diff : 0;
}

function compareNullableNumberDesc(left: number | null | undefined, right: number | null | undefined): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  const diff = right - left;
  return Math.abs(diff) > 0.00001 ? diff : 0;
}

function compareDateDesc(left: Date | null | undefined, right: Date | null | undefined): number {
  const leftTime = left?.getTime() ?? 0;
  const rightTime = right?.getTime() ?? 0;
  return rightTime - leftTime;
}

export function compareRankedItems<T>(
  left: RankedSortableItem<T>,
  right: RankedSortableItem<T>,
  sort: RankingSortMode,
): number {
  if (sort === "price_asc") {
    return (
      compareNullableNumberAsc(left.sortValues?.price, right.sortValues?.price) ||
      compareNumberDesc(left.ranking.rankRating, right.ranking.rankRating) ||
      compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore)
    );
  }

  if (sort === "price_desc") {
    return (
      compareNullableNumberDesc(left.sortValues?.price, right.sortValues?.price) ||
      compareNumberDesc(left.ranking.rankRating, right.ranking.rankRating) ||
      compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore)
    );
  }

  if (sort === "distance_asc") {
    return (
      compareNullableNumberAsc(left.sortValues?.distance, right.sortValues?.distance) ||
      compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore)
    );
  }

  if (sort === "duration_asc") {
    return (
      compareNullableNumberAsc(left.sortValues?.duration, right.sortValues?.duration) ||
      compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore)
    );
  }

  if (sort === "newest") {
    return (
      compareDateDesc(
        left.sortValues?.publishedAt ?? left.sortValues?.createdAt,
        right.sortValues?.publishedAt ?? right.sortValues?.createdAt,
      ) || compareNumberDesc(left.ranking.completenessScore, right.ranking.completenessScore)
    );
  }

  if (sort === "rating_desc") {
    return (
      compareNumberDesc(left.ranking.reviewScore, right.ranking.reviewScore) ||
      compareNumberDesc(left.ranking.rankRating, right.ranking.rankRating) ||
      compareNumberDesc(left.ranking.reviewTrustScore, right.ranking.reviewTrustScore) ||
      compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore)
    );
  }

  if (sort === "popular_desc") {
    const leftPopular =
      left.ranking.behaviorScore * 0.6 +
      left.ranking.reviewTrustScore * 0.25 +
      left.ranking.reviewRecencyScore * 0.15;
    const rightPopular =
      right.ranking.behaviorScore * 0.6 +
      right.ranking.reviewTrustScore * 0.25 +
      right.ranking.reviewRecencyScore * 0.15;

    return (
      compareNumberDesc(leftPopular, rightPopular) ||
      compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore)
    );
  }

  return (
    compareNumberDesc(left.ranking.finalScore, right.ranking.finalScore) ||
    compareNumberDesc(left.ranking.baseScore, right.ranking.baseScore) ||
    compareDateDesc(left.sortValues?.updatedAt, right.sortValues?.updatedAt)
  );
}

export function applyExplorationSlots<T extends { id: string }>(
  sortedItems: Array<RankedSortableItem<T>>,
  pageSize = 20,
): Array<RankedSortableItem<T>> {
  const slotPattern = new Map<number, "underexposed" | "new">([
    [4, "underexposed"],
    [9, "new"],
    [15, "underexposed"],
  ]);
  const result: Array<RankedSortableItem<T>> = [];
  const used = new Set<string>();
  const limit = Math.min(pageSize, sortedItems.length);

  for (let position = 1; position <= limit; position += 1) {
    const slotType = slotPattern.get(position);
    let selected: RankedSortableItem<T> | undefined;

    if (slotType) {
      selected = sortedItems.find((item) => {
        if (used.has(item.id) || !item.ranking.eligibleForExploration) {
          return false;
        }

        if (slotType === "new") {
          return item.ranking.explorationBoost > 0 && item.ranking.completenessScore >= 75;
        }

        return item.ranking.explorationBoost > 0;
      });
    }

    selected ??= sortedItems.find((item) => !used.has(item.id));

    if (!selected) {
      break;
    }

    used.add(selected.id);
    result.push(selected);
  }

  for (const item of sortedItems) {
    if (!used.has(item.id)) {
      result.push(item);
    }
  }

  return result;
}

export function applyDiversityRerank<T extends { id: string; ownerId?: string | null }>(
  sortedItems: Array<RankedSortableItem<T>>,
  options: {
    pageSize?: number;
    ownerLimit?: number;
    maxSoftDrop?: number;
  } = {},
): Array<RankedSortableItem<T>> {
  const pageSize = options.pageSize ?? 20;
  const ownerLimit = options.ownerLimit ?? 3;
  const maxSoftDrop = options.maxSoftDrop ?? 12;
  const firstPage = sortedItems.slice(0, pageSize);
  const rest = sortedItems.slice(pageSize);
  const selected: Array<RankedSortableItem<T>> = [];
  const remaining = [...firstPage];
  const ownerCounts = new Map<string, number>();

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const ownerId = item.ownerId ?? "";
      const ownerCount = ownerId ? ownerCounts.get(ownerId) ?? 0 : 0;
      const overLimit = ownerId && ownerCount >= ownerLimit;
      const penalty = overLimit ? clamp((ownerCount - ownerLimit + 1) * 5, 3, 8) : 0;
      const adjustedScore = item.ranking.finalScore - penalty;
      const scoreDropFromCurrent = remaining[0].ranking.finalScore - item.ranking.finalScore;

      if (scoreDropFromCurrent > maxSoftDrop && index > 0) {
        continue;
      }

      if (adjustedScore > bestAdjusted) {
        bestAdjusted = adjustedScore;
        bestIndex = index;
      }
    }

    const [item] = remaining.splice(bestIndex, 1);
    const ownerId = item.ownerId ?? "";
    const ownerCount = ownerId ? ownerCounts.get(ownerId) ?? 0 : 0;
    const diversityPenalty =
      ownerId && ownerCount >= ownerLimit ? clamp((ownerCount - ownerLimit + 1) * 5, 3, 8) : 0;

    if (ownerId) {
      ownerCounts.set(ownerId, ownerCount + 1);
    }

    selected.push({
      ...item,
      ranking: {
        ...item.ranking,
        diversityPenalty,
        finalScore: clamp(item.ranking.finalScore - diversityPenalty, 0, 120),
        explanation: {
          ...item.ranking.explanation,
          diversityPenalty,
        },
      },
    });
  }

  return [...selected, ...rest];
}

export function rankItems<T extends { id: string; ownerId?: string | null }>(
  items: Array<RankedSortableItem<T>>,
  sort: RankingSortMode,
  options: { pageSize?: number; applyExploration?: boolean; applyDiversity?: boolean } = {},
): Array<RankedSortableItem<T>> {
  const normalizedSort = sort === "recommended" ? "relevance" : sort;
  let ranked = [...items].sort((left, right) => compareRankedItems(left, right, normalizedSort));

  if (normalizedSort === "relevance" && options.applyExploration !== false) {
    ranked = applyExplorationSlots(ranked, options.pageSize ?? 20);
  }

  if (normalizedSort === "relevance" && options.applyDiversity !== false) {
    ranked = applyDiversityRerank(ranked, { pageSize: options.pageSize ?? 20 });
  }

  return ranked;
}

export function median(values: number[]): number {
  const clean = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (clean.length === 0) {
    return 0;
  }

  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[middle - 1] + clean[middle]) / 2 : clean[middle];
}
