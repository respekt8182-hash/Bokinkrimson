// Support chat server utilities.
import type { ChatManager } from "@prisma/client";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";

// ─── Constants ──────────────────────────────────────────────────

export const MAX_UNANSWERED = 3;
export const COOLDOWN_MS = 2 * 60_000; // 2 minutes
export const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
export const MESSAGE_TTL_MS = 24 * 60 * 60_000; // 24 hours
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
export const MAX_TEMPLATES = 12;

export const DEFAULT_TEMPLATES = [
  "Здравствуйте",
  "Мне нужна помощь",
  "Хочу узнать о наличии жилья",
  "Вопрос по бронированию",
];

// ─── Lazy cleanup tracker ───────────────────────────────────────

let lastCleanup = 0;

const supportChatDataFallbackContext = {
  contextId: "support-chat-data",
  unavailableMessage: "Support chat data is unavailable. Returning disabled chat defaults.",
  fallbackEligibleMessage:
    "Support chat data is unavailable or credentials are invalid. Returning disabled chat defaults.",
} as const;

const supportChatCleanupFallbackContext = {
  contextId: "support-chat-cleanup",
  unavailableMessage: "Support chat database is unavailable. Skipping stale message cleanup.",
  fallbackEligibleMessage:
    "Support chat database is unavailable or credentials are invalid. Skipping stale message cleanup.",
} as const;

export type SupportChatWidgetShellData = {
  enabled: boolean;
  manager: Pick<ChatManager, "name" | "photoUrl"> | null;
  templates: string[];
  social: {
    telegram: string;
    max: string;
  };
};

// ─── Settings helpers ───────────────────────────────────────────

export async function getSupportChatSettings(): Promise<{ enabled: boolean }> {
  return loadDataWithDatabaseFallback(
    supportChatDataFallbackContext,
    async () => {
      const row = await db.siteSetting.findUnique({ where: { key: "supportChatEnabled" } });
      return { enabled: row?.value === "true" };
    },
    { enabled: false },
  );
}

export async function setSupportChatEnabled(enabled: boolean): Promise<void> {
  await db.siteSetting.upsert({
    where: { key: "supportChatEnabled" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "supportChatEnabled", value: enabled ? "true" : "false" },
  });
}

export async function getSocialLinks(): Promise<{ telegram: string; max: string }> {
  return loadDataWithDatabaseFallback(
    supportChatDataFallbackContext,
    async () => {
      const rows = await db.siteSetting.findMany({
        where: { key: { in: ["telegram", "max"] } },
      });
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { telegram: map.telegram ?? "", max: map.max ?? "" };
    },
    { telegram: "", max: "" },
  );
}

export async function getSupportChatWidgetShellData(): Promise<SupportChatWidgetShellData> {
  return loadDataWithDatabaseFallback(
    supportChatDataFallbackContext,
    async () => {
      const [settingsRows, manager] = await Promise.all([
        db.siteSetting.findMany({
          where: {
            key: {
              in: ["supportChatEnabled", "supportChatTemplates", "telegram", "max"],
            },
          },
        }),
        db.chatManager.findFirst({
          where: { isActive: true },
          select: {
            name: true,
            photoUrl: true,
          },
        }),
      ]);

      const settingsMap = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
      let templates = [...DEFAULT_TEMPLATES];

      if (settingsMap.supportChatTemplates) {
        try {
          const parsed = JSON.parse(settingsMap.supportChatTemplates);
          if (Array.isArray(parsed)) {
            templates = parsed.filter((item): item is string => typeof item === "string");
          }
        } catch {
          templates = [...DEFAULT_TEMPLATES];
        }
      }

      return {
        enabled: settingsMap.supportChatEnabled === "true",
        manager,
        templates,
        social: {
          telegram: settingsMap.telegram ?? "",
          max: settingsMap.max ?? "",
        },
      };
    },
    () => ({
      enabled: false,
      manager: null,
      templates: [...DEFAULT_TEMPLATES],
      social: {
        telegram: "",
        max: "",
      },
    }),
  );
}

// ─── Templates ──────────────────────────────────────────────────

export async function getSupportChatTemplates(): Promise<string[]> {
  return loadDataWithDatabaseFallback(
    supportChatDataFallbackContext,
    async () => {
      const row = await db.siteSetting.findUnique({ where: { key: "supportChatTemplates" } });
      if (!row) return [...DEFAULT_TEMPLATES];
      try {
        const parsed = JSON.parse(row.value);
        return Array.isArray(parsed) ? parsed : [...DEFAULT_TEMPLATES];
      } catch {
        return [...DEFAULT_TEMPLATES];
      }
    },
    () => [...DEFAULT_TEMPLATES],
  );
}

export async function saveSupportChatTemplates(templates: string[]): Promise<void> {
  const value = JSON.stringify(templates.slice(0, MAX_TEMPLATES));
  await db.siteSetting.upsert({
    where: { key: "supportChatTemplates" },
    update: { value },
    create: { key: "supportChatTemplates", value },
  });
}

// ─── Manager helpers ────────────────────────────────────────────

export async function getActiveManager(): Promise<ChatManager | null> {
  return loadDataWithDatabaseFallback(
    supportChatDataFallbackContext,
    () => db.chatManager.findFirst({ where: { isActive: true } }),
    null,
  );
}

export async function getAllManagers(): Promise<ChatManager[]> {
  return loadDataWithDatabaseFallback(
    supportChatDataFallbackContext,
    () =>
      db.chatManager.findMany({
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
    () => [],
  );
}

export async function setActiveManager(managerId: string): Promise<void> {
  await db.$transaction([
    db.chatManager.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    db.chatManager.update({ where: { id: managerId }, data: { isActive: true } }),
  ]);
}

export function buildManagerGreeting(name: string): string {
  return `Здравствуйте! Меня зовут ${name}, я менеджер. Чем могу помочь?`;
}

// ─── Message cleanup ────────────────────────────────────────────

export async function cleanupOldMessages(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = new Date(now - MESSAGE_TTL_MS);
  await loadDataWithDatabaseFallback(
    supportChatCleanupFallbackContext,
    async () => {
      await db.supportMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
    },
    undefined,
  );
}

// ─── Antispam ───────────────────────────────────────────────────

export type CooldownResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export function checkMessageCooldown(
  messages: { senderType: string; createdAt: Date }[],
): CooldownResult {
  // Count consecutive unanswered user messages from the end
  let consecutiveUser = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderType === "user") {
      consecutiveUser++;
    } else {
      break;
    }
  }

  if (consecutiveUser < MAX_UNANSWERED) return { allowed: true };

  // Check if the earliest of those consecutive messages is within cooldown window
  const earliestIdx = messages.length - consecutiveUser;
  const earliest = messages[earliestIdx];
  const elapsed = Date.now() - earliest.createdAt.getTime();

  if (elapsed < COOLDOWN_MS) {
    return { allowed: false, retryAfterMs: COOLDOWN_MS - elapsed };
  }

  return { allowed: true };
}
