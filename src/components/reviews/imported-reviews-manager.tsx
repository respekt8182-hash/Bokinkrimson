"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  CloudUpload,
  Copy,
  ExternalLink,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseExternalReviewImportPayload,
  type ParsedExternalReviewImportItem,
} from "@/lib/external-review-import";
import {
  getReviewCategoryLabel,
  reviewCategoryOptions,
  type ReviewCategoryMatch,
} from "@/lib/review-categories";
import type { SerializedReview } from "@/lib/reviews";

type EntityType = "property" | "excursion" | "transfer";
type Mode = "owner" | "admin";
type ActiveTab = "queue" | "manual" | "json" | "history";
type ImportedReviewSort =
  | "created_desc"
  | "created_asc"
  | "reviewed_desc"
  | "reviewed_asc"
  | "rating_desc"
  | "rating_asc"
  | "author_asc";

type ImportedReviewsManagerProps = {
  entityType: EntityType;
  entityId: string;
  initialReviews: SerializedReview[];
  mode?: Mode;
  schemaAvailable?: boolean;
  canCreate?: boolean;
  createDisabledReason?: string | null;
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

type JsonImportResponse = {
  error?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  deletedCount?: number;
  items?: SerializedReview[];
  skipped?: Array<{ index: number; reason: string }>;
  failed?: Array<{ index: number; reason: string }>;
  warnings?: string[];
};

type EditDraft = {
  authorName: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  guestCity: string;
  reviewedAt: string;
  reviewCategory: string;
  reviewHighlight: string;
};

type ManualDraft = {
  authorName: string;
  guestCity: string;
  rating: string;
  reviewedAt: string;
  sourceName: string;
  sourceUrl: string;
  text: string;
  reviewCategory: string;
  reviewHighlight: string;
};

type JsonReviewDraft = {
  id: string;
  authorName: string;
  guestCity: string;
  rating: string;
  reviewedAt: string;
  sourceName: string;
  sourceUrl: string;
  text: string;
  reviewCategory: string;
  reviewHighlight: string;
  reviewCategoryMatches: ReviewCategoryMatch[];
};

const ratingOptions = ["", "5", "4.5", "4", "3.5", "3", "2.5", "2", "1.5", "1", "0.5"];
const reviewPreviewLength = 220;
const importedManagerPageSize = 10;
const importedReviewSortOptions: Array<{ value: ImportedReviewSort; label: string }> = [
  { value: "created_desc", label: "Сначала добавленные" },
  { value: "created_asc", label: "Сначала старые добавления" },
  { value: "reviewed_desc", label: "Дата отзыва: новые" },
  { value: "reviewed_asc", label: "Дата отзыва: старые" },
  { value: "rating_desc", label: "Рейтинг выше" },
  { value: "rating_asc", label: "Рейтинг ниже" },
  { value: "author_asc", label: "Автор А-Я" },
];
const jsonImportStatusOptions = [
  { value: "ACTIVE", label: "\u0412\u0438\u0434\u0438\u043c\u044b\u0435" },
  { value: "DELETED", label: "\u0421\u043a\u0440\u044b\u0442\u044b\u0435" },
] as const;
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

function getEntityCopy(entityType: EntityType): {
  genitive: string;
  dative: string;
} {
  if (entityType === "excursion") {
    return {
      genitive: "программы",
      dative: "программе",
    };
  }

  if (entityType === "transfer") {
    return {
      genitive: "трансфера",
      dative: "трансферу",
    };
  }

  return {
    genitive: "объекта",
    dative: "объекту",
  };
}

function createEmptyManualDraft(): ManualDraft {
  return {
    authorName: "",
    guestCity: "",
    rating: "5",
    reviewedAt: "",
    sourceName: "",
    sourceUrl: "",
    text: "",
    reviewCategory: "",
    reviewHighlight: "",
  };
}

function createJsonReviewDraft(
  item: ParsedExternalReviewImportItem,
  index: number,
): JsonReviewDraft {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    authorName: item.authorName,
    guestCity: item.guestCity ?? "",
    rating: item.rating >= 0.5 ? String(item.rating) : "",
    reviewedAt: item.reviewedAt ?? "",
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl ?? "",
    text: item.text,
    reviewCategory: item.reviewCategory ?? "",
    reviewHighlight: item.reviewHighlight ?? "",
    reviewCategoryMatches: item.reviewCategoryMatches,
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
    return { label: "Скрыт", className: "border-rose-200 bg-rose-50 text-rose-700" };
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

function getReviewTimestamp(value: string | null): number {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getReviewSortDate(review: SerializedReview): number {
  return getReviewTimestamp(review.reviewedAt) || getReviewTimestamp(review.createdAt);
}

function compareReviewText(left: string | null | undefined, right: string | null | undefined) {
  return (left?.trim() || "").localeCompare(right?.trim() || "", "ru-RU", {
    sensitivity: "base",
  });
}

function sortImportedReviews(items: SerializedReview[], sort: ImportedReviewSort) {
  return [...items].sort((left, right) => {
    const createdTieBreaker =
      getReviewTimestamp(right.createdAt) - getReviewTimestamp(left.createdAt);

    if (sort === "created_asc") {
      return getReviewTimestamp(left.createdAt) - getReviewTimestamp(right.createdAt);
    }

    if (sort === "reviewed_desc") {
      return getReviewSortDate(right) - getReviewSortDate(left) || createdTieBreaker;
    }

    if (sort === "reviewed_asc") {
      return getReviewSortDate(left) - getReviewSortDate(right) || createdTieBreaker;
    }

    if (sort === "rating_desc") {
      return right.rating - left.rating || createdTieBreaker;
    }

    if (sort === "rating_asc") {
      return left.rating - right.rating || createdTieBreaker;
    }

    if (sort === "author_asc") {
      return compareReviewText(left.userName, right.userName) || createdTieBreaker;
    }

    return createdTieBreaker;
  });
}

function getReviewSearchText(review: SerializedReview): string {
  return [
    review.userName,
    review.importedAuthorName,
    review.externalSourceName,
    review.guestCity,
    review.text,
    review.reviewedAt ? formatDate(review.reviewedAt) : "",
    review.createdAt ? formatDateTime(review.createdAt) : "",
    review.rating >= 0.5 ? review.rating.toFixed(1) : "",
    statusMeta(review.status).label,
    getReviewCategoryLabel(review.reviewCategory),
    review.reviewHighlight,
    ...review.reviewCategoryMatches.flatMap((match) => [
      getReviewCategoryLabel(match.category),
      ...match.highlights,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru-RU");
}

function getClientPage<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    currentPage,
    totalPages,
  };
}

function ReviewPageControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        Назад
      </Button>
      <span className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-olive/62">
        {currentPage} / {totalPages}
      </span>
      <Button
        type="button"
        variant="ghost"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Вперёд
      </Button>
    </div>
  );
}

export function ImportedReviewsManager({
  entityType,
  entityId,
  initialReviews,
  mode = "owner",
  schemaAvailable = true,
  canCreate = true,
  createDisabledReason = null,
  title = "Отзывы с других сайтов",
  description = "Создайте отзыв вручную: укажите автора, оценку, текст и источник. Добавленные отзывы проходят модерацию перед публикацией.",
}: ImportedReviewsManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialReviews);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    mode === "admin" ? "json" : "manual",
  );
  const [manualDraft, setManualDraft] = useState<ManualDraft>(() => createEmptyManualDraft());
  const [jsonDrafts, setJsonDrafts] = useState<JsonReviewDraft[]>([]);
  const [jsonImportStatus, setJsonImportStatus] = useState<"ACTIVE" | "DELETED">("ACTIVE");
  const [jsonImportSummary, setJsonImportSummary] = useState("");
  const [jsonImportWarnings, setJsonImportWarnings] = useState<string[]>([]);
  const [isJsonImporting, setIsJsonImporting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [processingReviewId, setProcessingReviewId] = useState<string | null>(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(() => new Set());
  const [jsonDraftPage, setJsonDraftPage] = useState(1);
  const [queuePage, setQueuePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [reviewSearchQuery, setReviewSearchQuery] = useState("");
  const [reviewSort, setReviewSort] = useState<ImportedReviewSort>("created_desc");
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
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceSuggestionsId = useId();

  const endpoint =
    mode === "admin" ? "/api/admin/external-reviews" : "/api/dashboard/external-reviews";
  const endpointUrl = `${endpoint}?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`;
  const importEndpointUrl = `${endpoint}/import?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`;
  const reviewEndpoint = mode === "admin" ? "/api/admin/reviews" : "/api/dashboard/reviews";
  const canModerateReviews = mode === "admin";
  const createDisabled = !schemaAvailable || !canCreate;
  const entityCopy = getEntityCopy(entityType);
  const normalizedReviewSearchQuery = reviewSearchQuery.trim().toLocaleLowerCase("ru-RU");

  const queuedItemsTotal = useMemo(
    () => items.filter((review) => review.status === "PENDING").length,
    [items],
  );
  const historyItemsTotal = items.length - queuedItemsTotal;
  const visibleItems = useMemo(() => {
    const filteredItems = normalizedReviewSearchQuery
      ? items.filter((review) => getReviewSearchText(review).includes(normalizedReviewSearchQuery))
      : items;

    return sortImportedReviews(filteredItems, reviewSort);
  }, [items, normalizedReviewSearchQuery, reviewSort]);
  const queuedItems = useMemo(
    () => visibleItems.filter((review) => review.status === "PENDING"),
    [visibleItems],
  );
  const historyItems = useMemo(
    () => visibleItems.filter((review) => review.status !== "PENDING"),
    [visibleItems],
  );
  const jsonDraftPagination = getClientPage(jsonDrafts, jsonDraftPage, importedManagerPageSize);
  const queuePagination = getClientPage(queuedItems, queuePage, importedManagerPageSize);
  const historyPagination = getClientPage(historyItems, historyPage, importedManagerPageSize);

  function updateReviewSearchQuery(value: string) {
    setReviewSearchQuery(value);
    setQueuePage(1);
    setHistoryPage(1);
  }

  function updateReviewSort(value: ImportedReviewSort) {
    setReviewSort(value);
    setQueuePage(1);
    setHistoryPage(1);
  }

  function applyReviewItem(review: SerializedReview) {
    setItems((previous) => mergeById(previous, review));
    setRatingById((previous) => ({
      ...previous,
      [review.id]: review.rating >= 0.5 ? String(review.rating) : (previous[review.id] ?? ""),
    }));
  }

  async function handleJsonFile(file: File | null) {
    if (!file) {
      return;
    }

    setError("");
    setSuccess("");
    setJsonImportSummary("");
    setJsonImportWarnings([]);

    try {
      const parsedImport = parseExternalReviewImportPayload({ jsonText: await file.text() });
      const warnings = [
        ...(parsedImport.warnings ?? []),
        ...parsedImport.skipped.map((item) => `#${item.index + 1}: ${item.reason}`),
      ];

      setJsonDrafts(parsedImport.items.map((item, index) => createJsonReviewDraft(item, index)));
      setJsonDraftPage(1);
      setJsonImportWarnings(warnings);

      if (parsedImport.items.length === 0) {
        setError("В JSON не найдено отзывов для импорта.");
        return;
      }

      setJsonImportSummary(
        `Подготовлено к добавлению: ${parsedImport.items.length}. Пропущено: ${parsedImport.skipped.length}.`,
      );
      setSuccess("Отзывы из JSON загружены в черновик. Проверьте их перед добавлением.");
    } catch {
      setJsonDrafts([]);
      setError("Не удалось разобрать JSON-файл.");
    } finally {
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = "";
      }
    }
  }

  async function submitJsonImport() {
    setError("");
    setSuccess("");
    setJsonImportSummary("");
    setJsonImportWarnings([]);

    if (createDisabled) {
      setError(
        createDisabledReason ??
          "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.",
      );
      return;
    }

    if (jsonDrafts.length === 0) {
      setError("Выберите JSON-файл с отзывами.");
      return;
    }

    const invalidDraftIndex = jsonDrafts.findIndex((draft) => {
      const ratingValue = Number(draft.rating || 0);
      return (
        !Number.isFinite(ratingValue) ||
        ratingValue < 0.5 ||
        ratingValue > 5 ||
        draft.text.trim().length < 10
      );
    });

    if (invalidDraftIndex >= 0) {
      setError(
        `Проверьте отзыв #${invalidDraftIndex + 1}: нужен рейтинг от 0.5 до 5 и текст от 10 символов.`,
      );
      return;
    }

    setIsJsonImporting(true);

    try {
      const response = await fetch(importEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            reviews: jsonDrafts.map((draft) => ({
              authorName: draft.authorName.trim() || "Гость",
              guestCity: draft.guestCity.trim(),
              rating: Number(draft.rating || 0),
              reviewedAt: draft.reviewedAt.trim(),
              sourceName: draft.sourceName.trim(),
              sourceUrl: draft.sourceUrl.trim(),
              text: draft.text.trim(),
              reviewCategory: draft.reviewCategory,
              reviewHighlight: draft.reviewHighlight.trim(),
              reviewCategoryMatches: draft.reviewCategoryMatches,
            })),
          },
          status: jsonImportStatus,
        }),
      });
      const body = (await response.json()) as JsonImportResponse;

      if (!response.ok) {
        setError(
          body.error ??
            "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c JSON.",
        );
        setJsonImportWarnings([
          ...(body.warnings ?? []),
          ...(body.skipped ?? []).map((item) => `#${item.index + 1}: ${item.reason}`),
          ...(body.failed ?? []).map((item) => `#${item.index + 1}: ${item.reason}`),
        ]);
        return;
      }

      for (const review of body.items ?? []) {
        applyReviewItem(review);
      }

      setJsonImportSummary(
        `\u0418\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u043e: ${body.importedCount ?? 0}. \u041f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043e: ${body.skippedCount ?? 0}. \u041e\u0448\u0438\u0431\u043e\u043a: ${body.failedCount ?? 0}.`,
      );
      setJsonImportWarnings([
        ...(body.warnings ?? []),
        ...(body.skipped ?? []).map((item) => `#${item.index + 1}: ${item.reason}`),
        ...(body.failed ?? []).map((item) => `#${item.index + 1}: ${item.reason}`),
      ]);
      setJsonDrafts([]);
      setSuccess(`Отзывы добавлены к выбранному ${entityCopy.dative}.`);
    } finally {
      setIsJsonImporting(false);
    }
  }

  function updateJsonDraft(id: string, patch: Partial<JsonReviewDraft>) {
    setJsonDrafts((previous) =>
      previous.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  }

  async function deleteAllImportedReviews() {
    if (mode !== "admin" || items.length === 0 || isBulkDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить все добавленные отзывы у этого ${entityCopy.genitive}? Действие нельзя отменить.`,
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setIsBulkDeleting(true);

    try {
      const response = await fetch(endpointUrl, { method: "DELETE" });
      const body = (await response.json()) as JsonImportResponse;

      if (!response.ok) {
        setError(body.error ?? "Не удалось удалить отзывы.");
        return;
      }

      setItems([]);
      setJsonDrafts([]);
      setEditDraftById({});
      setExpandedHistoryIds(new Set());
      setRatingById({});
      setSuccess(`Удалено отзывов: ${body.deletedCount ?? items.length}.`);
      router.refresh();
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function removeJsonDraft(id: string) {
    setJsonDrafts((previous) => previous.filter((draft) => draft.id !== id));
  }

  async function submitManualReview() {
    setError("");
    setSuccess("");

    if (createDisabled) {
      setError(
        createDisabledReason ??
          "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.",
      );
      return;
    }

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
          reviewCategory: manualDraft.reviewCategory,
          reviewHighlight: manualDraft.reviewHighlight.trim(),
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
        reviewCategory: review.reviewCategory ?? "",
        reviewHighlight: review.reviewHighlight ?? "",
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
                reviewCategory: draft.reviewCategory,
                reviewHighlight: draft.reviewHighlight.trim(),
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
          ? "Отзыв показан."
          : action === "reject"
            ? "Отзыв скрыт."
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

  function renderReviewCategoryFields(input: {
    category: string;
    highlight: string;
    onCategoryChange: (value: string) => void;
    onHighlightChange: (value: string) => void;
    disabled?: boolean;
  }) {
    return (
      <>
        <label className="grid gap-1.5 text-sm font-semibold text-olive">
          Категория отзыва
          <select
            value={input.category}
            onChange={(event) => input.onCategoryChange(event.target.value)}
            disabled={input.disabled}
            className="h-11 rounded-xl border border-olive/12 bg-white px-3 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
          >
            <option value="">Без категории</option>
            {reviewCategoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-olive">
          Слово для подсветки
          <Input
            value={input.highlight}
            onChange={(event) => input.onHighlightChange(event.target.value)}
            disabled={input.disabled}
            placeholder="например: чисто"
            maxLength={160}
          />
        </label>
      </>
    );
  }

  function renderReviewListControls(totalCount: number, visibleCount: number) {
    if (totalCount === 0) {
      return null;
    }

    return (
      <div className="mt-3 rounded-2xl border border-olive/10 bg-[#fcfbf7] p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="grid gap-1.5 text-sm font-semibold text-olive">
            Поиск по отзывам
            <div className="relative">
              <AppIcon
                icon={Search}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/38"
              />
              <Input
                value={reviewSearchQuery}
                onChange={(event) => updateReviewSearchQuery(event.target.value)}
                placeholder="Автор, город, источник или текст"
                className="pl-9 pr-10"
              />
              {reviewSearchQuery ? (
                <button
                  type="button"
                  aria-label="Очистить поиск"
                  onClick={() => updateReviewSearchQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-olive/46 transition hover:bg-olive/8 hover:text-olive"
                >
                  <AppIcon icon={X} className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-olive">
            Сортировка
            <div className="relative">
              <AppIcon
                icon={ArrowUpDown}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/38"
              />
              <select
                value={reviewSort}
                onChange={(event) => updateReviewSort(event.target.value as ImportedReviewSort)}
                className="h-11 w-full rounded-xl border border-olive/12 bg-white py-2 pl-9 pr-3 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
              >
                {importedReviewSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
        <p className="mt-2 text-xs font-medium text-olive/58">
          Показано {visibleCount} из {totalCount}
          {normalizedReviewSearchQuery ? ` · запрос: ${reviewSearchQuery.trim()}` : ""}
        </p>
      </div>
    );
  }

  function renderEditableReview(review: SerializedReview) {
    const draft = getDraft(review);
    const isEditing = review.id in editDraftById;

    if (!isEditing) {
      const categoryLabel = getReviewCategoryLabel(review.reviewCategory);
      return (
        <>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-olive/82">{review.text}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/58">
            {review.guestCity ? <span>Город: {review.guestCity}</span> : null}
            {review.reviewedAt ? <span>Дата: {formatDate(review.reviewedAt)}</span> : null}
          </div>
          {categoryLabel || review.reviewHighlight ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-olive/58">
              {categoryLabel ? <span>Категория: {categoryLabel}</span> : null}
              {review.reviewHighlight ? <span>Подсветка: {review.reviewHighlight}</span> : null}
            </div>
          ) : null}
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
        {renderReviewCategoryFields({
          category: draft.reviewCategory,
          highlight: draft.reviewHighlight,
          onCategoryChange: (value) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, reviewCategory: value },
            })),
          onHighlightChange: (value) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, reviewHighlight: value },
            })),
        })}
        <textarea
          value={draft.text}
          onChange={(event) =>
            setEditDraftById((previous) => ({
              ...previous,
              [review.id]: { ...draft, text: event.target.value },
            }))
          }
          rows={4}
          maxLength={5000}
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
          {queuedItemsTotal} на модерации
        </span>
      </div>

      {mode === "admin" && items.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void deleteAllImportedReviews()}
            disabled={isBulkDeleting}
            className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          >
            <AppIcon icon={Trash2} className="mr-1.5 h-4 w-4" />
            {isBulkDeleting ? "Удаляем..." : `Удалить все отзывы ${entityCopy.genitive}`}
          </Button>
        </div>
      ) : null}

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
          ...(mode === "admin"
            ? [
                {
                  value: "json" as const,
                  label: "\u0418\u043c\u043f\u043e\u0440\u0442 JSON",
                  icon: FileText,
                },
              ]
            : []),
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

      {activeTab === "json" && mode === "admin" ? (
        <div className="mt-5 rounded-2xl border border-olive/10 bg-[#fcfbf7] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <input
                ref={jsonFileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(event) => void handleJsonFile(event.target.files?.[0] ?? null)}
                disabled={createDisabled || isJsonImporting}
                className="sr-only"
              />
              <Button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                disabled={createDisabled || isJsonImporting}
              >
                <AppIcon icon={CloudUpload} className="mr-1.5 h-4 w-4" />
                Импорт JSON
              </Button>
            </div>
            <label className="grid gap-1.5 text-sm font-semibold text-olive">
              Статус после добавления
              <select
                value={jsonImportStatus}
                onChange={(event) =>
                  setJsonImportStatus(event.target.value === "DELETED" ? "DELETED" : "ACTIVE")
                }
                disabled={createDisabled || isJsonImporting}
                className="h-11 rounded-xl border border-olive/12 bg-white px-3 text-sm text-olive outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20"
              >
                {jsonImportStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {createDisabled && createDisabledReason ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {createDisabledReason}
            </div>
          ) : null}
          {jsonImportSummary ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {jsonImportSummary}
            </p>
          ) : null}
          {jsonImportWarnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">
                {"\u0414\u0435\u0442\u0430\u043b\u0438 \u0438\u043c\u043f\u043e\u0440\u0442\u0430"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {jsonImportWarnings.slice(0, 12).map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {jsonDrafts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-olive/16 bg-white px-5 py-6 text-sm text-olive/62">
              Выберите JSON-файл, и найденные отзывы появятся здесь для проверки.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {jsonDraftPagination.items.map((draft, index) => (
                <article
                  key={draft.id}
                  className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-olive">
                        Отзыв #
                        {(jsonDraftPagination.currentPage - 1) * importedManagerPageSize +
                          index +
                          1}
                      </p>
                      <p className="mt-1 text-xs text-olive/58">
                        {draft.sourceName || "Источник не указан"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeJsonDraft(draft.id)}
                      disabled={isJsonImporting}
                    >
                      <AppIcon icon={Trash2} className="mr-1.5 h-4 w-4" />
                      Убрать
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-semibold text-olive">
                      Автор
                      <Input
                        value={draft.authorName}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { authorName: event.target.value })
                        }
                        disabled={isJsonImporting}
                        maxLength={80}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-olive">
                      Город
                      <Input
                        value={draft.guestCity}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { guestCity: event.target.value })
                        }
                        disabled={isJsonImporting}
                        maxLength={80}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-olive">
                      Рейтинг
                      <select
                        value={draft.rating}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { rating: event.target.value })
                        }
                        disabled={isJsonImporting}
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
                      Дата отзыва
                      <Input
                        type="date"
                        value={draft.reviewedAt}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { reviewedAt: event.target.value })
                        }
                        disabled={isJsonImporting}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-olive">
                      Источник
                      <Input
                        value={draft.sourceName}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { sourceName: event.target.value })
                        }
                        disabled={isJsonImporting}
                        maxLength={80}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-olive">
                      Ссылка на источник
                      <Input
                        value={draft.sourceUrl}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { sourceUrl: event.target.value })
                        }
                        disabled={isJsonImporting}
                        maxLength={500}
                      />
                    </label>
                    {renderReviewCategoryFields({
                      category: draft.reviewCategory,
                      highlight: draft.reviewHighlight,
                      disabled: isJsonImporting,
                      onCategoryChange: (value) =>
                        updateJsonDraft(draft.id, { reviewCategory: value }),
                      onHighlightChange: (value) =>
                        updateJsonDraft(draft.id, { reviewHighlight: value }),
                    })}
                    <label className="grid gap-1.5 text-sm font-semibold text-olive md:col-span-2">
                      Текст отзыва
                      <textarea
                        value={draft.text}
                        onChange={(event) =>
                          updateJsonDraft(draft.id, { text: event.target.value })
                        }
                        rows={4}
                        maxLength={5000}
                        disabled={isJsonImporting}
                        className="rounded-xl border border-olive/12 bg-white px-3.5 py-3 text-sm leading-6 text-olive outline-none transition placeholder:text-olive/42 focus:border-terra focus:ring-2 focus:ring-terra/20"
                      />
                    </label>
                  </div>
                </article>
              ))}
              <ReviewPageControls
                currentPage={jsonDraftPagination.currentPage}
                totalPages={jsonDraftPagination.totalPages}
                onPageChange={setJsonDraftPage}
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void submitJsonImport()}
              disabled={isJsonImporting || createDisabled || jsonDrafts.length === 0}
            >
              <AppIcon icon={Check} className="mr-1.5 h-4 w-4" />
              {isJsonImporting ? "Добавляем..." : `Применить и добавить к ${entityCopy.dative}`}
            </Button>
            {jsonDrafts.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setJsonDrafts([])}
                disabled={isJsonImporting}
              >
                Очистить
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "queue" ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-olive">Отзывы на модерации</h3>
          {renderReviewListControls(queuedItemsTotal, queuedItems.length)}
          {queuedItemsTotal === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-olive/16 bg-white p-5 text-sm text-olive/62">
              Сейчас нет отзывов на модерации.
            </div>
          ) : queuedItems.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-olive/16 bg-white p-5 text-sm text-olive/62">
              По текущему поиску отзывов на модерации не найдено.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {queuePagination.items.map((review) => {
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
                            Показать
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void moderateReview(review, "reject")}
                            disabled={processing}
                          >
                            <AppIcon icon={X} className="mr-1.5 h-4 w-4" />
                            Скрыть
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
              <ReviewPageControls
                currentPage={queuePagination.currentPage}
                totalPages={queuePagination.totalPages}
                onPageChange={setQueuePage}
              />
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
            {renderReviewCategoryFields({
              category: manualDraft.reviewCategory,
              highlight: manualDraft.reviewHighlight,
              onCategoryChange: (value) =>
                setManualDraft((previous) => ({ ...previous, reviewCategory: value })),
              onHighlightChange: (value) =>
                setManualDraft((previous) => ({ ...previous, reviewHighlight: value })),
            })}
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
              disabled={isManualSubmitting || createDisabled}
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
          {renderReviewListControls(historyItemsTotal, historyItems.length)}
          {historyItemsTotal === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-olive/16 bg-white p-5 text-sm text-olive/62">
              Добавленные отзывы появятся здесь.
            </div>
          ) : historyItems.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-olive/16 bg-white p-5 text-sm text-olive/62">
              По текущему поиску добавленных отзывов не найдено.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {historyPagination.items.map((review) => {
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
                                {value
                                  ? `${Number(value).toFixed(1)} / 5`
                                  : "\u0420\u0435\u0439\u0442\u0438\u043d\u0433 \u0441\u0430\u0439\u0442\u0430"}
                              </option>
                            ))}
                          </select>
                        </label>
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
                      {canModerateReviews && review.status !== "ACTIVE" ? (
                        <Button
                          type="button"
                          onClick={() => void moderateReview(review, "approve")}
                          disabled={processing || Number(ratingById[review.id] || 0) < 0.5}
                        >
                          <AppIcon icon={Check} className="mr-1.5 h-4 w-4" />
                          {"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"}
                        </Button>
                      ) : null}
                      {canModerateReviews && review.status === "ACTIVE" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void moderateReview(review, "reject")}
                          disabled={processing}
                        >
                          <AppIcon icon={X} className="mr-1.5 h-4 w-4" />
                          Скрыть
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
              <ReviewPageControls
                currentPage={historyPagination.currentPage}
                totalPages={historyPagination.totalPages}
                onPageChange={setHistoryPage}
              />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
