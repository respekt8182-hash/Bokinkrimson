import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { resolveBaseUrl } from "@/lib/seo/site";

export type StorageVisibility = "public" | "private";
export type StorageDisposition = "inline" | "attachment";

type UploadInput = {
  key: string;
  body: Buffer;
  contentType: string;
  visibility?: StorageVisibility;
  contentDisposition?: StorageDisposition;
  cacheControl?: string | null;
};

type UploadResult = {
  url: string | null;
};

type StoredObjectMeta = {
  contentType: string;
  contentDisposition: StorageDisposition;
  visibility: StorageVisibility;
};

export type StoredObject = StoredObjectMeta & {
  body: Buffer;
  contentLength: number;
};

export type PublicUploadStorageObject = {
  key: string;
  modifiedAt: number;
};

const localUploadsPublicDir = path.join(process.cwd(), "public", "uploads");
const localPrivateStorageDir = path.join(process.cwd(), "storage", "private-uploads");
const publicUploadExistsCacheTtlMs = 30 * 1000;
const publicUploadExistsCache = new Map<string, { checkedAt: number; exists: boolean }>();
const fallbackContentTypeByExtension: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

function getDefaultVisibility(value: StorageVisibility | undefined): StorageVisibility {
  return value ?? "public";
}

function getDefaultContentDisposition(
  value: StorageDisposition | undefined,
  visibility: StorageVisibility,
): StorageDisposition {
  if (value) {
    return value;
  }

  return visibility === "private" ? "attachment" : "inline";
}

function getLocalBaseDir(visibility: StorageVisibility): string {
  return visibility === "private" ? localPrivateStorageDir : localUploadsPublicDir;
}

function getLocalMetaPath(fullPath: string): string {
  return `${fullPath}.meta.json`;
}

function getFallbackContentType(key: string): string {
  const extension = path.extname(key).replace(".", "").toLowerCase();
  return fallbackContentTypeByExtension[extension] ?? "application/octet-stream";
}

function getFallbackLocalMeta(key: string, visibility: StorageVisibility): StoredObjectMeta {
  return {
    contentType: getFallbackContentType(key),
    contentDisposition: getDefaultContentDisposition(undefined, visibility),
    visibility,
  };
}

function parseLocalMeta(rawMeta: string | null, fallback: StoredObjectMeta): StoredObjectMeta {
  if (!rawMeta) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawMeta) as Partial<StoredObjectMeta>;
    const visibility =
      parsed.visibility === "public" || parsed.visibility === "private"
        ? parsed.visibility
        : fallback.visibility;
    const contentDisposition =
      parsed.contentDisposition === "inline" || parsed.contentDisposition === "attachment"
        ? parsed.contentDisposition
        : getDefaultContentDisposition(undefined, visibility);

    return {
      contentType:
        typeof parsed.contentType === "string" && parsed.contentType.trim()
          ? parsed.contentType
          : fallback.contentType,
      contentDisposition,
      visibility,
    };
  } catch {
    return fallback;
  }
}

export function normalizeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").trim();
  if (!normalized) {
    throw new Error("INVALID_STORAGE_KEY");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("INVALID_STORAGE_KEY");
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error("INVALID_STORAGE_KEY");
    }

    if (/[\u0000-\u001f]/.test(segment)) {
      throw new Error("INVALID_STORAGE_KEY");
    }
  }

  return segments.join("/");
}

async function writeLocalObject(
  baseDir: string,
  key: string,
  body: Buffer,
  meta: StoredObjectMeta,
): Promise<void> {
  const fullPath = path.join(baseDir, ...key.split("/"));
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
  await writeFile(getLocalMetaPath(fullPath), JSON.stringify(meta));
}

async function readLocalObject(
  baseDir: string,
  key: string,
  fallbackVisibility: StorageVisibility,
): Promise<StoredObject> {
  const fullPath = path.join(baseDir, ...key.split("/"));
  const body = await readFile(fullPath);
  const rawMeta = await readFile(getLocalMetaPath(fullPath), "utf8").catch(() => null);
  const parsedMeta = parseLocalMeta(rawMeta, getFallbackLocalMeta(key, fallbackVisibility));

  return {
    ...parsedMeta,
    body,
    contentLength: body.byteLength,
  };
}

async function uploadToLocalStorage(input: UploadInput): Promise<UploadResult> {
  const visibility = getDefaultVisibility(input.visibility);
  const contentDisposition = getDefaultContentDisposition(input.contentDisposition, visibility);
  const normalizedKey = normalizeStorageKey(input.key);

  await writeLocalObject(getLocalBaseDir(visibility), normalizedKey, input.body, {
    contentType: input.contentType,
    contentDisposition,
    visibility,
  });
  if (visibility === "public") {
    publicUploadExistsCache.set(normalizedKey, { checkedAt: Date.now(), exists: true });
  }

  return {
    url: visibility === "public" ? `/uploads/${normalizedKey}` : null,
  };
}

async function deleteFromLocalStorage(key: string): Promise<void> {
  const normalizedKey = normalizeStorageKey(key);

  for (const visibility of ["public", "private"] as const) {
    const fullPath = path.join(getLocalBaseDir(visibility), ...normalizedKey.split("/"));
    await rm(fullPath, { force: true }).catch(() => null);
    await rm(getLocalMetaPath(fullPath), { force: true }).catch(() => null);
  }
  publicUploadExistsCache.set(normalizedKey, { checkedAt: Date.now(), exists: false });
}

async function readFromLocalStorage(key: string): Promise<StoredObject> {
  const normalizedKey = normalizeStorageKey(key);

  for (const visibility of ["private", "public"] as const) {
    try {
      return await readLocalObject(getLocalBaseDir(visibility), normalizedKey, visibility);
    } catch {
      continue;
    }
  }

  throw new Error("STORAGE_OBJECT_NOT_FOUND");
}

export async function readPublicUploadFromStorage(key: string): Promise<StoredObject> {
  const normalizedKey = normalizeStorageKey(key);
  const stored = await readLocalObject(localUploadsPublicDir, normalizedKey, "public");

  if (stored.visibility !== "public") {
    throw new Error("STORAGE_OBJECT_NOT_FOUND");
  }

  return stored;
}

function getConfig() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    publicBaseUrl,
  };
}

function hasRequiredS3Config(config: ReturnType<typeof getConfig>): boolean {
  return Boolean(config.bucket && config.accessKeyId && config.secretAccessKey);
}

function createClient(config: ReturnType<typeof getConfig>): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    forcePathStyle: config.forcePathStyle,
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }

  return new S3Client(clientConfig);
}

function buildPublicUrl(key: string, config: ReturnType<typeof getConfig>): string {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  if (config.endpoint && config.bucket) {
    return `${config.endpoint.replace(/\/$/, "")}/${config.bucket}/${key}`;
  }

  if (!config.bucket) {
    throw new Error("S3_BUCKET is not configured");
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

function startsWithNormalizedUrl(input: string, base: string): boolean {
  const normalizedInput = input.replace(/\/+$/, "");
  const normalizedBase = base.replace(/\/+$/, "");
  return normalizedInput.startsWith(`${normalizedBase}/`);
}

function getManagedPublicBaseUrls(config: ReturnType<typeof getConfig>): string[] {
  const candidates = new Set<string>();

  for (const candidate of [
    config.publicBaseUrl,
    config.endpoint && config.bucket ? `${config.endpoint}/${config.bucket}` : null,
    config.bucket ? `https://${config.bucket}.s3.${config.region}.amazonaws.com` : null,
  ]) {
    if (candidate) {
      candidates.add(candidate.replace(/\/+$/, ""));
    }
  }

  try {
    candidates.add(resolveBaseUrl().replace(/\/+$/, ""));
  } catch {
    // Ignore invalid application base URL configuration.
  }

  return [...candidates];
}

async function readS3Body(body: unknown): Promise<Buffer> {
  if (body && typeof body === "object" && "transformToByteArray" in body) {
    const bytes = await (
      body as { transformToByteArray(): Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }

  throw new Error("S3_BODY_UNSUPPORTED");
}

export function isStorageConfigured(): boolean {
  return hasRequiredS3Config(getConfig());
}

export function isLocalStorageBackend(): boolean {
  const config = getConfig();
  return !hasRequiredS3Config(config) || !config.bucket;
}

async function localPublicUploadExists(key: string): Promise<boolean> {
  const normalizedKey = normalizeStorageKey(key);
  const cached = publicUploadExistsCache.get(normalizedKey);
  const now = Date.now();

  if (cached && now - cached.checkedAt < publicUploadExistsCacheTtlMs) {
    return cached.exists;
  }

  const fullPath = path.join(localUploadsPublicDir, ...normalizedKey.split("/"));
  const fileStat = await stat(fullPath).catch(() => null);
  const exists = Boolean(fileStat?.isFile());
  publicUploadExistsCache.set(normalizedKey, { checkedAt: now, exists });
  return exists;
}

export async function filterExistingLocalPublicUploadUrls(
  urls: readonly string[],
): Promise<string[]> {
  if (!isLocalStorageBackend()) {
    return [...urls];
  }

  const filtered = await Promise.all(
    urls.map(async (url) => {
      const key = getStorageKeyFromPublicUrl(url);

      if (!key) {
        return url;
      }

      return (await localPublicUploadExists(key)) ? url : null;
    }),
  );

  return filtered.filter((url): url is string => url !== null);
}

async function listLocalPublicUploadObjects(
  currentDir = localUploadsPublicDir,
): Promise<PublicUploadStorageObject[]> {
  const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
  const objects: PublicUploadStorageObject[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      objects.push(...(await listLocalPublicUploadObjects(fullPath)));
      continue;
    }

    if (!entry.isFile() || entry.name.endsWith(".meta.json")) {
      continue;
    }

    const relativePath = path.relative(localUploadsPublicDir, fullPath);
    if (!relativePath || relativePath.startsWith("..")) {
      continue;
    }

    const key = relativePath.split(path.sep).join("/");
    const fileStat = await stat(fullPath).catch(() => null);
    objects.push({ key, modifiedAt: fileStat?.mtimeMs ?? 0 });
  }

  return objects;
}

function normalizeStoragePrefix(prefix: string): string {
  const normalized = normalizeStorageKey(prefix);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export async function listPublicUploadStorageObjects(
  prefixes: readonly string[] = [],
): Promise<PublicUploadStorageObject[]> {
  const config = getConfig();
  const normalizedPrefixes = prefixes.map(normalizeStoragePrefix);

  if (!hasRequiredS3Config(config) || !config.bucket) {
    const objects = await listLocalPublicUploadObjects();
    return normalizedPrefixes.length === 0
      ? objects
      : objects.filter((item) => normalizedPrefixes.some((prefix) => item.key.startsWith(prefix)));
  }

  const client = createClient(config);
  const objects: PublicUploadStorageObject[] = [];
  const prefixesToScan = normalizedPrefixes.length > 0 ? normalizedPrefixes : [undefined];

  for (const prefix of prefixesToScan) {
    let continuationToken: string | undefined;

    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of response.Contents ?? []) {
        if (!item.Key || item.Key.endsWith(".meta.json")) {
          continue;
        }

        try {
          objects.push({
            key: normalizeStorageKey(item.Key),
            modifiedAt: item.LastModified?.getTime() ?? 0,
          });
        } catch {
          // Ignore invalid legacy object keys.
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return objects;
}

export async function uploadToStorage(input: UploadInput): Promise<UploadResult> {
  const config = getConfig();
  const visibility = getDefaultVisibility(input.visibility);
  const contentDisposition = getDefaultContentDisposition(input.contentDisposition, visibility);
  const normalizedKey = normalizeStorageKey(input.key);

  if (!hasRequiredS3Config(config) || !config.bucket) {
    return uploadToLocalStorage({
      ...input,
      key: normalizedKey,
      visibility,
      contentDisposition,
    });
  }

  const client = createClient(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
      Body: input.body,
      ContentType: input.contentType,
      ContentDisposition: contentDisposition,
      CacheControl: input.cacheControl ?? undefined,
    }),
  );

  return {
    url: visibility === "public" ? buildPublicUrl(normalizedKey, config) : null,
  };
}

export async function readFromStorage(key: string): Promise<StoredObject> {
  const config = getConfig();
  const normalizedKey = normalizeStorageKey(key);

  if (!hasRequiredS3Config(config) || !config.bucket) {
    return readFromLocalStorage(normalizedKey);
  }

  const client = createClient(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
    }),
  );

  const body = await readS3Body(response.Body);

  return {
    body,
    contentLength: body.byteLength,
    contentType: response.ContentType ?? "application/octet-stream",
    contentDisposition: response.ContentDisposition?.toLowerCase().startsWith("attachment")
      ? "attachment"
      : "inline",
    visibility: "private",
  };
}

export async function deleteFromStorage(key: string): Promise<void> {
  const config = getConfig();
  const normalizedKey = normalizeStorageKey(key);

  if (!hasRequiredS3Config(config) || !config.bucket) {
    await deleteFromLocalStorage(normalizedKey);
    return;
  }

  const client = createClient(config);

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
    }),
  );
}

export function getStorageKeyFromPublicUrl(url: string): string | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith("/uploads/")) {
    try {
      return normalizeStorageKey(trimmedUrl.slice("/uploads/".length));
    } catch {
      return null;
    }
  }

  const config = getConfig();
  const candidates = getManagedPublicBaseUrls(config);

  for (const base of candidates) {
    const normalizedBase = base.replace(/\/+$/, "");

    if (normalizedBase === resolveBaseUrl().replace(/\/+$/, "")) {
      try {
        const parsedUrl = new URL(trimmedUrl);
        if (parsedUrl.origin === normalizedBase && parsedUrl.pathname.startsWith("/uploads/")) {
          return normalizeStorageKey(
            decodeURIComponent(parsedUrl.pathname.slice("/uploads/".length)),
          );
        }
      } catch {
        // Continue with the managed storage base candidates below.
      }
    }

    if (!startsWithNormalizedUrl(trimmedUrl, normalizedBase)) {
      continue;
    }

    try {
      const key = trimmedUrl.slice(normalizedBase.length + 1);
      return normalizeStorageKey(decodeURIComponent(key));
    } catch {
      return null;
    }
  }

  return null;
}

export function isManagedPublicUrl(url: string): boolean {
  return getStorageKeyFromPublicUrl(url) !== null;
}

export async function deleteManagedUrlFromStorage(url: string): Promise<void> {
  const key = getStorageKeyFromPublicUrl(url);
  if (!key) {
    return;
  }

  await deleteFromStorage(key);
}
