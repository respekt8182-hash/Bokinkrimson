// Domain/service module for media.
import { MediaType } from "@prisma/client";
import { mediaLimits } from "@/lib/constants";
import type { DbClientLike } from "@/lib/db";
import {
  formatUploadMegabytes,
  getAccommodationPhotoUploadSizeLimitBytes,
  getAccommodationPhotoUploadSizeError,
  getUploadFileExtension,
} from "@/lib/photo-upload";

export type SerializedMedia = {
  id: string;
  propertyId: string | null;
  roomId: string | null;
  type: MediaType;
  url: string;
  mimeType: string;
  fileSize: number;
  originalName: string | null;
  sortOrder: number;
  createdAt: string;
};

type MediaSortOrderClient = Pick<DbClientLike, "media">;

const imageExtensionFallbacks = new Set(["jpg", "jpeg", "png", "heic", "heif", "webp", "avif"]);
const videoExtensionFallbacks = new Set(["mp4", "mov", "webm", "m4v", "avi", "mkv"]);
export const accommodationVideoUploadSizeLimitBytes = 100 * 1024 * 1024;
export const accommodationVideoUploadDurationLimitSeconds = 60;

export function normalizeLegacyFotoImageUrl(url: string): string {
  return url.replace(/^\/Foto\/([^?#]+)\.png(?=($|[?#]))/i, "/Foto/$1.webp");
}

export function formatVideoUploadDuration(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    return `${seconds / 60} мин`;
  }

  return `${seconds} сек`;
}

export function getAccommodationVideoUploadSizeError(): string {
  return `Видео слишком большое. Максимум ${formatUploadMegabytes(
    accommodationVideoUploadSizeLimitBytes,
  )} на файл.`;
}

export function getAccommodationVideoUploadDurationError(): string {
  return `Видео слишком длинное. Максимальная длительность ${formatVideoUploadDuration(
    accommodationVideoUploadDurationLimitSeconds,
  )}.`;
}

export function detectMediaType(mimeType: string): MediaType | null {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";

  if (normalized.startsWith("image/")) {
    return MediaType.IMAGE;
  }

  if (normalized.startsWith("video/")) {
    return MediaType.VIDEO;
  }

  return null;
}

export function detectMediaTypeFromUpload(mimeType: string, fileName: string): MediaType | null {
  const byMime = detectMediaType(mimeType);
  if (byMime) {
    return byMime;
  }

  const extension = getUploadFileExtension(fileName);
  if (imageExtensionFallbacks.has(extension)) {
    return MediaType.IMAGE;
  }
  if (videoExtensionFallbacks.has(extension)) {
    return MediaType.VIDEO;
  }

  return null;
}

export function getMediaLimit(owner: "property" | "room", type: MediaType): number {
  if (owner === "property") {
    return type === MediaType.IMAGE ? mediaLimits.property.images : mediaLimits.property.videos;
  }

  return type === MediaType.IMAGE ? mediaLimits.room.images : mediaLimits.room.videos;
}

export function validateMediaFile(input: {
  mediaType: MediaType;
  size: number;
  mimeType: string;
  fileName: string;
}): string | null {
  if (
    input.mediaType === MediaType.IMAGE &&
    input.size >
      getAccommodationPhotoUploadSizeLimitBytes({
        mimeType: input.mimeType,
        fileName: input.fileName,
      })
  ) {
    return getAccommodationPhotoUploadSizeError();
  }

  if (input.mediaType === MediaType.VIDEO && input.size > accommodationVideoUploadSizeLimitBytes) {
    return getAccommodationVideoUploadSizeError();
  }

  return null;
}

export function serializeMedia(media: {
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
}): SerializedMedia {
  return {
    id: media.id,
    propertyId: media.propertyId,
    roomId: media.roomId,
    type: media.type,
    url: normalizeLegacyFotoImageUrl(media.url),
    mimeType: media.mimeType,
    fileSize: media.fileSize,
    originalName: media.originalName,
    sortOrder: media.sortOrder,
    createdAt: media.createdAt.toISOString(),
  };
}

export async function normalizePropertyMediaSortOrder(db: MediaSortOrderClient, propertyId: string) {
  const rows = await db.media.findMany({
    where: { propertyId, roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(
    rows.map((row, index) =>
      db.media.update({
        where: { id: row.id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );
}

export async function normalizeRoomMediaSortOrder(db: MediaSortOrderClient, roomId: string) {
  const rows = await db.media.findMany({
    where: { roomId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(
    rows.map((row, index) =>
      db.media.update({
        where: { id: row.id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );
}
