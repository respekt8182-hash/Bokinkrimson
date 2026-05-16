import type { SerializedReview } from "@/lib/reviews";
import {
  buildSingleReviewCategoryMatches,
  normalizeReviewCategory,
  normalizeReviewHighlight,
  normalizeReviewCategoryMatches,
  type ReviewCategoryMatch,
  type ReviewCategoryId,
} from "@/lib/review-categories";

export type ParsedExternalReviewImportItem = {
  authorName: string;
  guestCity: string | null;
  rating: number;
  reviewedAt: string | null;
  reviewCategory: ReviewCategoryId | null;
  reviewHighlight: string | null;
  reviewCategoryMatches: ReviewCategoryMatch[];
  sourceName: string;
  sourceUrl: string | null;
  text: string;
  warnings: string[];
};

export type ExternalReviewImportParseResult = {
  items: ParsedExternalReviewImportItem[];
  skipped: Array<{ index: number; reason: string }>;
  warnings: string[];
};

type ReviewBlock = {
  sourceName: string | null;
  sourceUrl: string | null;
  reviews: unknown[];
};

const MAX_IMPORT_REVIEWS = 500;
const MAX_IMPORTED_REVIEW_TEXT_LENGTH = 5000;

const TEXT = {
  duplicateInJson:
    "\u0414\u0443\u0431\u043b\u0438\u043a\u0430\u0442 \u0432\u043d\u0443\u0442\u0440\u0438 JSON",
  externalSite: "\u0412\u043d\u0435\u0448\u043d\u0438\u0439 \u0441\u0430\u0439\u0442",
  guest: "\u0413\u043e\u0441\u0442\u044c",
  invalidReviewObject:
    "\u041e\u0442\u0437\u044b\u0432 \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u043c JSON",
  noRating:
    "\u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u0440\u0435\u0439\u0442\u0438\u043d\u0433 \u043e\u0442 0.5 \u0434\u043e 5",
  parseFailed:
    "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u0442\u044c \u043e\u0442\u0437\u044b\u0432",
  textTooShort:
    "\u0422\u0435\u043a\u0441\u0442 \u043e\u0442\u0437\u044b\u0432\u0430 \u043a\u043e\u0440\u043e\u0447\u0435 10 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432",
};

const SOURCE_NAMES = {
  avito: "\u0410\u0432\u0438\u0442\u043e",
  kudanamore: "\u041a\u0443\u0434\u0430 \u043d\u0430 \u043c\u043e\u0440\u0435",
  ostrovok: "\u041e\u0441\u0442\u0440\u043e\u0432\u043e\u043a",
  sutochno: "\u0421\u0443\u0442\u043e\u0447\u043d\u043e.\u0440\u0443",
  tvil: "\u0422\u0412\u0418\u041b",
  yandexTravel:
    "\u042f\u043d\u0434\u0435\u043a\u0441 \u041f\u0443\u0442\u0435\u0448\u0435\u0441\u0442\u0432\u0438\u044f",
};

const cp1251ExtraBytesByCodePoint = new Map<number, number>([
  [0x0402, 0x80],
  [0x0403, 0x81],
  [0x201a, 0x82],
  [0x0453, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x20ac, 0x88],
  [0x2030, 0x89],
  [0x0409, 0x8a],
  [0x2039, 0x8b],
  [0x040a, 0x8c],
  [0x040c, 0x8d],
  [0x040b, 0x8e],
  [0x040f, 0x8f],
  [0x0452, 0x90],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x2122, 0x99],
  [0x0459, 0x9a],
  [0x203a, 0x9b],
  [0x045a, 0x9c],
  [0x045c, 0x9d],
  [0x045b, 0x9e],
  [0x045f, 0x9f],
  [0x00a0, 0xa0],
  [0x040e, 0xa1],
  [0x045e, 0xa2],
  [0x0408, 0xa3],
  [0x00a4, 0xa4],
  [0x0490, 0xa5],
  [0x00a6, 0xa6],
  [0x00a7, 0xa7],
  [0x0401, 0xa8],
  [0x00a9, 0xa9],
  [0x0404, 0xaa],
  [0x00ab, 0xab],
  [0x00ac, 0xac],
  [0x00ad, 0xad],
  [0x00ae, 0xae],
  [0x0407, 0xaf],
  [0x00b0, 0xb0],
  [0x00b1, 0xb1],
  [0x0406, 0xb2],
  [0x0456, 0xb3],
  [0x0491, 0xb4],
  [0x00b5, 0xb5],
  [0x00b6, 0xb6],
  [0x00b7, 0xb7],
  [0x0451, 0xb8],
  [0x2116, 0xb9],
  [0x0454, 0xba],
  [0x00bb, 0xbb],
  [0x0458, 0xbc],
  [0x0405, 0xbd],
  [0x0455, 0xbe],
  [0x0457, 0xbf],
]);

const monthByName = new Map<string, string>([
  ["\u044f\u043d\u0432\u0430\u0440\u044c", "01"],
  ["\u044f\u043d\u0432\u0430\u0440\u044f", "01"],
  ["\u044f\u043d\u0432", "01"],
  ["\u0444\u0435\u0432\u0440\u0430\u043b\u044c", "02"],
  ["\u0444\u0435\u0432\u0440\u0430\u043b\u044f", "02"],
  ["\u0444\u0435\u0432", "02"],
  ["\u043c\u0430\u0440\u0442", "03"],
  ["\u043c\u0430\u0440\u0442\u0430", "03"],
  ["\u043c\u0430\u0440", "03"],
  ["\u0430\u043f\u0440\u0435\u043b\u044c", "04"],
  ["\u0430\u043f\u0440\u0435\u043b\u044f", "04"],
  ["\u0430\u043f\u0440", "04"],
  ["\u043c\u0430\u0439", "05"],
  ["\u043c\u0430\u044f", "05"],
  ["\u0438\u044e\u043d\u044c", "06"],
  ["\u0438\u044e\u043d\u044f", "06"],
  ["\u0438\u044e\u043d", "06"],
  ["\u0438\u044e\u043b\u044c", "07"],
  ["\u0438\u044e\u043b\u044f", "07"],
  ["\u0438\u044e\u043b", "07"],
  ["\u0430\u0432\u0433\u0443\u0441\u0442", "08"],
  ["\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "08"],
  ["\u0430\u0432\u0433", "08"],
  ["\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044c", "09"],
  ["\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f", "09"],
  ["\u0441\u0435\u043d", "09"],
  ["\u0441\u0435\u043d\u0442", "09"],
  ["\u043e\u043a\u0442\u044f\u0431\u0440\u044c", "10"],
  ["\u043e\u043a\u0442\u044f\u0431\u0440\u044f", "10"],
  ["\u043e\u043a\u0442", "10"],
  ["\u043d\u043e\u044f\u0431\u0440\u044c", "11"],
  ["\u043d\u043e\u044f\u0431\u0440\u044f", "11"],
  ["\u043d\u043e\u044f", "11"],
  ["\u0434\u0435\u043a\u0430\u0431\u0440\u044c", "12"],
  ["\u0434\u0435\u043a\u0430\u0431\u0440\u044f", "12"],
  ["\u0434\u0435\u043a", "12"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function mojibakeScore(value: string): number {
  const markerMatches =
    value.match(
      /[\u00d0\u00d1]|[\u0420\u0421][\u0400-\u045f]|\u0432[\u0402\u20ac\u045b\u0403\u201a\u201e\u2026]/g,
    )?.length ?? 0;
  const replacementMatches = value.match(/\uFFFD/g)?.length ?? 0;
  return markerMatches + replacementMatches * 4;
}

function encodeWindows1251(value: string): Uint8Array | null {
  const bytes: number[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) return null;

    if (codePoint <= 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)) {
      bytes.push(codePoint);
    } else if (codePoint >= 0x0410 && codePoint <= 0x044f) {
      bytes.push(codePoint - 0x0410 + 0xc0);
    } else {
      const extraByte = cp1251ExtraBytesByCodePoint.get(codePoint);
      if (extraByte === undefined) return null;
      bytes.push(extraByte);
    }
  }

  return new Uint8Array(bytes);
}

export function repairMojibake(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized || mojibakeScore(normalized) === 0) {
    return normalized;
  }

  const bytes = encodeWindows1251(normalized);
  if (!bytes) {
    return normalized;
  }

  const repaired = normalizeWhitespace(new TextDecoder("utf-8").decode(bytes));
  return mojibakeScore(repaired) < mojibakeScore(normalized) ? repaired : normalized;
}

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const repaired = repairMojibake(value);
      if (repaired) return repaired;
    }
  }

  return null;
}

function readNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(",", "."));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readStringArray(source: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = [];

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      values.push(repairMojibake(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          values.push(repairMojibake(item));
        }
      }
    }
  }

  return values.filter(Boolean);
}

function normalizeSourceUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getHostname(sourceUrl: string | null): string | null {
  if (!sourceUrl) {
    return null;
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeExternalReviewSourceName(
  sourceName: string | null,
  sourceUrl: string | null,
): string {
  const repairedName = sourceName ? repairMojibake(sourceName) : "";
  const comparable = repairedName.toLowerCase();
  const hostname = getHostname(sourceUrl);

  if (
    comparable.includes("\u043a\u0443\u0434\u0430") &&
    comparable.includes("\u043c\u043e\u0440\u0435")
  ) {
    return SOURCE_NAMES.kudanamore;
  }
  if (hostname?.includes("kudanamore.ru")) {
    return SOURCE_NAMES.kudanamore;
  }
  if (
    comparable.includes("\u044f\u043d\u0434\u0435\u043a\u0441") ||
    comparable.includes("yandex")
  ) {
    return SOURCE_NAMES.yandexTravel;
  }
  if (hostname?.includes("travel.yandex") || hostname?.includes("yandex.ru")) {
    return SOURCE_NAMES.yandexTravel;
  }
  if (comparable.includes("tvil") || comparable.includes("\u0442\u0432\u0438\u043b")) {
    return SOURCE_NAMES.tvil;
  }
  if (hostname?.includes("tvil.ru")) {
    return SOURCE_NAMES.tvil;
  }
  if (comparable.includes("avito") || comparable.includes("\u0430\u0432\u0438\u0442\u043e")) {
    return SOURCE_NAMES.avito;
  }
  if (hostname?.includes("avito.ru")) {
    return SOURCE_NAMES.avito;
  }
  if (
    comparable.includes("sutochno") ||
    comparable.includes("\u0441\u0443\u0442\u043e\u0447\u043d\u043e")
  ) {
    return SOURCE_NAMES.sutochno;
  }
  if (hostname?.includes("sutochno.ru")) {
    return SOURCE_NAMES.sutochno;
  }
  if (
    comparable.includes("ostrovok") ||
    comparable.includes("\u043e\u0441\u0442\u0440\u043e\u0432\u043e\u043a")
  ) {
    return SOURCE_NAMES.ostrovok;
  }
  if (hostname?.includes("ostrovok.ru")) {
    return SOURCE_NAMES.ostrovok;
  }

  return repairedName || hostname || TEXT.externalSite;
}

function parseReviewDate(value: string | null, year: number | null): string | null {
  const dateValue = value ? repairMojibake(value).toLowerCase() : "";

  const isoMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(dateValue);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const monthYearMatch = /([\u0430-\u044f\u0451]+)\s+(\d{4})/i.exec(dateValue);
  if (monthYearMatch) {
    const month = monthByName.get(monthYearMatch[1]);
    if (month) {
      return `${monthYearMatch[2]}-${month}-01`;
    }
  }

  const yearMatch = /(?:^|\D)(20\d{2}|19\d{2})(?:\D|$)/.exec(dateValue);
  const parsedYear = yearMatch ? Number.parseInt(yearMatch[1], 10) : year;
  if (parsedYear && parsedYear >= 1900 && parsedYear <= 2100) {
    return `${parsedYear}-01-01`;
  }

  return null;
}

function normalizeRating(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const fivePointRating = value > 5 && value <= 10 ? value / 2 : value;
  if (fivePointRating < 0.5 || fivePointRating > 5) {
    return null;
  }

  return Math.round(fivePointRating * 2) / 2;
}

function readCategoryHighlights(category: Record<string, unknown>): string[] {
  const directHighlights = readStringArray(category, [
    "highlight",
    "highlights",
    "highlightText",
    "matchedText",
  ]);
  const highlights: string[] = [];
  const seen = new Set<string>();

  const pushHighlight = (value: string | null) => {
    const normalized = normalizeReviewHighlight(value);
    if (!normalized) {
      return;
    }

    const key = normalized.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    highlights.push(normalized);
  };

  for (const highlight of directHighlights) {
    pushHighlight(highlight);
  }

  const fragments = category.matched_fragments;
  if (Array.isArray(fragments)) {
    for (const fragment of fragments) {
      if (!isRecord(fragment)) {
        continue;
      }

      const keywords = readStringArray(fragment, [
        "matched_keywords",
        "matchedKeywords",
        "keywords",
      ]);
      if (keywords.length > 0) {
        for (const keyword of keywords) {
          pushHighlight(keyword);
        }
        continue;
      }

      const text = readString(fragment, ["text", "fragment"]);
      if (text) {
        pushHighlight(text);
      }
    }
  }

  return highlights;
}

function readReviewCategory(item: Record<string, unknown>): {
  reviewCategory: ReviewCategoryId | null;
  reviewHighlight: string | null;
  reviewCategoryMatches: ReviewCategoryMatch[];
} {
  const directMatches = normalizeReviewCategoryMatches(
    Array.isArray(item.reviewCategoryMatches)
      ? item.reviewCategoryMatches
      : Array.isArray(item.review_category_matches)
        ? item.review_category_matches
        : [],
  ).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const directCategory = normalizeReviewCategory(
    readString(item, ["reviewCategory", "review_category", "category", "type"]),
  );
  const directHighlight = normalizeReviewHighlight(
    readString(item, ["reviewHighlight", "review_highlight", "highlight"]),
  );
  if (directMatches.length > 0) {
    return {
      reviewCategory: directMatches[0]?.category ?? directCategory ?? null,
      reviewHighlight: directHighlight ?? directMatches[0]?.highlights[0] ?? null,
      reviewCategoryMatches: directMatches,
    };
  }

  if (directCategory) {
    const reviewCategoryMatches = buildSingleReviewCategoryMatches({
      reviewCategory: directCategory,
      reviewHighlight: directHighlight,
    });
    return {
      reviewCategory: directCategory,
      reviewHighlight: directHighlight,
      reviewCategoryMatches,
    };
  }

  const categories = item.review_categories;
  if (!Array.isArray(categories)) {
    return {
      reviewCategory: null,
      reviewHighlight: directHighlight,
      reviewCategoryMatches: [],
    };
  }

  const parsedCategories: ReviewCategoryMatch[] = categories
    .filter(isRecord)
    .map((category) => {
      const categoryId = normalizeReviewCategory(
        readString(category, ["category", "label", "badge"]),
      );
      if (!categoryId) {
        return null;
      }

      return {
        category: categoryId,
        label: readString(category, ["label"]),
        badge: readString(category, ["badge"]),
        sentiment: readString(category, ["sentiment"]),
        score: readNumber(category, ["score"]),
        highlights: readCategoryHighlights(category),
      };
    })
    .filter((category): category is ReviewCategoryMatch => category !== null)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

  const best = parsedCategories[0];
  return {
    reviewCategory: best?.category ?? null,
    reviewHighlight: best?.highlights[0] ?? directHighlight,
    reviewCategoryMatches: parsedCategories,
  };
}

function extractReviewBlocks(root: unknown): ReviewBlock[] {
  if (Array.isArray(root)) {
    if (root.every((item) => isRecord(item) && Array.isArray(item.reviews))) {
      return root.flatMap((item) => extractReviewBlocks(item));
    }

    return [{ sourceName: null, sourceUrl: null, reviews: root }];
  }

  if (!isRecord(root)) {
    return [];
  }

  if (Array.isArray(root.results)) {
    return root.results.flatMap((result) => extractReviewBlocks(result));
  }

  if (Array.isArray(root.reviews)) {
    const sourceUrl = normalizeSourceUrl(readString(root, ["url", "source_url", "sourceUrl"]));
    return [
      {
        sourceName: readString(root, ["source", "sourceName", "site", "platform"]),
        sourceUrl,
        reviews: root.reviews,
      },
    ];
  }

  return [];
}

function buildImportedReviewFingerprint(input: {
  authorName: string | null;
  reviewedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  text: string;
}): string {
  return [
    repairMojibake(input.authorName ?? "").toLowerCase(),
    input.reviewedAt ?? "",
    normalizeExternalReviewSourceName(input.sourceName, input.sourceUrl).toLowerCase(),
    input.sourceUrl ?? "",
    repairMojibake(input.text).toLowerCase().replace(/\s+/g, " ").slice(0, 500),
  ].join("|");
}

function parseReviewItem(
  item: unknown,
  index: number,
  block: ReviewBlock,
): { item: ParsedExternalReviewImportItem | null; skippedReason: string | null } {
  if (!isRecord(item)) {
    return { item: null, skippedReason: TEXT.invalidReviewObject };
  }

  const warnings: string[] = [];
  const authorName =
    readString(item, ["author", "authorName", "name", "user", "reviewer"]) ?? TEXT.guest;
  const text = readString(item, ["text", "review", "body", "comment", "content"]) ?? "";
  if (text.length < 10) {
    return { item: null, skippedReason: TEXT.textTooShort };
  }

  const rating = normalizeRating(readNumber(item, ["rating", "score", "stars"]));
  if (rating === null) {
    return { item: null, skippedReason: TEXT.noRating };
  }

  const rawSourceUrl =
    readString(item, ["review_id", "reviewId", "source_url", "sourceUrl", "url", "link"]) ??
    block.sourceUrl;
  const sourceUrl = normalizeSourceUrl(rawSourceUrl);
  const sourceName = normalizeExternalReviewSourceName(
    readString(item, ["source", "sourceName", "site", "platform"]) ?? block.sourceName,
    sourceUrl ?? block.sourceUrl,
  );
  const yearNumber = readNumber(item, ["year"]);
  const reviewedAt = parseReviewDate(
    readString(item, ["date", "reviewedAt", "createdAt"]),
    yearNumber,
  );
  const truncatedText =
    text.length > MAX_IMPORTED_REVIEW_TEXT_LENGTH
      ? text.slice(0, MAX_IMPORTED_REVIEW_TEXT_LENGTH).trim()
      : text;
  const categoryMeta = readReviewCategory(item);

  if (truncatedText.length !== text.length) {
    warnings.push(
      `\u041e\u0442\u0437\u044b\u0432 #${index + 1}: \u0442\u0435\u043a\u0441\u0442 \u0441\u043e\u043a\u0440\u0430\u0449\u0451\u043d \u0434\u043e ${MAX_IMPORTED_REVIEW_TEXT_LENGTH} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.`,
    );
  }

  return {
    item: {
      authorName,
      guestCity: readString(item, ["city", "guestCity", "location"]),
      rating,
      reviewedAt,
      reviewCategory: categoryMeta.reviewCategory,
      reviewHighlight: categoryMeta.reviewHighlight,
      reviewCategoryMatches: categoryMeta.reviewCategoryMatches,
      sourceName,
      sourceUrl: sourceUrl ?? block.sourceUrl,
      text: truncatedText,
      warnings,
    },
    skippedReason: null,
  };
}

export function parseExternalReviewImportPayload(
  payload: unknown,
): ExternalReviewImportParseResult {
  const root =
    isRecord(payload) && typeof payload.jsonText === "string"
      ? JSON.parse(payload.jsonText)
      : isRecord(payload) && "payload" in payload
        ? payload.payload
        : payload;
  const blocks = extractReviewBlocks(root);
  const skipped: ExternalReviewImportParseResult["skipped"] = [];
  const warnings: string[] = [];
  const fingerprints = new Set<string>();
  const items: ParsedExternalReviewImportItem[] = [];
  let currentIndex = 0;

  for (const block of blocks) {
    for (const rawReview of block.reviews) {
      if (items.length >= MAX_IMPORT_REVIEWS) {
        warnings.push(
          `\u0418\u043c\u043f\u043e\u0440\u0442 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d \u043f\u0435\u0440\u0432\u044b\u043c\u0438 ${MAX_IMPORT_REVIEWS} \u043e\u0442\u0437\u044b\u0432\u0430\u043c\u0438.`,
        );
        break;
      }

      const parsed = parseReviewItem(rawReview, currentIndex, block);
      if (!parsed.item) {
        skipped.push({
          index: currentIndex,
          reason: parsed.skippedReason ?? TEXT.parseFailed,
        });
        currentIndex += 1;
        continue;
      }

      const fingerprint = buildImportedReviewFingerprint(parsed.item);
      if (fingerprints.has(fingerprint)) {
        skipped.push({ index: currentIndex, reason: TEXT.duplicateInJson });
        currentIndex += 1;
        continue;
      }

      fingerprints.add(fingerprint);
      items.push(parsed.item);
      warnings.push(...parsed.item.warnings);
      currentIndex += 1;
    }
  }

  return { items, skipped, warnings };
}

export function getImportedReviewFingerprint(
  review: ParsedExternalReviewImportItem | SerializedReview,
): string {
  const isParsedImport = "authorName" in review;

  return buildImportedReviewFingerprint({
    authorName: isParsedImport ? review.authorName : (review.importedAuthorName ?? review.userName),
    reviewedAt: review.reviewedAt,
    sourceName: isParsedImport ? review.sourceName : review.externalSourceName,
    sourceUrl: isParsedImport ? review.sourceUrl : review.externalSourceUrl,
    text: review.text,
  });
}
