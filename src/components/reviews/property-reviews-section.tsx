"use client";

import { MessageSquareText, ShieldCheck, Star, ThumbsDown, ThumbsUp, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getReviewCategoryMatch,
  getReviewCategoryLabel,
  hasReviewCategory,
  reviewCategoryOptions,
  type ReviewCategorySummary,
} from "@/lib/review-categories";
import type { SerializedReview } from "@/lib/reviews";

type PropertyReviewsSectionProps = {
  submitUrl: string;
  loadMoreUrl: string;
  entityPath: string;
  entityLabel: string;
  avgRating: number;
  reviewsCount: number;
  initialReviews: SerializedReview[];
  initialHasMore: boolean;
  isAuthenticated: boolean;
  currentUserId?: string | null;
  ownerUserId?: string | null;
  title?: string;
  promptTitle?: string;
  promptText?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

type RatingDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

type ReviewSummary = {
  avgRating: number;
  reviewsCount: number;
  categories?: ReviewCategorySummary[];
  ratingDistribution?: RatingDistribution;
  hasNegativeReviews?: boolean;
};

type ReviewsListResponse = {
  error?: string;
  items?: SerializedReview[];
  summary?: ReviewSummary;
  pagination?: {
    offset: number;
    limit: number;
    nextOffset: number;
    hasMore: boolean;
    total: number;
  };
};

type CategoryDragState = {
  pointerId: number;
  startX: number;
  scrollLeft: number;
  hasMoved: boolean;
  clickCategoryId: string | null;
};

const MODAL_PAGE_SIZE = 10;
const PREVIEW_REVIEWS_COUNT = 3;
const CATEGORY_DRAG_CLICK_THRESHOLD_PX = 6;

const defaultRatingDistribution: RatingDistribution = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
};

function clampRating(value: number): number {
  const safe = Math.max(0.5, Math.min(5, value));
  return Math.round(safe * 2) / 2;
}

function getStarFillPercent(rating: number, starIndex: number): number {
  const value = rating - (starIndex - 1);
  if (value >= 1) return 100;
  if (value <= 0) return 0;
  return Math.round(value * 100);
}

function StarGlyph({
  fillPercent,
  className = "text-xl",
}: {
  fillPercent: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-block leading-none ${className}`}>
      <span className="text-olive/18">★</span>
      <span
        className="absolute left-0 top-0 overflow-hidden text-amber-500"
        style={{ width: `${Math.max(0, Math.min(100, fillPercent))}%` }}
      >
        ★
      </span>
    </span>
  );
}

function RatingStars({ rating, size = "text-xl" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} из 5`}>
      {[1, 2, 3, 4, 5].map((starIndex) => (
        <StarGlyph
          key={starIndex}
          fillPercent={getStarFillPercent(rating, starIndex)}
          className={size}
        />
      ))}
    </span>
  );
}

function formatReviewMonth(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getReviewDisplayDate(review: SerializedReview): string {
  return review.reviewedAt ?? review.createdAt;
}

function isYearOnlyReviewDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return Boolean(match && match[2] === "01" && match[3] === "01");
}

function formatReviewDateLabel(review: SerializedReview): string {
  if (review.isImported && review.reviewedAt && isYearOnlyReviewDate(review.reviewedAt)) {
    return review.reviewedAt.slice(0, 4);
  }

  return formatReviewMonth(getReviewDisplayDate(review));
}

function formatReviewsCountLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${count} отзывов`;
  if (last === 1) return `${count} отзыв`;
  if (last >= 2 && last <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
}

function getInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => part.trim().slice(0, 1).toUpperCase())
    .filter(Boolean)
    .slice(0, 2);
  return letters.join("") || "?";
}

function getExternalSourceDisplayName(review: SerializedReview): string | null {
  const sourceName = review.externalSourceName?.trim();
  if (sourceName && sourceName.toLocaleLowerCase("ru-RU") !== "вручную") {
    return sourceName;
  }

  if (!review.externalSourceUrl) {
    return null;
  }

  try {
    return new URL(review.externalSourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function getLocalRatingDistribution(reviews: SerializedReview[]): RatingDistribution {
  const distribution = { ...defaultRatingDistribution };
  for (const review of reviews) {
    const bucket = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
  }
  return distribution;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHighlightRanges(
  text: string,
  highlights: string[],
): Array<{ start: number; end: number }> {
  const normalizedHighlights = [
    ...new Set(highlights.map((highlight) => highlight.trim()).filter(Boolean)),
  ].sort((left, right) => right.length - left.length);
  const candidates: Array<{ start: number; end: number; length: number }> = [];

  for (const highlight of normalizedHighlights) {
    const parts = highlight.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      continue;
    }

    const pattern = parts.map(escapeRegExp).join("\\s+");
    const regex = new RegExp(pattern, "giu");
    for (const match of text.matchAll(regex)) {
      if (!match[0]) {
        continue;
      }

      candidates.push({
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        length: match[0].length,
      });
    }
  }

  const accepted: Array<{ start: number; end: number; length: number }> = [];
  const sortedCandidates = candidates.sort((left, right) => {
    if (right.length !== left.length) {
      return right.length - left.length;
    }

    return left.start - right.start;
  });

  for (const candidate of sortedCandidates) {
    const overlaps = accepted.some(
      (range) => candidate.start < range.end && candidate.end > range.start,
    );
    if (!overlaps) {
      accepted.push(candidate);
    }
  }

  return accepted
    .sort((left, right) => left.start - right.start)
    .map(({ start, end }) => ({ start, end }));
}

function HighlightedReviewText({
  review,
  activeCategory,
}: {
  review: SerializedReview;
  activeCategory: string | null;
}) {
  const activeMatch = getReviewCategoryMatch(review, activeCategory);
  if (!activeMatch) {
    return <>{review.text}</>;
  }

  const matchRanges = findHighlightRanges(
    review.text,
    activeMatch.highlights.length > 0
      ? activeMatch.highlights
      : review.reviewHighlight
        ? [review.reviewHighlight]
        : [],
  );
  if (matchRanges.length === 0) {
    return <>{review.text}</>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const range of matchRanges) {
    if (cursor < range.start) {
      parts.push(review.text.slice(cursor, range.start));
    }

    parts.push(
      <mark
        key={`${review.id}-${range.start}-${range.end}`}
        className="rounded-md bg-amber-100 px-1 py-0.5 text-olive ring-1 ring-amber-200"
      >
        {review.text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }

  if (cursor < review.text.length) {
    parts.push(review.text.slice(cursor));
  }

  return <>{parts}</>;
}

export function PropertyReviewsSection({
  submitUrl,
  loadMoreUrl,
  entityPath,
  entityLabel,
  avgRating,
  reviewsCount,
  initialReviews,
  initialHasMore,
  isAuthenticated,
  currentUserId = null,
  ownerUserId = null,
  title = "Отзывы гостей",
  promptTitle = "Отдыхали здесь? Поделитесь впечатлениями",
  promptText = "Короткий честный отзыв помогает другим гостям быстрее понять, подходит ли им это предложение.",
  emptyTitle = "Пока нет отзывов",
  emptyDescription = "Когда гости начнут делиться впечатлениями, здесь появится рейтинг и подробные комментарии.",
}: PropertyReviewsSectionProps) {
  const [previewItems, setPreviewItems] = useState(initialReviews);
  const [modalItems, setModalItems] = useState<SerializedReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({
    avgRating,
    reviewsCount,
    ratingDistribution: getLocalRatingDistribution(initialReviews),
    categories: [],
    hasNegativeReviews: initialReviews.some((review) => review.rating < 4),
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState<"new" | "old" | "positive" | "negative">("new");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reactionSavingById, setReactionSavingById] = useState<Record<string, boolean>>({});
  const [reactionErrorById, setReactionErrorById] = useState<Record<string, string>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const categoryScrollerRef = useRef<HTMLDivElement | null>(null);
  const categoryDragRef = useRef<CategoryDragState | null>(null);
  const suppressCategoryClickRef = useRef(false);
  const [isCategoryDragging, setIsCategoryDragging] = useState(false);

  const isOwnerViewer = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);
  const canWriteReview = isAuthenticated && !isOwnerViewer;
  const hasPublishedReviews = summary.reviewsCount > 0;
  const visiblePreviewItems = previewItems.slice(0, PREVIEW_REVIEWS_COUNT);
  const totalReviewsLabel = formatReviewsCountLabel(summary.reviewsCount);
  const loginHref = useMemo(
    () => `/auth/login?next=${encodeURIComponent(entityPath)}`,
    [entityPath],
  );
  const registerHref = useMemo(
    () => `/auth/register?next=${encodeURIComponent(entityPath)}`,
    [entityPath],
  );

  const loadReviews = useCallback(
    async (offset: number, options?: { replace?: boolean }) => {
      if (isLoading) {
        return;
      }

      setError("");
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(MODAL_PAGE_SIZE),
          sort,
        });
        if (activeCategory) {
          params.set("category", activeCategory);
        }

        const separator = loadMoreUrl.includes("?") ? "&" : "?";
        const response = await fetch(`${loadMoreUrl}${separator}${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as ReviewsListResponse;

        if (!response.ok) {
          setError(body.error ?? "Не удалось загрузить отзывы");
          return;
        }

        const nextItems = body.items ?? [];
        setModalItems((previous) => {
          if (options?.replace) {
            return nextItems;
          }
          const existingIds = new Set(previous.map((review) => review.id));
          return [...previous, ...nextItems.filter((review) => !existingIds.has(review.id))];
        });
        if (body.summary) {
          setSummary((previous) => ({ ...previous, ...body.summary }));
        }
        setHasMore(Boolean(body.pagination?.hasMore));
        setNextOffset(body.pagination?.nextOffset ?? offset + nextItems.length);
      } finally {
        setIsLoading(false);
      }
    },
    [activeCategory, isLoading, loadMoreUrl, sort],
  );

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    setModalItems([]);
    setNextOffset(0);
    setHasMore(false);
    void loadReviews(0, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, activeCategory, sort]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !isModalOpen || !hasMore || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadReviews(nextOffset);
        }
      },
      { root: null, rootMargin: "180px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isModalOpen, loadReviews, nextOffset]);

  function changeRatingByStep(step: number) {
    setRating((previous) => clampRating(previous + step));
  }

  function handleCategoryPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }

    const scroller = event.currentTarget;
    if (scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    categoryDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
      hasMoved: false,
      clickCategoryId:
        (event.target as HTMLElement).closest<HTMLButtonElement>("[data-review-category-id]")
          ?.dataset.reviewCategoryId ?? null,
    };
    setIsCategoryDragging(true);

    try {
      scroller.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; dragging still works without it.
    }
  }

  function handleCategoryPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = categoryDragRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > CATEGORY_DRAG_CLICK_THRESHOLD_PX) {
      state.hasMoved = true;
    }

    event.currentTarget.scrollLeft = state.scrollLeft - deltaX;
    if (state.hasMoved) {
      event.preventDefault();
    }
  }

  function finishCategoryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const state = categoryDragRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    if (state.hasMoved) {
      suppressCategoryClickRef.current = true;
      window.setTimeout(() => {
        suppressCategoryClickRef.current = false;
      }, 0);
    } else if (state.clickCategoryId) {
      const categoryId = state.clickCategoryId;
      suppressCategoryClickRef.current = true;
      setActiveCategory((previous) => (previous === categoryId ? null : categoryId));
      window.setTimeout(() => {
        suppressCategoryClickRef.current = false;
      }, 0);
    }

    categoryDragRef.current = null;
    setIsCategoryDragging(false);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }

  function handleCategoryClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressCategoryClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  async function submitReview() {
    setError("");
    setSuccess("");

    if (isOwnerViewer) {
      setError(`Вы владелец ${entityLabel}. Оставлять отзыв к своей карточке нельзя.`);
      return;
    }

    if (text.trim().length < 10) {
      setError("Текст отзыва должен содержать минимум 10 символов");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          text: text.trim(),
          guestCity: guestCity.trim(),
          reviewedAt,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        item?: SerializedReview;
        summary?: ReviewSummary;
        moderationStatus?: "PENDING";
      };

      if (!response.ok || !body.item) {
        setError(body.error ?? "Не удалось отправить отзыв");
        return;
      }

      if (body.summary) {
        setSummary((previous) => ({ ...previous, ...body.summary }));
      }

      setText("");
      setGuestCity("");
      setReviewedAt("");
      setRating(5);
      setIsComposerOpen(false);

      if (body.item.status === "PENDING" || body.moderationStatus === "PENDING") {
        setSuccess("Отзыв отправлен на модерацию. Он появится после проверки администратором.");
        return;
      }

      setPreviewItems((previous) => [body.item!, ...previous]);
      setModalItems((previous) => [body.item!, ...previous]);
      setSuccess("Спасибо, отзыв опубликован.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function setReaction(review: SerializedReview, nextValue: "LIKE" | "DISLIKE" | null) {
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы оценивать отзывы.");
      return;
    }

    setReactionErrorById((previous) => ({ ...previous, [review.id]: "" }));
    setReactionSavingById((previous) => ({ ...previous, [review.id]: true }));

    try {
      const response = await fetch(`/api/public/reviews/${review.id}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextValue }),
      });
      const body = (await response.json()) as { error?: string; item?: SerializedReview };

      if (!response.ok || !body.item) {
        setReactionErrorById((previous) => ({
          ...previous,
          [review.id]: body.error ?? "Не удалось сохранить реакцию",
        }));
        return;
      }

      const replaceReview = (item: SerializedReview) => (item.id === review.id ? body.item! : item);
      setPreviewItems((previous) => previous.map(replaceReview));
      setModalItems((previous) => previous.map(replaceReview));
    } finally {
      setReactionSavingById((previous) => ({ ...previous, [review.id]: false }));
    }
  }

  function renderReview(review: SerializedReview, compact = false) {
    const likeActive = review.currentUserReaction === "LIKE";
    const dislikeActive = review.currentUserReaction === "DISLIKE";
    const isReactionSaving = reactionSavingById[review.id] ?? false;
    const activeCategoryMatch = getReviewCategoryMatch(review, activeCategory);
    const categoryLabel = activeCategoryMatch
      ? getReviewCategoryLabel(activeCategory)
      : getReviewCategoryLabel(review.reviewCategory);
    const externalSourceName = getExternalSourceDisplayName(review);

    return (
      <article
        key={review.id}
        className={compact ? "py-3" : "border-b border-olive/10 py-5 last:border-b-0"}
      >
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef3f6] text-base font-semibold text-olive ring-1 ring-olive/10">
            {review.userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.userAvatarUrl}
                alt={review.userName}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(review.userName)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-semibold text-olive">{review.userName}</p>
              <span className="text-sm text-olive/55">{formatReviewDateLabel(review)}</span>
              {review.guestCity ? (
                <span className="rounded-full bg-olive/[0.04] px-2 py-0.5 text-xs font-medium text-olive/58">
                  {review.guestCity}
                </span>
              ) : null}
              {review.isImported ? (
                <span
                  title={externalSourceName ? `Источник: ${externalSourceName}` : "Внешний отзыв"}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  <AppIcon icon={ShieldCheck} className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <RatingStars rating={review.rating} size="text-lg" />
              <span className="text-sm font-semibold text-olive/68">
                {review.rating.toFixed(1)}
              </span>
              {categoryLabel ? (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                  {categoryLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-olive/86">
          <HighlightedReviewText review={review} activeCategory={activeCategory} />
        </p>

        {review.ownerReply ? (
          <div className="mt-3 rounded-2xl border-l-4 border-sage bg-[#f7faf8] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-olive/58">
              Ответ владельца
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-olive/84">
              {review.ownerReply}
            </p>
          </div>
        ) : null}

        {!compact ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-olive/65">
            <button
              type="button"
              onClick={() => void setReaction(review, likeActive ? null : "LIKE")}
              disabled={isReactionSaving}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                likeActive
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-olive/14 bg-white text-olive/72 hover:border-emerald-200 hover:text-emerald-700"
              }`}
            >
              <AppIcon icon={ThumbsUp} className="h-3.5 w-3.5" />
              {review.likesCount}
            </button>
            <button
              type="button"
              onClick={() => void setReaction(review, dislikeActive ? null : "DISLIKE")}
              disabled={isReactionSaving}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                dislikeActive
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-olive/14 bg-white text-olive/72 hover:border-rose-200 hover:text-rose-700"
              }`}
            >
              <AppIcon icon={ThumbsDown} className="h-3.5 w-3.5" />
              {review.dislikesCount}
            </button>
            {reactionErrorById[review.id] ? (
              <span className="text-xs text-red-600">{reactionErrorById[review.id]}</span>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  const distribution = summary.ratingDistribution ?? defaultRatingDistribution;
  const maxRatingBucket = Math.max(1, ...Object.values(distribution));
  const modalCategories = summary.categories?.length
    ? summary.categories
    : reviewCategoryOptions
        .map((option) => ({
          ...option,
          count: initialReviews.filter((review) => hasReviewCategory(review, option.id)).length,
        }))
        .filter((option) => option.count > 0);

  return (
    <section id="reviews" className="scroll-mt-[132px] md:scroll-mt-[152px]">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-olive/10 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-olive md:text-[1.85rem]">{title}</h2>
            {hasPublishedReviews ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
                <span className="inline-flex min-w-10 items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white">
                  {summary.avgRating.toFixed(1)}
                </span>
                <span className="font-semibold">{totalReviewsLabel}</span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-olive/66">{emptyDescription}</p>
            )}
          </div>
        </div>

        {visiblePreviewItems.length > 0 ? (
          <div className="mt-4 divide-y divide-olive/10">
            {visiblePreviewItems.map((review) => renderReview(review, true))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-olive/18 bg-[#fcfbf7] p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-terra ring-1 ring-olive/10">
                <AppIcon icon={MessageSquareText} className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-olive">{emptyTitle}</p>
                <p className="mt-1 text-sm leading-6 text-olive/70">{promptText}</p>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="mt-5 rounded-xl bg-[#f0efed] px-5 py-3 text-sm font-semibold text-olive transition hover:bg-[#e8e5e1]"
        >
          {hasPublishedReviews ? `Читать ${totalReviewsLabel}` : "Открыть отзывы"}
        </button>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/45 px-0 py-0 md:px-6 md:py-8">
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl md:h-[calc(100vh-4rem)] md:rounded-[28px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reviews-modal-title"
          >
            <div className="relative flex-1 overflow-y-auto px-5 pb-8 pt-6 md:px-10 md:pt-8">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="sticky top-0 right-0 z-20 float-right -mr-8 -mt-9 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-olive shadow-[0_8px_22px_rgba(58,43,35,0.12)] ring-1 ring-olive/10 backdrop-blur transition hover:bg-olive/6 md:-mr-14 md:-mt-12"
                aria-label="Закрыть отзывы"
              >
                <AppIcon icon={X} className="h-6 w-6" />
              </button>

              <h2 id="reviews-modal-title" className="pr-12 text-3xl font-semibold text-olive">
                {title}
              </h2>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <span className="inline-flex min-w-11 items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white">
                      {summary.avgRating.toFixed(1)}
                    </span>
                    <span className="font-semibold">{totalReviewsLabel}</span>
                  </div>
                  <div className="mt-4 grid max-w-2xl gap-2">
                    {[5, 4, 3, 2, 1].map((starCount) => (
                      <div
                        key={starCount}
                        className="grid grid-cols-[116px_1fr_32px] items-center gap-3"
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((starIndex) => (
                            <AppIcon
                              key={starIndex}
                              icon={Star}
                              className={`h-4 w-4 ${
                                starIndex <= starCount
                                  ? "fill-amber-500 text-amber-500"
                                  : "fill-olive/14 text-olive/14"
                              }`}
                            />
                          ))}
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-olive/14">
                          <span
                            className="block h-full rounded-full bg-olive/55"
                            style={{
                              width: `${Math.round((distribution[starCount as 1 | 2 | 3 | 4 | 5] / maxRatingBucket) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="text-sm text-olive/65">
                          {distribution[starCount as 1 | 2 | 3 | 4 | 5]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#f7f8f8] p-4">
                  <p className="text-sm leading-6 text-olive/72">
                    Рейтинг — это среднее арифметическое оценок пользователей.
                  </p>
                  {canWriteReview ? (
                    <Button
                      className="mt-4 w-full"
                      onClick={() => setIsComposerOpen((value) => !value)}
                    >
                      {isComposerOpen ? "Скрыть форму" : "Написать отзыв"}
                    </Button>
                  ) : isAuthenticated ? (
                    <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-olive/70">
                      Владелец может отвечать на отзывы, но не оставлять свои.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      <Link
                        href={loginHref}
                        className="rounded-xl bg-primary px-4 py-2 text-center text-sm font-semibold text-white"
                      >
                        Войти
                      </Link>
                      <Link
                        href={registerHref}
                        className="rounded-xl border border-olive/14 bg-white px-4 py-2 text-center text-sm font-semibold text-olive"
                      >
                        Регистрация
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {canWriteReview && isComposerOpen ? (
                <div className="mt-5 rounded-2xl bg-[#fcfbf7] p-5 ring-1 ring-olive/10">
                  <p className="font-semibold text-olive">{promptTitle}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeRatingByStep(-0.5)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-olive ring-1 ring-olive/16"
                      aria-label="Уменьшить оценку"
                    >
                      {"<"}
                    </button>
                    <span className="inline-flex rounded-xl bg-white px-2 py-1.5 ring-1 ring-olive/16">
                      <RatingStars rating={rating} />
                    </span>
                    <button
                      type="button"
                      onClick={() => changeRatingByStep(0.5)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-olive ring-1 ring-olive/16"
                      aria-label="Увеличить оценку"
                    >
                      {">"}
                    </button>
                    <span className="text-sm font-semibold text-olive">
                      {rating.toFixed(1)} / 5
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Input
                      value={guestCity}
                      onChange={(event) => setGuestCity(event.target.value)}
                      placeholder="Город, откуда вы приехали"
                      maxLength={80}
                    />
                    <Input
                      value={reviewedAt}
                      onChange={(event) => setReviewedAt(event.target.value)}
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      aria-label="Дата отзыва или поездки"
                    />
                  </div>
                  <textarea
                    className="mt-4 w-full rounded-2xl border border-olive/16 bg-white px-4 py-3 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-terra focus:ring-2 focus:ring-terra/18"
                    rows={5}
                    maxLength={2000}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Напишите, что понравилось, что было удобно и что стоит знать другим гостям."
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button onClick={() => void submitReview()} disabled={isSubmitting}>
                      {isSubmitting ? "Отправка..." : "Отправить отзыв"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
              {success ? (
                <p className="mt-4 text-sm font-medium text-green-700">{success}</p>
              ) : null}

              {modalCategories.length > 0 ? (
                <div
                  ref={categoryScrollerRef}
                  onPointerDown={handleCategoryPointerDown}
                  onPointerMove={handleCategoryPointerMove}
                  onPointerUp={finishCategoryDrag}
                  onPointerCancel={finishCategoryDrag}
                  onLostPointerCapture={finishCategoryDrag}
                  onClickCapture={handleCategoryClickCapture}
                  className={`mt-6 flex snap-x gap-2 overflow-x-auto scroll-smooth pb-2 pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                    isCategoryDragging
                      ? "cursor-grabbing select-none scroll-auto"
                      : "cursor-grab touch-pan-x"
                  }`}
                >
                  {modalCategories.map((category) => {
                    const active = activeCategory === category.id;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        data-review-category-id={category.id}
                        onClick={() => setActiveCategory(active ? null : category.id)}
                        className={`min-w-[148px] max-w-[190px] shrink-0 snap-start rounded-xl px-4 py-3 text-left text-sm transition ${
                          active
                            ? "bg-olive text-white"
                            : "bg-[#f3f2f0] text-olive hover:bg-[#ebe8e4]"
                        }`}
                      >
                        <span className="block break-words font-semibold leading-5">
                          {category.label}
                        </span>
                        <span className={`text-xs ${active ? "text-white/72" : "text-olive/55"}`}>
                          {formatReviewsCountLabel(category.count)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as "new" | "old" | "positive" | "negative")
                  }
                  className="h-11 rounded-xl border border-olive/10 bg-[#f3f2f0] px-3 text-sm font-semibold text-olive outline-none"
                >
                  <option value="new">Сначала новые</option>
                  <option value="old">Сначала старые</option>
                  <option value="positive">Сначала положительные</option>
                  <option value="negative" disabled={!summary.hasNegativeReviews}>
                    Сначала отрицательные
                  </option>
                </select>
                {activeCategory ? (
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className="h-11 rounded-xl bg-[#f3f2f0] px-3 text-sm font-semibold text-olive"
                  >
                    Все категории
                  </button>
                ) : null}
              </div>

              <div className="mt-2">
                {modalItems.length === 0 && !isLoading ? (
                  <div className="rounded-2xl border border-dashed border-olive/16 bg-[#fcfbf7] p-6 text-sm text-olive/65">
                    Для выбранных условий отзывов пока нет.
                  </div>
                ) : (
                  modalItems.map((review) => renderReview(review))
                )}
              </div>

              <div ref={sentinelRef} className="h-10" />
              {isLoading ? (
                <p className="py-4 text-center text-sm font-medium text-olive/60">
                  Загружаем отзывы...
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
