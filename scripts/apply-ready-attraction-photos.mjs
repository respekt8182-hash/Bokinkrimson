import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "готовые");
const placesDir = path.join(root, "places");
const publicDir = path.join(root, "public", "attractions");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

// The supplied names use abbreviations that differ from the Travel Crimea titles.
const explicitPlaceIds = new Map([
  ["аива тур", ["3279641"]],
  ["пляж сз таврида строй", ["3295961"]],
  ["пляж вдц алые паруса", ["3295066"]],
  ["пляж дома отдыха семидворье", ["3658514"]],
  ["пляж доц жемчужный берег", ["3277622"]],
  ["пляж доц фортуна", ["3296109"]],
  ["пляж ооо пкк крымские здравницы", ["3277589"]],
  ["пляж пансионата россия", ["3659385"]],
]);

function normalizeTitle(value) {
  return value
    .normalize("NFC")
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/[\u00ab\u00bb„“”"']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("ru");
}

function parseSourceTitle(fileName) {
  const title = path.basename(fileName, path.extname(fileName));
  const locationMatch = title.match(/\s*\((Алушта|Евпатория)\)\s*$/u);
  return {
    title: locationMatch ? title.slice(0, locationMatch.index).trim() : title,
    location: locationMatch?.[1] ?? null,
  };
}

async function readPlaceIndex() {
  const entries = await fs.readdir(placesDir, { withFileTypes: true });
  const index = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const place = JSON.parse(
        await fs.readFile(path.join(placesDir, entry.name, "data.json"), "utf8"),
      );
      const key = normalizeTitle(place.name ?? "");
      index.set(key, [...(index.get(key) ?? []), `${place.id}`]);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  return index;
}

async function main() {
  const [entries, placeIndex, overridesRaw] = await Promise.all([
    fs.readdir(sourceDir, { withFileTypes: true }),
    readPlaceIndex(),
    fs.readFile(overridesPath, "utf8"),
  ]);
  const overrides = JSON.parse(overridesRaw);
  const sourceImages = entries.filter(
    (entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()),
  );
  const updated = [];
  const updatedIds = new Set();

  for (const entry of sourceImages) {
    const parsed = parseSourceTitle(entry.name);
    const key = normalizeTitle(parsed.title);
    const placeIds = explicitPlaceIds.get(key) ?? placeIndex.get(key) ?? [];
    let matches = placeIds
      .map((placeId) => [`attraction_travelcrimea_${placeId}`, overrides[`attraction_travelcrimea_${placeId}`]])
      .filter(([, attraction]) => attraction);

    if (parsed.location) {
      matches = matches.filter(([, attraction]) => attraction.locationName === parsed.location);
    }
    if (matches.length === 0) {
      throw new Error(`No catalog attraction matches image: ${entry.name}`);
    }

    for (const [id, attraction] of matches) {
      if (updatedIds.has(id)) {
        throw new Error(`Attraction matched by more than one image: ${id}`);
      }

      const destinationDir = path.join(publicDir, attraction.slug);
      const destinationPath = path.join(destinationDir, "photo-ready.webp");
      await fs.mkdir(destinationDir, { recursive: true });
      await sharp(path.join(sourceDir, entry.name))
        .rotate()
        .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(destinationPath);

      const newPhoto = {
        url: `/attractions/${attraction.slug}/photo-ready.webp`,
        alt: attraction.title,
      };
      const remainingGallery = (attraction.gallery ?? [])
        .slice(1)
        .filter((photo) => photo?.url !== newPhoto.url);
      attraction.gallery = [newPhoto, ...remainingGallery];
      attraction.updatedAt = new Date().toISOString();
      updatedIds.add(id);
      updated.push({ id, title: attraction.title, slug: attraction.slug, source: entry.name });
    }
  }

  await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
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
