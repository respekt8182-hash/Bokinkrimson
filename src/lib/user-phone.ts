export function normalizeUserPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `7${digits}`;
  }

  return digits;
}

export function buildUserPhoneLookupCandidates(value: string): string[] {
  const normalized = normalizeUserPhone(value);
  const trimmed = value.trim();
  const candidates = new Set<string>();

  if (normalized) {
    candidates.add(normalized);
    candidates.add(`+${normalized}`);

    if (normalized.length === 11 && normalized.startsWith("7")) {
      candidates.add(`8${normalized.slice(1)}`);
    }
  }

  if (trimmed) {
    candidates.add(trimmed);
  }

  return [...candidates];
}
