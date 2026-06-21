import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "новые");
const placesDir = path.join(root, "places");
const publicDir = path.join(root, "public", "attractions");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const removedSlug = "plyazh-ooo-ist-investments-yal-4";
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function normalizeTitle(value) {
  return value
    .normalize("NFC")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLocaleLowerCase("ru");
}

async function readSourceImages() {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({
      fileName: entry.name,
      title: path.basename(entry.name, path.extname(entry.name)),
      sourcePath: path.join(sourceDir, entry.name),
    }));
}

async function readTravelCrimeaPlaceIndex() {
  const entries = await fs.readdir(placesDir, { withFileTypes: true });
  const index = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dataPath = path.join(placesDir, entry.name, "data.json");
    let place;
    try {
      place = JSON.parse(await fs.readFile(dataPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const key = normalizeTitle(place.name ?? "");
    const matches = index.get(key) ?? [];
    matches.push(`${place.id}`);
    index.set(key, matches);
  }

  return index;
}

async function main() {
  const [sourceImages, placeIndex, overridesRaw] = await Promise.all([
    readSourceImages(),
    readTravelCrimeaPlaceIndex(),
    fs.readFile(overridesPath, "utf8"),
  ]);
  const overrides = JSON.parse(overridesRaw);
  const removedEntry = Object.entries(overrides).find(([, value]) => value?.slug === removedSlug);

  if (!removedEntry) {
    throw new Error(`Attraction to remove was not found: ${removedSlug}`);
  }
  delete overrides[removedEntry[0]];

  const updated = [];
  for (const image of sourceImages) {
    const placeIds = placeIndex.get(normalizeTitle(image.title)) ?? [];
    if (placeIds.length === 0) {
      throw new Error(`No Travel Crimea place matches image: ${image.fileName}`);
    }

    let matchedAttractions = 0;
    for (const placeId of placeIds) {
      const id = `attraction_travelcrimea_${placeId}`;
      const attraction = overrides[id];
      if (!attraction) continue;
      matchedAttractions += 1;

      const destinationDir = path.join(publicDir, attraction.slug);
      const destinationPath = path.join(destinationDir, "photo-new.webp");
      await fs.mkdir(destinationDir, { recursive: true });
      await sharp(image.sourcePath)
        .rotate()
        .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(destinationPath);

      attraction.gallery = [
        {
          url: `/attractions/${attraction.slug}/photo-new.webp`,
          alt: attraction.title,
        },
      ];
      attraction.updatedAt = new Date().toISOString();
      updated.push({ id, slug: attraction.slug, source: image.fileName });
    }

    if (matchedAttractions === 0) {
      throw new Error(`No catalog attraction matches image: ${image.fileName}`);
    }
  }

  await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  await fs.rm(path.join(publicDir, removedSlug), { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        removed: { id: removedEntry[0], slug: removedSlug },
        sourceImages: sourceImages.length,
        updatedAttractions: updated.length,
        updated,
      },
      null,
      2,
    ),
  );
}

await main();
