import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const slug = process.argv[2]?.trim();

if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  throw new Error("Usage: node scripts/remove-attraction-by-slug.mjs <slug>");
}

const overridesPath = path.join(root, "data", "attractions-overrides.json");
const overrides = JSON.parse(await fs.readFile(overridesPath, "utf8"));
const matches = Object.entries(overrides).filter(([, attraction]) => attraction?.slug === slug);

if (matches.length !== 1) {
  throw new Error(`Expected one attraction for slug ${slug}, found ${matches.length}`);
}

const [[id, attraction]] = matches;
delete overrides[id];

await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
await fs.rm(path.join(root, "public", "attractions", slug), { recursive: true, force: true });

console.log(JSON.stringify({ id, slug, title: attraction.title }, null, 2));
