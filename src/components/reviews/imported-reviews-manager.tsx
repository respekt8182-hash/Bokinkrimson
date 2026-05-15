"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  ListChecks,
  Pencil,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedReview } from "@/lib/reviews";

type EntityType = "property" | "excursion" | "transfer";
type Mode = "owner" | "admin";
type ActiveTab = "queue" | "manual" | "history";

type ImportedReviewsManagerProps = {
  entityType: EntityType;
  entityId: string;
  initialReviews: SerializedReview[];
  mode?: Mode;
  schemaAvailable?: boolean;
  title?: string;
  description?: string;
};

type ReviewActionResponse = {
  error?: string;
  item?: SerializedReview | null;
};

type ManualReviewResponse = {
  error?: string;
  item?: SerializedReview;
};

type EditDraft = {
  authorName: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  guestCity: string;
  reviewedAt: string;
};

type ManualDraft = {
  authorName: string;
  guestCity: string;
  rating: string;
  reviewedAt: string;
  sourceName: string;
  sourceUrl: string;
  text: string;
};

const ratingOptions = ["", "5", "4.5", "4", "3.5", "3", "2.5", "2", "1.5", "1", "0.5"];
const reviewPreviewLength = 220;
const reviewSourceSuggestions = [
  "Куда на море",
  "Яндекс",
  "Авито",
  "Суточно",
  "Твил",
  "Куда на юга",
];
const currentReviewYear = new Date().getFullYear();
const reviewYearOptions = Array.from({ length: currentReviewYear - 2000 + 1 }, (_, index) =>
  String(currentReviewYear - index),
);

function createEmptyManualDraft(): ManualDraft {
  return {
    authorName: "",
    guestCity: "",
    rating: "5",
    reviewedAt: "",
    sourceName: "",
    sourceUrl: "",
    text: "",
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null): string {
  if (!value) return "";
  if (isYearOnlyReviewDate(value)) return value.slice(0, 4);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function isYearOnlyReviewDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return Boolean(match && match[2] === "01" && match[3] === "01");
}

function reviewYearToDateValue(year: string): string {
  return year ? `${year}-01-01` : "";
}

function statusMeta(status: SerializedReview["status"]): {
  label: string;
  className: string;
} {
  if (status === "ACTIVE") {
    return {
      label: "Опубликован",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "DELETED") {
    return { label: "Отклонён", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }
  if (status === "DUPLICATE") {
    return { label: "Дубль", className: "border-slate-200 bg-slate-50 text-slate-700" };
  }
  if (status === "FAILED") {
    return { label: "Ошибка", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }

  return {
    label: "На модерации",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function mergeById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) {
    return [nextItem, ...items];
  }
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function getReviewPreview(text: string): string {
  const normalized = text.trim();
  if (normalized.length <= reviewPreviewLength) {
    return normalized;
  }
  return `${normalized.slice(0, reviewPreviewLength).trim()}...`;
}

function hasHiddenText(text: string): boolean {
  return text.trim().length > reviewPreviewLength;
}

export function ImportedReviewsManager({
  entityType,
  entityId,
  initialReviews,
  mode = "owner",
  schemaAvailable = true,
  title = "Отзывы с других сайтов",
  description = "Создайте отзыв вручную: укажите автора, оценку, текст и источник. Добавленные отзывы проходят модерацию перед публикацией.",
}: ImportedReviewsManagerProps) {
  const [items, setItems] = useState(initialReviews);
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual");
  const [manualDraft, setManualDraft] = useState<ManualDraft>(() => createEmptyManualDraft());
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [processingReviewId, setProcessingReviewId] = useState<string | null>(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(() => new Set());
  const [ratingById, setRatingById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialReviews.map((review) => [
        review.id,
        review.rating >= 0.5 ? String(review.rating) : "",
      ]),
    ),
  );
  const [editDraftById, setEditDraftById] = useState<Record<string, EditDraft>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sourceSuggestionsId = useId();

  const endpoint =
    mode === "admin" ? "/api/admin/external-reviews" : "/api/dashboard/external-reviews";
  const endpointUrl = `${endpoint}?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`;
  const reviewEndpoint = mode === "admin" ? "/api/admin/reviews" : "/api/dashboard/reviews";
  const canModerateReviews = mode === "admin";

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [items],
  );
  const queuedItems = useMemo(
    () => orderedItems.filter((review) => review.status === "PENDING"),
    [orderedItems],
  );
  const historyItems = useMemo(
    () => orderedItems.filter((review) => review.status !== "PENDING"),
    [orderedItems],
  );

  function applyReviewItem(review: SerializedReview) {
    setItems((previous) => mergeById(previous, review));
    setRatingById((previous) => ({
      ...previous,
      [review.id]: review.rating >= 0.5 ? String(review.rating) : (previous[review.id] ?? ""),
    }));
  }

  async function submitManualReview() {
    setError("");
    setSuccess("");

    const ratingValue = Number(manualDraft.rating || 0);
    if (!manualDraft.authorName.trim()) {
      setError("Укажите имя автора отзыва.");
      return;
    }
    if (!Number.isFinite(ratingValue) || ratingValue < 0.5) {
      setError("Выберите рейтинг от 0.5 до 5.");
      return;
    }
    if (manualDraft.text.trim().length < 10) {
      setError("Текст отзыва должен содержать минимум 10 символов.");
      return;
    }

    setIsManualSubmitting(true);

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: manualDraft.authorName.trim(),
          rating: ratingValue,
          text: manualDraft.text.trim(),
          guestCity: manualDraft.guestCity.trim(),
          reviewedAt: reviewYearToDateValue(manualDraft.reviewedAt),
          sourceName: manualDraft.sourceName.trim(),
          sourceUrl: manualDraft.sourceUrl.trim(),
        }),
      });
      const body = (await response.json()) as ManualReviewResponse;

      if (!response.ok || !body.item) {
        setError(body.error ?? "Не удалось создать отзыв.");
        return;
      }

      applyReviewItem(body.item);
      setManualDraft({
        ...createEmptyManualDraft(),
        sourceName: manualDraft.sourceName.trim(),
        sourceUrl: manualDraft.sourceUrl.trim(),
      });
      setSuccess(mode === "admin" ? "Отзыв опубликован." : "Отзыв добавлен на модерацию.");
    } finally {
      setIsManualSubmitting(false);
    }
  }

  function getDraft(review: SerializedReview): EditDraft {
    return (
      editDraftById[review.id] ?? {
        authorName: review.importedAuthorName ?? review.userName,
        text: review.text,
        sourceName: review.externalSourceName ?? "",
        sourceUrl: review.externalSourceUrl ?? "",
        guestCity: review.guestCity ?? "",
        reviewedAt: toDateInputValue(review.reviewedAt),
      }
    );
  }

  async function moderateReview(
    review: SerializedReview,
    action: "approve" | "reject" | "duplicate" | "delete" | "edit",
  ) {
    setError("");
    setSuccess("");
    setProcessingReviewId(review.id);

    try {
      const ratingValue = Number(ratingById[review.id] || 0);
      const draft = getDraft(review);
      const response = await fetch(`${reviewEndpoint}/${review.id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          action === "delete"
            ? undefined
            : JSON.stringify({
                action,
                rating: Number.isFinite(ratingValue) ? ratingValue : 0,
                text: draft.text.trim(),
                authorName: draft.authorName.trim(),
                sourceName: draft.sourceName.trim(),
                sourceUrl: draft.sourceUrl.trim(),
                guestCity: draft.guestCity.trim(),
                reviewedAt: draft.reviewedAt,
              }),
      });
      const body = (await response.json()) as ReviewActionResponse;

      if (!response.ok) {
        setError(body.error ?? "Не удалось изменить отзыв.");
        return;
      }

      if (action === "delete" || body.item === null) {
        setItems((previous) => previous.filter((item) => item.id !== review.id));
      } else if (body.item) {
        setItems((previous) => previous.map((item) => (item.id === review.id ? body.item! : item)));
        setRatingById((previous) => ({
          ...previous,
          [review.id]:
            body.item!.rating >= 0.5 ? String(body.item!.rating) : (previous[review.id] ?? ""),
        }));
      }

      if (action === "edit") {
        setEditDraftById((previous) => {
          const next = { ...previous };
          delete next[review.id];
          return next;
        });
      }

      setSuccess(
        action === "approve"
          ? "Отзыв опубликован."
          : action === "reject"
            ? "Отзыв отклонён."
            : action === "duplicate"
              ? "Отзыв отмечен как дубль."
              : action === "delete"
                ? "Отзыв удалён."
                : "Отзыв сохранён.",
      );
    } finally {
      setProcessingReviewId(null);
    }
  }

  function toggleHistoryItem(reviewId: string) {
    setExpandedHistoryIds((previous) => {
      const next = new Set(previous);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  }

  function renderEditableReview(review: SerializedReview) {
    const draft = getDraft(review);
    const isEditing = review.id in editDraftById;

    if (!isEditing) {
      return (
        <>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-olive/82">{review.text}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/58">
            {review.guestCity ? <span>Город: {review.guestCity}</span> : null}
            {review.reviewedAt ? <span>Дата: {formatDate(review.reviewedAt)}</span> : null}
          </div>
        </>
      );
    }

    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input
          value={draft.authorName}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, authorName: event.target.value },
            }))
          }
          placeholder="Автор"
          maxLength={80}
        />
        <Input
          value={draft.guestCity}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, guestCity: event.target.value },
            }))
          }
          placeholder="Город автора"
          maxLength={80}
        />
        <Input
          value={draft.reviewedAt}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, reviewedAt: event.target.value },
            }))
          }
          type="date"
        />
        <Input
          value={draft.sourceName}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, sourceName: event.target.value },
            }))
          }
          placeholder="Источник"
          maxLength={80}
        />
        <Input
          value={draft.sourceUrl}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, sourceUrl: event.target.value },
            }))
          }
          placeholder="Ссылка на источник"
          maxLength={500}
        />
        <textarea
          value={draft.text}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, text: event.target.value },
            }))
          }
          rows={4}
          maxLength={2000}
          className="rounded-xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/42 focus:border-terra focus:ring-2 focus:ring-terra/20 md:col-span-2"
        />
      </div>
    );
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
          {queuedItems.length} на модерации
        </span>
      </div>

      {!schemaAvailable ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            База данных ещё не обновлена для отзывов с других сайтов. Примените последнюю
            Prisma-миграцию, чтобы добавить и модерировать отзывы.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-b border-olive/10 pb-3">
        {[
          { value: "manual" as const, label: "Создать отзыв", icon: Plus },
          { value: "queue" as const, label: "На модерации", icon: ListChecks },
          { value: "history" as const, label: "Добавленные отзывы", icon: Clock3 },
        ].map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-primary/20 bg-primary/8 text-primary"
                  : "border-olive/12 bg-white text-olive/70 hover:border-primary/20 hover:text-primary"
              }`}
            >
              <AppIcon icon={tab.icon} className="mr-1.5 h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}

      {activeTab === "queue" ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-olive">Отзывы на модерации</h3>
          {queuedItems.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-olive/16 bg-white p-5 text-sm text-olive/62">
              Сейчас нет отзывов на модерации.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {queuedItems.map((review) => {
                const meta = statusMeta(review.status);
                const isEditing = review.id in editDraftById;
                const processing = processingReviewId === review.id;
                const canApprove = Number(ratingById[review.id] || 0) >= 0.5;

                return (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-olive/10 bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-olive">{review.userName}</p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-olive/58">
                          Источник: {review.externalSourceName ?? "внешний сайт"} · добавлен{" "}
                          {formatDateTime(review.createdAt)}
                        </p>
                      </div>
                      <div className="text-sm text-olive/66 sm:text-right">
                        <p>
                          Рейтинг сайта:{" "}
                          {review.rating >= 0.5 ? `${review.rating.toFixed(1)} / 5` : "не выбран"}
                        </p>
                      </div>
                    </div>

                    {renderEditableReview(review)}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canModerateReviews ? (
                        <>
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-olive">
                            <AppIcon icon={Star} className="h-4 w-4 text-amber-500" />
                            <select
                              value={ratingById[review.id] ?? ""}
                              onChange={(event) =>
                                setRatingById((previous) => ({
                                  ...previous,
                                  [review.id]: event.target.value,
                                }))
                              }
                              className="h-10 rounded-xl border border-olive/12 bg-white px-3 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
                            >
                              {ratingOptions.map((value) => (
                                <option key={value || "empty"} value={value}>
                                  {value ? `${Number(value).toFixed(1)} / 5` : "Рейтинг сайта"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Button
                            type="button"
                            onClick={() => void moderateReview(review, "approve")}
                            disabled={processing || !canApprove}
                          >
                            <AppIcon icon={Check} className="mr-1.5 h-4 w-4" />
                            Опубликовать
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void moderateReview(review, "reject")}
                            disabled={processing}
                          >
                            <AppIcon icon={X} className="mr-1.5 h-4 w-4" />
                            Отклонить
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void moderateReview(review, "duplicate")}
                            disabled={processing}
                          >
                            <AppIcon icon={Copy} className="mr-1.5 h-4 w-4" />
                            Дубль
                          </Button>
                        </>
                      ) : null}
                      {isEditing ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void moderateReview(review, "edit")}
                          disabled={processing}
                        >
                          Сохранить
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setEditDraftById((previous) => ({
                              ...previous,
                              [review.id]: getDraft(review),
                            }))
                          }
                          disabled={processing}
                        >
                          <AppIcon icon={Pencil} className="mr-1.5 h-4 w-4" />
                          Редактировать
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void moderateReview(review, "delete")}
                        disabled={processing}
                      >
                        <AppIcon icon={Trash2} className="mr-1.5 h-4 w-4" />
                        Удалить
                      </Button>
                      {review.externalSourceUrl ? (
                        <a
                          href={review.externalSourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center rounded-xl border border-primary/18 bg-primary/6 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                        >
                          Источник
                          <AppIcon icon={ExternalLink} className="ml-1.5 h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "manual" ? (
        <div className="mt-5 rounded-2xl border border-olive/10 bg-[#fcfbf7] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Имя автора
              <Input
                value={manualDraft.authorName}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, authorName: event.target.value }))
                }
                placeholder="Анна"
                maxLength={80}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Город
              <Input
                value={manualDraft.guestCity}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, guestCity: event.target.value }))
                }
                placeholder="Москва"
                maxLength={80}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Рейтинг
              <select
                value={manualDraft.rating}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, rating: event.target.value }))
                }
                className="h-11 rounded-xl border border-olive/12 bg-white px-3 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
              >
                {ratingOptions.filter(Boolean).map((value) => (
                  <option key={value} value={value}>
                    {Number(value).toFixed(1)} / 5
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Год отзыва
              <select
                value={manualDraft.reviewedAt}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, reviewedAt: event.target.value }))
                }
                className="h-11 rounded-xl border border-olive/12 bg-white px-3 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
              >
                <option value="">Выберите год</option>
                {reviewYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Источник
              <Input
                value={manualDraft.sourceName}
                list={sourceSuggestionsId}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, sourceName: event.target.value }))
                }
                placeholder="Яндекс, Авито, Суточно..."
                maxLength={80}
              />
              <datalist id={sourceSuggestionsId}>
                {reviewSourceSuggestions.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Ссылка на источник
              <Input
                value={manualDraft.sourceUrl}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, sourceUrl: event.target.value }))
                }
                placeholder="https://..."
                maxLength={500}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-olive md:col-span-2">
              Текст отзыва
              <textarea
                value={manualDraft.text}
                onChange={(event) =>
                  setManualDraft((previous) => ({ ...previous, text: event.target.value }))
                }
                rows={5}
                maxLength={2000}
                className="rounded-xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/42 focus:border-terra focus:ring-2 focus:ring-terra/20"
                placeholder="Текст отзыва"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void submitManualReview()}
              disabled={isManualSubmitting || !schemaAvailable}
            >
              <AppIcon icon={Plus} className="mr-1.5 h-4 w-4" />
              {isManualSubmitting ? "Добавляем..." : "Добавить отзыв"}
            </Button>
          </div>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-olive">История добавленных отзывов</h3>
          {historyItems.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-olive/16 bg-white p-5 text-sm text-olive/62">
              Опубликованные, отклонённые и удалённые отзывы появятся здесь.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {historyItems.map((review) => {
                const meta = statusMeta(review.status);
                const processing = processingReviewId === review.id;
                const isEditing = review.id in editDraftById;
                const isExpanded = expandedHistoryIds.has(review.id);
                const canExpand = hasHiddenText(review.text);

                return (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-olive/10 bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-olive">{review.userName}</p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-olive/58">
                          Источник: {review.externalSourceName ?? "внешний сайт"} · добавлен{" "}
                          {formatDateTime(review.createdAt)}
                        </p>
                      </div>
                      <div className="text-sm text-olive/66 sm:text-right">
                        <p>
                          Рейтинг сайта:{" "}
                          {review.rating >= 0.5 ? `${review.rating.toFixed(1)} / 5` : "не выбран"}
                        </p>
                      </div>
                    </div>

                    {isEditing ? (
                      renderEditableReview(review)
                    ) : (
                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-olive/82">
                        {isExpanded ? review.text : getReviewPreview(review.text)}
                      </p>
                    )}

                    {isExpanded && !isEditing ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/58">
                        {review.guestCity ? <span>Город: {review.guestCity}</span> : null}
                        {review.reviewedAt ? (
                          <span>Дата: {formatDate(review.reviewedAt)}</span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canExpand && !isEditing ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleHistoryItem(review.id)}
                        >
                          <AppIcon
                            icon={isExpanded ? ChevronUp : ChevronDown}
                            className="mr-1.5 h-4 w-4"
                          />
                          {isExpanded ? "Свернуть" : "Развернуть"}
                        </Button>
                      ) : null}
                      {canModerateReviews ? (
                        isEditing ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void moderateReview(review, "edit")}
                            disabled={processing}
                          >
                            {processing ? "Сохраняем..." : "Сохранить"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setEditDraftById((previous) => ({
                                ...previous,
                                [review.id]: getDraft(review),
                              }))
                            }
                            disabled={processing}
                          >
                            <AppIcon icon={Pencil} className="mr-1.5 h-4 w-4" />
                            Редактировать
                          </Button>
                        )
                      ) : null}
                      {canModerateReviews && review.status === "ACTIVE" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void moderateReview(review, "reject")}
                          disabled={processing}
                        >
                          <AppIcon icon={X} className="mr-1.5 h-4 w-4" />
                          Отключить
                        </Button>
                      ) : null}
                      {canModerateReviews ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void moderateReview(review, "delete")}
                          disabled={processing}
                        >
                          <AppIcon icon={Trash2} className="mr-1.5 h-4 w-4" />
                          Удалить
                        </Button>
                      ) : null}
                      {review.externalSourceUrl ? (
                        <a
                          href={review.externalSourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center rounded-xl border border-primary/18 bg-primary/6 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                        >
                          Источник
                          <AppIcon icon={ExternalLink} className="ml-1.5 h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
