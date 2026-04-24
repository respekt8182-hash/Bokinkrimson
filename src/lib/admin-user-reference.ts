export function resolveAdminRelationUserId(adminId: string): string | null {
  const normalized = adminId.trim();

  if (!normalized || normalized.startsWith("admin:")) {
    return null;
  }

  return normalized;
}
