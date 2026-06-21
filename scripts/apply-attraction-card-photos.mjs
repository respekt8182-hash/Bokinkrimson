import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.resolve(root, process.argv[2] ?? "новое 67");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicDir = path.join(root, "public", "attractions");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const titleAliases = new Map([
  ["дельфинарий немо в алуште", "delfinariy-nemo-alushta"],
]);

function normalizeTitle(value) {
  return value
    .normalize("NFC")
    .replace(/_upscayl.*$/iu, "")
    .replace(/[«»„“”"']/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("ru");
}

function preferSource(left, right) {
  const leftUpscaled = /_upscayl/iu.test(left.name);
  const rightUpscaled = /_upscayl/iu.test(right.name);
  if (leftUpscaled !== rightUpscaled) return rightUpscaled ? right : left;
  throw new Error(`More than one source image matches the same attraction: ${left.name}, ${right.name}`);
}

async function main() {
  const [entries, overridesRaw] = await Promise.all([
    fs.readdir(sourceDir, { withFileTypes: true }),
    fs.readFile(overridesPath, "utf8"),
  ]);
  const overrides = JSON.parse(overridesRaw);
  const attractions = Object.entries(overrides);
  const sourcesByTitle = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const title = path.basename(entry.name, path.extname(entry.name));
    const key = normalizeTitle(title);
    const source = { name: entry.name, path: path.join(sourceDir, entry.name) };
    const previous = sourcesByTitle.get(key);
    sourcesByTitle.set(key, previous ? preferSource(previous, source) : source);
  }

  const updated = [];
  for (const [sourceTitle, source] of sourcesByTitle) {
    const aliasSlug = titleAliases.get(sourceTitle);
    const matches = attractions.filter(([, attraction]) =>
      aliasSlug ? attraction.slug === aliasSlug : normalizeTitle(attraction.title ?? "") === sourceTitle,
    );
    if (matches.length !== 1) {
      throw new Error(
        `${matches.length ? "Ambiguous" : "No"} catalog match for ${source.name}: ${matches
          .map(([, attraction]) => attraction.slug)
          .join(", ")}`,
      );
    }

    const [id, attraction] = matches[0];
    const destinationDir = path.join(publicDir, attraction.slug);
    const destinationName = "card-new.webp";
    const destinationPath = path.join(destinationDir, destinationName);
    await fs.mkdir(destinationDir, { recursive: true });
    await sharp(source.path)
      .rotate()
      .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(destinationPath);

    const photo = {
      url: `/attractions/${attraction.slug}/${destinationName}`,
      alt: attraction.title,
    };
    attraction.gallery = [photo];
    attraction.updatedAt = new Date().toISOString();
    updated.push({ id, title: attraction.title, slug: attraction.slug, source: source.name });
  }

  await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ sourceFiles: entries.length, updatedAttractions: updated.length, updated }, null, 2));
}

await main();
