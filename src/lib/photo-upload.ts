// Upload validation helpers for accommodation photos: MIME types, extensions, size limits, and user-facing errors.
export const supportedPhotoUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

export const supportedPhotoUploadExtensions = [
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
] as const;

export type SupportedPhotoUploadType = "jpeg" | "png" | "heic" | "heif" | "webp";
export type UploadMediaOwner = "property" | "room";
export type UploadMediaType = "IMAGE" | "VIDEO";

export const accommodationJpegPngUploadSizeLimitBytes = 15 * 1024 * 1024;
export const accommodationPhotoUploadSizeLimitBytes = 30 * 1024 * 1024;
export const accommodationPhotoUploadFormatsLabel = "JPG/JPEG, PNG, HEIC/HEIF и WEBP";
export const accommodationPhotoUploadLimitsLabel =
  `JPG/JPEG и PNG до ${formatUploadMegabytes(accommodationJpegPngUploadSizeLimitBytes)}, HEIC/HEIF и WEBP до ${formatUploadMegabytes(accommodationPhotoUploadSizeLimitBytes)}`;
export const accommodationPhotoUploadAccept = Array.from(
  new Set([
    ...supportedPhotoUploadMimeTypes,
    ...supportedPhotoUploadExtensions.map((extension) => `.${extension}`),
  ]),
).join(",");

export function normalizeUploadMimeType(value: string): string {
  return value.toLowerCase().split(";")[0]?.trim() ?? "";
}

export function getUploadFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }

  return fileName
    .slice(lastDot + 1)
    .toLowerCase()
    .trim();
}

export function detectSupportedPhotoUploadType(input: {
  mimeType: string;
  fileName: string;
}): SupportedPhotoUploadType | null {
  const mimeType = normalizeUploadMimeType(input.mimeType);

  if (mimeType === "image/jpeg") {
    return "jpeg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/heic") {
    return "heic";
  }
  if (mimeType === "image/heif") {
    return "heif";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }

  const extension = getUploadFileExtension(input.fileName);
  if (extension === "jpg" || extension === "jpeg") {
    return "jpeg";
  }
  if (extension === "png") {
    return "png";
  }
  if (extension === "heic") {
    return "heic";
  }
  if (extension === "heif") {
    return "heif";
  }
  if (extension === "webp") {
    return "webp";
  }

  return null;
}

export function formatUploadMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  const formatted = Number.isInteger(megabytes) ? String(megabytes) : megabytes.toFixed(1);
  return `${formatted} МБ`;
}

export function getAccommodationPhotoUploadSizeLimitBytes(input: {
  mimeType: string;
  fileName: string;
}): number {
  const uploadType = detectSupportedPhotoUploadType(input);

  if (uploadType === "jpeg" || uploadType === "png") {
    return accommodationJpegPngUploadSizeLimitBytes;
  }

  return accommodationPhotoUploadSizeLimitBytes;
}

export function getUnsupportedAccommodationPhotoFormatError(): string {
  return `Формат не поддерживается. Загрузите ${accommodationPhotoUploadFormatsLabel}.`;
}

export function getAccommodationPhotoUploadSizeError(): string {
  return `Файл слишком большой. ${accommodationPhotoUploadLimitsLabel}.`;
}

export function getMediaLimitExceededError(input: {
  owner: UploadMediaOwner;
  mediaType: UploadMediaType;
  limit: number;
}): string {
  const ownerLabel = input.owner === "property" ? "объекта" : "номера";
  const mediaLabel = input.mediaType === "IMAGE" ? "фото" : "видео";
  return `Максимум ${input.limit} ${mediaLabel} для ${ownerLabel}`;
}
