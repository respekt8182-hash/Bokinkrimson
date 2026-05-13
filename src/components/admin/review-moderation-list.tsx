// UI component for review moderation list in the admin module.
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SerializedReview } from "@/lib/reviews";

type ReviewModerationListProps = {
  initialReviews: SerializedReview[];
  initialAvgRating: number;
  initialReviewsCount: number;
  title?: string;
};

function getStarFillPercent(rating: number, starIndex: number): number {
  const value = rating - (starIndex - 1);
  if (value >= 1) return 100;
  if (value <= 0) return 0;
  return Math.round(value * 100);
}

function StarGlyph({ fillPercent }: { fillPercent: number }) {
  return (
    <span className="relative inline-block text-base leading-none">
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function getReviewDisplayDate(review: SerializedReview): string {
  return review.reviewedAt ?? review.createdAt;
}

export function ReviewModerationList({
  initialReviews,
  initialAvgRating,
  initialReviewsCount,
  title = "Отзывы объекта",
}: ReviewModerationListProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [avgRating, setAvgRating] = useState(initialAvgRating);
  const [reviewsCount, setReviewsCount] = useState(initialReviewsCount);
  const [processingById, setProcessingById] = useState<Record<string, "approve" | "reject" | null>>({});
  const [error, setError] = useState("");
  const orderedReviews = useMemo(
    () =>
      [...reviews].sort((left, right) => {
        const leftPriority = left.status === "PENDING" ? 0 : left.status === "ACTIVE" ? 1 : 2;
        const rightPriority = right.status === "PENDING" ? 0 : right.status === "ACTIVE" ? 1 : 2;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [reviews],
  );

  async function moderateReview(id: string, action: "approve" | "reject") {
    setError("");
    setProcessingById((previous) => ({ ...previous, [id]: action }));
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = (await response.json()) as {
        error?: string;
        item?: SerializedReview;
        summary?: { avgRating: number; reviewsCount: number };
      };

      if (!response.ok || !body.item) {
        setError(body.error ?? "Не удалось изменить статус отзыва");
        return;
      }

      setReviews((prev) => prev.map((review) => (review.id === id ? body.item! : review)));

      if (body.summary) {
        setAvgRating(body.summary.avgRating);
        setReviewsCount(body.summary.reviewsCount);
      }
    } finally {
      setProcessingById((previous) => ({ ...previous, [id]: null }));
    }
  }

  return (
    <section className="rounded-2xl border border-olive/10 bg-white p-4">
      <h2 className="text-xl text-olive">{title}</h2>
      <p className="mt-1 text-sm text-olive/75">
        Активный рейтинг: <span className="font-semibold text-olive">{avgRating.toFixed(1)}</span> (
        {reviewsCount} отзывов)
      </p>

      {reviews.length === 0 ? (
        <p className="mt-2 text-sm text-olive/70">Отзывов пока нет.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {orderedReviews.map((review) => (
            <article
              key={review.id}
              className={`rounded-xl p-3 ${
                review.status === "ACTIVE"
                  ? "bg-cream/60"
                  : review.status === "PENDING"
                    ? "bg-amber-50"
                    : "bg-red-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-olive">{review.userName}</p>
                  <p className="text-xs text-olive/60">
                    {formatDateTime(getReviewDisplayDate(review))}
                    {review.guestCity ? ` · ${review.guestCity}` : ""}
                  </p>
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
                  <span>{review.rating.toFixed(1)}/5</span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-olive/85">{review.text}</p>
              {review.isImported ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-olive/70">
                  <span className="rounded-full border border-primary/15 bg-primary/6 px-2 py-1 font-semibold text-primary">
                    Внешний источник
                  </span>
                  {review.externalSourceName ? <span>{review.externalSourceName}</span> : null}
                  {review.externalSourceUrl ? (
                    <a
                      href={review.externalSourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-primary hover:underline"
                    >
                      Проверить источник
                    </a>
                  ) : null}
                </div>
              ) : null}
              {review.ownerReply ? (
                <div className="mt-2 rounded-lg border border-olive/12 bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-olive/65">
                    Ответ владельца
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-olive/85">{review.ownerReply}</p>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2 py-1 text-xs text-olive/70">
                  Статус:{" "}
                  {review.status === "ACTIVE"
                    ? "Активен"
                    : review.status === "PENDING"
                      ? "На модерации"
                      : "Отклонен"}
                </span>
                {review.status === "PENDING" ? (
                  <Button
                    disabled={(processingById[review.id] ?? null) !== null}
                    onClick={() => void moderateReview(review.id, "approve")}
                  >
                    {(processingById[review.id] ?? null) === "approve" ? "Одобрение..." : "Одобрить"}
                  </Button>
                ) : null}
                {review.status !== "DELETED" ? (
                  <Button
                    variant="ghost"
                    disabled={(processingById[review.id] ?? null) !== null}
                    onClick={() => void moderateReview(review.id, "reject")}
                  >
                    {(processingById[review.id] ?? null) === "reject" ? "Отклонение..." : "Отклонить"}
                  </Button>
                ) : null}
                {review.status === "DELETED" ? (
                  <Button
                    variant="ghost"
                    disabled={(processingById[review.id] ?? null) !== null}
                    onClick={() => void moderateReview(review.id, "approve")}
                  >
                    {(processingById[review.id] ?? null) === "approve" ? "Восстановление..." : "Восстановить"}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
