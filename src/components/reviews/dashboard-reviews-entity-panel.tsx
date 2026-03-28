// Interactive review panel for the owner dashboard.
// Shows reviews for a property or excursion with load-more / page navigation and a report dialog.
"use client";

import { ChevronDown, ChevronUp, Flag, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SerializedReview } from "@/lib/reviews";

// ─── constants ───────────────────────────────────────────────────────────────

const INITIAL_LIMIT = 5;
const INCREMENT = 3;
const PAGE_THRESHOLD = 50;
const PAGE_SIZE = 15;

const REPORT_REASONS = [
  { value: "spam", label: "Спам или реклама" },
  { value: "abuse", label: "Оскорбления или грубость" },
  { value: "misleading", label: "Недостоверная информация" },
  { value: "other", label: "Другое" },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]["value"];

// ─── helpers ─────────────────────────────────────────────────────────────────

function getStarFillPercent(rating: number, starIndex: number): number {
  const v = rating - (starIndex - 1);
  if (v >= 1) return 100;
  if (v <= 0) return 0;
  return Math.round(v * 100);
}

function StarGlyph({ fillPercent }: { fillPercent: number }) {
  return (
    <span className="relative inline-block text-base leading-none">
      <span className="text-olive/20">★</span>
      <span
        className="absolute left-0 top-0 overflow-hidden text-amber-500"
        style={{ width: `${Math.max(0, Math.min(100, fillPercent))}%` }}
      >
        ★
      </span>
    </span>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarGlyph key={i} fillPercent={getStarFillPercent(rating, i)} />
      ))}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

// ─── types ────────────────────────────────────────────────────────────────────

type EntityType = "property" | "excursion";

type ReviewsApiResponse = {
  items?: SerializedReview[];
  pagination?: {
    offset: number;
    limit: number;
    nextOffset: number;
    hasMore: boolean;
    total: number;
  };
  error?: string;
};

export type DashboardReviewsEntityPanelProps = {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  reviewsCount: number;
  avgRating: number;
};

// ─── report dialog ────────────────────────────────────────────────────────────

type ReportDialogProps = {
  reviewId: string;
  userName: string;
  onClose: () => void;
};

function ReportDialog({ reviewId, userName, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  async function submit() {
    if (!reason) {
      setError("Выберите причину жалобы");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
      });
      const body = (await res.json()) as { error?: string; code?: string };

      if (!res.ok) {
        if (body.code === "ALREADY_REPORTED") {
          setError("Вы уже отправляли жалобу на этот отзыв");
        } else {
          setError(body.error ?? "Не удалось отправить жалобу");
        }
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-olive/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-olive">Пожаловаться на отзыв</h3>
            <p className="mt-0.5 text-xs text-olive/60">Отзыв пользователя: {userName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-olive/50 hover:bg-cream hover:text-olive"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200">
            <p className="font-semibold">Жалоба отправлена</p>
            <p className="mt-1 text-green-700">
              Администрация рассмотрит её и при необходимости примет меры.
            </p>
            <Button className="mt-3" variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-olive/50">
              Причина
            </p>
            <div className="mt-2 space-y-1.5">
              {REPORT_REASONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                    reason === value
                      ? "border-terra/40 bg-terra/5 text-olive"
                      : "border-olive/12 bg-cream/40 text-olive/70 hover:border-olive/25 hover:bg-cream"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-terra"
                  />
                  {label}
                </label>
              ))}
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-olive/50">
              Комментарий <span className="normal-case font-normal text-olive/40">(необязательно)</span>
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Опишите подробнее, что именно нарушает правила"
              className="mt-2 w-full resize-none rounded-xl border border-olive/20 bg-white px-3 py-2.5 text-sm text-olive placeholder:text-olive/40 outline-none focus:border-terra focus:ring-2 focus:ring-terra/20"
            />
            <p className="mt-0.5 text-right text-xs text-olive/40">{comment.length}/500</p>

            {error ? (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void submit()} disabled={submitting || !reason}>
                {submitting ? "Отправка..." : "Отправить жалобу"}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
                Отмена
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── review card ──────────────────────────────────────────────────────────────

type ReviewCardProps = {
  review: SerializedReview;
  onReport: (reviewId: string, userName: string) => void;
};

function ReviewCard({ review, onReport }: ReviewCardProps) {
  return (
    <article className="rounded-2xl border border-olive/10 bg-cream/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-olive ring-1 ring-olive/12">
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
            <p className="text-xs text-olive/55">{formatDate(review.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <RatingStars rating={review.rating} />
            <span className="text-sm font-semibold text-terra">{review.rating.toFixed(1)}</span>
          </div>
          <button
            type="button"
            title="Пожаловаться на отзыв"
            onClick={() => onReport(review.id, review.userName)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-olive/35 transition hover:bg-rose-50 hover:text-rose-500"
            aria-label="Пожаловаться"
          >
            <Flag className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-olive/85">
        {review.text}
      </p>

      {review.ownerReply ? (
        <div className="mt-3 rounded-lg border border-olive/12 bg-white px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-olive/50">Ответ владельца</p>
          <p className="mt-1 whitespace-pre-line text-sm text-olive/80">{review.ownerReply}</p>
          {review.ownerRepliedAt ? (
            <p className="mt-1 text-xs text-olive/45">{formatDate(review.ownerRepliedAt)}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// ─── main panel ──────────────────────────────────────────────────────────────

export function DashboardReviewsEntityPanel({
  entityType,
  entityId,
  entityName,
  reviewsCount,
  avgRating,
}: DashboardReviewsEntityPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<SerializedReview[]>([]);
  const [total, setTotal] = useState(reviewsCount);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Page-based state (only when total > PAGE_THRESHOLD)
  const [currentPage, setCurrentPage] = useState(1);

  // Report dialog state
  const [reportTarget, setReportTarget] = useState<{ reviewId: string; userName: string } | null>(null);

  const usePageNav = total > PAGE_THRESHOLD;
  const totalPages = usePageNav ? Math.ceil(total / PAGE_SIZE) : 0;

  const fetchReviews = useCallback(
    async (offset: number, limit: number): Promise<ReviewsApiResponse | null> => {
      setError("");
      setLoading(true);
      try {
        const url = `/api/dashboard/reviews/items?entityType=${entityType}&entityId=${entityId}&offset=${offset}&limit=${limit}`;
        const res = await fetch(url, { cache: "no-store" });
        const body = (await res.json()) as ReviewsApiResponse;
        if (!res.ok) {
          setError(body.error ?? "Не удалось загрузить отзывы");
          return null;
        }
        return body;
      } finally {
        setLoading(false);
      }
    },
    [entityType, entityId],
  );

  async function open() {
    if (loaded) {
      setExpanded(true);
      return;
    }

    const limit = usePageNav ? PAGE_SIZE : INITIAL_LIMIT;
    const body = await fetchReviews(0, limit);
    if (!body) return;

    setItems(body.items ?? []);
    setTotal(body.pagination?.total ?? reviewsCount);
    setHasMore(body.pagination?.hasMore ?? false);
    setLoaded(true);
    setCurrentPage(1);
    setExpanded(true);
  }

  function close() {
    setExpanded(false);
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    const body = await fetchReviews(items.length, INCREMENT);
    if (!body) return;

    const next = body.items ?? [];
    setItems((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      return [...prev, ...next.filter((r) => !existingIds.has(r.id))];
    });
    setTotal(body.pagination?.total ?? total);
    setHasMore(body.pagination?.hasMore ?? false);
  }

  async function goToPage(page: number) {
    if (loading || page < 1 || page > totalPages) return;
    const offset = (page - 1) * PAGE_SIZE;
    const body = await fetchReviews(offset, PAGE_SIZE);
    if (!body) return;

    setItems(body.items ?? []);
    setTotal(body.pagination?.total ?? total);
    setCurrentPage(page);
  }

  function openReport(reviewId: string, userName: string) {
    setReportTarget({ reviewId, userName });
  }

  function closeReport() {
    setReportTarget(null);
  }

  const noReviews = reviewsCount === 0;

  return (
    <>
      <article className="rounded-xl border border-olive/10 bg-cream/40">
        {/* Entity header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-olive">{entityName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {reviewsCount > 0 ? (
                <>
                  <div className="flex items-center gap-1">
                    <RatingStars rating={avgRating} />
                    <span className="text-xs font-semibold text-terra">{avgRating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-olive/50">
                    {reviewsCount} {reviewsCount === 1 ? "отзыв" : reviewsCount < 5 ? "отзыва" : "отзывов"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-olive/45">Нет отзывов</span>
              )}
            </div>
          </div>

          {noReviews ? (
            <span className="rounded-lg border border-olive/15 px-3 py-1.5 text-xs text-olive/40">
              Нет отзывов
            </span>
          ) : expanded ? (
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center gap-1.5 rounded-lg border border-olive/20 px-3 py-1.5 text-xs font-semibold text-olive transition hover:bg-cream"
            >
              Скрыть <ChevronUp className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void open()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-olive/20 bg-white px-3 py-1.5 text-xs font-semibold text-olive transition hover:bg-cream disabled:opacity-55"
            >
              {loading && !loaded ? "Загрузка..." : "Показать отзывы"}
              {!loading && <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Expanded reviews */}
        {expanded && (
          <div className="border-t border-olive/10 px-3 pb-4 pt-3">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-olive/55">Отзывы не найдены</p>
            ) : (
              <>
                <div className="space-y-3">
                  {items.map((review) => (
                    <ReviewCard key={review.id} review={review} onReport={openReport} />
                  ))}
                </div>

                {/* Load more (≤ 50 reviews) */}
                {!usePageNav && hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="ghost"
                      onClick={() => void loadMore()}
                      disabled={loading}
                    >
                      {loading
                        ? "Загружаем..."
                        : `Показать ещё ${Math.min(INCREMENT, total - items.length)}`}
                    </Button>
                  </div>
                )}

                {/* Page navigation (> 50 reviews) */}
                {usePageNav && totalPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-olive/55">
                      Страница {currentPage} из {totalPages} · всего {total} отзывов
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void goToPage(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className="rounded-lg border border-olive/20 px-3 py-1.5 text-xs font-semibold text-olive transition hover:bg-cream disabled:opacity-40"
                      >
                        ← Назад
                      </button>

                      {/* Page number buttons: show up to 5 around current */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 2,
                        )
                        .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "…" ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-olive/40">
                              …
                            </span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => void goToPage(item as number)}
                              disabled={loading}
                              className={`h-7 w-7 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
                                item === currentPage
                                  ? "bg-primary text-white"
                                  : "border border-olive/20 text-olive hover:bg-cream"
                              }`}
                            >
                              {item}
                            </button>
                          ),
                        )}

                      <button
                        type="button"
                        onClick={() => void goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        className="rounded-lg border border-olive/20 px-3 py-1.5 text-xs font-semibold text-olive transition hover:bg-cream disabled:opacity-40"
                      >
                        Вперёд →
                      </button>
                    </div>
                  </div>
                )}

                {loading && loaded && (
                  <p className="mt-3 text-center text-xs text-olive/50">Загрузка...</p>
                )}
              </>
            )}
          </div>
        )}
      </article>

      {reportTarget && (
        <ReportDialog
          reviewId={reportTarget.reviewId}
          userName={reportTarget.userName}
          onClose={closeReport}
        />
      )}
    </>
  );
}
