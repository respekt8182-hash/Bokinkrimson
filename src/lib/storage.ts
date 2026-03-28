// Storage adapter: writes files to S3 when configured, otherwise falls back to local public/uploads in development.
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

type UploadInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

const localUploadsPublicDir = path.join(process.cwd(), "public", "uploads");

function normalizeStorageKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function uploadToLocalStorage(input: UploadInput): Promise<{ url: string }> {
  const normalizedKey = normalizeStorageKey(input.key);
  const fullPath = path.join(localUploadsPublicDir, ...normalizedKey.split("/"));
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, input.body);
  return {
    url: `/uploads/${normalizedKey}`,
  };
}

async function deleteFromLocalStorage(key: string): Promise<void> {
  const normalizedKey = normalizeStorageKey(key);
  const fullPath = path.join(localUploadsPublicDir, ...normalizedKey.split("/"));
  await unlink(fullPath).catch(() => null);
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

export function isStorageConfigured(): boolean {
  return hasRequiredS3Config(getConfig());
}

export async function uploadToStorage(input: UploadInput): Promise<{ url: string }> {
  const config = getConfig();

  if (!hasRequiredS3Config(config) || !config.bucket) {
    // Local dev fallback when S3 credentials are missing.
    return uploadToLocalStorage(input);
  }

  const client = createClient(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );

  return {
    url: buildPublicUrl(input.key, config),
  };
}

export async function deleteFromStorage(key: string): Promise<void> {
  const config = getConfig();

  if (!hasRequiredS3Config(config) || !config.bucket) {
    await deleteFromLocalStorage(key);
    return;
  }

  const client = createClient(config);

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}
