// UI component for property/excursion reviews section.
"use client";

import { MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedReview } from "@/lib/reviews";

type PropertyReviewsSectionProps = {
  submitUrl: string;
  loadMoreUrl: string;
  entityPath: string;
  entityLabel: "объекта" | "экскурсии" | "трансфера";
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

type ReviewsListResponse = {
  error?: string;
  items?: SerializedReview[];
  summary?: { avgRating: number; reviewsCount: number };
  pagination?: {
    offset: number;
    limit: number;
    nextOffset: number;
    hasMore: boolean;
    total: number;
  };
};

const REVIEWS_PAGE_SIZE = 5;

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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
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

function formatReviewsCountLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${count} отзывов`;
  if (last === 1) return `${count} отзыв`;
  if (last >= 2 && last <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
}

function formatVisibleReviewsLabel(visibleCount: number, totalCount: number): string {
  const safeTotal = Math.max(0, totalCount);
  const safeVisible = Math.min(Math.max(0, visibleCount), safeTotal);

  if (safeTotal <= 0) {
    return "Пока нет отзывов";
  }

  if (safeVisible >= safeTotal) {
    return `Показаны все ${formatReviewsCountLabel(safeTotal)}`;
  }

  return `Показано ${safeVisible} из ${safeTotal}`;
}

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((item) => item.slice(0, 1).toUpperCase());
  return letters.join("") || "?";
}

function StarGlyph({ fillPercent }: { fillPercent: number }) {
  return (
    <span className="relative inline-block text-xl leading-none">
      <span className="text-olive/25">★</span>
      <span
        className="absolute left-0 top-0 overflow-hidden text-amber-500"
        style={{ width: `${Math.max(0, Math.min(100, fillPercent))}%` }}
      >
        ★
      </span>
    </span>
  );
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
  promptTitle = "Отдыхали здесь? Поделитесь впечатлениями!",
  promptText = "Короткий честный отзыв помогает другим гостям быстрее понять, подходит ли им это предложение.",
  emptyTitle = "Пока нет отзывов",
  emptyDescription = "Когда гости начнут делиться впечатлениями, здесь появятся рейтинг и подробные комментарии.",
}: PropertyReviewsSectionProps) {
  const [items, setItems] = useState(initialReviews);
  const [summary, setSummary] = useState({
    avgRating,
    reviewsCount,
  });
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [replyDraftById, setReplyDraftById] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialReviews.map((review) => [review.id, review.ownerReply ?? ""])),
  );
  const [replySavingById, setReplySavingById] = useState<Record<string, boolean>>({});
  const [replyErrorById, setReplyErrorById] = useState<Record<string, string>>({});
  const [replySuccessById, setReplySuccessById] = useState<Record<string, string>>({});
  const [reactionSavingById, setReactionSavingById] = useState<Record<string, boolean>>({});
  const [reactionErrorById, setReactionErrorById] = useState<Record<string, string>>({});

  const isOwnerViewer = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);
  const effectiveRating = rating;
  const hasPublishedReviews = summary.reviewsCount > 0;
  const canWriteReview = isAuthenticated && !isOwnerViewer;
  const totalReviewsLabel = formatReviewsCountLabel(summary.reviewsCount);
  const visibleReviewsLabel = formatVisibleReviewsLabel(items.length, summary.reviewsCount);

  useEffect(() => {
    setReplyDraftById((previous) => {
      const next = { ...previous };
      for (const review of items) {
        if (!(review.id in next)) {
          next[review.id] = review.ownerReply ?? "";
        }
      }
      return next;
    });
  }, [items]);

  const loginHref = useMemo(
    () => `/auth/login?next=${encodeURIComponent(entityPath)}`,
    [entityPath],
  );
  const registerHref = useMemo(
    () => `/auth/register?next=${encodeURIComponent(entityPath)}`,
    [entityPath],
  );

  function changeRatingByStep(step: number) {
    setRating((previous) => clampRating(previous + step));
  }

  async function submitReview() {
    setError("");
    setSuccess("");

    if (isOwnerViewer) {
      setError("Владелец не может оставлять отзыв о своей карточке.");
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
        summary?: { avgRating: number; reviewsCount: number };
        moderationStatus?: "PENDING";
      };

      if (!response.ok) {
        setError(body.error ?? "Не удалось отправить отзыв");
        return;
      }

      if (!body.item) {
        setError("Не удалось отправить отзыв");
        return;
      }

      if (body.summary) {
        setSummary(body.summary);
      }

      if (body.item.status === "PENDING" || body.moderationStatus === "PENDING") {
        setText("");
        setGuestCity("");
        setReviewedAt("");
        setRating(5);
        setIsComposerOpen(false);
        setSuccess("Отзыв отправлен на модерацию. Он появится после проверки администратором.");
        return;
      }

      setItems((previous) => [body.item!, ...previous]);
      setText("");
      setGuestCity("");
      setReviewedAt("");
      setRating(5);
      setIsComposerOpen(false);
      setSuccess("Спасибо, отзыв опубликован.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadMoreReviews() {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setError("");
    setIsLoadingMore(true);
    try {
      const separator = loadMoreUrl.includes("?") ? "&" : "?";
      const response = await fetch(
        `${loadMoreUrl}${separator}offset=${items.length}&limit=${REVIEWS_PAGE_SIZE}`,
        {
          cache: "no-store",
        },
      );
      const body = (await response.json()) as ReviewsListResponse;

      if (!response.ok) {
        setError(body.error ?? "Не удалось загрузить дополнительные отзывы");
        return;
      }

      const nextItems = body.items ?? [];
      setItems((previous) => {
        const existingIds = new Set(previous.map((review) => review.id));
        const freshItems = nextItems.filter((review) => !existingIds.has(review.id));
        return [...previous, ...freshItems];
      });

      if (body.summary) {
        setSummary(body.summary);
      }
      setHasMore(
        body.pagination?.hasMore ?? items.length + nextItems.length < summary.reviewsCount,
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function submitOwnerReply(reviewId: string) {
    const replyText = (replyDraftById[reviewId] ?? "").trim();
    setReplyErrorById((previous) => ({ ...previous, [reviewId]: "" }));
    setReplySuccessById((previous) => ({ ...previous, [reviewId]: "" }));

    if (replyText.length < 2) {
      setReplyErrorById((previous) => ({
        ...previous,
        [reviewId]: "Ответ должен содержать минимум 2 символа",
      }));
      return;
    }

    setReplySavingById((previous) => ({ ...previous, [reviewId]: true }));
    try {
      const response = await fetch(`/api/public/reviews/${reviewId}/owner-reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      });

      const body = (await response.json()) as {
        error?: string;
        item?: SerializedReview;
      };

      if (!response.ok || !body.item) {
        setReplyErrorById((previous) => ({
          ...previous,
          [reviewId]: body.error ?? "Не удалось сохранить ответ",
        }));
        return;
      }

      setItems((previous) =>
        previous.map((review) => (review.id === reviewId ? body.item! : review)),
      );
      setReplyDraftById((previous) => ({
        ...previous,
        [reviewId]: body.item?.ownerReply ?? "",
      }));
      setReplySuccessById((previous) => ({
        ...previous,
        [reviewId]: "Ответ сохранен",
      }));
    } finally {
      setReplySavingById((previous) => ({ ...previous, [reviewId]: false }));
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

      setItems((previous) => previous.map((item) => (item.id === review.id ? body.item! : item)));
    } finally {
      setReactionSavingById((previous) => ({ ...previous, [review.id]: false }));
    }
  }

  return (
    <section
      id="reviews"
      className="scroll-mt-[132px] rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)] md:scroll-mt-[152px] md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl text-olive md:text-[1.85rem]">{title}</h2>
          {hasPublishedReviews ? (
            <div className="mt-3 flex items-center gap-3 text-sm text-olive/68">
              <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-emerald-600 px-3 py-1.5 font-semibold text-white">
                {summary.avgRating.toFixed(1)}
              </span>
              <span className="font-medium text-olive">Всего {totalReviewsLabel}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-olive/66">
              Рейтинг появится здесь после первых опубликованных отзывов.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-[24px] bg-[#f4f6f7] px-4 py-4 ring-1 ring-olive/8 md:flex-row md:items-center md:justify-between md:px-5">
        <div>
          <p className="text-base font-semibold text-olive">{promptTitle}</p>
          <p className="mt-1 text-sm text-olive/60">
            {isOwnerViewer
              ? `Вы владелец ${entityLabel}. Оставлять отзыв нельзя, но можно отвечать на отзывы гостей ниже.`
              : promptText}
          </p>
        </div>

        {canWriteReview ? (
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen((previous) => !previous);
              setError("");
              setSuccess("");
            }}
            className="inline-flex items-center justify-center rounded-full border border-olive/16 bg-white px-4 py-2 text-sm font-semibold text-olive transition hover:border-olive/24 hover:bg-white/90"
          >
            {isComposerOpen ? "Скрыть форму" : "Написать отзыв"}
          </button>
        ) : isAuthenticated ? (
          <span className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-olive/72 ring-1 ring-olive/10">
            Ответы владельца доступны ниже
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link
              href={loginHref}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Войти
            </Link>
            <Link
              href={registerHref}
              className="rounded-full border border-olive/16 bg-white px-4 py-2 text-sm font-semibold text-olive"
            >
              Регистрация
            </Link>
          </div>
        )}
      </div>

      {canWriteReview && isComposerOpen ? (
        <div className="mt-4 rounded-[24px] bg-[#fcfbf7] p-5 ring-1 ring-olive/10">
          <p className="text-base font-semibold text-olive">Оставить отзыв</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => changeRatingByStep(-0.5)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-olive ring-1 ring-olive/16 transition hover:bg-cream"
              aria-label="Уменьшить оценку на 0.5"
            >
              {"<"}
            </button>
            <div
              className="inline-flex items-center gap-1 rounded-xl bg-white px-2 py-1.5 ring-1 ring-olive/16"
              tabIndex={0}
              role="slider"
              aria-label="Оценка"
              aria-valuemin={0.5}
              aria-valuemax={5}
              aria-valuenow={effectiveRating}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  changeRatingByStep(-0.5);
                } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  changeRatingByStep(0.5);
                }
              }}
            >
              {[1, 2, 3, 4, 5].map((starIndex) => (
                <span
                  key={starIndex}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                  aria-hidden="true"
                >
                  <StarGlyph fillPercent={getStarFillPercent(effectiveRating, starIndex)} />
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => changeRatingByStep(0.5)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-olive ring-1 ring-olive/16 transition hover:bg-cream"
              aria-label="Увеличить оценку на 0.5"
            >
              {">"}
            </button>
            <span className="text-sm font-semibold text-olive">
              {effectiveRating.toFixed(1)} / 5
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              value={guestCity}
              onChange={(event) => setGuestCity(event.target.value)}
              placeholder="Город, откуда вы приехали (необязательно)"
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
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-green-700">{success}</p> : null}
          </div>
        </div>
      ) : null}

      {!isComposerOpen && error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!isComposerOpen && success ? <p className="mt-4 text-sm text-green-700">{success}</p> : null}

      {items.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-olive/18 bg-[#fcfbf7] p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-terra ring-1 ring-olive/10">
              <AppIcon icon={MessageSquareText} className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-semibold text-olive">{emptyTitle}</p>
              <p className="mt-1 text-sm leading-6 text-olive/70">{emptyDescription}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f7faf8] px-4 py-3 ring-1 ring-olive/8">
            <span className="text-sm font-semibold text-olive">{visibleReviewsLabel}</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-olive/60 ring-1 ring-olive/8">
              {totalReviewsLabel}
            </span>
          </div>

          {items.map((review) => {
            const likeActive = review.currentUserReaction === "LIKE";
            const dislikeActive = review.currentUserReaction === "DISLIKE";
            const isReactionSaving = reactionSavingById[review.id] ?? false;
            const reactionsTotal = review.likesCount + review.dislikesCount;
            const helpfulPercent =
              reactionsTotal > 0 ? Math.round((review.likesCount / reactionsTotal) * 100) : null;
            const externalSourceName = getExternalSourceDisplayName(review);
            const externalSourceTitle = externalSourceName
              ? `Источник: ${externalSourceName}`
              : "Внешний отзыв";

            return (
              <article
                key={review.id}
                className="rounded-[24px] border border-olive/10 bg-white p-5 shadow-[0_10px_28px_rgba(58,43,35,0.04)]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef3f6] text-base font-semibold text-olive ring-1 ring-olive/10">
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
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-lg font-semibold text-olive">
                          {review.userName}
                        </p>
                        <span className="text-sm text-olive/55">
                          {formatReviewDateLabel(review)}
                        </span>
                        {review.guestCity ? (
                          <span className="rounded-full bg-olive/[0.04] px-2 py-0.5 text-xs font-medium text-olive/58">
                            {review.guestCity}
                          </span>
                        ) : null}
                        {review.isImported ? (
                          <span
                            title={externalSourceTitle}
                            aria-label={externalSourceTitle}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            <AppIcon icon={ShieldCheck} className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-terra">
                        <div className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((starIndex) => (
                            <StarGlyph
                              key={`${review.id}-star-${starIndex}`}
                              fillPercent={getStarFillPercent(review.rating, starIndex)}
                            />
                          ))}
                        </div>
                        <span>{review.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-olive/84">
                  {review.text}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm text-olive/65">
                  <span className="font-medium text-olive/70">Полезный отзыв?</span>
                  <button
                    type="button"
                    onClick={() => void setReaction(review, likeActive ? null : "LIKE")}
                    disabled={isReactionSaving}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                      likeActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-olive/14 bg-white text-olive/72 hover:border-emerald-200 hover:text-emerald-700"
                    }`}
                  >
                    <AppIcon icon={ThumbsUp} className="h-3.5 w-3.5" />
                    <span>Да</span>
                    <span className="text-xs opacity-70">{review.likesCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void setReaction(review, dislikeActive ? null : "DISLIKE")}
                    disabled={isReactionSaving}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                      dislikeActive
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-olive/14 bg-white text-olive/72 hover:border-rose-200 hover:text-rose-700"
                    }`}
                  >
                    <AppIcon icon={ThumbsDown} className="h-3.5 w-3.5" />
                    <span>Нет</span>
                    <span className="text-xs opacity-70">{review.dislikesCount}</span>
                  </button>
                  <span className="rounded-full bg-olive/[0.04] px-3 py-1.5 text-xs font-medium text-olive/58">
                    {helpfulPercent === null ? "Оценок пока нет" : `${helpfulPercent}% полезно`}
                  </span>
                  {reactionErrorById[review.id] ? (
                    <span className="text-xs text-red-600">{reactionErrorById[review.id]}</span>
                  ) : null}
                </div>

                {review.ownerReply ? (
                  <div className="mt-4 rounded-[20px] border-l-4 border-sage bg-[#f7faf8] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-olive/58">
                      Ответ владельца
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-olive/84">
                      {review.ownerReply}
                    </p>
                    {review.ownerRepliedAt ? (
                      <p className="mt-2 text-xs text-olive/55">
                        {formatDateTime(review.ownerRepliedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {isOwnerViewer ? (
                  <div className="mt-4 rounded-[20px] bg-[#f7f8f8] p-4 ring-1 ring-olive/8">
                    <p className="text-sm font-semibold text-olive">Ответить на отзыв</p>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={replyDraftById[review.id] ?? ""}
                      onChange={(event) =>
                        setReplyDraftById((previous) => ({
                          ...previous,
                          [review.id]: event.target.value,
                        }))
                      }
                      placeholder="Ваш ответ гостю"
                      className="mt-3 w-full rounded-2xl border border-olive/16 bg-white px-3.5 py-3 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/18"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => void submitOwnerReply(review.id)}
                        disabled={replySavingById[review.id] ?? false}
                        variant="ghost"
                      >
                        {(replySavingById[review.id] ?? false)
                          ? "Сохранение..."
                          : "Сохранить ответ"}
                      </Button>
                      {replyErrorById[review.id] ? (
                        <span className="text-sm text-red-600">{replyErrorById[review.id]}</span>
                      ) : null}
                      {replySuccessById[review.id] ? (
                        <span className="text-sm text-green-700">
                          {replySuccessById[review.id]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="ghost"
                onClick={() => void loadMoreReviews()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Загружаем..." : "Показать ещё отзывы"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
