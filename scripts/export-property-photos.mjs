import fs from "node:fs/promises";
import path from "node:path";
import { MediaType, PrismaClient, PropertyStatus } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();
const uploadsDir = path.join(rootDir, "public", "uploads");
const defaultOutputDir = "property-photo-batches";
const defaultFirstBatchSize = 50;

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

function ensureInsideWorkspace(targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to access path outside workspace: ${targetPath}`);
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

function toWorkspaceRelative(targetPath) {
  return path.relative(rootDir, targetPath).split(path.sep).join("/");
}

function padNumber(value, length) {
  return String(value).padStart(length, "0");
}

function buildBatchDirName(batchNumber, startIndex, endIndex) {
  return `batch-${padNumber(batchNumber, 2)}-objects-${padNumber(startIndex, 3)}-${padNumber(endIndex, 3)}`;
}

function getPhotoFileExtension(media) {
  const extensionFromUrl = path.extname(media.url ?? "").toLowerCase();
  if (extensionFromUrl) {
    return extensionFromUrl;
  }

  const extensionFromStorageKey = path.extname(media.storageKey ?? "").toLowerCase();
  if (extensionFromStorageKey) {
    return extensionFromStorageKey;
  }

  if (typeof media.mimeType === "string") {
    if (media.mimeType === "image/jpeg") {
      return ".jpg";
    }
    if (media.mimeType === "image/png") {
      return ".png";
    }
    if (media.mimeType === "image/avif") {
      return ".avif";
    }
  }

  return ".webp";
}

function buildFlatPhotoFileName(input) {
  const scopeSegment = input.roomSequence === null ? "scope-object" : `scope-room-${padNumber(input.roomSequence, 2)}`;
  const roomIdSegment = input.roomId ? `roomid-${input.roomId}` : null;

  return [
    `obj-${padNumber(input.globalIndex, 3)}`,
    `pub-${input.publicId === null ? "none" : input.publicId}`,
    `property-${input.propertyId}`,
    scopeSegment,
    roomIdSegment,
    `media-${input.mediaId}`,
    `photo-${padNumber(input.photoIndex, 3)}`,
  ]
    .filter(Boolean)
    .join("__")
    .concat(input.extension);
}

async function existsFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function normalizeComparableName(value) {
  return String(value ?? "").normalize("NFC");
}

function buildFileStemPrefixes(fileName) {
  const extension = path.extname(fileName);
  const stem = path.basename(fileName, extension);
  const parts = stem.split("-");
  const prefixes = [];

  for (let index = parts.length; index >= 1; index -= 1) {
    prefixes.push(parts.slice(0, index).join("-"));
  }

  return {
    extension,
    prefixes,
  };
}

async function findExistingSourcePath(storageKey) {
  const exactPath = path.join(uploadsDir, ...storageKey.split("/"));
  if (await existsFile(exactPath)) {
    return exactPath;
  }

  const directoryPath = path.dirname(exactPath);
  const expectedFileName = path.basename(exactPath);
  const expectedComparable = normalizeComparableName(expectedFileName);
  const dirEntries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
  const fileNames = dirEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  const exactNameMatch = fileNames.find(
    (name) => normalizeComparableName(name) === expectedComparable,
  );
  if (exactNameMatch) {
    return path.join(directoryPath, exactNameMatch);
  }

  const { extension, prefixes } = buildFileStemPrefixes(expectedFileName);
  const normalizedExtension = extension.toLowerCase();

  for (const prefix of prefixes) {
    const comparablePrefix = normalizeComparableName(prefix);
    const candidates = fileNames.filter((name) => {
      if (path.extname(name).toLowerCase() !== normalizedExtension) {
        return false;
      }

      return normalizeComparableName(path.basename(name, path.extname(name))).startsWith(
        comparablePrefix,
      );
    });

    if (candidates.length === 1) {
      return path.join(directoryPath, candidates[0]);
    }
  }

  return null;
}

async function copyPropertyPhoto(storageKey, destinationPath) {
  const exactSourcePath = path.join(uploadsDir, ...storageKey.split("/"));

  try {
    await fs.copyFile(exactSourcePath, destinationPath);
    return {
      sourcePath: exactSourcePath,
      matchedBy: "exact",
    };
  } catch (error) {
    const fallbackSourcePath = await findExistingSourcePath(storageKey);
    if (!fallbackSourcePath) {
      const fallbackError = new Error(`Source file not found for storage key: ${storageKey}`);
      fallbackError.cause = error;
      throw fallbackError;
    }

    await fs.copyFile(fallbackSourcePath, destinationPath);
    return {
      sourcePath: fallbackSourcePath,
      matchedBy: "fallback",
    };
  }
}

async function loadPublishedProperties() {
  return prisma.property.findMany({
    where: {
      status: PropertyStatus.PUBLISHED,
      isPublishedVisible: true,
      media: {
        some: {
          type: MediaType.IMAGE,
        },
      },
    },
    orderBy: [{ publicId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      publicId: true,
      name: true,
      locationName: true,
      rooms: {
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
        },
      },
      media: {
        where: {
          type: MediaType.IMAGE,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          roomId: true,
          url: true,
          storageKey: true,
          mimeType: true,
          fileSize: true,
          sortOrder: true,
          originalName: true,
        },
      },
    },
  });
}

function splitIntoTwoBatches(items, firstBatchSize) {
  const firstBatch = items.slice(0, firstBatchSize);
  const secondBatch = items.slice(firstBatchSize);

  return [firstBatch, secondBatch].filter((batch) => batch.length > 0);
}

function buildReadmeText() {
  return [
    "Property photo batches",
    "======================",
    "",
    "Each batch folder contains all images in one flat list without object subfolders.",
    "The image file name contains the object number, public id, property id, scope, room identifier, media id, and photo order.",
    "",
    "Examples:",
    "obj-001__pub-1002__property-<propertyId>__scope-object__media-<mediaId>__photo-001.webp",
    "obj-001__pub-1002__property-<propertyId>__scope-room-01__roomid-<roomId>__media-<mediaId>__photo-002.webp",
    "",
    "You may improve the images in place or in a copied folder tree.",
    "Keep the base file names unchanged. The extension may change if your processing tool outputs another format.",
    "",
    "To import processed images back into the project, run:",
    "node scripts/import-processed-property-photos.mjs --source <path-to-processed-folder>",
    "",
    "The import script writes the processed images back to public/uploads and updates Media.fileSize and Media.mimeType in the database.",
    "",
  ].join("\n");
}

async function main() {
  const firstBatchSizeRaw = Number(getFlagValue("--first-batch-size", String(defaultFirstBatchSize)));
  const firstBatchSize =
    Number.isInteger(firstBatchSizeRaw) && firstBatchSizeRaw > 0
      ? firstBatchSizeRaw
      : defaultFirstBatchSize;
  const outputDir = path.resolve(rootDir, getFlagValue("--out", defaultOutputDir));

  ensureInsideWorkspace(outputDir);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "README.txt"), buildReadmeText(), "utf8");

  const properties = await loadPublishedProperties();
  const batches = splitIntoTwoBatches(properties, firstBatchSize);
  const exportStartedAt = new Date().toISOString();

  let totalExportedPhotos = 0;
  let totalMissingPhotos = 0;
  let totalRecoveredPhotos = 0;
  const missingPhotosReport = [];
  const rootManifest = {
    manifestVersion: 2,
    exportStartedAt,
    layout: "flat-batch-folders",
    workspaceRoot: rootDir,
    originalUploadsRoot: toWorkspaceRelative(uploadsDir),
    totalObjects: properties.length,
    totalBatches: batches.length,
    batches: [],
  };

  let globalIndexOffset = 0;

  for (const [batchIndex, batchItems] of batches.entries()) {
    const batchNumber = batchIndex + 1;
    const batchStartIndex = globalIndexOffset + 1;
    const batchEndIndex = globalIndexOffset + batchItems.length;
    const batchDirName = buildBatchDirName(batchNumber, batchStartIndex, batchEndIndex);
    const batchDir = path.join(outputDir, batchDirName);

    ensureInsideWorkspace(batchDir);
    await fs.mkdir(batchDir, { recursive: true });

    let batchPhotoCount = 0;
    let batchMissingPhotos = 0;
    const batchManifest = {
      manifestVersion: 2,
      exportStartedAt,
      layout: "flat",
      batchNumber,
      batchDirName,
      objectRange: {
        start: batchStartIndex,
        end: batchEndIndex,
      },
      objectCount: batchItems.length,
      photoCount: 0,
      missingPhotoCount: 0,
      objects: [],
      photos: [],
      missingPhotos: [],
    };

    for (const [propertyIndex, property] of batchItems.entries()) {
      const globalIndex = globalIndexOffset + propertyIndex + 1;
      const roomSequenceById = new Map(property.rooms.map((room, roomIndex) => [room.id, roomIndex + 1]));
      const roomTitleById = new Map(property.rooms.map((room) => [room.id, room.title]));
      const objectSummary = {
        globalIndex,
        propertyId: property.id,
        publicId: property.publicId,
        name: property.name,
        locationName: property.locationName,
        roomCount: property.rooms.length,
        photoCount: 0,
        missingPhotoCount: 0,
      };

      batchManifest.objects.push(objectSummary);

      for (const [mediaIndex, media] of property.media.entries()) {
        const normalizedStorageKey = normalizeStorageKey(media.storageKey);
        const extension = getPhotoFileExtension(media);
        const roomSequence =
          media.roomId && roomSequenceById.has(media.roomId) ? roomSequenceById.get(media.roomId) : null;
        const roomTitle = media.roomId ? roomTitleById.get(media.roomId) ?? null : null;
        const fileName = buildFlatPhotoFileName({
          globalIndex,
          publicId: property.publicId,
          propertyId: property.id,
          roomSequence,
          roomId: media.roomId,
          mediaId: media.id,
          photoIndex: mediaIndex + 1,
          extension,
        });
        const destinationPath = path.join(batchDir, fileName);

        ensureInsideWorkspace(destinationPath);

        try {
          const copiedPhoto = await copyPropertyPhoto(normalizedStorageKey, destinationPath);
          const originalLocalPath = toWorkspaceRelative(copiedPhoto.sourcePath);

          if (copiedPhoto.matchedBy === "fallback") {
            totalRecoveredPhotos += 1;
          }

          const photoRecord = {
            globalIndex,
            batchNumber,
            propertyId: property.id,
            publicId: property.publicId,
            propertyName: property.name,
            locationName: property.locationName,
            photoIndex: mediaIndex + 1,
            fileName,
            sourceKind: media.roomId ? "room" : "property",
            roomId: media.roomId,
            roomSequence,
            roomTitle,
            mediaId: media.id,
            storageKey: normalizedStorageKey,
            url: media.url,
            mimeType: media.mimeType,
            originalName: media.originalName,
            originalFileSize: media.fileSize,
            sortOrder: media.sortOrder,
            originalLocalPath,
            pathMatchStrategy: copiedPhoto.matchedBy,
          };

          batchManifest.photos.push(photoRecord);
          objectSummary.photoCount += 1;
          totalExportedPhotos += 1;
          batchPhotoCount += 1;
        } catch {
          const missingPhotoRecord = {
            globalIndex,
            batchNumber,
            propertyId: property.id,
            publicId: property.publicId,
            mediaId: media.id,
            roomId: media.roomId,
            roomSequence,
            roomTitle,
            photoIndex: mediaIndex + 1,
            expectedFileName: fileName,
            storageKey: normalizedStorageKey,
            sourcePath: toWorkspaceRelative(path.join(uploadsDir, ...normalizedStorageKey.split("/"))),
          };

          batchManifest.missingPhotos.push(missingPhotoRecord);
          objectSummary.missingPhotoCount += 1;
          totalMissingPhotos += 1;
          batchMissingPhotos += 1;
          continue;
        }
      }

      if (objectSummary.missingPhotoCount > 0) {
        missingPhotosReport.push({
          globalIndex,
          batchNumber,
          propertyId: property.id,
          publicId: property.publicId,
          name: property.name,
          locationName: property.locationName,
          missingPhotos: batchManifest.missingPhotos.filter((item) => item.propertyId === property.id),
        });
      }
    }

    batchManifest.photoCount = batchPhotoCount;
    batchManifest.missingPhotoCount = batchMissingPhotos;

    await fs.writeFile(
      path.join(batchDir, "_batch-manifest.json"),
      JSON.stringify(batchManifest, null, 2),
      "utf8",
    );

    rootManifest.batches.push({
      batchNumber,
      directoryName: batchDirName,
      objectRange: {
        start: batchStartIndex,
        end: batchEndIndex,
      },
      objectCount: batchItems.length,
      photoCount: batchPhotoCount,
      missingPhotoCount: batchMissingPhotos,
    });

    globalIndexOffset += batchItems.length;
  }

  rootManifest.totalPhotos = totalExportedPhotos;
  rootManifest.totalMissingPhotos = totalMissingPhotos;
  rootManifest.totalRecoveredPhotos = totalRecoveredPhotos;

  await fs.writeFile(
    path.join(outputDir, "_export-manifest.json"),
    JSON.stringify(rootManifest, null, 2),
    "utf8",
  );

  await fs.writeFile(
    path.join(outputDir, "_missing-photos-report.json"),
    JSON.stringify(
      {
        generatedAt: exportStartedAt,
        affectedObjects: missingPhotosReport.length,
        totalMissingPhotos,
        objects: missingPhotosReport,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        outputDir,
        totalObjects: rootManifest.totalObjects,
        totalBatches: rootManifest.totalBatches,
        totalPhotos: totalExportedPhotos,
        totalRecoveredPhotos,
        totalMissingPhotos,
        batches: rootManifest.batches,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
