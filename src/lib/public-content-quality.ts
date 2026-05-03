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

const mojibakePattern =
  /(?:Рџ|Рљ|Рќ|Рћ|Р§|РЁ|Р“|Р”|Р•|Р—|Р°|Р±|РІ|Рі|Рґ|Рµ|Р¶|Р·|Рё|Р№|Рє|Р»|Рј|РЅ|Рѕ|Рї|СЂ|СЃ|С‚|Сѓ|С„|С…|С†|С‡|С€|С‰|С‹|СЊ|СЋ|СЏ|вЂ|в„|в™|вќ|вњ|в€|Гђ|Г‘|Гў|Г—|â€|Â|�)/u;

const servicePlaceholderPatterns = [
  /\b(?:lorem\s+ipsum|ipsum\s+dolor|dolor\s+sit\s+amet)\b/i,
  /\b(?:test|demo)\s+(?:card|listing|content|text|description)\b/i,
  /(?:тестов(?:ая|ый|ое|ые)|демо|демонстрационн(?:ая|ый|ое|ые)|примерн(?:ая|ый|ое|ые))\s+(?:карточк\w*|объект\w*|проект\w*|описан\w*|маршрут\w*|текст\w*|контент\w*)/iu,
  /(?:для\s+оценки|для\s+демонстрации|визуальной\s+оценки|наполненного\s+каталога|заполненном\s+сайте|тестового\s+наполнения)/iu,
  /(?:здесь|тут)\s+будет\s+(?:описание|текст|информация)/iu,
  /(?:введите|добавьте|укажите)\s+(?:описание|текст|информацию)/iu,
  /(?:описание|текст)\s+(?:пока\s+)?(?:не\s+)?(?:добавлен[оа]?|заполнен[оа]?|указан[оа]?)/iu,
  /(?:asdf|qwerty|йцукен|ывапролдж|фывфыв)/iu,
];

const weakMarketingPatterns = [
  /\bнового\s+поколения\b.*\bкомфортной\s+жизни\b/iu,
  /\bнаслаждаться\s+красивыми\s+закатами\s+каждый\s+день\b/iu,
];

const stopWords = new Set([
  "для",
  "или",
  "это",
  "что",
  "как",
  "при",
  "над",
  "под",
  "без",
  "еще",
  "ещё",
  "уже",
  "все",
  "всё",
  "его",
  "она",
  "они",
  "там",
  "тут",
  "есть",
  "можно",
  "будет",
  "после",
]);

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

function getTextWords(value: string): string[] {
  return (
    value
      .toLowerCase()
      .replace(/ё/g, "е")
      .match(/[a-zа-я0-9]{3,}/giu) ?? []
  );
}

function hasServicePlaceholder(value: string): boolean {
  return servicePlaceholderPatterns.some((pattern) => pattern.test(value));
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

  const lettersAndDigits = value.match(/[a-zа-яё0-9]/giu)?.length ?? 0;
  const visible = value.replace(/\s/g, "").length;
  if (visible === 0) {
    return true;
  }

  return lettersAndDigits / visible < 0.55;
}

function isBadSentence(value: string): boolean {
  const sentence = value.trim();
  if (!sentence) {
    return true;
  }

  if (mojibakePattern.test(sentence) || hasServicePlaceholder(sentence)) {
    return true;
  }

  if (hasBrokenCharacterMix(sentence) || hasLowLexicalQuality(sentence)) {
    return true;
  }

  return sentence.length >= 90 && weakMarketingPatterns.some((pattern) => pattern.test(sentence));
}

function splitSentences(value: string): string[] {
  return (
    value
      .match(/[^.!?…\n]+(?:[.!?…]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
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
    candidate.lastIndexOf("…"),
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

  if (mojibakePattern.test(normalized) || hasServicePlaceholder(normalized)) {
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

    const key = cleaned.toLowerCase().replace(/ё/g, "е");
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

    const key = q.toLowerCase().replace(/ё/g, "е");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ q, a });
  }

  return result;
}
