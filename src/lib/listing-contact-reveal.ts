import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListingEntityType } from "@/lib/listing-analytics";
import { logger } from "@/lib/logger";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";
import {
  parsePublishedExcursionSnapshot,
  shouldUsePublishedExcursionSnapshot,
} from "@/lib/excursion-public-snapshot";
import {
  parsePublishedPropertySnapshot,
  shouldUsePublishedSnapshot,
} from "@/lib/property-public-snapshot";
import {
  parsePublishedTransferSnapshot,
  shouldUsePublishedTransferSnapshot,
} from "@/lib/transfer-public-snapshot";
import {
  createSensitiveRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
  type LimitResult,
} from "@/lib/rate-limit";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

export type RevealedListingContacts = {
  phone: string | null;
  phoneName: string | null;
  phone2: string | null;
  phone2Name: string | null;
  phone3: string | null;
  phone3Name: string | null;
  email: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
};

export type RevealContactContext = {
  request: Request;
  entityType: ListingEntityType;
  entityId: string;
  visitorId?: string | null;
  userId?: string | null;
};

export type RevealContactResult = {
  entityType: ListingEntityType;
  entityId: string;
  entityPublicId: number | null;
  contacts: RevealedListingContacts;
};

type PublicListingContactRecord = {
  ownerId: string;
  publicId: number | null;
  contacts: RevealedListingContacts;
};

type RateLimiterKey = "ip" | "session" | "route" | "object" | "suspicious";

declare global {
  var __bokingContactTrapHits: Map<string, number> | undefined;
}

export class ContactRevealRateLimitError extends Error {
  constructor(public result: LimitResult) {
    super("CONTACT_REVEAL_RATE_LIMITED");
  }
}

export class ContactRevealUnavailableError extends Error {
  constructor(message = "CONTACT_REVEAL_UNAVAILABLE") {
    super(message);
  }
}

const limiterConfigs: Record<
  RateLimiterKey,
  { id: string; windowMs: number; maxRequests: number }
> = {
  ip: { id: "contact-reveal-ip", windowMs: 10 * 60 * 1000, maxRequests: 12 },
  session: { id: "contact-reveal-session", windowMs: 10 * 60 * 1000, maxRequests: 8 },
  route: { id: "contact-reveal-route", windowMs: 10 * 60 * 1000, maxRequests: 30 },
  object: { id: "contact-reveal-object", windowMs: 60 * 60 * 1000, maxRequests: 6 },
  suspicious: { id: "contact-reveal-suspicious", windowMs: 60 * 60 * 1000, maxRequests: 1 },
};

const limiterCache = new Map<RateLimiterKey, ReturnType<typeof createSensitiveRateLimiter>>();

function getLimiter(key: RateLimiterKey): ReturnType<typeof createSensitiveRateLimiter> {
  const existing = limiterCache.get(key);
  if (existing) {
    return existing;
  }

  const created = createSensitiveRateLimiter(limiterConfigs[key]);
  limiterCache.set(key, created);
  return created;
}

function normalizeValue(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeContactPayload(input: RevealedListingContacts): RevealedListingContacts {
  return {
    phone: normalizeValue(input.phone),
    phoneName: normalizeValue(input.phoneName),
    phone2: normalizeValue(input.phone2),
    phone2Name: normalizeValue(input.phone2Name),
    phone3: normalizeValue(input.phone3),
    phone3Name: normalizeValue(input.phone3Name),
    email: normalizeValue(input.email),
    websiteUrl: normalizeValue(input.websiteUrl),
    whatsappUrl: normalizeWhatsappUrl(input.whatsappUrl),
    telegramUrl: normalizeTelegramProfileUrl(input.telegramUrl),
    vkUrl: normalizeVkProfileUrl(input.vkUrl),
    maxUrl: normalizeMaxProfileUrl(input.maxUrl),
    okUrl: normalizeOkProfileUrl(input.okUrl),
  };
}

function getHeaderValue(request: Request, name: string): string {
  return request.headers.get(name)?.trim() ?? "";
}

function getClientIp(request: Request): string {
  return (
    getHeaderValue(request, "x-forwarded-for").split(",")[0]?.trim() ||
    getHeaderValue(request, "x-real-ip") ||
    "unknown-ip"
  );
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function getClientKey(request: Request, visitorId?: string | null): string {
  const userAgent = getHeaderValue(request, "user-agent");
  return hashKey([getClientIp(request), userAgent, visitorId ?? ""].join("|"));
}

function getTrapStore(): Map<string, number> {
  if (!global.__bokingContactTrapHits) {
    global.__bokingContactTrapHits = new Map<string, number>();
  }

  return global.__bokingContactTrapHits;
}

function pruneTrapStore(now = Date.now()): void {
  const store = getTrapStore();
  const ttlMs = 60 * 60 * 1000;

  for (const [key, hitAt] of store.entries()) {
    if (hitAt + ttlMs < now) {
      store.delete(key);
    }
  }
}

export function markContactHoneypotHit(request: Request, visitorId?: string | null): string {
  const clientKey = getClientKey(request, visitorId);
  pruneTrapStore();
  getTrapStore().set(clientKey, Date.now());
  logger.warn("listing_contact_honeypot_hit", { clientKey });
  return clientKey;
}

export function isContactClientMarkedSuspicious(
  request: Request,
  visitorId?: string | null,
): boolean {
  pruneTrapStore();
  return getTrapStore().has(getClientKey(request, visitorId));
}

export function resetContactRevealStateForTests(): void {
  global.__bokingContactTrapHits = new Map<string, number>();
  limiterCache.clear();
}

function hasSuspiciousUserAgent(request: Request): boolean {
  const userAgent = getHeaderValue(request, "user-agent").toLowerCase();
  if (!userAgent) {
    return true;
  }

  return [
    "curl",
    "wget",
    "python-requests",
    "scrapy",
    "httpclient",
    "crawler",
    "spider",
  ].some((pattern) => userAgent.includes(pattern));
}

async function applyLimit(key: RateLimiterKey, identity: string): Promise<LimitResult> {
  try {
    return await getLimiter(key).limit(identity);
  } catch (error) {
    if (
      error instanceof RateLimitConfigurationError ||
      error instanceof RateLimitBackendUnavailableError
    ) {
      throw new ContactRevealUnavailableError(error.message);
    }

    throw error;
  }
}

async function enforceContactRevealLimits(context: RevealContactContext): Promise<void> {
  const clientKey = getClientKey(context.request, context.visitorId);
  const ipKey = hashKey(getClientIp(context.request));
  const sessionKey = context.userId
    ? hashKey(`user:${context.userId}`)
    : hashKey(`visitor:${context.visitorId ?? clientKey}`);
  const objectKey = hashKey(`${context.entityType}:${context.entityId}:${clientKey}`);
  const routeKey = hashKey(`route:${context.entityType}:${clientKey}`);
  const suspicious =
    hasSuspiciousUserAgent(context.request) ||
    isContactClientMarkedSuspicious(context.request, context.visitorId);
  const limits: Array<[RateLimiterKey, string]> = [
    ["ip", ipKey],
    ["session", sessionKey],
    ["route", routeKey],
    ["object", objectKey],
  ];

  if (suspicious) {
    limits.push(["suspicious", clientKey]);
  }

  for (const [limitKey, identity] of limits) {
    const result = await applyLimit(limitKey, identity);
    if (!result.allowed) {
      logger.warn("listing_contact_rate_limit_exceeded", {
        entityType: context.entityType,
        entityId: context.entityId,
        limitKey,
        clientKey,
        retryAfterSeconds: result.retryAfterSeconds,
        source: result.source,
      });
      throw new ContactRevealRateLimitError(result);
    }
  }
}

async function getPropertyContactRecord(entityId: string): Promise<PublicListingContactRecord | null> {
  const property = await db.property.findFirst({
    where: {
      id: entityId,
      ...buildPublishedPropertyVisibilityWhere(),
    },
    select: {
      ownerId: true,
      publicId: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
      phone: true,
      phoneName: true,
      phone2: true,
      phone2Name: true,
      phone3: true,
      phone3Name: true,
      websiteUrl: true,
      contactEmail: true,
      showEmail: true,
      whatsappUrl: true,
      telegramUrl: true,
      vkUrl: true,
      maxUrl: true,
      okUrl: true,
      owner: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!property) {
    return null;
  }

  const snapshot = shouldUsePublishedSnapshot(property)
    ? parsePublishedPropertySnapshot(property.publishedSnapshot)
    : null;
  const display = snapshot?.property ?? property;
  const email = display.contactEmail ?? (display.showEmail ? property.owner.email : null);

  return {
    ownerId: property.ownerId,
    publicId: property.publicId ?? null,
    contacts: normalizeContactPayload({
      phone: display.phone,
      phoneName: display.phoneName,
      phone2: display.phone2,
      phone2Name: display.phone2Name,
      phone3: display.phone3,
      phone3Name: display.phone3Name,
      email,
      websiteUrl: display.websiteUrl,
      whatsappUrl: display.whatsappUrl,
      telegramUrl: display.telegramUrl,
      vkUrl: display.vkUrl,
      maxUrl: display.maxUrl,
      okUrl: display.okUrl,
    }),
  };
}

async function getExcursionContactRecord(
  entityId: string,
): Promise<PublicListingContactRecord | null> {
  const excursion = await db.excursion.findFirst({
    where: {
      id: entityId,
      ...buildPublishedExcursionVisibilityWhere(),
    },
    select: {
      ownerId: true,
      publicId: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
      contactPhone: true,
      contactPhoneName: true,
      contactPhone2: true,
      contactPhone2Name: true,
      contactPhone3: true,
      contactPhone3Name: true,
      contactEmail: true,
      websiteUrl: true,
      whatsappUrl: true,
      telegramUrl: true,
      vkUrl: true,
      maxUrl: true,
      okUrl: true,
      owner: {
        select: {
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!excursion) {
    return null;
  }

  const snapshot = shouldUsePublishedExcursionSnapshot(excursion)
    ? parsePublishedExcursionSnapshot(excursion.publishedSnapshot)
    : null;
  const display = snapshot?.excursion ?? excursion;

  return {
    ownerId: excursion.ownerId,
    publicId: excursion.publicId ?? null,
    contacts: normalizeContactPayload({
      phone: display.contactPhone ?? excursion.owner.phone,
      phoneName: display.contactPhoneName,
      phone2: display.contactPhone2,
      phone2Name: display.contactPhone2Name,
      phone3: display.contactPhone3,
      phone3Name: display.contactPhone3Name,
      email: display.contactEmail ?? excursion.owner.email,
      websiteUrl: display.websiteUrl,
      whatsappUrl: display.whatsappUrl,
      telegramUrl: display.telegramUrl,
      vkUrl: display.vkUrl,
      maxUrl: display.maxUrl,
      okUrl: display.okUrl,
    }),
  };
}

async function getTransferContactRecord(
  entityId: string,
): Promise<PublicListingContactRecord | null> {
  const transfer = await db.transfer.findFirst({
    where: {
      id: entityId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: {
      ownerId: true,
      publicId: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
      phone: true,
      phoneName: true,
      phone2: true,
      phone2Name: true,
      phone3: true,
      phone3Name: true,
      contactEmail: true,
      websiteUrl: true,
      whatsappUrl: true,
      telegramUrl: true,
      vkUrl: true,
      maxUrl: true,
      okUrl: true,
      owner: {
        select: {
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!transfer) {
    return null;
  }

  const snapshot = shouldUsePublishedTransferSnapshot(transfer)
    ? parsePublishedTransferSnapshot(transfer.publishedSnapshot as Prisma.JsonValue | null)
    : null;
  const display = snapshot?.transfer ?? transfer;

  return {
    ownerId: transfer.ownerId,
    publicId: transfer.publicId ?? null,
    contacts: normalizeContactPayload({
      phone: display.phone ?? transfer.owner.phone,
      phoneName: display.phoneName,
      phone2: display.phone2,
      phone2Name: display.phone2Name,
      phone3: display.phone3,
      phone3Name: display.phone3Name,
      email: display.contactEmail ?? transfer.owner.email,
      websiteUrl: display.websiteUrl,
      whatsappUrl: display.whatsappUrl,
      telegramUrl: display.telegramUrl,
      vkUrl: display.vkUrl,
      maxUrl: display.maxUrl,
      okUrl: display.okUrl,
    }),
  };
}

async function getPublicListingContactRecord(
  entityType: ListingEntityType,
  entityId: string,
): Promise<PublicListingContactRecord | null> {
  if (entityType === "property") {
    return getPropertyContactRecord(entityId);
  }

  if (entityType === "excursion") {
    return getExcursionContactRecord(entityId);
  }

  return getTransferContactRecord(entityId);
}

export async function revealListingContacts(
  context: RevealContactContext,
): Promise<RevealContactResult | null> {
  await enforceContactRevealLimits(context);

  const record = await getPublicListingContactRecord(context.entityType, context.entityId);
  if (!record) {
    logger.warn("listing_contact_reveal_not_found", {
      entityType: context.entityType,
      entityId: context.entityId,
      clientKey: getClientKey(context.request, context.visitorId),
    });
    return null;
  }

  logger.info("listing_contact_revealed", {
    entityType: context.entityType,
    entityId: context.entityId,
    entityPublicId: record.publicId,
    ownerId: record.ownerId,
    userId: context.userId ?? null,
    clientKey: getClientKey(context.request, context.visitorId),
  });

  return {
    entityType: context.entityType,
    entityId: context.entityId,
    entityPublicId: record.publicId,
    contacts: record.contacts,
  };
}
