import { Prisma, TransferStatus } from "@prisma/client";
import type { DbClientLike } from "@/lib/db";

export type PublishedTransferSnapshot = {
  transfer: {
    title: string | null;
    transferType: string | null;
    vehicleClass: string | null;
    vehicleModel: string | null;
    seats: number | null;
    luggage: number | null;
    locationId: string | null;
    locationName: string | null;
    districtId: string | null;
    serviceArea: string | null;
    routeExamples: string | null;
    latitude: number | null;
    longitude: number | null;
    priceFrom: number | null;
    priceUnitLabel: string | null;
    currency: string;
    shortDescription: string | null;
    description: string | null;
    photoUrls: string[];
    serviceTags: string[];
    fleet: Prisma.JsonValue;
    contactName: string | null;
    phone: string | null;
    phoneName: string | null;
    phone2: string | null;
    phone2Name: string | null;
    phone3: string | null;
    phone3Name: string | null;
    websiteUrl: string | null;
    contactEmail: string | null;
    whatsappUrl: string | null;
    telegramUrl: string | null;
    vkUrl: string | null;
    maxUrl: string | null;
    okUrl: string | null;
    receiveRequests: boolean;
    publishedAt: string | null;
    updatedAt: string;
    location: {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    } | null;
    district: {
      name: string;
    } | null;
  };
};

export const transferPublicSnapshotInclude = Prisma.validator<Prisma.TransferInclude>()({
  location: {
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
    },
  },
  district: {
    select: {
      name: true,
    },
  },
});

export type TransferPublicSnapshotSource = Prisma.TransferGetPayload<{
  include: typeof transferPublicSnapshotInclude;
}>;

type TransferSnapshotClient = DbClientLike;

function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toNumberOrNull(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toDateOrNull(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildPublishedTransferSnapshot(
  transfer: TransferPublicSnapshotSource,
): PublishedTransferSnapshot {
  return toJson({
    transfer: {
      title: transfer.title,
      transferType: transfer.transferType,
      vehicleClass: transfer.vehicleClass,
      vehicleModel: transfer.vehicleModel,
      seats: transfer.seats,
      luggage: transfer.luggage,
      locationId: transfer.locationId,
      locationName: transfer.locationName,
      districtId: transfer.districtId,
      serviceArea: transfer.serviceArea,
      routeExamples: transfer.routeExamples,
      latitude: toNumberOrNull(transfer.latitude),
      longitude: toNumberOrNull(transfer.longitude),
      priceFrom: toNumberOrNull(transfer.priceFrom),
      priceUnitLabel: transfer.priceUnitLabel,
      currency: transfer.currency,
      shortDescription: transfer.shortDescription,
      description: transfer.description,
      photoUrls: transfer.photoUrls,
      serviceTags: transfer.serviceTags,
      fleet: transfer.fleet,
      contactName: transfer.contactName,
      phone: transfer.phone,
      phoneName: transfer.phoneName,
      phone2: transfer.phone2,
      phone2Name: transfer.phone2Name,
      phone3: transfer.phone3,
      phone3Name: transfer.phone3Name,
      websiteUrl: transfer.websiteUrl,
      contactEmail: transfer.contactEmail,
      whatsappUrl: transfer.whatsappUrl,
      telegramUrl: transfer.telegramUrl,
      vkUrl: transfer.vkUrl,
      maxUrl: transfer.maxUrl,
      okUrl: transfer.okUrl,
      receiveRequests: transfer.receiveRequests,
      publishedAt: transfer.publishedAt ? transfer.publishedAt.toISOString() : null,
      updatedAt: transfer.updatedAt.toISOString(),
      location: transfer.location
        ? {
            id: transfer.location.id,
            name: transfer.location.name,
            latitude: toNumberOrNull(transfer.location.latitude),
            longitude: toNumberOrNull(transfer.location.longitude),
          }
        : null,
      district: transfer.district
        ? {
            name: transfer.district.name,
          }
        : null,
    },
  });
}

export function parsePublishedTransferSnapshot(
  value: Prisma.JsonValue | null,
): PublishedTransferSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublishedTransferSnapshot>;
  if (!candidate.transfer || typeof candidate.transfer !== "object") {
    return null;
  }

  return candidate as PublishedTransferSnapshot;
}

export function shouldUsePublishedTransferSnapshot(input: {
  status: TransferStatus;
  pendingEditStatus: TransferStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
}): boolean {
  return (
    input.status === TransferStatus.PUBLISHED &&
    input.pendingEditStatus !== null &&
    parsePublishedTransferSnapshot(input.publishedSnapshot) !== null
  );
}

export function applyPublishedTransferSnapshotToRow<
  T extends {
    status: TransferStatus;
    pendingEditStatus?: TransferStatus | null;
    publishedSnapshot?: Prisma.JsonValue | null;
    publishedAt?: Date | null;
    updatedAt?: Date;
  },
>(row: T): T {
  const snapshot =
    row.status === TransferStatus.PUBLISHED && row.pendingEditStatus
      ? parsePublishedTransferSnapshot(row.publishedSnapshot ?? null)
      : null;

  if (!snapshot) {
    return row;
  }

  return {
    ...row,
    ...snapshot.transfer,
    fleet: snapshot.transfer.fleet,
    photoUrls: [...snapshot.transfer.photoUrls],
    serviceTags: [...snapshot.transfer.serviceTags],
    location: snapshot.transfer.location,
    district: snapshot.transfer.district,
    publishedAt: toDateOrNull(snapshot.transfer.publishedAt),
    updatedAt: toDateOrNull(snapshot.transfer.updatedAt) ?? row.updatedAt,
  } as T;
}

export async function refreshPublishedTransferSnapshot(
  client: TransferSnapshotClient,
  transferId: string,
): Promise<PublishedTransferSnapshot | null> {
  const transfer = await client.transfer.findUnique({
    where: { id: transferId },
    include: transferPublicSnapshotInclude,
  });

  if (!transfer) {
    return null;
  }

  const snapshot = buildPublishedTransferSnapshot(transfer);
  await client.transfer.update({
    where: { id: transferId },
    data: {
      publishedSnapshot: snapshot as Prisma.InputJsonValue,
    },
  });

  return snapshot;
}

export async function ensurePublishedTransferSnapshotBeforeOwnerEdit(
  client: TransferSnapshotClient,
  transferId: string,
): Promise<void> {
  const transfer = await client.transfer.findUnique({
    where: { id: transferId },
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
    },
  });

  if (!transfer || transfer.status !== TransferStatus.PUBLISHED) {
    return;
  }

  if (!parsePublishedTransferSnapshot(transfer.publishedSnapshot)) {
    await refreshPublishedTransferSnapshot(client, transfer.id);
  }

  if (transfer.pendingEditStatus === null) {
    await client.transfer.update({
      where: { id: transfer.id },
      data: {
        pendingEditStatus: TransferStatus.DRAFT,
        moderationNotes: null,
      },
    });
  }
}
