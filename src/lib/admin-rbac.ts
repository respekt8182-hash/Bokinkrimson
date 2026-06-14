export const adminRoles = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT", "FINANCE"] as const;

export type AdminRoleValue = (typeof adminRoles)[number];

export const adminRoleLabels: Record<AdminRoleValue, string> = {
  SUPER_ADMIN: "Главный администратор",
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  SUPPORT: "Поддержка",
  FINANCE: "Финансы",
};

export const adminPermissions = [
  "dashboard:read",
  "content:manage",
  "content:create",
  "content:delete",
  "moderation:manage",
  "communications:manage",
  "reviews:manage",
  "messages:manage",
  "applications:manage",
  "support:manage",
  "support-settings:manage",
  "phone-verification:manage",
  "password-resets:manage",
  "users:manage",
  "users:delete",
  "finance:manage",
  "statistics:manage",
  "settings:manage",
  "admins:manage",
  "profile:manage",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const rolePermissions: Record<AdminRoleValue, readonly AdminPermission[]> = {
  SUPER_ADMIN: adminPermissions,
  ADMIN: [
    "dashboard:read",
    "content:manage",
    "content:create",
    "content:delete",
    "moderation:manage",
    "communications:manage",
    "reviews:manage",
    "messages:manage",
    "applications:manage",
    "support:manage",
    "support-settings:manage",
    "phone-verification:manage",
    "password-resets:manage",
    "users:manage",
    "users:delete",
    "finance:manage",
    "statistics:manage",
    "settings:manage",
    "admins:manage",
    "profile:manage",
  ],
  MODERATOR: [
    "dashboard:read",
    "content:manage",
    "moderation:manage",
    "reviews:manage",
    "profile:manage",
  ],
  SUPPORT: [
    "dashboard:read",
    "reviews:manage",
    "applications:manage",
    "support:manage",
    "phone-verification:manage",
    "password-resets:manage",
    "profile:manage",
  ],
  FINANCE: ["dashboard:read", "finance:manage", "profile:manage"],
};

export function normalizeAdminRole(value: unknown): AdminRoleValue {
  return typeof value === "string" && adminRoles.includes(value as AdminRoleValue)
    ? (value as AdminRoleValue)
    : "ADMIN";
}

export function getAdminRolePermissions(role: AdminRoleValue): readonly AdminPermission[] {
  return rolePermissions[role] ?? rolePermissions.ADMIN;
}

export function hasAdminPermission(
  role: AdminRoleValue | string | null | undefined,
  permission: AdminPermission,
): boolean {
  return getAdminRolePermissions(normalizeAdminRole(role)).includes(permission);
}

export function canManageAdminRole(actorRole: AdminRoleValue, targetRole: AdminRoleValue): boolean {
  if (actorRole === "SUPER_ADMIN") {
    return true;
  }

  return actorRole === "ADMIN" && targetRole !== "SUPER_ADMIN";
}

function normalizeAdminPath(pathname: string): string {
  const pathOnly = pathname.split("?")[0] ?? pathname;
  const normalized = pathOnly.replace(/\/+$/, "");
  return normalized || "/";
}

export function getAdminUiPathPermission(pathname: string): AdminPermission | null {
  const path = normalizeAdminPath(pathname);

  if (path === "/admin/login") return null;
  if (path === "/admin") return "dashboard:read";
  if (path.startsWith("/admin/profile")) return "profile:manage";
  if (path.startsWith("/admin/help")) return "dashboard:read";
  if (path.startsWith("/admin/statistics")) return "statistics:manage";
  if (path.startsWith("/admin/admins")) return "admins:manage";
  if (path.startsWith("/admin/password-resets")) return "password-resets:manage";
  if (path.startsWith("/admin/phone-verification")) return "phone-verification:manage";
  if (path.startsWith("/admin/payments") || path.startsWith("/admin/renewals")) {
    return "finance:manage";
  }
  if (path.startsWith("/admin/support-chat")) return "support:manage";
  if (path.startsWith("/admin/applications")) return "applications:manage";
  if (path.startsWith("/admin/messages")) return "messages:manage";
  if (path.startsWith("/admin/reviews")) return "reviews:manage";
  if (path.startsWith("/admin/users")) return "users:manage";
  if (path.startsWith("/admin/moderation")) return "moderation:manage";

  if (
    path.startsWith("/admin/objects/new") ||
    path.startsWith("/admin/excursions/new") ||
    path.startsWith("/admin/attractions/new")
  ) {
    return "content:create";
  }

  if (
    path.startsWith("/admin/objects") ||
    path.startsWith("/admin/excursions") ||
    path.startsWith("/admin/attractions") ||
    path.startsWith("/admin/transfers")
  ) {
    return "content:manage";
  }

  return "dashboard:read";
}

export function canAccessAdminPath(
  role: AdminRoleValue | string | null | undefined,
  pathname: string,
): boolean {
  const permission = getAdminUiPathPermission(pathname);
  return permission ? hasAdminPermission(role, permission) : true;
}

export function getAdminApiRequestPermission(
  pathname: string,
  method: string,
): AdminPermission | null {
  const path = normalizeAdminPath(pathname);
  const requestMethod = method.toUpperCase();

  if (path === "/api/admin/auth") return null;
  if (path.startsWith("/api/admin/profile")) return "profile:manage";
  if (path.startsWith("/api/admin/notifications")) return "dashboard:read";
  if (path.startsWith("/api/admin/admins")) return "admins:manage";
  if (path.startsWith("/api/admin/moderation")) return "moderation:manage";
  if (path.includes("/moderation")) return "moderation:manage";
  if (path.startsWith("/api/admin/properties") && path.includes("/registry-moderation")) {
    return "moderation:manage";
  }
  if (path.startsWith("/api/admin/phone-verification")) return "phone-verification:manage";
  if (path.startsWith("/api/admin/users/") && path.endsWith("/reset-password")) {
    return "password-resets:manage";
  }
  if (path.startsWith("/api/admin/users/")) {
    return requestMethod === "DELETE" || path.endsWith("/restore") ? "users:delete" : "users:manage";
  }
  if (path.startsWith("/api/admin/users")) return "users:manage";
  if (path.startsWith("/api/admin/payments") || path.startsWith("/api/admin/listing-payments")) {
    return "finance:manage";
  }
  if (path.startsWith("/api/admin/statistics")) return "statistics:manage";
  if (path.startsWith("/api/admin/support-chat")) {
    return requestMethod === "PATCH" || requestMethod === "DELETE"
      ? "support-settings:manage"
      : "support:manage";
  }
  if (path.startsWith("/api/admin/chat-managers")) return "support-settings:manage";
  if (path.startsWith("/api/admin/messages")) return "messages:manage";
  if (path.startsWith("/api/admin/external-reviews/import")) return "reviews:manage";
  if (path.startsWith("/api/admin/external-reviews")) {
    return requestMethod === "DELETE" ? "content:delete" : "reviews:manage";
  }
  if (path.startsWith("/api/admin/reviews")) {
    return requestMethod === "DELETE" ? "content:delete" : "reviews:manage";
  }
  if (path.startsWith("/api/admin/chessboard")) return "content:manage";
  if (path.startsWith("/api/admin/objects")) return "content:manage";
  if (path.startsWith("/api/admin/properties/")) {
    return requestMethod === "DELETE" || path.endsWith("/restore")
      ? "content:delete"
      : "content:manage";
  }
  if (path.startsWith("/api/admin/properties")) return "content:manage";
  if (path.startsWith("/api/admin/excursions/")) {
    return requestMethod === "DELETE" || path.endsWith("/restore")
      ? "content:delete"
      : "content:manage";
  }
  if (path.startsWith("/api/admin/excursions")) return "content:manage";
  if (path.startsWith("/api/admin/transfers")) return "content:manage";

  return "dashboard:read";
}
