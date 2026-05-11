import { createHash } from "node:crypto";
import { getEditorSession } from "@/lib/editor-access";

export type ListingAnalyticsActorRole = "guest" | "owner" | "admin";

export type ListingAnalyticsActor = {
  role: ListingAnalyticsActorRole;
  userId: string | null;
};

export function normalizeAnalyticsVisitorId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) {
    return null;
  }

  return /^[a-zA-Z0-9:_-]+$/.test(trimmed) ? trimmed : null;
}

export async function resolveListingAnalyticsActor(ownerId: string | null): Promise<ListingAnalyticsActor> {
  const editor = await getEditorSession();

  if (!editor) {
    return { role: "guest", userId: null };
  }

  if (editor.isAdmin) {
    return { role: "admin", userId: editor.id };
  }

  return {
    role: ownerId && editor.id === ownerId ? "owner" : "guest",
    userId: editor.id,
  };
}

export function getListingAnalyticsSource(request: Request): string | null {
  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    return referer.slice(0, 1000);
  }

  return null;
}

export function buildListingAnalyticsVisitorKey(input: {
  request: Request;
  actor: ListingAnalyticsActor;
  visitorId: string | null;
}): string {
  const base =
    input.actor.userId && input.actor.role !== "guest"
      ? `${input.actor.role}:${input.actor.userId}`
      : `guest:${input.visitorId ?? getRequestFingerprint(input.request)}`;

  return createHash("sha256").update(base).digest("hex").slice(0, 64);
}

function getRequestFingerprint(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const acceptLanguage = request.headers.get("accept-language")?.trim() ?? "";

  return [forwardedFor || realIp || "unknown-ip", userAgent, acceptLanguage].join("|");
}
