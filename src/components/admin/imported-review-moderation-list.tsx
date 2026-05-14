"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SerializedReview } from "@/lib/reviews";

export type AdminImportedReviewItem = SerializedReview & {
  target: {
    href: string;
    title: string;
    subtitle: string;
    ownerName: string | null;
  } | null;
};

type ImportedReviewModerationListProps = {
  initialReviews: AdminImportedReviewItem[];
  activeStatus?: SerializedReview["status"] | "ALL";
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function getReviewDisplayDate(review: SerializedReview): string {
  return review.reviewedAt ?? review.createdAt;
}

function statusLabel(status: SerializedReview["status"]): string {
  if (status === "ACTIVE") return "Проверен";
  if (status === "DELETED") return "Отклонен";
  if (status === "DUPLICATE") return "Дубль";
  if (status === "FAILED") return "Ошибка";
  return "На проверке";
}

export function ImportedReviewModerationList({
  initialReviews,
  activeStatus = "ALL",
}: ImportedReviewModerationListProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [processingById, setProcessingById] = useState<
    Record<string, "approve" | "reject" | "duplicate" | "delete" | null>
  >({});
  const [ratingById, setRatingById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialReviews.map((review) => [
        review.id,
        review.rating >= 0.5 ? String(review.rating) : "",
      ]),
    ),
  );
  const [error, setError] = useState("");

  const orderedReviews = useMemo(
    () =>
      [...reviews].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [reviews],
  );

  async function moderateReview(id: string, action: "approve" | "reject" | "duplicate" | "delete") {
    setError("");
    setProcessingById((previous) => ({ ...previous, [id]: action }));
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          action === "delete"
            ? undefined
            : JSON.stringify({
                action,
                rating: Number(ratingById[id] || 0),
              }),
      });
      const body = (await response.json()) as { error?: string; item?: SerializedReview | null };

      if (!response.ok) {
        setError(body.error ?? "Не удалось изменить статус отзыва.");
        return;
      }

      if (action === "delete" || body.item === null) {
        setReviews((previous) => previous.filter((review) => review.id !== id));
        return;
      }

      if (!body.item) {
        setError("Не удалось изменить статус отзыва.");
        return;
      }

      if (activeStatus !== "ALL" && body.item.status !== activeStatus) {
        setReviews((previous) => previous.filter((review) => review.id !== id));
        return;
      }

      setReviews((previous) =>
        previous.map((review) =>
          review.id === id
            ? {
                ...review,
                ...body.item!,
                target: review.target,
              }
            : review,
        ),
      );
    } finally {
      setProcessingById((previous) => ({ ...previous, [id]: null }));
    }
  }

  if (orderedReviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-olive/16 bg-white p-6 text-sm text-olive/65">
        Отзывов для выбранного статуса пока нет.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
      {orderedReviews.map((review) => (
        <article
          key={review.id}
          className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/70">
                {statusLabel(review.status)}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-olive">
                {review.target?.title ?? "Карточка не найдена"}
              </h2>
              <p className="mt-1 text-sm text-olive/60">
                {review.target?.subtitle ?? "Источник карточки не определён"} · владелец{" "}
                {review.target?.ownerName ?? "не указан"}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-olive">{review.userName}</p>
              <p className="mt-1 text-xs text-olive/55">
                {formatDateTime(getReviewDisplayDate(review))}
                {review.guestCity ? ` · ${review.guestCity}` : ""}
              </p>
              <p className="mt-1 text-sm font-semibold text-terra">
                {review.rating >= 0.5
                  ? `${review.rating.toFixed(1)} / 5`
                  : "Рейтинг сайта не выбран"}
              </p>
            </div>
          </div>

          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-olive/82">{review.text}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {review.externalSourceName ? (
              <span className="inline-flex rounded-xl border border-olive/12 bg-cream/60 px-3 py-2 font-semibold text-olive/72">
                Источник: {review.externalSourceName}
              </span>
            ) : null}
            {review.externalSourceUrl ? (
              <a
                href={review.externalSourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex rounded-xl border border-primary/18 bg-primary/6 px-3 py-2 font-semibold text-primary hover:bg-primary/10"
              >
                Открыть источник
              </a>
            ) : null}
            {review.target ? (
              <Link
                href={review.target.href}
                className="inline-flex rounded-xl border border-olive/12 px-3 py-2 font-semibold text-olive/72 hover:bg-cream"
              >
                Открыть карточку
              </Link>
            ) : null}
            <select
              value={ratingById[review.id] ?? ""}
              onChange={(event) =>
                setRatingById((previous) => ({
                  ...previous,
                  [review.id]: event.target.value,
                }))
              }
              className="h-10 rounded-xl border border-olive/12 bg-white px-3 text-sm font-semibold text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
            >
              <option value="">Рейтинг сайта</option>
              {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((value) => (
                <option key={value} value={String(value)}>
                  {value.toFixed(1)} / 5
                </option>
              ))}
            </select>
            {review.status !== "ACTIVE" ? (
              <Button
                disabled={
                  (processingById[review.id] ?? null) !== null ||
                  Number(ratingById[review.id] || 0) < 0.5
                }
                onClick={() => void moderateReview(review.id, "approve")}
              >
                {(processingById[review.id] ?? null) === "approve" ? "Проверяем..." : "Одобрить"}
              </Button>
            ) : null}
            {review.status !== "DELETED" ? (
              <Button
                variant="ghost"
                disabled={(processingById[review.id] ?? null) !== null}
                onClick={() => void moderateReview(review.id, "reject")}
              >
                {(processingById[review.id] ?? null) === "reject" ? "Отклоняем..." : "Отклонить"}
              </Button>
            ) : null}
            {review.status !== "DUPLICATE" ? (
              <Button
                variant="ghost"
                disabled={(processingById[review.id] ?? null) !== null}
                onClick={() => void moderateReview(review.id, "duplicate")}
              >
                {(processingById[review.id] ?? null) === "duplicate" ? "Помечаем..." : "Дубль"}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={(processingById[review.id] ?? null) !== null}
              onClick={() => void moderateReview(review.id, "delete")}
            >
              {(processingById[review.id] ?? null) === "delete" ? "Удаляем..." : "Удалить"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
