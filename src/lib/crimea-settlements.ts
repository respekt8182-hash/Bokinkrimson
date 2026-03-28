import { readFile } from "fs/promises";
import path from "path";

export type CrimeaSettlementItem = {
  id: string;
  name: string;
};

const settlementFilePath = path.join(process.cwd(), "crimea_settlements.txt");
const settlementLinePattern = /^\s*\d+\.\s*(.+?)\s*$/;
const settlementTypePattern =
  /^(?:г\.?|город|пгт\.?|с\.?|село|п\.?|пос\.?|поселок(?:\s+городского\s+типа)?|посёлок(?:\s+городского\s+типа)?|д\.?|деревня|х\.?|хутор)\s+/i;
const cyrillicToLatinMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

let cachedSettlementsPromise: Promise<CrimeaSettlementItem[]> | null = null;
let hasLoggedReadError = false;

function normalizeSettlementName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
}

function transliterateToLatin(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join("");
}

function slugifySettlementName(input: string): string {
  return transliterateToLatin(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function cleanupSettlementName(rawValue: string): string {
  return rawValue.replace(settlementTypePattern, "").trim().replace(/\s+/g, " ");
}

async function loadCrimeaSettlementDirectory(): Promise<CrimeaSettlementItem[]> {
  try {
    const raw = await readFile(settlementFilePath, "utf8");
    const seenByNormalizedName = new Map<string, CrimeaSettlementItem>();
    const usedIds = new Set<string>();

    for (const line of raw.split(/\r?\n/u)) {
      const match = line.match(settlementLinePattern);
      if (!match) {
        continue;
      }

      const cleanedName = cleanupSettlementName(match[1] ?? "");
      if (cleanedName.length < 2) {
        continue;
      }

      const normalizedName = normalizeSettlementName(cleanedName);
      if (seenByNormalizedName.has(normalizedName)) {
        continue;
      }

      const baseId = slugifySettlementName(cleanedName) || "crimea-settlement";
      let candidateId = baseId;
      let suffix = 2;

      while (usedIds.has(candidateId)) {
        candidateId = `${baseId}-${suffix}`;
        suffix += 1;
      }

      usedIds.add(candidateId);
      seenByNormalizedName.set(normalizedName, {
        id: candidateId,
        name: cleanedName,
      });
    }

    return Array.from(seenByNormalizedName.values());
  } catch (error) {
    if (!hasLoggedReadError) {
      hasLoggedReadError = true;
      console.error("Failed to read Crimea settlements directory", error);
    }

    return [];
  }
}

export async function getCrimeaSettlementDirectoryItems(): Promise<CrimeaSettlementItem[]> {
  if (!cachedSettlementsPromise) {
    cachedSettlementsPromise = loadCrimeaSettlementDirectory();
  }

  return cachedSettlementsPromise;
}

export async function findCrimeaSettlementById(
  settlementId: string | null | undefined,
): Promise<CrimeaSettlementItem | null> {
  if (!settlementId) {
    return null;
  }

  const items = await getCrimeaSettlementDirectoryItems();
  return items.find((item) => item.id === settlementId) ?? null;
}

export async function findCrimeaSettlementByName(
  settlementName: string | null | undefined,
): Promise<CrimeaSettlementItem | null> {
  if (!settlementName) {
    return null;
  }

  const normalizedName = normalizeSettlementName(settlementName);
  if (!normalizedName) {
    return null;
  }

  const items = await getCrimeaSettlementDirectoryItems();
  return (
    items.find((item) => normalizeSettlementName(item.name) === normalizedName) ?? null
  );
}
