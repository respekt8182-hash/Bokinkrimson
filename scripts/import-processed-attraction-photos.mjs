import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const workflowDir = path.join(rootDir, "attractions-photo-processing");
const processedDir = path.join(workflowDir, "02-processed");
const manifestPath = path.join(workflowDir, "manifest.json");
const overridesPath = path.join(rootDir, "data", "attractions-overrides.json");
const temporaryDir = path.join(workflowDir, `.import-temp-${process.pid}`);
const allowedExtensions = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"]);
const dryRun = process.argv.includes("--dry-run");
const allowPartial = process.argv.includes("--allow-partial");

function ensureInsideWorkspace(targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside workspace: ${targetPath}`);
  }
}

async function listProcessedImages(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const images = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      images.push(...(await listProcessedImages(entryPath)));
      continue;
    }
    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      images.push(entryPath);
    }
  }

  return images;
}

async function readProcessedIndex() {
  const imagePaths = await listProcessedImages(processedDir);
  const index = new Map();

  for (const imagePath of imagePaths) {
    const extension = path.extname(imagePath).toLowerCase();
    const stem = path.basename(imagePath, extension).normalize("NFC");
    index.set(stem, [...(index.get(stem) ?? []), imagePath]);
  }

  return index;
}

async function main() {
  ensureInsideWorkspace(workflowDir);
  const [manifestRaw, overridesRaw, processedIndex] = await Promise.all([
    fs.readFile(manifestPath, "utf8"),
    fs.readFile(overridesPath, "utf8"),
    readProcessedIndex(),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const overrides = JSON.parse(overridesRaw);

  if (manifest.manifestVersion !== 1 || !Array.isArray(manifest.photos)) {
    throw new Error("Unsupported or invalid attractions photo manifest.");
  }

  const selected = [];
  const missing = [];
  for (const photo of manifest.photos) {
    const processedStem = String(photo.processedFileStem).normalize("NFC");
    const originalStem = path
      .basename(String(photo.exportedFileName), path.extname(String(photo.exportedFileName)))
      .normalize("NFC");
    const matches = [
      ...(processedIndex.get(processedStem) ?? []),
      ...(processedIndex.get(originalStem) ?? []),
    ];
    if (matches.length > 1) {
      throw new Error(
        `More than one processed file matches ${photo.exportedFileName}: ${matches.join(", ")}`,
      );
    }
    if (matches.length === 0) {
      missing.push(photo.exportedFileName);
      continue;
    }

    const attraction = overrides[photo.attractionId];
    if (!attraction || attraction.slug !== photo.slug) {
      throw new Error(`Attraction mapping changed or disappeared: ${photo.attractionId} (${photo.slug})`);
    }

    selected.push({ photo, sourcePath: matches[0], attraction });
  }

  if (missing.length > 0 && !allowPartial) {
    throw new Error(
      `Processed set is incomplete: ${missing.length} of ${manifest.photos.length} files are missing. ` +
        "Add the files or explicitly use --allow-partial.",
    );
  }
  if (selected.length === 0) throw new Error("No correctly named processed files were found.");

  const summary = {
    dryRun,
    allowPartial,
    manifestPhotos: manifest.photos.length,
    selectedPhotos: selected.length,
    missingPhotos: missing.length,
    affectedAttractions: new Set(selected.map(({ photo }) => photo.attractionId)).size,
    conversion: "rotate; fit inside 1920x1440; without enlargement; WebP quality 88, effort 5",
  };
  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await fs.rm(temporaryDir, { recursive: true, force: true });
  await fs.mkdir(temporaryDir, { recursive: true });

  try {
    const conversionConcurrency = 2;
    for (let offset = 0; offset < selected.length; offset += conversionConcurrency) {
      const batch = selected.slice(offset, offset + conversionConcurrency);
      await Promise.all(
        batch.map(async (item, batchIndex) => {
          const index = offset + batchIndex;
          const tempPath = path.join(
            temporaryDir,
            `${String(index + 1).padStart(5, "0")}.webp`,
          );
          // Upscayl 4x output can exceed the site's normal upload limit before it is resized.
          await sharp(item.sourcePath, { failOn: "error", limitInputPixels: 300_000_000 })
            .rotate()
            .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 88, effort: 5 })
            .toFile(tempPath);
          item.tempPath = tempPath;
        }),
      );
    }

    const obsoletePaths = [];
    for (const item of selected) {
      const oldPath = path.resolve(rootDir, item.photo.originalPath);
      ensureInsideWorkspace(oldPath);
      const destinationPath = path.join(path.dirname(oldPath), `${path.basename(oldPath, path.extname(oldPath))}.webp`);
      ensureInsideWorkspace(destinationPath);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.copyFile(item.tempPath, destinationPath);

      const newUrl = `/attractions/${item.photo.slug}/${path.basename(destinationPath)}`;
      item.attraction.gallery = (item.attraction.gallery ?? []).map((galleryPhoto) =>
        galleryPhoto?.url === item.photo.originalUrl ? { ...galleryPhoto, url: newUrl } : galleryPhoto,
      );
      item.attraction.updatedAt = new Date().toISOString();

      if (oldPath !== destinationPath) obsoletePaths.push(oldPath);
    }

    await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
    await Promise.all(obsoletePaths.map((targetPath) => fs.rm(targetPath, { force: true })));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await fs.rm(temporaryDir, { recursive: true, force: true });
  }
}

await main();
