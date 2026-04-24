// Image upload helper: validates photo formats, sanitizes file names, and converts photos to optimized WebP.
import sharp from "sharp";
import {
  getUploadFileExtension,
  normalizeUploadMimeType,
  supportedPhotoUploadExtensions,
  supportedPhotoUploadMimeTypes,
} from "@/lib/photo-upload";
import { sanitizeStoredFileName } from "@/lib/upload-validation";

const WEBP_MIME_TYPE = "image/webp";
const defaultWebpQuality = 82;
const defaultWebMaxSide = 2200;
const photoUploadExtensions = new Set<string>(supportedPhotoUploadExtensions);
const photoUploadMimeTypes = new Set<string>(supportedPhotoUploadMimeTypes);
type SupportedImageUploadType = "jpeg" | "png" | "heic" | "heif";
const sizeLimitedPhotoMimeTypes = new Set(["image/jpeg", "image/png"]);
const sizeLimitedPhotoExtensions = new Set(["jpg", "jpeg", "png"]);
const heifBrands = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "heif",
  "mif1",
  "msf1",
]);

function getWebpQuality(): number {
  const raw = Number(process.env.MEDIA_WEBP_QUALITY);

  if (!Number.isFinite(raw)) {
    return defaultWebpQuality;
  }

  return Math.max(1, Math.min(100, Math.round(raw)));
}

function getWebMaxSide(): number {
  const raw = Number(process.env.MEDIA_WEB_MAX_SIDE);
  if (!Number.isFinite(raw)) {
    return defaultWebMaxSide;
  }

  return Math.max(800, Math.min(6000, Math.round(raw)));
}

export function replaceFileExtension(fileName: string, extension: string): string {
  const cleanExtension = extension.replace(/^\.+/, "").toLowerCase();
  const normalizedName = fileName.trim();
  const withoutExtension = normalizedName.replace(/\.[^./\\]+$/, "");
  const baseName = withoutExtension || "file";

  return `${baseName}.${cleanExtension}`;
}

export function sanitizeUploadedFileName(fileName: string, fallback = "file"): string {
  return sanitizeStoredFileName(fileName, fallback);
}

function sniffImageTypeByMagicBytes(bytes: Buffer): SupportedImageUploadType | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  if (bytes.length >= 16 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii").toLowerCase();
    if (heifBrands.has(brand)) {
      return brand === "heif" ? "heif" : "heic";
    }
  }

  return null;
}

export function isSupportedPhotoUpload(input: {
  mimeType: string;
  fileName: string;
  bytes?: Buffer;
}): boolean {
  const byMagic = input.bytes ? sniffImageTypeByMagicBytes(input.bytes) : null;
  if (byMagic) {
    return true;
  }

  const mimeType = normalizeUploadMimeType(input.mimeType);
  if (photoUploadMimeTypes.has(mimeType)) {
    return true;
  }

  return photoUploadExtensions.has(getUploadFileExtension(input.fileName));
}

export function shouldEnforceJpegPngSizeLimit(input: {
  mimeType: string;
  fileName: string;
}): boolean {
  const mimeType = normalizeUploadMimeType(input.mimeType);
  if (sizeLimitedPhotoMimeTypes.has(mimeType)) {
    return true;
  }

  return sizeLimitedPhotoExtensions.has(getUploadFileExtension(input.fileName));
}

type ImageUploadInput = {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
};

type ImageUploadPayload = {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  converted: boolean;
};

export async function convertImageUploadToWebp(
  input: ImageUploadInput,
): Promise<ImageUploadPayload> {
  if (
    !isSupportedPhotoUpload({
      mimeType: input.mimeType,
      fileName: input.fileName,
      bytes: input.bytes,
    })
  ) {
    throw new Error("UNSUPPORTED_IMAGE_FORMAT");
  }

  let webp: Buffer;
  try {
    webp = await sharp(input.bytes, { failOn: "error" })
      .rotate()
      .resize({
        width: getWebMaxSide(),
        height: getWebMaxSide(),
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: getWebpQuality() })
      .toBuffer();
  } catch {
    throw new Error("IMAGE_PROCESSING_FAILED");
  }

  return {
    bytes: webp,
    mimeType: WEBP_MIME_TYPE,
    fileName: replaceFileExtension(input.fileName, "webp"),
    converted: true,
  };
}
