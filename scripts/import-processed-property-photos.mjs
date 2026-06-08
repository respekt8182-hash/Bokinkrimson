import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const rootDir = process.cwd();
const uploadsDir = path.join(rootDir, "public", "uploads");
const defaultSourceDir = "property-photo-batches";
const allowedExtensions = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"]);
const defaultWebpQuality = 82;

function getFlagValue(flagName, fallbackValue) {
  const inlinePrefix = `${flagName}=`;
  const inlineMatch = process.argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inlineMatch) {
    return inlineMatch.slice(inlinePrefix.length);
  }

  const index = process.argv.indexOf(flagName);
  if (index >= 0) {
    const nextValue = process.argv[index + 1];
    if (nextValue && !nextValue.startsWith("--")) {
      return nextValue;
    }
  }

  return fallbackValue;
}

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

function ensureInsideWorkspace(targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside workspace: ${targetPath}`);
  }
}

function normalizeStorageKey(key) {
  const normalized = String(key ?? "")
    .replace(/\\/g, "/")
    .trim();
  if (!normalized) {
    throw new Error("Invalid empty storage key");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }

  return segments.join("/");
}

function mimeTypeFromExtension(extension) {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".avif":
      return "image/avif";
    case ".webp":
    default:
      return "image/webp";
  }
}

async function findManifestPaths(currentDir, manifestFileName) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await findManifestPaths(entryPath, manifestFileName)));
      continue;
    }

    if (entry.isFile() && entry.name === manifestFileName) {
      results.push(entryPath);
    }
  }

  return results.sort((left, right) => left.localeCompare(right, "ru"));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveReplacementPath(baseDir, expectedFileName) {
  const exactPath = path.join(baseDir, expectedFileName);
  if (await pathExists(exactPath)) {
    return exactPath;
  }

  const expectedBaseName = path.basename(expectedFileName, path.extname(expectedFileName));
  const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => allowedExtensions.has(path.extname(fileName).toLowerCase()))
    .filter((fileName) => {
      const baseName = path.basename(fileName, path.extname(fileName));
      return (
        baseName === expectedBaseName ||
        baseName.startsWith(`${expectedBaseName}-`) ||
        baseName.startsWith(`${expectedBaseName}_`)
      );
    })
    .sort((left, right) => left.localeCompare(right, "en"));

  if (candidates.length === 0) {
    return null;
  }

  return path.join(baseDir, candidates[0]);
}

async function convertBufferToTargetExtension(buffer, targetExtension, options = {}) {
  const webpQuality = options.webpQuality ?? defaultWebpQuality;
  const image = sharp(buffer, { limitInputPixels: 120_000_000 }).rotate();

  switch (targetExtension) {
    case ".jpg":
    case ".jpeg":
      return image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    case ".png":
      return image.png({ compressionLevel: 9 }).toBuffer();
    case ".avif":
      return image.avif({ quality: 70 }).toBuffer();
    case ".webp":
      return image.webp({ quality: webpQuality, effort: 5 }).toBuffer();
    default:
      throw new Error(`Unsupported target extension: ${targetExtension}`);
  }
}

async function loadBatchImportSources(sourceDir) {
  const batchManifestPaths = await findManifestPaths(sourceDir, "_batch-manifest.json");
  const sources = [];

  for (const manifestPath of batchManifestPaths) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const photos = Array.isArray(manifest.photos) ? manifest.photos : [];

    if (photos.length === 0) {
      continue;
    }

    sources.push({
      objectCount:
        Number.isInteger(manifest.objectCount) && manifest.objectCount > 0
          ? manifest.objectCount
          : new Set(photos.map((photo) => photo.propertyId)).size,
      photosDir: path.dirname(manifestPath),
      photos,
    });
  }

  return sources;
}

async function loadSingleManifestImportSource(sourceDir, manifestPath) {
  const resolvedManifestPath = path.resolve(rootDir, manifestPath);
  ensureInsideWorkspace(resolvedManifestPath);

  const manifest = JSON.parse(await fs.readFile(resolvedManifestPath, "utf8"));
  const photos = Array.isArray(manifest.photos) ? manifest.photos : [];
  const objectCount =
    Number.isInteger(manifest.objectCount) && manifest.objectCount > 0
      ? manifest.objectCount
      : new Set(photos.map((photo) => photo.propertyId)).size;

  return [
    {
      objectCount,
      photosDir: sourceDir,
      photos,
    },
  ];
}

async function loadLegacyImportSources(sourceDir) {
  const objectManifestPaths = await findManifestPaths(sourceDir, "_object-manifest.json");

  return Promise.all(
    objectManifestPaths.map(async (manifestPath) => {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      return {
        objectCount: 1,
        photosDir: path.dirname(manifestPath),
        photos: Array.isArray(manifest.photos) ? manifest.photos : [],
      };
    }),
  );
}

async function loadImportSources(sourceDir, manifestPath) {
  if (manifestPath) {
    return loadSingleManifestImportSource(sourceDir, manifestPath);
  }

  const batchSources = await loadBatchImportSources(sourceDir);
  if (batchSources.length > 0) {
    return batchSources;
  }

  return loadLegacyImportSources(sourceDir);
}

async function main() {
  const sourceDir = path.resolve(rootDir, getFlagValue("--source", defaultSourceDir));
  const manifestPath = getFlagValue("--manifest", "");
  const dryRun = hasFlag("--dry-run");
  const compress = hasFlag("--compress");
  const webpQualityRaw = Number(getFlagValue("--webp-quality", String(defaultWebpQuality)));
  const webpQuality =
    Number.isFinite(webpQualityRaw) && webpQualityRaw >= 1 && webpQualityRaw <= 100
      ? Math.round(webpQualityRaw)
      : defaultWebpQuality;
  const prisma = dryRun ? null : new PrismaClient();

  const stats = {
    sourceDir,
    manifestPath: manifestPath || null,
    dryRun,
    compress,
    webpQuality,
    objectCount: 0,
    processedFiles: 0,
    convertedFiles: 0,
    compressedFiles: 0,
    skippedMissingFiles: 0,
    inputBytes: 0,
    outputBytes: 0,
    errors: [],
  };

  try {
    const importSources = await loadImportSources(sourceDir, manifestPath);
    stats.objectCount = importSources.reduce((sum, source) => sum + source.objectCount, 0);

    if (importSources.length === 0) {
      throw new Error(`No import manifests found in ${sourceDir}`);
    }

    for (const source of importSources) {
      for (const photo of source.photos) {
        const replacementPath = await resolveReplacementPath(source.photosDir, photo.fileName);
        if (!replacementPath) {
          stats.skippedMissingFiles += 1;
          continue;
        }

        const normalizedStorageKey = normalizeStorageKey(photo.storageKey);
        const targetPath = path.join(uploadsDir, ...normalizedStorageKey.split("/"));
        const targetExtension = path.extname(targetPath).toLowerCase() || ".webp";
        const replacementExtension = path.extname(replacementPath).toLowerCase();

        ensureInsideWorkspace(targetPath);

        const replacementBuffer = await fs.readFile(replacementPath);
        stats.inputBytes += replacementBuffer.byteLength;
        const outputBuffer =
          replacementExtension === targetExtension && !compress
            ? replacementBuffer
            : await convertBufferToTargetExtension(replacementBuffer, targetExtension, {
                webpQuality,
              });
        stats.outputBytes += outputBuffer.byteLength;

        if (replacementExtension !== targetExtension) {
          stats.convertedFiles += 1;
        }
        if (compress) {
          stats.compressedFiles += 1;
        }

        if (!dryRun) {
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, outputBuffer);

          await prisma.media.update({
            where: { id: photo.mediaId },
            data: {
              fileSize: outputBuffer.byteLength,
              mimeType: mimeTypeFromExtension(targetExtension),
            },
          });
        }

        stats.processedFiles += 1;
      }
    }

    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    stats.errors.push(error instanceof Error ? error.message : String(error));
    console.log(JSON.stringify(stats, null, 2));
    process.exitCode = 1;
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

await main();
