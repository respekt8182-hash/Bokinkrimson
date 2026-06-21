const sourceTrailPatterns = [
  /\[(?:источник|source)[^\]]*\]/giu,
  /\((?:источник|source):[^)]*\)/giu,
  /https?:\/\/\S+/giu,
];

export function normalizeAttractionText(value: string | null | undefined): string {
  if (!value) return "";

  let normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1");

  for (const pattern of sourceTrailPatterns) normalized = normalized.replace(pattern, "");

  return normalized
    .replace(/известный исторических памятников/giu, "исторический памятник")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function uniqueAttractionTexts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const text = normalizeAttractionText(value);
    if (!text) return [];
    const key = text.toLocaleLowerCase("ru-RU").replace(/\W/gu, "");
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
}

export function getSmartAttractionFaq(
  faq: Array<{ question: string; answer: string }>,
  comparedText = "",
): Array<{ question: string; answer: string }> {
  const corpus = normalizeAttractionText(comparedText).toLocaleLowerCase("ru-RU");
  return faq
    .map((item) => ({
      question: normalizeAttractionText(item.question),
      answer: normalizeAttractionText(item.answer),
    }))
    .filter((item) => item.question && item.answer)
    .filter((item, index, all) => all.findIndex((entry) => entry.question === item.question) === index)
    .filter((item) => !corpus.includes(item.answer.toLocaleLowerCase("ru-RU")));
}
