import { describe, expect, it } from "vitest";
import {
  applyDiversityRerank,
  calculateBehaviorScore,
  calculateRankRating,
  compareRankedItems,
  getRotationPeriodIndex,
  rankItems,
  scoreRankingCandidate,
  summarizeActiveReviewsForRanking,
  type RankedSortableItem,
  type RankingCandidateInput,
} from "../../src/lib/ranking-v2";

function candidate(
  patch: Partial<RankingCandidateInput> & { id: string },
): RankingCandidateInput {
  return {
    id: patch.id,
    ownerId: patch.ownerId ?? "owner-1",
    vertical: patch.vertical ?? "property",
    avgRating: patch.avgRating ?? 4.6,
    reviewsCount: patch.reviewsCount ?? 10,
    createdAt: patch.createdAt ?? new Date("2026-04-01T00:00:00.000Z"),
    publishedAt: patch.publishedAt ?? new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: patch.updatedAt ?? new Date("2026-04-10T00:00:00.000Z"),
    componentScores: patch.componentScores ?? {
      intentScore: 80,
      availabilityScore: 80,
      completenessScore: 85,
      freshnessScore: 50,
    },
    behaviorMetrics: patch.behaviorMetrics,
    fraudSuspicious: patch.fraudSuspicious,
  };
}

function rankedItem(input: RankingCandidateInput): RankedSortableItem<{
  id: string;
  ownerId?: string | null;
}> {
  return {
    id: input.id,
    ownerId: input.ownerId,
    ranking: scoreRankingCandidate(input, {
      now: new Date("2026-05-01T00:00:00.000Z"),
      periodIndex: 10,
      impressionsMedian: 100,
      searchFingerprint: "test",
    }),
    sortValues: {
      price: 1000,
      updatedAt: input.updatedAt,
      createdAt: input.createdAt,
      publishedAt: input.publishedAt,
    },
  };
}

describe("Ranking V2", () => {
  it("does not let pending reviews affect rankRating", () => {
    const summary = summarizeActiveReviewsForRanking([
      { rating: 5, status: "PENDING", createdAt: "2026-04-20T00:00:00.000Z" },
      { rating: 1, status: "DELETED", createdAt: "2026-04-21T00:00:00.000Z" },
      { rating: 4, status: "ACTIVE", createdAt: "2026-04-22T00:00:00.000Z" },
    ]);

    expect(summary.avgRating).toBe(4);
    expect(summary.reviewsCount).toBe(1);
    expect(calculateRankRating({ ...summary, vertical: "property" })).toBeLessThan(4.4);
  });

  it("does not let 5.0 with one review outrank 4.8 with forty reviews in rating_desc", () => {
    const oneReview = rankedItem(candidate({ id: "one", avgRating: 5, reviewsCount: 1 }));
    const trusted = rankedItem(candidate({ id: "trusted", avgRating: 4.8, reviewsCount: 40 }));

    expect(compareRankedItems(oneReview, trusted, "rating_desc")).toBeGreaterThan(0);
  });

  it("does not use raw impressions as a positive ranking factor", () => {
    const lowExposure = calculateBehaviorScore({ impressions: 10, cardViews: 2 });
    const highExposureSameClicks = calculateBehaviorScore({ impressions: 1000, cardViews: 2 });

    expect(highExposureSameClicks.behaviorScore).toBeLessThanOrEqual(lowExposure.behaviorScore);
  });

  it("gives explorationBoost to an underexposed quality object", () => {
    const ranking = scoreRankingCandidate(
      candidate({
        id: "underexposed",
        behaviorMetrics: { impressions: 5, cardViews: 2 },
      }),
      {
        now: new Date("2026-05-01T00:00:00.000Z"),
        impressionsMedian: 100,
        periodIndex: 10,
      },
    );

    expect(ranking.eligibleForExploration).toBe(true);
    expect(ranking.explorationBoost).toBeGreaterThan(0);
  });

  it("does not make a poor card eligible for exploration", () => {
    const ranking = scoreRankingCandidate(
      candidate({
        id: "empty-card",
        componentScores: {
          intentScore: 80,
          availabilityScore: 70,
          completenessScore: 45,
          freshnessScore: 50,
        },
        behaviorMetrics: { impressions: 2, cardViews: 1 },
      }),
      {
        now: new Date("2026-05-01T00:00:00.000Z"),
        impressionsMedian: 100,
        periodIndex: 10,
      },
    );

    expect(ranking.eligibleForExploration).toBe(false);
    expect(ranking.explorationBoost).toBe(0);
  });

  it("keeps rotation stable inside one periodIndex", () => {
    const first = scoreRankingCandidate(candidate({ id: "stable" }), {
      periodIndex: 12,
      searchFingerprint: "same",
    });
    const second = scoreRankingCandidate(candidate({ id: "stable" }), {
      periodIndex: 12,
      searchFingerprint: "same",
    });

    expect(first.rotationBoost).toBe(second.rotationBoost);
  });

  it("changes rotation when periodIndex changes", () => {
    const first = scoreRankingCandidate(candidate({ id: "stable" }), {
      periodIndex: 12,
      searchFingerprint: "same",
    });
    const second = scoreRankingCandidate(candidate({ id: "stable" }), {
      periodIndex: 13,
      searchFingerprint: "same",
    });

    expect(first.rotationBoost).not.toBe(second.rotationBoost);
    expect(getRotationPeriodIndex(new Date("2026-05-01T00:00:00.000Z"), 72)).toBe(
      getRotationPeriodIndex(new Date("2026-05-02T00:00:00.000Z"), 72),
    );
  });

  it("does not let exploration slots break price_asc", () => {
    const expensive = rankedItem(
      candidate({
        id: "expensive",
        behaviorMetrics: { impressions: 1, cardViews: 1 },
      }),
    );
    const cheap = rankedItem(candidate({ id: "cheap" }));
    expensive.sortValues = { ...expensive.sortValues, price: 5000 };
    cheap.sortValues = { ...cheap.sortValues, price: 1000 };

    const [first] = rankItems([expensive, cheap], "price_asc", { pageSize: 20 });

    expect(first.id).toBe("cheap");
  });

  it("uses rankRating/reviewScore for explicit rating_desc", () => {
    const inflated = rankedItem(candidate({ id: "inflated", avgRating: 5, reviewsCount: 1 }));
    const trusted = rankedItem(candidate({ id: "trusted", avgRating: 4.8, reviewsCount: 40 }));
    const [first] = rankItems([inflated, trusted], "rating_desc", { pageSize: 20 });

    expect(first.id).toBe("trusted");
  });

  it("keeps one owner from filling the first page when alternatives exist", () => {
    const sameOwner = Array.from({ length: 6 }, (_, index) =>
      rankedItem(
        candidate({
          id: `same-${index}`,
          ownerId: "same-owner",
          componentScores: {
            intentScore: 90 - index,
            availabilityScore: 90,
            completenessScore: 90,
            freshnessScore: 60,
          },
        }),
      ),
    );
    const alternatives = Array.from({ length: 4 }, (_, index) =>
      rankedItem(
        candidate({
          id: `alt-${index}`,
          ownerId: `alt-owner-${index}`,
          componentScores: {
            intentScore: 86 - index,
            availabilityScore: 88,
            completenessScore: 88,
            freshnessScore: 60,
          },
        }),
      ),
    );
    const reranked = applyDiversityRerank([...sameOwner, ...alternatives], {
      pageSize: 10,
      ownerLimit: 3,
    });
    const firstSixOwnerCount = reranked
      .slice(0, 6)
      .filter((item) => item.ownerId === "same-owner").length;

    expect(firstSixOwnerCount).toBeLessThan(6);
  });
});
