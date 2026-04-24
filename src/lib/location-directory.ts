import { CustomLocationStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { crimeaLocationById, crimeaLocationIds, crimeaLocations } from "@/lib/constants";
import {
  findCrimeaSettlementById,
  findCrimeaSettlementByName,
  getCrimeaSettlementDirectoryItems,
} from "@/lib/crimea-settlements";
import { db, type DbTransactionClient } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

export type LocationDirectoryItem = {
  id: string;
  name: string;
};

const builtInLocationIdSet = new Set(crimeaLocationIds);
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

type ResolvePropertyLocationInput = {
  tx: DbTransactionClient;
  locationId?: string | null;
  locationName: string;
  sourcePropertyId: string;
};

export function normalizeLocationName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
}

function transliterateToLatin(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join("");
}

function slugifyLocationName(input: string): string {
  return transliterateToLatin(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getBuiltInLocationByName(name: string): { id: string; name: string } | null {
  const normalized = normalizeLocationName(name);
  const exact = crimeaLocations.find((item) => normalizeLocationName(item.name) === normalized);
  return exact ?? null;
}

export function isBuiltInLocationId(locationId: string | null | undefined): boolean {
  if (!locationId) {
    return false;
  }

  return builtInLocationIdSet.has(locationId);
}

async function readLocationDirectorySourceRows() {
  const canUseFallback = process.env.NODE_ENV !== "production";
  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "location-directory",
      "Database is unavailable. Using built-in location list.",
    );
    return [[], []] as const;
  }

  try {
    return await Promise.all([
      db.customLocation.findMany({
        where: { status: CustomLocationStatus.APPROVED },
        orderBy: [{ name: "asc" }],
        select: { slug: true, name: true },
      }),
      db.excursionLocation.findMany({
        orderBy: [{ isMajor: "desc" }, { name: "asc" }],
        select: { slug: true, name: true },
      }),
    ]);
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "location-directory",
      "Database is unavailable or credentials are invalid. Using built-in location list.",
    );
    return [[], []] as const;
  }
}

const getCachedLocationDirectoryItems = unstable_cache(
  async (): Promise<LocationDirectoryItem[]> => {
  const [approvedCustomLocations, excursionLocations] = await readLocationDirectorySourceRows();
  const officialSettlements = await getCrimeaSettlementDirectoryItems();

  const merged = [
    ...crimeaLocations.map((item) => ({ id: item.id, name: item.name })),
    ...officialSettlements,
    ...excursionLocations.map((item) => ({ id: item.slug, name: item.name })),
    ...approvedCustomLocations.map((item) => ({ id: item.slug, name: item.name })),
  ];

  const dedupedByName = new Map<string, LocationDirectoryItem>();
  for (const item of merged) {
    const normalized = normalizeLocationName(item.name);
    if (!dedupedByName.has(normalized)) {
      dedupedByName.set(normalized, item);
    }
  }

  return Array.from(dedupedByName.values());
  },
  ["location-directory-v1"],
  { revalidate: 1800 },
);

export async function getLocationDirectoryItems(): Promise<LocationDirectoryItem[]> {
  return getCachedLocationDirectoryItems();
}

export async function searchLocationDirectory(
  query: string,
  limit = 8,
): Promise<LocationDirectoryItem[]> {
  const items = await getLocationDirectoryItems();
  if (query.trim().length < 2) {
    return items.slice(0, limit);
  }

  return rankByTrigram(
    query,
    items,
    (item) => item.name,
    { limit, minScore: 0.08 },
  );
}

async function createUniqueCustomLocationSlug(
  tx: DbTransactionClient,
  locationName: string,
): Promise<string> {
  const base = slugifyLocationName(locationName) || "crimea-location";
  let candidate = base;
  let suffix = 2;

  while (true) {
    if (builtInLocationIdSet.has(candidate) || (await findCrimeaSettlementById(candidate))) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      continue;
    }

    const existing = await tx.customLocation.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// Resolves built-in location first; if missing, creates pending custom location.
export async function resolveOrCreatePropertyLocation({
  tx,
  locationId,
  locationName,
  sourcePropertyId,
}: ResolvePropertyLocationInput): Promise<{
  locationId: string;
  locationName: string;
  isPendingCustom: boolean;
}> {
  const cleanedLocationName = locationName.trim().replace(/\s+/g, " ");
  if (cleanedLocationName.length < 2) {
    throw new Error("LOCATION_NAME_REQUIRED");
  }

  if (locationId && isBuiltInLocationId(locationId)) {
    return {
      locationId,
      locationName: crimeaLocationById[locationId]?.name ?? cleanedLocationName,
      isPendingCustom: false,
    };
  }

  const officialById = await findCrimeaSettlementById(locationId);
  if (officialById) {
    return {
      locationId: officialById.id,
      locationName: officialById.name,
      isPendingCustom: false,
    };
  }

  const builtInByName = getBuiltInLocationByName(cleanedLocationName);
  if (builtInByName) {
    return {
      locationId: builtInByName.id,
      locationName: builtInByName.name,
      isPendingCustom: false,
    };
  }

  const officialByName = await findCrimeaSettlementByName(cleanedLocationName);
  if (officialByName) {
    return {
      locationId: officialByName.id,
      locationName: officialByName.name,
      isPendingCustom: false,
    };
  }

  if (locationId && !isBuiltInLocationId(locationId)) {
    const existingBySlug = await tx.customLocation.findUnique({
      where: { slug: locationId },
      select: { slug: true, name: true, status: true },
    });

    if (existingBySlug) {
      return {
        locationId: existingBySlug.slug,
        locationName: existingBySlug.name,
        isPendingCustom: existingBySlug.status !== CustomLocationStatus.APPROVED,
      };
    }
  }

  const normalizedName = normalizeLocationName(cleanedLocationName);
  const existingByName = await tx.customLocation.findUnique({
    where: { normalizedName },
    select: { slug: true, name: true, status: true },
  });

  if (existingByName) {
    return {
      locationId: existingByName.slug,
      locationName: existingByName.name,
      isPendingCustom: existingByName.status !== CustomLocationStatus.APPROVED,
    };
  }

  const slug = await createUniqueCustomLocationSlug(tx, cleanedLocationName);
  const created = await tx.customLocation.create({
    data: {
      slug,
      name: cleanedLocationName,
      normalizedName,
      status: CustomLocationStatus.PENDING,
      sourcePropertyId,
    },
    select: { slug: true, name: true },
  });

  return {
    locationId: created.slug,
    locationName: created.name,
    isPendingCustom: true,
  };
}
