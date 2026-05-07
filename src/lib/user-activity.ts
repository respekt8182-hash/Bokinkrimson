import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  USER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
  USER_ONLINE_WINDOW_MS,
  USER_RECENT_WINDOW_MS,
  USER_WEEK_WINDOW_MS,
} from "@/lib/user-activity-constants";

export const USER_ACTIVITY_COLUMNS = ["lastLoginAt", "lastSeenAt", "lastLogoutAt"] as const;
export {
  USER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
  USER_ONLINE_WINDOW_MS,
  USER_RECENT_WINDOW_MS,
  USER_WEEK_WINDOW_MS,
} from "@/lib/user-activity-constants";

type ActivityUpdateKind = "login" | "seen" | "logout";

async function isUserActivitySchemaAvailable(): Promise<boolean> {
  return areDatabaseColumnsAvailable("User", USER_ACTIVITY_COLUMNS);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

async function runBestEffortActivityUpdate(
  userId: string,
  kind: ActivityUpdateKind,
  update: () => Promise<unknown>,
): Promise<boolean> {
  try {
    if (!(await isUserActivitySchemaAvailable())) {
      return false;
    }

    await update();
    return true;
  } catch (error) {
    logger.warn("User activity update failed", {
      userId,
      kind,
      error: getErrorMessage(error),
    });
    return false;
  }
}

export async function markUserLogin(userId: string, now = new Date()): Promise<boolean> {
  return runBestEffortActivityUpdate(userId, "login", () =>
    db.user.updateMany({
      where: {
        id: userId,
        deletedAt: null,
      },
      data: {
        lastLoginAt: now,
        lastSeenAt: now,
      },
    }),
  );
}

export async function markUserSeen(
  userId: string,
  now = new Date(),
  minUpdateIntervalMs = USER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - minUpdateIntervalMs);

  return runBestEffortActivityUpdate(userId, "seen", () =>
    db.user.updateMany({
      where: {
        id: userId,
        role: "USER",
        deletedAt: null,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }],
      },
      data: {
        lastSeenAt: now,
      },
    }),
  );
}

export async function markUserLogout(userId: string, now = new Date()): Promise<boolean> {
  return runBestEffortActivityUpdate(userId, "logout", () =>
    db.user.updateMany({
      where: {
        id: userId,
        deletedAt: null,
      },
      data: {
        lastLogoutAt: now,
        lastSeenAt: now,
      },
    }),
  );
}

export type UserActivityStatusKey = "online" | "recent" | "week" | "inactive" | "never";

export type UserActivityStatus = {
  key: UserActivityStatusKey;
  label: string;
  description: string;
  toneClassName: string;
  dotClassName: string;
};

export function getUserActivityStatus(
  lastSeenAt: Date | null | undefined,
  now = new Date(),
): UserActivityStatus {
  if (!lastSeenAt) {
    return {
      key: "never",
      label: "Не заходил",
      description: "Активность пока не фиксировалась",
      toneClassName: "bg-olive/10 text-olive/60",
      dotClassName: "bg-olive/35",
    };
  }

  const ageMs = now.getTime() - lastSeenAt.getTime();

  if (ageMs <= USER_ONLINE_WINDOW_MS) {
    return {
      key: "online",
      label: "Онлайн",
      description: "Активен прямо сейчас",
      toneClassName: "bg-emerald-100 text-emerald-700",
      dotClassName: "bg-emerald-500",
    };
  }

  if (ageMs <= USER_RECENT_WINDOW_MS) {
    return {
      key: "recent",
      label: "Сегодня",
      description: "Был на сайте за последние сутки",
      toneClassName: "bg-primary/10 text-primary",
      dotClassName: "bg-primary",
    };
  }

  if (ageMs <= USER_WEEK_WINDOW_MS) {
    return {
      key: "week",
      label: "На неделе",
      description: "Был на сайте в последние 7 дней",
      toneClassName: "bg-amber-100 text-amber-800",
      dotClassName: "bg-amber-500",
    };
  }

  return {
    key: "inactive",
    label: "Давно не был",
    description: "Не появлялся больше недели",
    toneClassName: "bg-red-50 text-red-700",
    dotClassName: "bg-red-500",
  };
}

export function formatUserActivityTime(date: Date | null | undefined, now = new Date()): string {
  if (!date) {
    return "-";
  }

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return "только что";
  }

  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)} мин назад`;
  }

  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)} ч назад`;
  }

  if (diffMs < 7 * dayMs) {
    return `${Math.floor(diffMs / dayMs)} дн назад`;
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
