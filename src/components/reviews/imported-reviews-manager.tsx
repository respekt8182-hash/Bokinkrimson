"use client";

import { CircleAlert, ExternalLink, ShieldCheck, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedReview } from "@/lib/reviews";

type ImportedReviewsManagerProps = {
  entityType: "property" | "excursion" | "transfer";
  entityId: string;
  initialReviews: SerializedReview[];
  mode?: "owner" | "admin";
  schemaAvailable?: boolean;
  title?: string;
  description?: string;
};

const ratingOptions = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];
const sourceNameSuggestions = [
  "Куда на море",
  "Яндекс",
  "Суточно",
  "Твил",
  "101 Отель",
  "Азур",
  "Куда на юга",
];

function formatStatus(review: SerializedReview): { label: string; className: string } {
  if (review.status === "ACTIVE") {
    return {
      label: review.verifiedAt ? "Проверен" : "Опубликован",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (review.status === "DELETED") {
    return {
      label: "Отклонён",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: "На проверке",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function ImportedReviewsManager({
  entityType,
  entityId,
  initialReviews,
  mode = "owner",
  schemaAvailable = true,
  title = "Отзывы с других сайтов",
  description = "Добавьте имя автора, оценку, текст, сайт-источник, город и дату, если они известны. После проверки отзыв появится в публичной карточке.",
}: ImportedReviewsManagerProps) {
  const [items, setItems] = useState(initialReviews);
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState("5");
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [items],
  );
  const endpoint =
    mode === "admin" ? "/api/admin/external-reviews" : "/api/dashboard/external-reviews";
  const endpointUrl = `${endpoint}?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`;

  async function submitReview() {
    setError("");
    setSuccess("");

    if (!schemaAvailable) {
      setError("База данных ещё не обновлена для отзывов с других сайтов.");
      return;
    }

    if (
      authorName.trim().length < 2 ||
      text.trim().length < 10 ||
      (!sourceName.trim() && !sourceUrl.trim())
    ) {
      setError("Заполните имя, текст отзыва и название сайта или ссылку на источник.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          rating: Number(rating),
          text: text.trim(),
          sourceUrl: sourceUrl.trim(),
          sourceName: sourceName.trim(),
          guestCity: guestCity.trim(),
          reviewedAt,
        }),
      });

      const body = (await response.json()) as { error?: string; item?: SerializedReview };

      if (!response.ok || !body.item) {
        setError(body.error ?? "Не удалось добавить отзыв.");
        return;
      }

      setItems((previous) => [body.item!, ...previous]);
      setAuthorName("");
      setRating("5");
      setText("");
      setSourceUrl("");
      setSourceName("");
      setGuestCity("");
      setReviewedAt("");
      setSuccess(
        mode === "admin"
          ? "Отзыв добавлен и отправлен на проверку."
          : "Отзыв отправлен администратору на проверку.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-olive/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <AppIcon icon={ShieldCheck} className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-semibold text-olive">{title}</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-olive/68">{description}</p>
        </div>
        <span className="inline-flex self-start rounded-full border border-primary/15 bg-primary/6 px-3 py-1 text-xs font-semibold text-primary">
          {orderedItems.length} в истории
        </span>
      </div>

      {!schemaAvailable ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            База данных ещё не обновлена для отзывов с других сайтов. Примените последнюю
            Prisma-миграцию, после этого форма станет доступна.
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_140px]">
        <Input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="Имя автора отзыва"
          maxLength={80}
          disabled={!schemaAvailable}
        />
        <label className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500">
            <AppIcon icon={Star} className="h-4 w-4" />
          </span>
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            disabled={!schemaAvailable}
            className="h-11 w-full rounded-xl border border-olive/12 bg-white px-10 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20 disabled:opacity-55"
          >
            {ratingOptions.map((value) => (
              <option key={value} value={String(value)}>
                {value.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
        <Input
          value={guestCity}
          onChange={(event) => setGuestCity(event.target.value)}
          placeholder="Город автора (необязательно)"
          maxLength={80}
          disabled={!schemaAvailable}
        />
        <Input
          value={reviewedAt}
          onChange={(event) => setReviewedAt(event.target.value)}
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          disabled={!schemaAvailable}
          aria-label="Дата отзыва"
        />
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Текст отзыва"
          rows={4}
          maxLength={2000}
          disabled={!schemaAvailable}
          className="rounded-xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/42 focus:border-terra focus:ring-2 focus:ring-terra/20 disabled:opacity-55 lg:col-span-2"
        />
        <Input
          value={sourceName}
          onChange={(event) => setSourceName(event.target.value)}
          placeholder="Название сайта-источника"
          maxLength={80}
          disabled={!schemaAvailable}
          className="lg:col-span-2"
        />
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          {sourceNameSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setSourceName(suggestion)}
              disabled={!schemaAvailable}
              className="rounded-full border border-primary/14 bg-primary/6 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <Input
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="Ссылка на отзыв (необязательно, только для проверки)"
          type="url"
          maxLength={500}
          disabled={!schemaAvailable}
          className="lg:col-span-2"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void submitReview()}
          disabled={isSubmitting || !schemaAvailable}
        >
          {isSubmitting ? "Отправляем..." : "Добавить на проверку"}
        </Button>
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
        {success ? <span className="text-sm text-emerald-700">{success}</span> : null}
      </div>

      {orderedItems.length > 0 ? (
        <div className="mt-6 space-y-3">
          {orderedItems.map((review) => {
            const status = formatStatus(review);

            return (
              <article
                key={review.id}
                className="rounded-xl border border-olive/10 bg-cream/35 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-olive">{review.userName}</p>
                    <p className="mt-1 text-sm text-olive/60">
                      {review.rating.toFixed(1)} из 5
                      {review.externalSourceName ? ` · ${review.externalSourceName}` : ""}
                      {review.guestCity ? ` · ${review.guestCity}` : ""}
                      {review.reviewedAt ? ` · ${formatDate(review.reviewedAt)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-olive/80">
                  {review.text}
                </p>
                {review.externalSourceUrl ? (
                  <a
                    href={review.externalSourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Источник
                    <AppIcon icon={ExternalLink} className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
