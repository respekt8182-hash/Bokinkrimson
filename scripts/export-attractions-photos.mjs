import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const overridesPath = path.join(rootDir, "data", "attractions-overrides.json");
const attractionsDir = path.join(rootDir, "public", "attractions");
const outputDir = path.join(rootDir, "attractions-unified-photos");

const allowedExtensions = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"]);
const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

function sanitizeFileSegment(value) {
  return value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function compareNames(left, right) {
  return collator.compare(left, right);
}

function ensureInsideRoot(targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside workspace: ${targetPath}`);
  }
}

async function readAttractions() {
  const raw = JSON.parse(await fs.readFile(overridesPath, "utf8"));
  const published = Object.values(raw).filter(
    (item) => item?.status === "PUBLISHED" && item?.isPublishedVisible === true && item?.slug,
  );

  const titleCounts = new Map();
  for (const item of published) {
    const key = `${item.title ?? item.slug}`;
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  return published
    .map((item) => {
      const baseTitle = item.title?.trim() || item.slug;
      const duplicateCount = titleCounts.get(baseTitle) ?? 0;
      const suffix = duplicateCount > 1 && item.locationName ? ` (${item.locationName})` : "";

      return {
        slug: item.slug,
        title: baseTitle,
        displayName: `${baseTitle}${suffix}`,
        gallery: Array.isArray(item.gallery) ? item.gallery : [],
      };
    })
    .sort((left, right) => compareNames(left.displayName, right.displayName));
}

async function listLocalImages(slug) {
  const slugDir = path.join(attractionsDir, slug);

  let dirEntries;
  try {
    dirEntries = await fs.readdir(slugDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => allowedExtensions.has(path.extname(name).toLowerCase()))
    .filter((name) => name.toLowerCase() !== "zaglushka.png")
    .sort(compareNames);
}

function buildOrderedImageList(slug, gallery, localFiles) {
  const localSet = new Set(localFiles);
  const ordered = [];

  for (const image of gallery) {
    const url = typeof image?.url === "string" ? image.url : "";
    if (!url.startsWith(`/attractions/${slug}/`)) {
      continue;
    }

    const fileName = path.basename(url);
    if (localSet.has(fileName)) {
      ordered.push(fileName);
      localSet.delete(fileName);
    }
  }

  const remaining = [...localSet].sort(compareNames);
  return [...ordered, ...remaining];
}

async function main() {
  ensureInsideRoot(outputDir);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const attractions = await readAttractions();
  const missingTitles = [];
  let copiedFiles = 0;

  for (const [index, attraction] of attractions.entries()) {
    const localFiles = await listLocalImages(attraction.slug);
    const orderedFiles = buildOrderedImageList(attraction.slug, attraction.gallery, localFiles);

    if (!orderedFiles.length) {
      missingTitles.push(attraction.displayName);
      continue;
    }

    for (const [photoIndex, fileName] of orderedFiles.entries()) {
      const sourcePath = path.join(attractionsDir, attraction.slug, fileName);
      const destinationName = `${index + 1}.${photoIndex + 1} ${sanitizeFileSegment(attraction.displayName)}${path.extname(fileName).toLowerCase()}`;
      const destinationPath = path.join(outputDir, destinationName);

      await fs.copyFile(sourcePath, destinationPath);
      copiedFiles += 1;
    }
  }

  const report = {
    outputDir,
    totalAttractions: attractions.length,
    copiedFiles,
    attractionsWithPhotos: attractions.length - missingTitles.length,
    attractionsWithoutPhotos: missingTitles.length,
    missingTitles,
  };

  console.log(JSON.stringify(report, null, 2));
}

await main();
