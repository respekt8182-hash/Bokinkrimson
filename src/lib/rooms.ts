import { MediaType, type BathroomType, type Prisma } from "@prisma/client";
import { serializeMedia, type SerializedMedia } from "@/lib/media";
import { serializeRoomPrice, type SerializedRoomPrice } from "@/lib/pricing";
import { normalizeRoomMeta, type RoomMeta } from "@/lib/room-catalog";
import { normalizeRoomTitle } from "@/lib/room-title";

// Shared room serializer/include used by room APIs and owner/public pages.
export const roomInclude = {
  features: {
    include: {
      feature: true,
    },
  },
  customFeatures: true,
  media: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  prices: {
    orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.RoomInclude;

export type SerializedRoom = {
  id: string;
  propertyId: string;
  title: string;
  beds: number;
  extraBeds: number;
  roomsCount: number;
  areaSqm: number | null;
  bathroomType: BathroomType;
  bathroomTypeLabel: string;
  meta: RoomMeta | null;
  sortOrder: number;
  isActive: boolean;
  featureIds: string[];
  features: Array<{ id: string; name: string; category: string }>;
  customFeatures: string[];
  media: SerializedMedia[];
  mediaStats: {
    imageCount: number;
    videoCount: number;
  };
  prices: SerializedRoomPrice[];
  createdAt: string;
  updatedAt: string;
};

export type SerializedChessboardRoom = {
  id: string;
  propertyId: string;
  title: string;
  beds: number;
  extraBeds: number;
  roomsCount: number;
  areaSqm: number | null;
  bathroomType: BathroomType;
  bathroomTypeLabel: string;
  sortOrder: number;
  isActive: boolean;
  prices: SerializedRoomPrice[];
};

const fallbackRoomSortOrderMetaKey = "__roomSortOrder";

function getFallbackRoomSortOrder(meta: Prisma.JsonValue | null | undefined): number | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const value = (meta as Record<string, unknown>)[fallbackRoomSortOrderMetaKey];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function isFallbackSortOrderOnlyMeta(meta: Prisma.JsonValue | null | undefined): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return false;
  }

  const keys = Object.keys(meta);
  return keys.length === 1 && keys[0] === fallbackRoomSortOrderMetaKey;
}

function normalizeRoomMetaForSerialization(
  meta: Prisma.JsonValue | null | undefined,
): RoomMeta | null {
  return normalizeRoomMeta(isFallbackSortOrderOnlyMeta(meta) ? null : (meta ?? null));
}

export function resolveSerializedRoomSortOrder(room: {
  sortOrder?: number | null;
  meta?: Prisma.JsonValue | null;
}): number {
  const fallbackSortOrder = getFallbackRoomSortOrder(room.meta);
  if (fallbackSortOrder !== null) {
    return fallbackSortOrder;
  }

  if (
    typeof room.sortOrder === "number" &&
    Number.isInteger(room.sortOrder) &&
    room.sortOrder > 0
  ) {
    return room.sortOrder;
  }

  return 0;
}

export function buildRoomMetaWithFallbackSortOrder(
  meta: Prisma.JsonValue | null | undefined,
  sortOrder: number,
): Prisma.InputJsonValue {
  const base = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  return {
    ...(base as Record<string, unknown>),
    [fallbackRoomSortOrderMetaKey]: Math.max(1, Math.floor(sortOrder)),
  } as Prisma.InputJsonObject;
}

export function compareSerializedRoomsBySortOrder<
  T extends { id: string; sortOrder: number; title: string },
>(left: T, right: T): number {
  if (left.sortOrder !== right.sortOrder) {
    if (left.sortOrder <= 0) {
      return 1;
    }
    if (right.sortOrder <= 0) {
      return -1;
    }
    return left.sortOrder - right.sortOrder;
  }

  return left.title.localeCompare(right.title, "ru", {
    numeric: true,
    sensitivity: "base",
  });
}

function isInRoomBathroomLocation(location: string): boolean {
  return location === "in_room" || location === "in_bathroom";
}

export function getBathroomTypeLabel(type: BathroomType): string {
  switch (type) {
    case "IN_ROOM":
      return "В номере";
    case "ON_FLOOR":
      return "На этаже";
    case "OUTSIDE":
      return "На улице";
    default:
      return type;
  }
}

export function resolveBathroomTypeFromMeta(
  meta: {
    hasPrivateBathroom?: boolean;
    privateBathroomLocations?: string[];
    privateToiletLocations?: string[];
    hasSharedBathroom?: boolean;
    sharedBathroomLocations?: string[];
    sharedToiletLocations?: string[];
  } | null,
  fallback: BathroomType,
): BathroomType {
  if (!meta) {
    return fallback;
  }

  const privateLocations = meta.hasPrivateBathroom
    ? [...(meta.privateBathroomLocations ?? []), ...(meta.privateToiletLocations ?? [])]
    : [];
  const sharedLocations = meta.hasSharedBathroom
    ? [...(meta.sharedBathroomLocations ?? []), ...(meta.sharedToiletLocations ?? [])]
    : [];
  const allLocations = [...privateLocations, ...sharedLocations];

  if (
    meta.hasPrivateBathroom &&
    privateLocations.length > 0 &&
    privateLocations.every(isInRoomBathroomLocation)
  ) {
    return "IN_ROOM";
  }

  if (allLocations.includes("outside")) {
    return "OUTSIDE";
  }

  if (allLocations.some((location) => !isInRoomBathroomLocation(location))) {
    return "ON_FLOOR";
  }

  if (meta.hasPrivateBathroom) {
    return "IN_ROOM";
  }

  if (meta.hasSharedBathroom) {
    return "ON_FLOOR";
  }

  return fallback;
}

export function normalizeSerializedRoomBathroom<
  T extends Pick<SerializedRoom, "bathroomType" | "bathroomTypeLabel" | "meta">,
>(room: T): T {
  const bathroomType = resolveBathroomTypeFromMeta(room.meta, room.bathroomType);
  return {
    ...room,
    bathroomType,
    bathroomTypeLabel: getBathroomTypeLabel(bathroomType),
  };
}

// Utility for custom room features/services entered manually by owner.
export function dedupeStringsCaseInsensitive(values: string[]): string[] {
  return Array.from(
    new Map(
      values
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  );
}

export function serializeRoom(room: {
  id: string;
  propertyId: string;
  title: string;
  beds: number;
  extraBeds: number;
  roomsCount: number;
  areaSqm: Prisma.Decimal | null;
  bathroomType: BathroomType;
  meta?: Prisma.JsonValue | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  features?: Array<{
    feature: {
      id: string;
      name: string;
      category: string;
    };
  }>;
  customFeatures?: Array<{ name: string }>;
  media?: Array<{
    id: string;
    propertyId: string | null;
    roomId: string | null;
    type: MediaType;
    url: string;
    mimeType: string;
    fileSize: number;
    originalName: string | null;
    sortOrder: number;
    createdAt: Date;
  }>;
  prices?: Array<{
    id: string;
    roomId: string;
    dateFrom: Date;
    dateTo: Date;
    price: Prisma.Decimal;
    priceType?: string | null;
    minGuests?: number | null;
    minNights?: number | null;
    extraBedPrice?: Prisma.Decimal | number | null;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): SerializedRoom {
  // Flatten nested Prisma relations into UI-friendly shape.
  const features = room.features?.map((item) => item.feature) ?? [];
  const featureIds = features.map((item) => item.id);
  const customFeatures = room.customFeatures?.map((item) => item.name) ?? [];
  const media = room.media?.map(serializeMedia).sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const mediaStats = {
    imageCount: media.filter((item) => item.type === MediaType.IMAGE).length,
    videoCount: media.filter((item) => item.type === MediaType.VIDEO).length,
  };
  const prices = room.prices?.map(serializeRoomPrice) ?? [];
  const meta = normalizeRoomMetaForSerialization(room.meta);

  return normalizeSerializedRoomBathroom({
    id: room.id,
    propertyId: room.propertyId,
    title: normalizeRoomTitle(room.title),
    beds: room.beds,
    extraBeds: room.extraBeds,
    roomsCount: room.roomsCount,
    areaSqm: room.areaSqm === null ? null : Number(room.areaSqm),
    bathroomType: room.bathroomType,
    bathroomTypeLabel: getBathroomTypeLabel(room.bathroomType),
    meta,
    sortOrder: resolveSerializedRoomSortOrder(room),
    isActive: room.isActive,
    featureIds,
    features,
    customFeatures,
    media,
    mediaStats,
    prices,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  });
}

export function serializeRoomForChessboard(room: {
  id: string;
  propertyId: string;
  title: string;
  beds: number;
  extraBeds: number;
  roomsCount: number;
  areaSqm: Prisma.Decimal | null;
  bathroomType: BathroomType;
  meta?: Prisma.JsonValue | null;
  sortOrder: number;
  isActive: boolean;
  prices?: Array<{
    id: string;
    roomId: string;
    dateFrom: Date;
    dateTo: Date;
    price: Prisma.Decimal;
    priceType?: string | null;
    minGuests?: number | null;
    minNights?: number | null;
    extraBedPrice?: Prisma.Decimal | number | null;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): SerializedChessboardRoom {
  const meta = normalizeRoomMetaForSerialization(room.meta);
  const bathroomType = resolveBathroomTypeFromMeta(meta, room.bathroomType);

  return {
    id: room.id,
    propertyId: room.propertyId,
    title: normalizeRoomTitle(room.title),
    beds: room.beds,
    extraBeds: room.extraBeds,
    roomsCount: room.roomsCount,
    areaSqm: room.areaSqm === null ? null : Number(room.areaSqm),
    bathroomType,
    bathroomTypeLabel: getBathroomTypeLabel(bathroomType),
    sortOrder: resolveSerializedRoomSortOrder(room),
    isActive: room.isActive,
    prices: room.prices?.map(serializeRoomPrice) ?? [],
  };
}
