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
  isActive: boolean;
  prices: SerializedRoomPrice[];
};

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
  meta:
    | {
        hasPrivateBathroom?: boolean;
        hasSharedBathroom?: boolean;
        sharedBathroomLocations?: string[];
        sharedToiletLocations?: string[];
      }
    | null,
  fallback: BathroomType,
): BathroomType {
  if (!meta) {
    return fallback;
  }

  if (meta.hasPrivateBathroom) {
    return "IN_ROOM";
  }

  if (
    meta.hasSharedBathroom &&
    (meta.sharedBathroomLocations?.includes("outside") ||
      meta.sharedToiletLocations?.includes("outside"))
  ) {
    return "OUTSIDE";
  }

  if (meta.hasSharedBathroom) {
    return "ON_FLOOR";
  }

  return fallback;
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
    minGuests?: number | null;
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
  const meta = normalizeRoomMeta(room.meta ?? null);

  return {
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
    isActive: room.isActive,
    featureIds,
    features,
    customFeatures,
    media,
    mediaStats,
    prices,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
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
  isActive: boolean;
  prices?: Array<{
    id: string;
    roomId: string;
    dateFrom: Date;
    dateTo: Date;
    price: Prisma.Decimal;
    minGuests?: number | null;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): SerializedChessboardRoom {
  return {
    id: room.id,
    propertyId: room.propertyId,
    title: normalizeRoomTitle(room.title),
    beds: room.beds,
    extraBeds: room.extraBeds,
    roomsCount: room.roomsCount,
    areaSqm: room.areaSqm === null ? null : Number(room.areaSqm),
    bathroomType: room.bathroomType,
    bathroomTypeLabel: getBathroomTypeLabel(room.bathroomType),
    isActive: room.isActive,
    prices: room.prices?.map(serializeRoomPrice) ?? [],
  };
}
