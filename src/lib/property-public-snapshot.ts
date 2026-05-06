// Snapshot helpers that preserve the published property version while the owner edits pending changes.
import {
  MediaType,
  PetsPolicy,
  Prisma,
  PropertyStatus,
  SmokingPolicy,
} from "@prisma/client";
import type { DbClientLike } from "@/lib/db";
import { serializeMedia, type SerializedMedia } from "@/lib/media";
import { roomInclude, serializeRoom, type SerializedRoom } from "@/lib/rooms";
import type { FaqItem } from "@/types/excursions";

export type PublishedPropertySnapshot = {
  property: {
    name: string | null;
    type: string | null;
    locationId: string | null;
    locationName: string | null;
    address: string | null;
    seaDistance: string | null;
    latitude: number | null;
    longitude: number | null;
    description: string | null;
    faqItems: FaqItem[];
    phone: string | null;
    phoneName: string | null;
    phone2: string | null;
    phone2Name: string | null;
    phone3: string | null;
    phone3Name: string | null;
    websiteUrl: string | null;
    contactEmail: string | null;
    showEmail: boolean;
    whatsappUrl: string | null;
    telegramUrl: string | null;
    vkUrl: string | null;
    maxUrl: string | null;
    okUrl: string | null;
    receiveRequests: boolean;
    checkInFrom: string | null;
    checkOutUntil: string | null;
    childrenAllowed: boolean | null;
    childrenMinAge: number | null;
    petsPolicy: PetsPolicy | null;
    smokingPolicy: SmokingPolicy | null;
    quietHoursEnabled: boolean | null;
    quietHoursFrom: string | null;
    quietHoursTo: string | null;
    parkingInfo: string | null;
    mealOptions: string | null;
    prepaymentPolicy: string | null;
    classificationApplicable: boolean;
    registryNumber: string | null;
    registryDetails: string | null;
    starRating: number | null;
  };
  media: SerializedMedia[];
  amenities: Array<{ id: string; name: string; category: string }>;
  customAmenities: string[];
  keyRoomAmenityNames: string[];
  rooms: SerializedRoom[];
};

export const propertyPublicSnapshotInclude = Prisma.validator<Prisma.PropertyInclude>()({
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  amenities: {
    include: { amenity: true },
  },
  customAmenities: true,
  roomAmenitySettings: {
    where: {
      enabled: true,
      isKeyAmenity: true,
    },
    orderBy: [{ updatedAt: "asc" }],
    select: {
      feature: {
        select: {
          name: true,
        },
      },
    },
  },
  rooms: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: roomInclude,
  },
});

export type PropertyPublicSnapshotSource = Prisma.PropertyGetPayload<{
  include: typeof propertyPublicSnapshotInclude;
}>;

type PropertySnapshotClient = DbClientLike;

function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildPublishedPropertySnapshot(
  property: PropertyPublicSnapshotSource,
): PublishedPropertySnapshot {
  return toJson({
    property: {
      name: property.name,
      type: property.type,
      locationId: property.locationId,
      locationName: property.locationName,
      address: property.address,
      seaDistance: property.seaDistance,
      latitude: property.latitude === null ? null : Number(property.latitude),
      longitude: property.longitude === null ? null : Number(property.longitude),
      description: property.description,
      faqItems: Array.isArray(property.faqItems) ? (property.faqItems as FaqItem[]) : [],
      phone: property.phone,
      phoneName: property.phoneName,
      phone2: property.phone2,
      phone2Name: property.phone2Name,
      phone3: property.phone3,
      phone3Name: property.phone3Name,
      websiteUrl: property.websiteUrl,
      contactEmail: property.contactEmail,
      showEmail: property.showEmail,
      whatsappUrl: property.whatsappUrl,
      telegramUrl: property.telegramUrl,
      vkUrl: property.vkUrl,
      maxUrl: property.maxUrl,
      okUrl: property.okUrl,
      receiveRequests: property.receiveRequests,
      checkInFrom: property.checkInFrom,
      checkOutUntil: property.checkOutUntil,
      childrenAllowed: property.childrenAllowed,
      childrenMinAge: property.childrenMinAge,
      petsPolicy: property.petsPolicy,
      smokingPolicy: property.smokingPolicy,
      quietHoursEnabled: property.quietHoursEnabled,
      quietHoursFrom: property.quietHoursFrom,
      quietHoursTo: property.quietHoursTo,
      parkingInfo: property.parkingInfo,
      mealOptions: property.mealOptions,
      prepaymentPolicy: property.prepaymentPolicy,
      classificationApplicable: property.classificationApplicable,
      registryNumber: property.registryNumber,
      registryDetails: property.registryDetails,
      starRating: property.starRating,
    },
    media: property.media.map(serializeMedia),
    amenities: property.amenities.map((item) => item.amenity),
    customAmenities: property.customAmenities.map((item) => item.name),
    keyRoomAmenityNames: property.roomAmenitySettings.map((item) => item.feature.name),
    rooms: property.rooms.map(serializeRoom),
  });
}

export function parsePublishedPropertySnapshot(
  value: Prisma.JsonValue | null,
): PublishedPropertySnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublishedPropertySnapshot>;
  if (!candidate.property || !Array.isArray(candidate.media) || !Array.isArray(candidate.rooms)) {
    return null;
  }

  return candidate as PublishedPropertySnapshot;
}

export function shouldUsePublishedSnapshot(input: {
  status: PropertyStatus;
  pendingEditStatus: PropertyStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
}): boolean {
  return (
    input.status === PropertyStatus.PUBLISHED &&
    input.pendingEditStatus !== null &&
    parsePublishedPropertySnapshot(input.publishedSnapshot) !== null
  );
}

export async function refreshPublishedPropertySnapshot(
  client: PropertySnapshotClient,
  propertyId: string,
): Promise<PublishedPropertySnapshot | null> {
  const property = await client.property.findUnique({
    where: { id: propertyId },
    include: propertyPublicSnapshotInclude,
  });

  if (!property) {
    return null;
  }

  const snapshot = buildPublishedPropertySnapshot(property);
  await client.property.update({
    where: { id: propertyId },
    data: {
      publishedSnapshot: snapshot as Prisma.InputJsonValue,
    },
  });

  return snapshot;
}

export async function ensurePublishedPropertySnapshotBeforeOwnerEdit(
  client: PropertySnapshotClient,
  propertyId: string,
): Promise<void> {
  const property = await client.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
    },
  });

  if (!property || property.status !== PropertyStatus.PUBLISHED) {
    return;
  }

  if (!parsePublishedPropertySnapshot(property.publishedSnapshot)) {
    await refreshPublishedPropertySnapshot(client, property.id);
  }

  if (property.pendingEditStatus === null) {
    await client.property.update({
      where: { id: property.id },
      data: {
        pendingEditStatus: PropertyStatus.DRAFT,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    });
  }
}

export function getSnapshotImageCount(snapshot: PublishedPropertySnapshot | null): number {
  if (!snapshot) {
    return 0;
  }

  return snapshot.media.filter((item) => item.type === MediaType.IMAGE).length;
}
