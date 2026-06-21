const DEFAULT_TIME_ZONE = "Europe/Moscow";

function hashString(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function getDailyDateKey(
  date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function selectDailyItems<T>(
  items: readonly T[],
  options: {
    dateKey: string;
    selectionKey: string;
    limit: number;
    getId: (item: T) => string;
  },
): T[] {
  if (options.limit <= 0 || items.length === 0) {
    return [];
  }

  return [...items]
    .sort((left, right) => {
      const leftId = options.getId(left);
      const rightId = options.getId(right);
      const seed = `${options.selectionKey}:${options.dateKey}:`;
      const scoreDifference = hashString(`${seed}${leftId}`) - hashString(`${seed}${rightId}`);

      return scoreDifference || leftId.localeCompare(rightId);
    })
    .slice(0, options.limit);
}
