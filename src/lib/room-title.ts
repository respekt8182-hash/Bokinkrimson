// String helpers for building clean room titles and removing duplicate semantic fragments.
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toComparisonKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;:!?'"`«»()[\]{}]/g, " ")
    .replace(/[|/\\]+/g, " ")
    .replace(/\bномер(?:а|ов)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areSemanticallyDuplicateParts(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  if (left.length < 8 || right.length < 8) {
    return false;
  }

  return left.includes(right) || right.includes(left);
}

function dedupeTitleParts(parts: string[]): string[] {
  const selected: Array<{ raw: string; key: string }> = [];

  for (const rawPart of parts) {
    const raw = normalizeWhitespace(rawPart);
    if (!raw) {
      continue;
    }

    const key = toComparisonKey(raw);
    if (!key) {
      continue;
    }

    const existingIndex = selected.findIndex((item) =>
      areSemanticallyDuplicateParts(item.key, key),
    );

    if (existingIndex === -1) {
      selected.push({ raw, key });
      continue;
    }

    const current = selected[existingIndex];
    if (!current) {
      continue;
    }

    const nextIsMoreSpecific = key.length > current.key.length;
    const sameSpecificity = key.length === current.key.length;
    const nextLooksCleaner = raw.length < current.raw.length;

    if (nextIsMoreSpecific || (sameSpecificity && nextLooksCleaner)) {
      selected[existingIndex] = { raw, key };
    }
  }

  return selected.map((item) => item.raw);
}

export function joinRoomTitleParts(
  parts: Array<string | null | undefined>,
  separator = " · ",
): string {
  return dedupeTitleParts(parts.map((part) => part ?? "")).join(separator);
}

export function normalizeRoomTitle(title: string): string {
  const cleanTitle = normalizeWhitespace(title);
  if (!cleanTitle) {
    return "";
  }

  if (!cleanTitle.includes("·")) {
    return cleanTitle;
  }

  const parts = cleanTitle.split("·").map((item) => item.trim());
  const deduped = dedupeTitleParts(parts);
  return deduped.join(" · ");
}
