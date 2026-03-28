// UI component for property/excursion reviews section.
"use client";

import { MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import type { SerializedReview } from "@/lib/reviews";

type PropertyReviewsSectionProps = {
  submitUrl: string;
  loadMoreUrl: string;
  entityPath: string;
  entityLabel: "объекта" | "экскурсии";
  avgRating: number;
  reviewsCount: number;
  initialReviews: SerializedReview[];
  initialHasMore: boolean;
  isAuthenticated: boolean;
  currentUserId?: string | null;
  ownerUserId?: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [replyDraftById, setReplyDraftById] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initialReviews.map((review) => [review.id, review.ownerReply ?? ""]),
      ),
  );
  const [replySavingById, setReplySavingById] = useState<Record<string, boolean>>({});
  const [replyErrorById, setReplyErrorById] = useState<Record<string, string>>({});
  const [replySuccessById, setReplySuccessById] = useState<Record<string, string>>({});
  const [reactionSavingById, setReactionSavingById] = useState<Record<string, boolean>>({});
  const [reactionErrorById, setReactionErrorById] = useState<Record<string, string>>({});

  const isOwnerViewer = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);
  const effectiveRating = rating;

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
      setError("Владелец не может оставлять отзыв о своем объекте.");
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
        setRating(5);
        setSuccess("Отзыв отправлен на модерацию. Он появится после проверки администратором.");
        return;
      }

      setItems((previous) => [body.item!, ...previous]);
      setText("");
      setRating(5);
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
        `${loadMoreUrl}${separator}offset=${items.length}&limit=3`,
        { cache: "no-store" },
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
      setHasMore(body.pagination?.hasMore ?? items.length + nextItems.length < summary.reviewsCount);
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

      setItems((previous) =>
        previous.map((item) => (item.id === review.id ? body.item! : item)),
      );
    } finally {
      setReactionSavingById((previous) => ({ ...previous, [review.id]: false }));
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-olive/10 shadow-[0_12px_30px_rgba(15,118,110,0.08)] md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl text-olive">Отзывы</h2>
          <p className="mt-1 text-sm text-olive/75">
            Средний рейтинг: <span className="font-semibold text-olive">{summary.avgRating.toFixed(1)}</span>{" "}
            ({summary.reviewsCount} отзывов)
          </p>
        </div>
        {summary.reviewsCount > 0 ? (
          <span className="rounded-full bg-sage/22 px-3 py-1 text-xs font-semibold text-olive">
            Проверено отзывами
          </span>
        ) : null}
      </div>

      {isAuthenticated ? (
        isOwnerViewer ? (
          <div className="mt-4 rounded-xl bg-cream/70 p-4 text-sm text-olive/80 ring-1 ring-olive/10">
            Вы владелец {entityLabel}. Оставлять отзыв о собственном {entityLabel} нельзя, но вы можете отвечать
            на отзывы гостей ниже.
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-cream/70 p-4 ring-1 ring-olive/10">
            <p className="text-sm font-semibold text-olive">Оставить отзыв</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => changeRatingByStep(-0.5)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-olive ring-1 ring-olive/20 transition hover:bg-cream"
                aria-label="Уменьшить оценку на 0.5"
              >
                {"<"}
              </button>
              <div
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 ring-1 ring-olive/20"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-olive ring-1 ring-olive/20 transition hover:bg-cream"
                aria-label="Увеличить оценку на 0.5"
              >
                {">"}
              </button>
              <span className="text-sm font-semibold text-olive">{effectiveRating.toFixed(1)} / 5</span>
            </div>
            <textarea
              className="mt-3 w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20"
              rows={4}
              maxLength={2000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Напишите ваши впечатления"
            />
            <div className="mt-3">
              <Button onClick={() => void submitReview()} disabled={isSubmitting}>
                {isSubmitting ? "Отправка..." : "Отправить отзыв"}
              </Button>
            </div>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            {success ? <p className="mt-2 text-sm text-green-700">{success}</p> : null}
          </div>
        )
      ) : (
        <div className="mt-4 rounded-xl bg-cream/70 p-4 text-sm text-olive/80 ring-1 ring-olive/10">
          Оставлять отзывы о {entityLabel} могут только авторизованные пользователи.
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={loginHref}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Войти
            </Link>
            <Link
              href={registerHref}
              className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-white"
            >
              Регистрация
            </Link>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-cream/70 p-6 text-center ring-1 ring-olive/10">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-terra ring-1 ring-olive/12">
            <AppIcon icon={MessageSquareText} className="h-7 w-7" />
          </div>
          <p className="mt-3 text-base font-semibold text-olive">Пока нет отзывов</p>
          <p className="mt-1 text-sm text-olive/75">
            Будьте первым гостем, который поделится впечатлениями об этом объекте.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((review) => {
            const likeActive = review.currentUserReaction === "LIKE";
            const dislikeActive = review.currentUserReaction === "DISLIKE";
            const isReactionSaving = reactionSavingById[review.id] ?? false;

            return (
              <article
                key={review.id}
                className="rounded-2xl bg-cream/60 p-4 ring-1 ring-olive/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-olive ring-1 ring-olive/12">
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
                      <p className="truncate text-sm font-semibold text-olive">{review.userName}</p>
                      <p className="text-xs text-olive/60">{formatDateTime(review.createdAt)}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-terra">
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

                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-olive/85">
                  {review.text}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setReaction(review, likeActive ? null : "LIKE")}
                    disabled={isReactionSaving}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      likeActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-olive/15 bg-white text-olive/70 hover:border-emerald-200 hover:text-emerald-700"
                    }`}
                  >
                    <AppIcon icon={ThumbsUp} className="h-3.5 w-3.5" />
                    <span>{review.likesCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void setReaction(review, dislikeActive ? null : "DISLIKE")}
                    disabled={isReactionSaving}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      dislikeActive
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-olive/15 bg-white text-olive/70 hover:border-rose-200 hover:text-rose-700"
                    }`}
                  >
                    <AppIcon icon={ThumbsDown} className="h-3.5 w-3.5" />
                    <span>{review.dislikesCount}</span>
                  </button>
                  {reactionErrorById[review.id] ? (
                    <span className="text-xs text-red-600">{reactionErrorById[review.id]}</span>
                  ) : null}
                </div>

                {review.ownerReply ? (
                  <div className="mt-3 rounded-lg border border-olive/12 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-olive/65">
                      Ответ владельца
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-olive/85">{review.ownerReply}</p>
                    {review.ownerRepliedAt ? (
                      <p className="mt-1 text-xs text-olive/60">{formatDateTime(review.ownerRepliedAt)}</p>
                    ) : null}
                  </div>
                ) : null}

                {isOwnerViewer ? (
                  <div className="mt-3 rounded-lg border border-olive/12 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-olive/65">
                      Ответить на отзыв
                    </p>
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
                      className="mt-2 w-full rounded-xl border border-olive/20 bg-white px-3 py-2 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => void submitOwnerReply(review.id)}
                        disabled={replySavingById[review.id] ?? false}
                        variant="ghost"
                      >
                        {(replySavingById[review.id] ?? false) ? "Сохранение..." : "Сохранить ответ"}
                      </Button>
                      {replyErrorById[review.id] ? (
                        <span className="text-sm text-red-600">{replyErrorById[review.id]}</span>
                      ) : null}
                      {replySuccessById[review.id] ? (
                        <span className="text-sm text-green-700">{replySuccessById[review.id]}</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button variant="ghost" onClick={() => void loadMoreReviews()} disabled={isLoadingMore}>
                {isLoadingMore ? "Загружаем..." : "Еще отзывы"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
