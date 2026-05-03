import type { FaqItem } from "@/types/excursions";

type CleanPublicTextOptions = {
  minLength?: number;
  maxLength?: number;
  preserveLineBreaks?: boolean;
};

type CleanPublicTextListOptions = CleanPublicTextOptions & {
  maxItems?: number;
};

const DEFAULT_MIN_TEXT_LENGTH = 2;
const DEFAULT_MAX_TEXT_LENGTH = 5000;
const ELLIPSIS = "\u2026";
const CYRILLIC_YO_LOWER = "\u0451";
const CYRILLIC_E_LOWER = "\u0435";
const WINDOWS_1251_DECODER = new TextDecoder("windows-1251");
const WINDOWS_1251_CONTINUATION_CODES = new Set(
  Array.from({ length: 64 }, (_, index) =>
    WINDOWS_1251_DECODER.decode(Uint8Array.of(0x80 + index)).charCodeAt(0),
  ),
);

const latinPlaceholderPattern = /\b(?:lorem\s+ipsum|ipsum\s+dolor|dolor\s+sit\s+amet)\b/i;
const latinDemoPattern = /\b(?:test|demo)\s+(?:card|listing|content|text|description)\b/i;
const wordPattern = /[a-z\u0430-\u044f\u04510-9]{3,}/giu;
const sentencePattern = /[^.!?\u2026\n]+(?:[.!?\u2026]+|$)/g;

const placeholderSubjectStems = [
  "\u0442\u0435\u0441\u0442\u043e\u0432",
  "\u0434\u0435\u043c\u043e",
  "\u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u043e\u043d\u043d",
  "\u043f\u0440\u0438\u043c\u0435\u0440\u043d",
];

const placeholderNounStems = [
  "\u043a\u0430\u0440\u0442\u043e\u0447\u043a",
  "\u043e\u0431\u044a\u0435\u043a\u0442",
  "\u043f\u0440\u043e\u0435\u043a\u0442",
  "\u043e\u043f\u0438\u0441\u0430\u043d",
  "\u043c\u0430\u0440\u0448\u0440\u0443\u0442",
  "\u0442\u0435\u043a\u0441\u0442",
  "\u043a\u043e\u043d\u0442\u0435\u043d\u0442",
];

const placeholderContextPhrases = [
  "\u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438",
  "\u0434\u043b\u044f \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u0438",
  "\u0432\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u043e\u0439 \u043e\u0446\u0435\u043d\u043a\u0438",
  "\u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0433\u043e \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430",
  "\u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u043c \u0441\u0430\u0439\u0442\u0435",
  "\u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0433\u043e \u043d\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f",
];

const placeholderPronouns = ["\u0437\u0434\u0435\u0441\u044c", "\u0442\u0443\u0442"];
const placeholderObjects = [
  "\u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  "\u0442\u0435\u043a\u0441\u0442",
  "\u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f",
];
const placeholderPromptVerbs = [
  "\u0432\u0432\u0435\u0434\u0438\u0442\u0435",
  "\u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435",
  "\u0443\u043a\u0430\u0436\u0438\u0442\u0435",
];
const missingContentNouns = [
  "\u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
  "\u0442\u0435\u043a\u0441\u0442",
];
const missingContentStates = [
  "\u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d",
  "\u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d",
  "\u0443\u043a\u0430\u0437\u0430\u043d",
];
const keyboardMashTokens = [
  "asdf",
  "qwerty",
  "\u0439\u0446\u0443\u043a\u0435\u043d",
  "\u044b\u0432\u0430\u043f\u0440\u043e\u043b\u0434\u0436",
  "\u0444\u044b\u0432\u0444\u044b\u0432",
];

const weakMarketingPhrases = [
  "\u043d\u043e\u0432\u043e\u0433\u043e \u043f\u043e\u043a\u043e\u043b\u0435\u043d\u0438\u044f",
  "\u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u043e\u0439 \u0436\u0438\u0437\u043d\u0438",
  "\u043d\u0430\u0441\u043b\u0430\u0436\u0434\u0430\u0442\u044c\u0441\u044f \u043a\u0440\u0430\u0441\u0438\u0432\u044b\u043c\u0438 \u0437\u0430\u043a\u0430\u0442\u0430\u043c\u0438 \u043a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c",
];

const stopWords = new Set([
  "\u0434\u043b\u044f",
  "\u0438\u043b\u0438",
  "\u044d\u0442\u043e",
  "\u0447\u0442\u043e",
  "\u043a\u0430\u043a",
  "\u043f\u0440\u0438",
  "\u043d\u0430\u0434",
  "\u043f\u043e\u0434",
  "\u0431\u0435\u0437",
  "\u0435\u0449\u0435",
  "\u0443\u0436\u0435",
  "\u0432\u0441\u0435",
  "\u0435\u0433\u043e",
  "\u043e\u043d\u0430",
  "\u043e\u043d\u0438",
  "\u0442\u0430\u043c",
  "\u0442\u0443\u0442",
  "\u0435\u0441\u0442\u044c",
  "\u043c\u043e\u0436\u043d\u043e",
  "\u0431\u0443\u0434\u0435\u0442",
  "\u043f\u043e\u0441\u043b\u0435",
]);

function normalizeRussian(value: string): string {
  return value.toLowerCase().replaceAll(CYRILLIC_YO_LOWER, CYRILLIC_E_LOWER);
}

function normalizeWhitespace(value: string, preserveLineBreaks: boolean): string {
  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .replace(/\r\n?/g, "\n");

  if (!preserveLineBreaks) {
    return normalized.replace(/\s+/g, " ").trim();
  }

  return normalized
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeForChecks(value: string): string {
  return normalizeRussian(normalizeWhitespace(value, false));
}

function includesAny(value: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function hasPlaceholderStemPair(value: string): boolean {
  return (
    placeholderSubjectStems.some((stem) => value.includes(stem)) &&
    placeholderNounStems.some((stem) => value.includes(stem))
  );
}

function hasMojibake(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0xfffd) {
      return true;
    }

    const next = value.charCodeAt(index + 1);
    if (!Number.isFinite(next)) {
      continue;
    }

    if (
      (code === 0x0420 || code === 0x0421) &&
      WINDOWS_1251_CONTINUATION_CODES.has(next)
    ) {
      return true;
    }

    if (
      code === 0x0413 &&
      ((next >= 0x0080 && next <= 0x00ff) ||
        (next >= 0x0041 && next <= 0x005a) ||
        (next >= 0x0061 && next <= 0x007a))
    ) {
      return true;
    }

    if (code === 0x0432 && next === 0x0402) {
      return true;
    }
  }

  return false;
}

function getTextWords(value: string): string[] {
  return value
    .toLowerCase()
    .replaceAll(CYRILLIC_YO_LOWER, CYRILLIC_E_LOWER)
    .match(wordPattern) ?? [];
}

function hasServicePlaceholder(value: string): boolean {
  if (latinPlaceholderPattern.test(value) || latinDemoPattern.test(value)) {
    return true;
  }

  const normalized = normalizeForChecks(value);
  if (!normalized) {
    return false;
  }

  if (includesAny(normalized, keyboardMashTokens)) {
    return true;
  }

  if (hasPlaceholderStemPair(normalized)) {
    return true;
  }

  if (includesAny(normalized, placeholderContextPhrases)) {
    return true;
  }

  if (
    placeholderPronouns.some((pronoun) =>
      placeholderObjects.some(
        (object) =>
          normalized.includes(
            `${pronoun} \u0431\u0443\u0434\u0435\u0442 ${object}`,
          ),
      ),
    )
  ) {
    return true;
  }

  if (
    placeholderPromptVerbs.some((verb) =>
      placeholderObjects.some((object) => normalized.includes(`${verb} ${object}`)),
    )
  ) {
    return true;
  }

  return missingContentNouns.some((noun) =>
    missingContentStates.some(
      (state) =>
        normalized.includes(`${noun} ${state}`) ||
        normalized.includes(`${noun} \u043d\u0435 ${state}`) ||
        normalized.includes(
          `${noun} \u043f\u043e\u043a\u0430 \u043d\u0435 ${state}`,
        ),
    ),
  );
}

function hasLowLexicalQuality(value: string): boolean {
  const words = getTextWords(value);
  if (words.length < 18) {
    return false;
  }

  const meaningfulWords = words.filter((word) => !stopWords.has(word));
  if (meaningfulWords.length < 14) {
    return false;
  }

  const uniqueWords = new Set(meaningfulWords);
  const uniqueRatio = uniqueWords.size / meaningfulWords.length;
  if (meaningfulWords.length >= 28 && uniqueRatio < 0.38) {
    return true;
  }

  const counts = new Map<string, number>();
  for (const word of meaningfulWords) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return Math.max(...counts.values()) / meaningfulWords.length > 0.23;
}

function hasBrokenCharacterMix(value: string): boolean {
  if (value.length < 32) {
    return false;
  }

  const lettersAndDigits = value.match(/[a-z\u0430-\u044f\u04510-9]/giu)?.length ?? 0;
  const visible = value.replace(/\s/g, "").length;
  if (visible === 0) {
    return true;
  }

  return lettersAndDigits / visible < 0.55;
}

function hasWeakMarketingCopy(value: string): boolean {
  const normalized = normalizeForChecks(value);

  return (
    (normalized.includes(weakMarketingPhrases[0]) &&
      normalized.includes(weakMarketingPhrases[1])) ||
    normalized.includes(weakMarketingPhrases[2])
  );
}

function isBadSentence(value: string): boolean {
  const sentence = value.trim();
  if (!sentence) {
    return true;
  }

  if (hasMojibake(sentence) || hasServicePlaceholder(sentence)) {
    return true;
  }

  if (hasBrokenCharacterMix(sentence) || hasLowLexicalQuality(sentence)) {
    return true;
  }

  return sentence.length >= 90 && hasWeakMarketingCopy(sentence);
}

function splitSentences(value: string): string[] {
  return value.match(sentencePattern)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
}

function truncateToCompleteSentence(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const candidate = value.slice(0, maxLength).trim();
  const lastSentenceEnd = Math.max(
    candidate.lastIndexOf("."),
    candidate.lastIndexOf("!"),
    candidate.lastIndexOf("?"),
    candidate.lastIndexOf(ELLIPSIS),
  );

  if (lastSentenceEnd >= Math.min(80, Math.floor(maxLength * 0.45))) {
    return candidate.slice(0, lastSentenceEnd + 1).trim();
  }

  return `${candidate.replace(/[\s,;:.-]+$/u, "")}...`;
}

function cleanParagraph(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (hasMojibake(normalized) || hasServicePlaceholder(normalized)) {
    const sentences = splitSentences(normalized);
    const safeSentences: string[] = [];

    for (const sentence of sentences) {
      if (isBadSentence(sentence)) {
        break;
      }
      safeSentences.push(sentence);
    }

    return safeSentences.join(" ").trim() || null;
  }

  const sentences = splitSentences(normalized);
  if (sentences.length === 0) {
    return isBadSentence(normalized) ? null : normalized;
  }

  const safeSentences: string[] = [];
  for (const sentence of sentences) {
    if (isBadSentence(sentence)) {
      break;
    }
    safeSentences.push(sentence);
  }

  return safeSentences.join(" ").trim() || null;
}

export function cleanPublicText(
  value: string | null | undefined,
  options: CleanPublicTextOptions = {},
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const preserveLineBreaks = options.preserveLineBreaks === true;
  const minLength = options.minLength ?? DEFAULT_MIN_TEXT_LENGTH;
  const maxLength = options.maxLength ?? DEFAULT_MAX_TEXT_LENGTH;
  const normalized = normalizeWhitespace(value, preserveLineBreaks);
  if (!normalized || normalized.length < minLength) {
    return null;
  }

  const cleaned = (preserveLineBreaks ? normalized.split("\n") : [normalized])
    .map(cleanParagraph)
    .filter((item): item is string => Boolean(item))
    .join(preserveLineBreaks ? "\n" : " ")
    .trim();

  if (!cleaned || cleaned.length < minLength) {
    return null;
  }

  return truncateToCompleteSentence(cleaned, maxLength);
}

export function cleanPublicTextList(
  values: Array<string | null | undefined> | null | undefined,
  options: CleanPublicTextListOptions = {},
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanPublicText(value, {
      ...options,
      preserveLineBreaks: false,
    });
    if (!cleaned) {
      continue;
    }

    const key = normalizeRussian(cleaned);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

export function cleanFaqItems(value: FaqItem[] | null | undefined): FaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: FaqItem[] = [];

  for (const item of value) {
    const q = cleanPublicText(item?.q, { minLength: 4, maxLength: 160 });
    const a = cleanPublicText(item?.a, { minLength: 10, maxLength: 600 });
    if (!q || !a) {
      continue;
    }

    const key = normalizeRussian(q);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ q, a });
  }

  return result;
}
