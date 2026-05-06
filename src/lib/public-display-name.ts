type PublicPersonName = {
  firstName?: string | null;
};

function normalizeName(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

export function getPublicFirstName(value: string | null | undefined): string | null {
  const normalized = normalizeName(value);
  return normalized?.split(" ")[0] ?? null;
}

export function formatPublicPersonName(
  person: PublicPersonName | null | undefined,
  fallback: string,
): string {
  return getPublicFirstName(person?.firstName) ?? fallback;
}

export function formatPublicContactName(
  value: string | null | undefined,
  fallback: string,
): string {
  return getPublicFirstName(value) ?? fallback;
}

export function getPublicNameInitial(
  value: string | null | undefined,
  fallback = "?",
): string {
  const firstName = getPublicFirstName(value);
  const firstCharacter = firstName ? Array.from(firstName)[0] : null;
  return firstCharacter ? firstCharacter.toUpperCase() : fallback;
}

export function getPublicPersonInitial(
  person: PublicPersonName | null | undefined,
  fallback = "?",
): string {
  return getPublicNameInitial(person?.firstName, fallback);
}
