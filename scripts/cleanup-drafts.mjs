/**
 * CLI utility: delete property drafts older than 14 days, including storage files.
 *
 * Usage:
 *   node scripts/cleanup-drafts.mjs [--dry-run]
 *
 * Requires DATABASE_URL in the environment (reads from .env automatically via Prisma).
 * For S3 deletion: also set S3_* env vars.
 */
import { PrismaClient } from "@prisma/client";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RETENTION_DAYS = 14;
const DRY_RUN = process.argv.includes("--dry-run");

async function deleteFile(storageKey) {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (bucket && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  } else {
    const key = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    const fullPath = path.join(__dirname, "..", "public", "uploads", ...key.split("/"));
    await unlink(fullPath).catch(() => null);
  }
}

async function main() {
  const db = new PrismaClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const drafts = await db.property.findMany({
    where: { ownerDeletedAt: null, status: "draft", updatedAt: { lt: cutoff } },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      media: { select: { storageKey: true } },
      rooms: { select: { media: { select: { storageKey: true } } } },
      documents: { select: { storageKey: true } },
    },
  });

  if (drafts.length === 0) {
    console.log("No expired drafts found.");
    await db.$disconnect();
    return;
  }

  console.log(
    `Found ${drafts.length} expired draft(s)${DRY_RUN ? " [DRY RUN — no changes]" : ""}:`,
  );
  for (const p of drafts) {
    const files =
      p.media.length +
      p.rooms.reduce((acc, r) => acc + r.media.length, 0) +
      p.documents.length;
    console.log(
      `  - ${p.id}  "${p.name ?? "(no name)"}"  updated=${p.updatedAt.toISOString()}  files=${files}`,
    );
  }

  if (DRY_RUN) {
    await db.$disconnect();
    return;
  }

  const storageKeys = drafts.flatMap((p) => [
    ...p.media.map((m) => m.storageKey),
    ...p.rooms.flatMap((r) => r.media.map((m) => m.storageKey)),
    ...p.documents.map((d) => d.storageKey),
  ]);

  await Promise.all(
    storageKeys.map((key) =>
      deleteFile(key).catch((err) => console.warn(`  ! Failed to delete ${key}: ${err.message}`)),
    ),
  );
  console.log(`Deleted ${storageKeys.length} file(s) from storage.`);

  const { count } = await db.property.deleteMany({
    where: { id: { in: drafts.map((p) => p.id) } },
  });
  console.log(`Deleted ${count} property record(s) from the database.`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
