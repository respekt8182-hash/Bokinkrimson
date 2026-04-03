// Support chat server utilities.
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

// ─── Settings helpers ───────────────────────────────────────────

export async function getSupportChatSettings(): Promise<{ enabled: boolean }> {
  const row = await db.siteSetting.findUnique({ where: { key: "supportChatEnabled" } });
  return { enabled: row?.value === "true" };
}

export async function setSupportChatEnabled(enabled: boolean): Promise<void> {
  await db.siteSetting.upsert({
    where: { key: "supportChatEnabled" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "supportChatEnabled", value: enabled ? "true" : "false" },
  });
}

export async function getSocialLinks(): Promise<{ telegram: string; max: string }> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: ["telegram", "max"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { telegram: map.telegram ?? "", max: map.max ?? "" };
}

// ─── Templates ──────────────────────────────────────────────────

export async function getSupportChatTemplates(): Promise<string[]> {
  const row = await db.siteSetting.findUnique({ where: { key: "supportChatTemplates" } });
  if (!row) return DEFAULT_TEMPLATES;
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
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

export async function getActiveManager() {
  return db.chatManager.findFirst({ where: { isActive: true } });
}

export async function getAllManagers() {
  return db.chatManager.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
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
  await db.supportMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
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
