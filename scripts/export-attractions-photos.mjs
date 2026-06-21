import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const overridesPath = path.join(rootDir, "data", "attractions-overrides.json");
const attractionsDir = path.join(rootDir, "public", "attractions");
const outputDir = path.join(rootDir, "attractions-photo-processing");
const originalsDir = path.join(outputDir, "01-originals");
const processedDir = path.join(outputDir, "02-processed");
const manifestPath = path.join(outputDir, "manifest.json");
const readmePath = path.join(outputDir, "README.md");

const allowedExtensions = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"]);
const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });
const force = process.argv.includes("--force");

function ensureInsideWorkspace(targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside workspace: ${targetPath}`);
  }
}

function toWorkspacePath(targetPath) {
  return path.relative(rootDir, targetPath).split(path.sep).join("/");
}

function sanitizeFileSegment(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120)
    .replace(/[. ]+$/g, "");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(targetPath) {
  const bytes = await fs.readFile(targetPath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function readAttractions() {
  const raw = JSON.parse(await fs.readFile(overridesPath, "utf8"));

  return Object.entries(raw)
    .filter(([, item]) => item?.slug)
    .map(([id, item]) => ({
      id,
      slug: item.slug,
      title: item.title?.trim() || item.slug,
      status: item.status ?? null,
      isPublishedVisible: item.isPublishedVisible === true,
      gallery: Array.isArray(item.gallery) ? item.gallery : [],
    }))
    .sort((left, right) =>
      collator.compare(left.title, right.title) || collator.compare(left.slug, right.slug),
    );
}

async function listLocalImages(slug) {
  const directoryPath = path.join(attractionsDir, slug);
  const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => allowedExtensions.has(path.extname(name).toLowerCase()))
    .filter((name) => name.toLowerCase() !== "zaglushka.png")
    .sort((left, right) => collator.compare(left, right));
}

function orderImages(attraction, localFiles) {
  const remaining = new Set(localFiles);
  const ordered = [];

  for (const photo of attraction.gallery) {
    const url = typeof photo?.url === "string" ? photo.url : "";
    const prefix = `/attractions/${attraction.slug}/`;
    if (!url.startsWith(prefix)) continue;

    const fileName = path.basename(url);
    if (remaining.delete(fileName)) ordered.push(fileName);
  }

  return [...ordered, ...[...remaining].sort((left, right) => collator.compare(left, right))];
}

function buildReadme(manifest) {
  return `# Обработка фотографий достопримечательностей

Экспорт создан ${manifest.exportedAt}. В папке \`01-originals\` находятся ${manifest.photoCount} исходных фотографий из ${manifest.attractionsWithPhotos} достопримечательностей. Все изображения лежат единым списком, без вложенных папок.

## Что делать с фотографиями

1. Не переименовывайте и не изменяйте файлы в \`01-originals\`: это резервная копия.
2. Обработайте фотографию и положите результат в \`02-processed\`.
3. К исходному имени перед расширением добавьте ровно \`__PROCESSED\`.
4. Расширение результата может быть \`.jpg\`, \`.jpeg\`, \`.png\`, \`.webp\` или \`.avif\`.

Пример:

- исходник: \`A0001__P001__Название.webp\`
- результат: \`A0001__P001__Название__PROCESSED.png\`

Файл \`manifest.json\` хранит точную обратную привязку: внутренний ID, slug, название достопримечательности, позицию фото, исходный URL, путь и контрольную сумму. Не редактируйте и не удаляйте его.

## Проверка перед возвратом

\`npm run photos:import:attractions -- --dry-run\`

Проверка требует полный комплект. Для намеренной частичной загрузки добавьте \`--allow-partial\`.

## Возврат на сайт

\`npm run photos:import:attractions\`

При возврате скрипт применяет используемый для достопримечательностей алгоритм: автоповорот по EXIF, уменьшение внутри 1920x1440 без увеличения маленьких файлов, конвертация в WebP с quality 88 и effort 5. Затем он возвращает файлы в папки соответствующих достопримечательностей и при необходимости меняет расширения URL в \`data/attractions-overrides.json\`.

Перед реальным импортом исходники остаются в \`01-originals\`, поэтому комплект одновременно служит резервной копией. Повторный экспорт возможен только командой \`npm run photos:export:attractions -- --force\`; папка \`02-processed\` при этом не удаляется.
`;
}

async function main() {
  ensureInsideWorkspace(outputDir);

  if ((await pathExists(originalsDir)) && !force) {
    throw new Error(
      "Export already exists. Use --force to rebuild 01-originals; 02-processed will be preserved.",
    );
  }

  if (force) await fs.rm(originalsDir, { recursive: true, force: true });
  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(processedDir, { recursive: true });

  const attractions = await readAttractions();
  const photos = [];
  let attractionsWithPhotos = 0;

  for (const [attractionIndex, attraction] of attractions.entries()) {
    const localFiles = await listLocalImages(attraction.slug);
    const orderedFiles = orderImages(attraction, localFiles);
    if (orderedFiles.length > 0) attractionsWithPhotos += 1;

    for (const [photoIndex, originalFileName] of orderedFiles.entries()) {
      const extension = path.extname(originalFileName).toLowerCase();
      const title = sanitizeFileSegment(attraction.title) || attraction.slug;
      const exportedStem = `A${String(attractionIndex + 1).padStart(4, "0")}__P${String(photoIndex + 1).padStart(3, "0")}__${title}`;
      const exportedFileName = `${exportedStem}${extension}`;
      const processedFileStem = `${exportedStem}__PROCESSED`;
      const sourcePath = path.join(attractionsDir, attraction.slug, originalFileName);
      const destinationPath = path.join(originalsDir, exportedFileName);
      const originalUrl = `/attractions/${attraction.slug}/${originalFileName}`;
      const galleryIndexes = attraction.gallery.flatMap((photo, index) =>
        photo?.url === originalUrl ? [index] : [],
      );

      await fs.copyFile(sourcePath, destinationPath);
      const fileStat = await fs.stat(sourcePath);
      photos.push({
        attractionIndex: attractionIndex + 1,
        photoIndex: photoIndex + 1,
        attractionId: attraction.id,
        slug: attraction.slug,
        title: attraction.title,
        status: attraction.status,
        isPublishedVisible: attraction.isPublishedVisible,
        galleryIndexes,
        originalFileName,
        originalUrl,
        originalPath: toWorkspacePath(sourcePath),
        originalExtension: extension,
        originalBytes: fileStat.size,
        sha256: await sha256(sourcePath),
        exportedFileName,
        processedFileStem,
      });
    }
  }

  const manifest = {
    manifestVersion: 1,
    exportedAt: new Date().toISOString(),
    suffixForProcessedFiles: "__PROCESSED",
    originalsDirectory: toWorkspacePath(originalsDir),
    processedDirectory: toWorkspacePath(processedDir),
    attractionCount: attractions.length,
    attractionsWithPhotos,
    attractionsWithoutPhotos: attractions.length - attractionsWithPhotos,
    photoCount: photos.length,
    photos,
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(readmePath, buildReadme(manifest), "utf8");

  console.log(
    JSON.stringify(
      {
        outputDir,
        attractionCount: manifest.attractionCount,
        attractionsWithPhotos,
        attractionsWithoutPhotos: manifest.attractionsWithoutPhotos,
        photoCount: photos.length,
      },
      null,
      2,
    ),
  );
}

await main();
