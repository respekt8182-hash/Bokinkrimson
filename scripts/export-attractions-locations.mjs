import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "data", "attractions-overrides.json");
const outputDir = path.join(rootDir, "dostoprimechatelnosti-teksty");
const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

function sanitizeFileName(value) {
  return value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 180);
}

function formatLocation(item) {
  const parts = [item.locationName, item.address]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  if (parts.length) {
    return parts.join(", ");
  }

  if (Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) {
    return `координаты: ${item.latitude}, ${item.longitude}`;
  }

  return "местоположение не указано";
}

function buildFileNames(attractions) {
  const titleCounts = new Map();
  for (const item of attractions) {
    const key = item.title.toLocaleLowerCase("ru");
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  const usedNames = new Set();
  return attractions.map((item) => {
    const titleKey = item.title.toLocaleLowerCase("ru");
    const needsLocation = (titleCounts.get(titleKey) ?? 0) > 1;
    const locationSuffix = needsLocation && item.locationName ? ` (${item.locationName})` : "";
    let baseName = sanitizeFileName(`${item.title}${locationSuffix}`) || item.slug;
    let uniqueKey = baseName.toLocaleLowerCase("ru");

    if (usedNames.has(uniqueKey)) {
      baseName = sanitizeFileName(`${baseName} (${item.slug})`);
      uniqueKey = baseName.toLocaleLowerCase("ru");
    }

    usedNames.add(uniqueKey);
    return { ...item, fileName: `${baseName}.txt` };
  });
}

async function main() {
  const raw = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const attractions = Object.values(raw)
    .filter(
      (item) =>
        item?.status === "PUBLISHED" &&
        item?.isPublishedVisible === true &&
        typeof item?.title === "string" &&
        typeof item?.slug === "string",
    )
    .map((item) => ({
      title: item.title.trim(),
      slug: item.slug,
      locationName: item.locationName,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    }))
    .sort((left, right) => collator.compare(left.title, right.title));

  await fs.mkdir(outputDir, { recursive: true });

  for (const item of buildFileNames(attractions)) {
    const content = `Название: ${item.title}\nМестоположение: ${formatLocation(item)}\n`;
    await fs.writeFile(path.join(outputDir, item.fileName), content, "utf8");
  }

  console.log(`Создано файлов: ${attractions.length}`);
  console.log(`Папка: ${outputDir}`);
}

await main();
