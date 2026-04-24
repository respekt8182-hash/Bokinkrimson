const MS_PER_DAY = 86_400_000;

export const EMPTY_DRAFT_RETENTION_DAYS = 15;

export function getEmptyDraftCleanupCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - EMPTY_DRAFT_RETENTION_DAYS);
  return cutoff;
}

export function getEmptyDraftExpiresAt(updatedAt: Date): Date {
  const expiresAt = new Date(updatedAt);
  expiresAt.setDate(expiresAt.getDate() + EMPTY_DRAFT_RETENTION_DAYS);
  return expiresAt;
}

export function getEmptyDraftDaysUntilCleanup(
  updatedAt: Date,
  now: Date = new Date(),
): number {
  return Math.ceil((getEmptyDraftExpiresAt(updatedAt).getTime() - now.getTime()) / MS_PER_DAY);
}

export function hasNonEmptyText(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => Boolean(value?.trim()));
}
