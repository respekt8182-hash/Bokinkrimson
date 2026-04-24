export type UploadKind = "document" | "image" | "video";

type DetectedFileType = {
  kind: UploadKind;
  mimeType: string;
  extension: string;
};

type ValidateFileInput = {
  file: File;
  allowedKinds: UploadKind[];
  maxSizeBytes: number;
};

export type ValidatedUpload = {
  detectedMimeType: string;
  detectedExtension: string;
  sanitizedFileName: string;
  size: number;
};

const heifBrands = new Map<string, { mimeType: string; extension: string }>([
  ["heic", { mimeType: "image/heic", extension: "heic" }],
  ["heix", { mimeType: "image/heic", extension: "heic" }],
  ["hevc", { mimeType: "image/heic", extension: "heic" }],
  ["hevx", { mimeType: "image/heic", extension: "heic" }],
  ["heif", { mimeType: "image/heif", extension: "heif" }],
  ["mif1", { mimeType: "image/heif", extension: "heif" }],
  ["msf1", { mimeType: "image/heif", extension: "heif" }],
]);

const mp4Brands = new Set([
  "isom",
  "iso2",
  "avc1",
  "mp41",
  "mp42",
  "m4v ",
  "dash",
  "iso5",
  "iso6",
]);

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  );
}

function detectIsoBaseMedia(bytes: Uint8Array): DetectedFileType | null {
  if (bytes.length < 16 || Buffer.from(bytes.subarray(4, 8)).toString("ascii") !== "ftyp") {
    return null;
  }

  const brand = Buffer.from(bytes.subarray(8, 12)).toString("ascii").toLowerCase();

  const heif = heifBrands.get(brand);
  if (heif) {
    return {
      kind: "image",
      mimeType: heif.mimeType,
      extension: heif.extension,
    };
  }

  if (brand === "qt  ") {
    return {
      kind: "video",
      mimeType: "video/quicktime",
      extension: "mov",
    };
  }

  if (mp4Brands.has(brand)) {
    return {
      kind: "video",
      mimeType: "video/mp4",
      extension: "mp4",
    };
  }

  return null;
}

function hasWebmSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

export function detectFileTypeFromBytes(bytes: Uint8Array): DetectedFileType | null {
  if (hasPdfSignature(bytes)) {
    return { kind: "document", mimeType: "application/pdf", extension: "pdf" };
  }

  if (hasJpegSignature(bytes)) {
    return { kind: "image", mimeType: "image/jpeg", extension: "jpg" };
  }

  if (hasPngSignature(bytes)) {
    return { kind: "image", mimeType: "image/png", extension: "png" };
  }

  if (hasWebpSignature(bytes)) {
    return { kind: "image", mimeType: "image/webp", extension: "webp" };
  }

  const isoType = detectIsoBaseMedia(bytes);
  if (isoType) {
    return isoType;
  }

  if (hasWebmSignature(bytes)) {
    return { kind: "video", mimeType: "video/webm", extension: "webm" };
  }

  return null;
}

export function sanitizeStoredFileName(
  value: string,
  fallback = "file",
  maxLength = 120,
): string {
  const normalizedValue = value.normalize("NFKC").replace(/<[^>]*>/g, " ");
  const basename = normalizedValue.split(/[\\/]+/).pop() ?? normalizedValue;
  const plainText = basename
    .replace(/[<>:"|?*\u0000-\u001f]+/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutTrailingDots = plainText.replace(/[.\s]+$/g, "");
  const safe =
    withoutTrailingDots
      .replace(/[^\p{L}\p{N}().,_\- ]+/gu, "")
      .replace(/\s*\.\s*/g, ".")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim() || fallback;

  return safe.slice(0, maxLength);
}

export async function readFileHeader(file: File, headerBytes = 16 * 1024): Promise<Uint8Array> {
  const chunk = await file.slice(0, headerBytes).arrayBuffer();
  return new Uint8Array(chunk);
}

export async function validateUploadFile(input: ValidateFileInput): Promise<ValidatedUpload> {
  if (input.file.size <= 0) {
    throw new Error("FILE_EMPTY");
  }

  if (input.file.size > input.maxSizeBytes) {
    throw new Error("FILE_TOO_LARGE");
  }

  const detected = detectFileTypeFromBytes(await readFileHeader(input.file));
  if (!detected || !input.allowedKinds.includes(detected.kind)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  return {
    detectedMimeType: detected.mimeType,
    detectedExtension: detected.extension,
    sanitizedFileName: sanitizeStoredFileName(input.file.name || "file"),
    size: input.file.size,
  };
}
