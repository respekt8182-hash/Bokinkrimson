import {
  buildReviewCategorySummary,
  hasReviewCategory,
  normalizeReviewCategory,
} from "@/lib/review-categories";
import type { SerializedReview } from "@/lib/reviews";

export const PUBLIC_REVIEW_SCAN_LIMIT = 1000;

export type PublicReviewSort = "relevance" | "new" | "old" | "positive" | "negative";

export type PublicReviewRatingDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

export type PublicReviewMeta = {
  categories: ReturnType<typeof buildReviewCategorySummary>;
  ratingDistribution: PublicReviewRatingDistribution;
  hasNegativeReviews: boolean;
};

export function parsePublicReviewSort(value: string | null): PublicReviewSort {
  if (value === "new" || value === "old" || value === "positive" || value === "negative") {
    return value;
  }

  return "relevance";
}

export function buildPublicReviewMeta(reviews: SerializedReview[]): PublicReviewMeta {
  const ratingDistribution: PublicReviewRatingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const review of reviews) {
    const bucket = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    ratingDistribution[bucket] += 1;
  }

  return {
    categories: buildReviewCategorySummary(reviews),
    ratingDistribution,
    hasNegativeReviews: reviews.some((review) => review.rating < 4),
  };
}

function getReviewSortDate(review: SerializedReview): number {
  return Date.parse(review.reviewedAt ?? review.createdAt);
}

export function filterAndSortPublicReviews(input: {
  reviews: SerializedReview[];
  category?: string | null;
  sort?: PublicReviewSort;
}): SerializedReview[] {
  const category = normalizeReviewCategory(input.category);
  const filtered = category
    ? input.reviews.filter((review) => hasReviewCategory(review, category))
    : [...input.reviews];

  if (input.sort === "new") {
    return filtered.sort((left, right) => getReviewSortDate(right) - getReviewSortDate(left));
  }

  if (input.sort === "old") {
    return filtered.sort((left, right) => getReviewSortDate(left) - getReviewSortDate(right));
  }

  if (input.sort === "positive") {
    return filtered.sort((left, right) => {
      if (right.rating !== left.rating) return right.rating - left.rating;
      return getReviewSortDate(right) - getReviewSortDate(left);
    });
  }

  if (input.sort === "negative") {
    return filtered.sort((left, right) => {
      if (left.rating !== right.rating) return left.rating - right.rating;
      return getReviewSortDate(right) - getReviewSortDate(left);
    });
  }

  return filtered;
}

export function slicePublicReviews(input: {
  reviews: SerializedReview[];
  offset: number;
  limit: number;
}): {
  items: SerializedReview[];
  pagination: {
    offset: number;
    limit: number;
    nextOffset: number;
    hasMore: boolean;
    total: number;
  };
} {
  const offset = Math.max(0, input.offset);
  const limit = Math.max(1, Math.min(10, input.limit));
  const items = input.reviews.slice(offset, offset + limit);
  const nextOffset = offset + items.length;

  return {
    items,
    pagination: {
      offset,
      limit,
      nextOffset,
      hasMore: nextOffset < input.reviews.length,
      total: input.reviews.length,
    },
  };
}
