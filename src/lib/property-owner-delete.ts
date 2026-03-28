// Domain/service module for property owner delete.
export const PROPERTY_OWNER_DELETE_RETENTION_DAYS = 7;

export function getOwnerPropertyDeletionExpiresAt(from: Date = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + PROPERTY_OWNER_DELETE_RETENTION_DAYS);
  return expiresAt;
}

export function isOwnerDeletionWindowActive(
  ownerDeletionExpiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!ownerDeletionExpiresAt) {
    return false;
  }

  return ownerDeletionExpiresAt.getTime() > now.getTime();
}
