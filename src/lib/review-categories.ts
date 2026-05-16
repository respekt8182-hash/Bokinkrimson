export const reviewCategoryOptions = [
  { id: "rooms", label: "Номера" },
  { id: "cleanliness", label: "Чистота" },
  { id: "comfort", label: "Комфорт" },
  { id: "equipment", label: "Оснащение" },
  { id: "location", label: "Расположение" },
  { id: "sea_beach", label: "Море и пляж" },
  { id: "hosts_staff", label: "Хозяева и персонал" },
  { id: "check_in", label: "Заселение" },
  { id: "territory", label: "Территория" },
  { id: "family", label: "Семейный отдых" },
  { id: "value_for_money", label: "Цена–качество" },
] as const;

export type ReviewCategoryId = (typeof reviewCategoryOptions)[number]["id"];

export type ReviewCategorySummary = {
  id: ReviewCategoryId;
  label: string;
  count: number;
};

export type ReviewCategoryMatch = {
  category: ReviewCategoryId;
  label: string | null;
  badge: string | null;
  sentiment: string | null;
  score: number | null;
  highlights: string[];
};

type ReviewCategoryCarrier = {
  reviewCategory?: string | null;
  reviewHighlight?: string | null;
  reviewCategoryMatches?: unknown;
};

const reviewCategoryIds = new Set<string>(reviewCategoryOptions.map((option) => option.id));

const reviewCategoryAliasByKey = new Map<string, ReviewCategoryId>([
  ["room", "rooms"],
  ["rooms", "rooms"],
  ["nomera", "rooms"],
  ["номер", "rooms"],
  ["номера", "rooms"],
  ["cleanliness", "cleanliness"],
  ["clean", "cleanliness"],
  ["чистота", "cleanliness"],
  ["чисто", "cleanliness"],
  ["comfort", "comfort"],
  ["комфорт", "comfort"],
  ["уют", "comfort"],
  ["уютно", "comfort"],
  ["equipment", "equipment"],
  ["amenities", "equipment"],
  ["оснащение", "equipment"],
  ["удобства", "equipment"],
  ["location", "location"],
  ["расположение", "location"],
  ["sea_beach", "sea_beach"],
  ["beach", "sea_beach"],
  ["sea", "sea_beach"],
  ["море", "sea_beach"],
  ["пляж", "sea_beach"],
  ["hosts_staff", "hosts_staff"],
  ["staff", "hosts_staff"],
  ["hosts", "hosts_staff"],
  ["персонал", "hosts_staff"],
  ["хозяева", "hosts_staff"],
  ["арендодатель", "hosts_staff"],
  ["check_in", "check_in"],
  ["checkin", "check_in"],
  ["заселение", "check_in"],
  ["территория", "territory"],
  ["territory", "territory"],
  ["family", "family"],
  ["family_rest", "family"],
  ["семейный отдых", "family"],
  ["семья", "family"],
  ["value_for_money", "value_for_money"],
  ["value", "value_for_money"],
  ["price_quality", "value_for_money"],
  ["цена-качество", "value_for_money"],
  ["цена–качество", "value_for_money"],
  ["цена качество", "value_for_money"],
]);

export function normalizeReviewCategory(value?: string | null): ReviewCategoryId | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  if (!normalized) {
    return null;
  }

  if (reviewCategoryIds.has(normalized)) {
    return normalized as ReviewCategoryId;
  }

  return reviewCategoryAliasByKey.get(normalized) ?? null;
}

export function getReviewCategoryLabel(category: string | null | undefined): string | null {
  const id = normalizeReviewCategory(category);
  return reviewCategoryOptions.find((option) => option.id === id)?.label ?? null;
}

export function normalizeReviewHighlight(value?: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.slice(0, 160) || null;
}

function normalizeReviewCategoryText(value: unknown, maxLength = 160): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.slice(0, maxLength) || null;
}

function readReviewCategoryMatchHighlights(item: Record<string, unknown>): string[] {
  const candidates: string[] = [];

  const readValues = (value: unknown) => {
    if (typeof value === "string") {
      candidates.push(value);
      return;
    }

    if (!Array.isArray(value)) {
      return;
    }

    for (const entry of value) {
      if (typeof entry === "string") {
        candidates.push(entry);
      }
    }
  };

  readValues(item.highlight);
  readValues(item.highlights);
  readValues(item.keyword);
  readValues(item.keywords);
  readValues(item.matchedKeyword);
  readValues(item.matchedKeywords);
  readValues(item.matched_keywords);

  const seen = new Set<string>();
  const highlights: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeReviewHighlight(candidate);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    highlights.push(normalized);
  }

  return highlights.slice(0, 12);
}

export function normalizeReviewCategoryMatches(value: unknown): ReviewCategoryMatch[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byCategory = new Map<ReviewCategoryId, ReviewCategoryMatch>();

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const category = normalizeReviewCategory(
      typeof record.category === "string"
        ? record.category
        : typeof record.id === "string"
          ? record.id
          : typeof record.label === "string"
            ? record.label
            : null,
    );

    if (!category) {
      continue;
    }

    const nextScore =
      typeof record.score === "number" && Number.isFinite(record.score)
        ? record.score
        : typeof record.score === "string"
          ? Number.parseFloat(record.score)
          : null;
    const nextHighlights = readReviewCategoryMatchHighlights(record);
    const existing = byCategory.get(category);

    if (!existing) {
      byCategory.set(category, {
        category,
        label: normalizeReviewCategoryText(record.label, 80),
        badge: normalizeReviewCategoryText(record.badge, 120),
        sentiment: normalizeReviewCategoryText(record.sentiment, 20),
        score: Number.isFinite(nextScore ?? Number.NaN) ? nextScore : null,
        highlights: nextHighlights,
      });
      continue;
    }

    const mergedHighlights = [...existing.highlights];
    const seenHighlights = new Set(mergedHighlights.map((highlight) => highlight.toLocaleLowerCase("ru-RU")));
    for (const highlight of nextHighlights) {
      const key = highlight.toLocaleLowerCase("ru-RU");
      if (seenHighlights.has(key)) {
        continue;
      }

      seenHighlights.add(key);
      mergedHighlights.push(highlight);
    }

    byCategory.set(category, {
      category,
      label: existing.label ?? normalizeReviewCategoryText(record.label, 80),
      badge: existing.badge ?? normalizeReviewCategoryText(record.badge, 120),
      sentiment: existing.sentiment ?? normalizeReviewCategoryText(record.sentiment, 20),
      score:
        existing.score !== null && existing.score !== undefined
          ? existing.score
          : Number.isFinite(nextScore ?? Number.NaN)
            ? nextScore
            : null,
      highlights: mergedHighlights.slice(0, 12),
    });
  }

  return [...byCategory.values()];
}

export function buildSingleReviewCategoryMatches(input: {
  reviewCategory?: string | null;
  reviewHighlight?: string | null;
}): ReviewCategoryMatch[] {
  const category = normalizeReviewCategory(input.reviewCategory);
  if (!category) {
    return [];
  }

  const highlight = normalizeReviewHighlight(input.reviewHighlight);
  return [
    {
      category,
      label: getReviewCategoryLabel(category),
      badge: null,
      sentiment: null,
      score: null,
      highlights: highlight ? [highlight] : [],
    },
  ];
}

export function getReviewCategoryMatches(review: ReviewCategoryCarrier): ReviewCategoryMatch[] {
  const normalizedMatches = normalizeReviewCategoryMatches(review.reviewCategoryMatches);
  if (normalizedMatches.length > 0) {
    return normalizedMatches;
  }

  return buildSingleReviewCategoryMatches({
    reviewCategory: review.reviewCategory,
    reviewHighlight: review.reviewHighlight,
  });
}

export function hasReviewCategory(
  review: ReviewCategoryCarrier,
  category: string | null | undefined,
): boolean {
  const normalizedCategory = normalizeReviewCategory(category);
  if (!normalizedCategory) {
    return false;
  }

  return getReviewCategoryMatches(review).some((match) => match.category === normalizedCategory);
}

export function getReviewCategoryMatch(
  review: ReviewCategoryCarrier,
  category: string | null | undefined,
): ReviewCategoryMatch | null {
  const normalizedCategory = normalizeReviewCategory(category);
  if (!normalizedCategory) {
    return null;
  }

  return (
    getReviewCategoryMatches(review).find((match) => match.category === normalizedCategory) ?? null
  );
}

export function buildReviewCategorySummary(
  reviews: ReviewCategoryCarrier[],
): ReviewCategorySummary[] {
  const countByCategory = new Map<ReviewCategoryId, number>();

  for (const review of reviews) {
    const categories = new Set(
      getReviewCategoryMatches(review).map((match) => match.category),
    );

    for (const category of categories) {
      countByCategory.set(category, (countByCategory.get(category) ?? 0) + 1);
    }
  }

  return reviewCategoryOptions
    .map((option) => ({
      id: option.id,
      label: option.label,
      count: countByCategory.get(option.id) ?? 0,
    }))
    .filter((option) => option.count > 0);
}
