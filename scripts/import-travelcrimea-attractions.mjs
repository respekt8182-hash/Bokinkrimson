#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "places");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicRoot = path.join(root, "public", "attractions");
const dryRun = process.argv.includes("--dry-run");
const importedAt = new Date().toISOString();

// These large natural landmarks have representative coordinates tens of
// kilometres apart in different sources, so distance-based matching alone
// cannot identify them reliably.
const knownDuplicateSources = new Map([
  ["27089", "attraction_bulganakskie_gryazevye_vulkany"],
  ["5788", "attraction_new_arabatskaya_strelka"],
]);

const decoder1251 = new TextDecoder("windows-1251");
const decoderUtf8 = new TextDecoder("utf-8", { fatal: true });
const cp1251Bytes = new Map();
for (let byte = 0; byte <= 255; byte += 1) {
  cp1251Bytes.set(decoder1251.decode(Uint8Array.of(byte)), byte);
}

function repairMojibake(value) {
  if (typeof value !== "string" || !/[РС][\u0080-\u04ff]/.test(value)) return value;
  const bytes = [];
  for (const character of value) {
    const byte = cp1251Bytes.get(character);
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  try {
    return decoderUtf8.decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

function stripServiceCodeSuffix(value) {
  if (typeof value !== "string") return value;
  return value.replace(
    /\s*\((?:[а-яё]{2,4}\.?\s*[- ]?\d{1,3}[а-яё]?(?:[./-][а-яё\d]+)?)(?:\s*[,/]\s*[а-яё]{2,4}\.?\s*[- ]?\d{1,3}[а-яё]?(?:[./-][а-яё\d]+)?)?\)\s*$/iu,
    "",
  ).trim();
}

function normalizeTitle(value) {
  return repairMojibake(value ?? "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/\s+[—-]\s+достопримечательность крыма.*$/i, "")
    .replace(/\s*\([а-я]{1,3}[- ]?\d+(?:[-./]\d+)?\)\s*$/i, "")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const genericWords = new Set([
  "автономной", "городской", "города", "дворец", "дом", "заповедник", "имени", "комплекс",
  "крым", "крыму", "музей", "мыс", "на", "памятник", "парк", "пляж", "района", "республики",
  "санатория", "сквер", "собор", "театр", "храм", "центр", "церковь",
]);

function titleTokens(value) {
  return new Set(normalizeTitle(value).split(" ").filter((word) => word.length >= 3 && !genericWords.has(word)));
}

function dice(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

function distanceKm(left, right) {
  if (![...left, ...right].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const [lat1, lon1] = left;
  const [lat2, lon2] = right;
  const y = ((lat2 - lat1) * Math.PI) / 180;
  const x = ((lon2 - lon1) * Math.PI) / 180 * Math.cos(((lat1 + lat2) * Math.PI) / 360);
  return 6371 * Math.hypot(x, y);
}

function placeFamily(title) {
  const value = normalizeTitle(title);
  const families = [
    ["beach", /(^| )(пляж|купальн)/],
    ["museum", /(^| )(музей|галерея|экспозиц)/],
    ["memorial", /(^| )(памятник|мемориал|обелиск|стела)/],
    ["religion", /(^| )(храм|собор|церковь|мечеть|монастырь|кенас)/],
    ["fortress", /(^| )(крепость|городище|башня|форт)/],
    ["park", /(^| )(парк|сквер|сад)/],
    ["water", /(^| )(водопад|озеро|водохранилище)/],
  ];
  return families.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}

function findDuplicate(source, existing) {
  const normalized = normalizeTitle(source.name);
  const tokens = titleTokens(source.name);
  const coordinates = [source.latitude, source.longitude];
  const family = placeFamily(source.name);

  for (const candidate of existing) {
    const candidateNormalized = normalizeTitle(candidate.title);
    const km = distanceKm(coordinates, [candidate.latitude, candidate.longitude]);
    const tokenScore = dice(tokens, titleTokens(candidate.title));
    const candidateFamily = placeFamily(candidate.title);
    const exactName = normalized === candidateNormalized;
    const containedName = normalized.includes(candidateNormalized) || candidateNormalized.includes(normalized);

    // A beach, park and museum belonging to the same named resort are separate places.
    if (family && candidateFamily && family !== candidateFamily) continue;
    if (exactName && (!Number.isFinite(km) || km <= 15)) return candidate;
    if (containedName && Math.min(normalized.length, candidateNormalized.length) >= 7 && km <= 2) return candidate;
    if (tokenScore >= 0.8 && km <= 5) return candidate;
    if (tokenScore >= 0.55 && km <= 0.35) return candidate;
  }
  return null;
}

const transliteration = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e",
  ю: "yu", я: "ya", ь: "", ъ: "",
};

function slugify(value) {
  return repairMojibake(value).toLocaleLowerCase("ru").split("").map((character) => transliteration[character] ?? character)
    .join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function categoryFor(place) {
  const title = normalizeTitle(place.name);
  if (place.category === "Пляжи") return "Пляжи и купание";
  if (/(храм|собор|церковь|мечеть|монастыр|кенасс)/.test(title)) return "Храмы, монастыри и религия";
  if (/(дворец|дача|усадьба|вилла|архитект)/.test(title)) return "Дворцы, дачи и архитектура";
  if (/(крепость|городище|батарея|форт|мемориал|памятник|обелиск|стела|курган)/.test(title)) return "История, археология и военные объекты";
  if (/(музей|галерея|театр|выстав)/.test(title)) return "Музеи, культура и памятники";
  if (/(водопад|озеро|водохранилище|источник)/.test(title)) return "Водопады, озёра и водоёмы";
  if (/(бухта|мыс|маяк|залив|коса)/.test(title)) return "Море, бухты, мысы и маяки";
  if (/(гора|скала|пещер|грот|каньон|перевал|яйла)/.test(title)) return "Горы, скалы и пещеры";
  if (/(заповедник|урочище|роща|лес)/.test(title)) return "Заповедники, урочища и природные парки";
  if (/(парк|сквер|набережная|вокзал|автостанция|аэропорт)/.test(title)) return "Городские прогулки, парки и инфраструктура";
  if (/(аквапарк|дельфинар|зоопарк|развлекатель)/.test(title)) return "Развлечения и семейный отдых";
  return place.category === "Природа" ? "Смотровые и маршруты" : "Музеи, культура и памятники";
}

function firstParagraph(value) {
  const text = repairMojibake(value ?? "").replace(/\r/g, "").trim();
  return text.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").slice(0, 320) || null;
}

const overrides = JSON.parse(await readFile(overridesPath, "utf8"));
const renamed = [];
for (const [id, item] of Object.entries(overrides)) {
  if (!id.startsWith("attraction_travelcrimea_")) continue;
  const oldTitle = item.title;
  const title = stripServiceCodeSuffix(oldTitle);
  if (!title || title === oldTitle) continue;

  item.title = title;
  if (item.h1 === oldTitle) item.h1 = title;
  if (item.seoTitle?.startsWith(oldTitle)) item.seoTitle = `${title}${item.seoTitle.slice(oldTitle.length)}`;
  if (item.metaDescription?.startsWith(oldTitle)) {
    item.metaDescription = `${title}${item.metaDescription.slice(oldTitle.length)}`;
  }
  item.gallery = (item.gallery ?? []).map((image) => ({
    ...image,
    alt: image.alt?.startsWith(oldTitle) ? `${title}${image.alt.slice(oldTitle.length)}` : image.alt,
  }));
  item.searchKeywords = (item.searchKeywords ?? []).map((keyword) => keyword === oldTitle ? title : keyword);
  renamed.push({ id, from: oldTitle, to: title });
}
const removed = [];
for (const sourceId of knownDuplicateSources.keys()) {
  const importedId = `attraction_travelcrimea_${sourceId}`;
  const imported = overrides[importedId];
  if (!imported) continue;

  delete overrides[importedId];
  removed.push({ id: importedId, title: imported.title });
  if (!dryRun && imported.slug) {
    await rm(path.join(publicRoot, imported.slug), { recursive: true, force: true });
  }
}
const existing = Object.entries(overrides).map(([id, value]) => ({ id, ...value }));
const usedSlugs = new Set(existing.map((item) => item.slug));
const directories = (await readdir(sourceRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
const added = [];
const skipped = [];

for (const directory of directories) {
  const directoryPath = path.join(sourceRoot, directory.name);
  const raw = JSON.parse(await readFile(path.join(directoryPath, "data.json"), "utf8"));
  const place = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, repairMojibake(value)]));
  place.name = stripServiceCodeSuffix(place.name);
  const knownDuplicate = knownDuplicateSources.get(String(place.id));
  if (knownDuplicate && overrides[knownDuplicate]) {
    skipped.push({ source: place.name, existing: overrides[knownDuplicate].title });
    continue;
  }
  const duplicate = findDuplicate(place, existing);
  if (duplicate) {
    skipped.push({ source: place.name, existing: duplicate.title });
    continue;
  }

  const id = `attraction_travelcrimea_${place.id}`;
  if (overrides[id]) {
    skipped.push({ source: place.name, existing: overrides[id].title });
    continue;
  }

  let slug = slugify(place.name) || `travelcrimea-${place.id}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${place.id}`;
  usedSlugs.add(slug);

  let description = null;
  try {
    description = repairMojibake(await readFile(path.join(directoryPath, "description.txt"), "utf8")).trim() || null;
  } catch {}

  const imageFile = place.image_file || (await readdir(directoryPath)).find((name) => /^photo\./i.test(name));
  const extension = imageFile ? path.extname(imageFile).toLowerCase() : null;
  const gallery = extension ? [{ url: `/attractions/${slug}/image-01${extension}`, alt: `${place.name} - фото` }] : [];
  const mapUrl = Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    ? `https://yandex.ru/maps/?pt=${place.longitude},${place.latitude}&z=15&l=map`
    : null;

  const record = {
    title: place.name,
    slug,
    h1: place.name,
    seoTitle: `${place.name}: фото, координаты и как добраться`,
    metaDescription: firstParagraph(description) ?? `${place.name}: адрес, координаты и расположение на карте Крыма.`,
    category: categoryFor(place),
    tags: [repairMojibake(place.category), repairMojibake(place.region)].filter(Boolean),
    locationName: repairMojibake(place.region) || null,
    locationAliases: [],
    districtName: null,
    address: repairMojibake(place.address) || null,
    latitude: Number.isFinite(place.latitude) ? place.latitude : null,
    longitude: Number.isFinite(place.longitude) ? place.longitude : null,
    shortDescription: firstParagraph(description),
    description,
    gallery,
    websiteUrl: typeof place.site === "string" && /^https?:\/\//i.test(place.site) ? place.site : null,
    mapUrl,
    facts: [], sections: [], nearby: [], faq: [],
    searchKeywords: [place.name, place.region, place.category, `travelcrimea ${place.id}`].filter(Boolean),
    status: "PUBLISHED",
    isPublishedVisible: true,
    createdByLogin: "travelcrimea-import",
    createdAt: importedAt,
    updatedAt: importedAt,
  };

  overrides[id] = record;
  existing.push({ id, ...record });
  added.push({ id, title: record.title, slug: record.slug });

  if (!dryRun && imageFile && extension) {
    const targetDirectory = path.join(publicRoot, slug);
    await mkdir(targetDirectory, { recursive: true });
    await copyFile(path.join(directoryPath, imageFile), path.join(targetDirectory, `image-01${extension}`));
  }
}

if (!dryRun) {
  await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  dryRun,
  source: directories.length,
  added: added.length,
  skipped: skipped.length,
  removed: removed.length,
  renamed: renamed.length,
}, null, 2));
console.log("Added sample:", added.slice(0, 12));
console.log("Skipped sample:", skipped.slice(0, 12));
console.log("Removed duplicates:", removed);
console.log("Renamed sample:", renamed.slice(0, 12));
