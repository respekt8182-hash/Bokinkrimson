#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym");
const seoFilePath = path.join(sourceRoot, "223-232.txt");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const importedAt = "2026-04-29T12:30:00.000Z";

const entries = [
  {
    id: "attraction_hram_ioanna_predtechi_kerch",
    sourceTitle: "Храм Святого Иоанна Предтечи, Керчь",
    sourceDir: "231 Храм Святого Иоанна Предтечи",
    title: "Храм Святого Иоанна Предтечи",
    category: "Дворцы и архитектура",
    locationName: "Керчь",
    locationAliases: ["центр Керчи", "площадь Ленина", "гора Митридат", "Пантикапей"],
    districtName: "Керчь",
    address: "пер. Димитрова, 2",
    latitude: 45.351405,
    longitude: 36.476034,
    tags: ["православный храм", "византийская архитектура", "старый город", "Керчь", "история"],
    nearby: ["гора Митридат", "Пантикапей", "Керченская набережная", "площадь Ленина"],
    websiteUrl: "https://soborpredtechi.ru/",
  },
  {
    id: "attraction_sasyk_sivash_rozovoe_ozero",
    sourceTitle: "Озеро Сасык-Сиваш, Розовое озеро",
    sourceDir: "232 Озеро Сасык-Сиваш (Розовое озеро)",
    title: "Озеро Сасык-Сиваш (Розовое озеро)",
    category: "Природа и озёра",
    locationName: "Саки",
    locationAliases: ["Евпатория", "Прибрежное", "Сасык-Сиваш", "Розовое озеро", "западный Крым"],
    districtName: "Сакский район",
    address: "между Евпаторией и Саками, район Прибрежного",
    latitude: 45.187484,
    longitude: 33.506504,
    tags: ["розовое озеро", "солёное озеро", "природа", "фото", "Евпатория"],
    nearby: ["Евпатория", "Саки", "Прибрежное", "озеро Мойнаки", "Сакское озеро"],
  },
  {
    id: "attraction_storozhevoy_utes_smotrovaya",
    sourceTitle: "Смотровая площадка «Сторожевой утёс»",
    sourceDir: "223 Смотровая площадка «Сторожевой утёс»",
    title: "Смотровая площадка «Сторожевой утёс»",
    category: "Горы и смотровые",
    locationName: "Соколиное",
    locationAliases: ["Большой каньон Крыма", "Бахчисарайский район", "Ай-Петри", "Коккозская долина"],
    districtName: "Бахчисарайский район",
    address: "район Большого каньона Крыма",
    latitude: 44.528127,
    longitude: 34.019346,
    tags: ["смотровая площадка", "Большой каньон", "горы", "пеший маршрут", "панорамы"],
    nearby: ["Большой каньон Крыма", "Соколиное", "ванна молодости", "Ай-Петри", "Коккозская долина"],
  },
  {
    id: "attraction_smotrovaya_gory_mitridat_kerch",
    sourceTitle: "Смотровая площадка горы Митридат",
    sourceDir: "224 Смотровая площадка горы Митридат",
    title: "Смотровая площадка горы Митридат",
    category: "Горы и смотровые",
    locationName: "Керчь",
    locationAliases: ["гора Митридат", "Митридатская лестница", "Пантикапей", "Крымский мост"],
    districtName: "Керчь",
    address: "гора Митридат, центр Керчи",
    latitude: 45.350701,
    longitude: 36.469735,
    tags: ["смотровая площадка", "Керчь", "Пантикапей", "лестница", "история"],
    nearby: ["Митридатская лестница", "Пантикапей", "Обелиск Славы", "центр Керчи", "Керченская набережная"],
  },
  {
    id: "attraction_shaytan_merdven_smotrovaya",
    sourceTitle: "Смотровая площадка «Шайтан-Мердвен»",
    sourceDir: "225 Смотровая площадка «Шайтан-Мердвен»",
    title: "Смотровая площадка «Шайтан-Мердвен»",
    category: "Горы и смотровые",
    locationName: "Форос",
    locationAliases: ["Чёртова лестница", "Олива", "Мухалатка", "Байдарские ворота", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "район Фороса и старого перевала Шайтан-Мердвен",
    latitude: 44.446047,
    longitude: 33.834918,
    tags: ["Шайтан-Мердвен", "Чёртова лестница", "перевал", "пеший маршрут", "смотровая"],
    nearby: ["Форос", "Форосская церковь", "Байдарские ворота", "Олива", "Скельская пещера"],
    websiteUrl: "https://zapovedcrimea.ru/yaltinskiy",
  },
  {
    id: "attraction_park_ayvazovskoe_partenit",
    sourceTitle: "Парк «Айвазовское» в Партените",
    sourceDir: "226 Парк «Айвазовское» (им. Айвазовского)",
    title: "Парк «Айвазовское» в Партените",
    category: "Дворцы и парки",
    locationName: "Партенит",
    locationAliases: ["Алушта", "Айвазовское", "санаторий Айвазовское", "Аю-Даг", "Кучук-Ламбат"],
    districtName: "Алуштинский регион",
    address: "ул. Васильченко, 1А",
    latitude: 44.582646,
    longitude: 34.344238,
    tags: ["парк", "ландшафтный парк", "Партенит", "Аю-Даг", "экскурсия"],
    nearby: ["Аю-Даг", "Партенит", "мыс Плака", "дворец княгини Гагариной", "Карасан"],
    websiteUrl: "https://xn--80aafbpklm8ac5a.xn--p1ai/park/",
  },
  {
    id: "attraction_krepost_chembalo",
    sourceTitle: "Фортификация Балаклавы — крепость Чембало",
    sourceDir: "229 Фортификация Балаклавы (башня Чембало)",
    title: "Крепость Чембало в Балаклаве",
    category: "Крепости",
    locationName: "Балаклава",
    locationAliases: ["Севастополь", "гора Кастрон", "Балаклавская бухта", "набережная Назукина"],
    districtName: "Севастополь",
    address: "гора Кастрон, Балаклава",
    latitude: 44.494623,
    longitude: 33.59875,
    tags: ["крепость", "генуэзская крепость", "Балаклава", "смотровая", "история"],
    nearby: ["Балаклавская бухта", "набережная Назукина", "музей подводных лодок", "мыс Фиолент", "Сапун-гора"],
    websiteUrl: "https://archaeoglobus.sfu-kras.ru/monument/krepost-chembalo/",
  },
];

function splitSeoPages(markdown) {
  return markdown
    .split(/^# \d+\. /m)
    .slice(1)
    .map((chunk) => ({
      title: chunk.split(/\r?\n/, 1)[0].trim(),
      markdown: chunk,
    }));
}

function field(markdown, label) {
  const match = markdown.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
  return cleanup(match?.[1] ?? "");
}

function slugFromPage(markdown) {
  const slug = cleanup(markdown.match(/\*\*URL \/ slug:\*\*\s*`\/([^`]+)`/)?.[1] ?? "");
  return slug.replace(/\/+$/, "");
}

function section(markdown, number, nextNumber) {
  const regex = new RegExp(
    `^## ${number}\\.[^\\n]*\\r?\\n\\r?\\n([\\s\\S]*?)(?=^## ${nextNumber}\\.)`,
    "m",
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}

function cleanup(value) {
  return value
    .replace(/\r/g, "")
    .replace(/\s*\(\[[^\]]+\]\[\d+\]\)/g, "")
    .replace(/\s*\[[^\]]+\]\[\d+\]/g, "")
    .replace(/^\[\d+\]:.+$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function shorten(value, maxLength) {
  const text = cleanup(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }
  const slice = text.slice(0, maxLength);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd > Math.floor(maxLength * 0.55)) {
    return slice.slice(0, sentenceEnd + 1);
  }
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxLength).trim()}...`;
}

function parseSection(markdown, number, nextNumber) {
  const raw = cleanup(section(markdown, number, nextNumber));
  const list = [];
  const nonListLines = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)/);
    if (bullet) {
      list.push(cleanup(bullet[1]).replace(/\.$/, ""));
      continue;
    }
    nonListLines.push(line);
  }

  const body = nonListLines
    .join("\n")
    .split(/\n{2,}/)
    .map((item) => cleanup(item).replace(/\n+/g, " "))
    .filter(Boolean);

  return { body, list };
}

function parseFacts(markdown, entry) {
  const raw = section(markdown, 13, 14);
  const preferred = new Set([
    "Где находится",
    "Координаты",
    "Режим работы",
    "Стоимость входа",
    "Парковка",
    "Общественный транспорт",
    "Время на посещение",
    "Лучший сезон",
    "Что рядом",
    "Подходит ли для детей",
    "Подходит ли для пожилых",
  ]);
  const facts = [];

  for (const line of raw.split("\n")) {
    const match =
      line.trim().match(/^\*\s+\*\*(.+?):\*\*\s*(.+)$/) ??
      line.trim().match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (!match) {
      continue;
    }
    const label = cleanup(match[1]);
    const value = cleanup(match[2]).replace(/\.$/, ".");
    if (preferred.has(label) && value) {
      facts.push({ label, value });
    }
  }

  const withoutCoordinates = facts.filter((fact) => fact.label !== "Координаты");
  withoutCoordinates.push({
    label: "Координаты",
    value: `${entry.latitude}, ${entry.longitude}`,
  });

  return withoutCoordinates.sort((left, right) => {
    const order = [
      "Время на посещение",
      "Лучший сезон",
      "Где находится",
      "Координаты",
      "Режим работы",
      "Стоимость входа",
      "Парковка",
      "Общественный транспорт",
      "Что рядом",
      "Подходит ли для детей",
      "Подходит ли для пожилых",
    ];
    return order.indexOf(left.label) - order.indexOf(right.label);
  });
}

function parseFaq(markdown) {
  const raw = section(markdown, 14, 15);
  const faq = [];
  for (const line of raw.split(/\r?\n/)) {
    const inline = line.trim().match(/^\*\*([^*?]+?\?)\*\*\s*(.+)$/);
    if (inline) {
      const question = cleanup(inline[1]);
      const answer = cleanup(inline[2]);
      if (question && answer) {
        faq.push({ question, answer });
      }
    }
  }

  if (faq.length > 0) {
    return faq.slice(0, 6);
  }

  const regex = /\*\*([^*?]+?\?)\*\*\s*\r?\n([\s\S]*?)(?=\r?\n\r?\n\*\*|$)/g;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    const question = cleanup(match[1]);
    const answer = cleanup(match[2]).replace(/\n+/g, " ");
    if (question && answer) {
      faq.push({ question, answer });
    }
  }

  return faq.slice(0, 6);
}

function parseAltTexts(markdown, title) {
  const block =
    markdown.match(/\*\*Alt-тексты:\*\*([\s\S]*?)(?=\*\*Корот(?:кие|кое) описан|\n## 2\.)/)?.[1] ?? "";
  const alts = [];
  for (const line of block.split(/\r?\n/)) {
    const match = line.trim().match(/^\d+\.\s+(.+)/);
    if (match) {
      alts.push(cleanup(match[1]));
    }
  }
  return alts.length > 0 ? alts : [`${title} в Крыму`];
}

function buildSections(markdown) {
  const sourceSections = [
    { title: "Обзор", parsed: parseSection(markdown, 2, 3) },
    { title: "История и особенности", parsed: parseSection(markdown, 4, 5) },
    { title: "Что посмотреть на месте", parsed: parseSection(markdown, 5, 6) },
    { title: "Как добраться", parsed: parseSection(markdown, 6, 7) },
    { title: "Когда лучше ехать", parsed: parseSection(markdown, 7, 8) },
    { title: "Что посмотреть рядом", parsed: parseSection(markdown, 11, 12) },
  ];

  return sourceSections
    .map(({ title, parsed }) => ({
      title,
      body: parsed.body.map((item) => shorten(item, 850)),
      ...(parsed.list.length > 0 ? { list: parsed.list.map((item) => shorten(item, 240)) } : {}),
    }))
    .filter((item) => item.body.length > 0 || item.list?.length);
}

async function imageFiles(sourceDir) {
  const files = await readdir(sourceDir, { withFileTypes: true });
  return files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(webp|png|jpe?g)$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" }));
}

async function convertGalleryImages(entry, slug, altTexts) {
  const sourceDir = path.join(sourceRoot, entry.sourceDir);
  const targetDir = path.join(publicAttractionsRoot, slug);
  const files = await imageFiles(sourceDir);

  await mkdir(targetDir, { recursive: true });

  const gallery = [];
  for (let index = 0; index < files.length; index += 1) {
    const fileName = `image-${String(index + 1).padStart(2, "0")}.webp`;
    const sourcePath = path.join(sourceDir, files[index]);
    const targetPath = path.join(targetDir, fileName);

    await sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize({
        width: 1800,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toFile(targetPath);

    gallery.push({
      url: `/attractions/${slug}/${fileName}`,
      alt: altTexts[index] ?? `${entry.title}: фото ${index + 1}`,
    });
  }

  return gallery;
}

function readInfoMapUrl(infoText) {
  return infoText.match(/https:\/\/(?:yandex\.ru|yandex\.com)\/maps\/\S+/)?.[0] ?? null;
}

async function buildAttraction(entry, page, existingOverride) {
  const infoPath = path.join(sourceRoot, entry.sourceDir, "info.txt");
  const infoText = await readFile(infoPath, "utf8");
  const slug = slugFromPage(page.markdown);
  const mainDescription = section(page.markdown, 3, 4) || section(page.markdown, 2, 3);
  const altTexts = parseAltTexts(page.markdown, entry.title);
  const gallery = await convertGalleryImages(entry, slug, altTexts);

  return {
    title: entry.title,
    slug,
    h1: field(page.markdown, "H1") || entry.title,
    seoTitle: field(page.markdown, "SEO Title") || `${entry.title} в Крыму`,
    metaDescription: field(page.markdown, "Meta Description") || shorten(mainDescription, 180),
    category: entry.category,
    tags: [...new Set([...entry.tags, entry.category, entry.locationName])],
    locationName: entry.locationName,
    locationAliases: entry.locationAliases,
    districtName: entry.districtName,
    address: entry.address,
    latitude: entry.latitude,
    longitude: entry.longitude,
    shortDescription: shorten(section(page.markdown, 2, 3), 360),
    description: shorten(mainDescription, 720),
    gallery,
    websiteUrl: entry.websiteUrl ?? null,
    mapUrl: readInfoMapUrl(infoText),
    facts: parseFacts(page.markdown, entry),
    sections: buildSections(page.markdown),
    nearby: entry.nearby,
    faq: parseFaq(page.markdown),
    searchKeywords: [
      entry.title,
      `${entry.title} Крым`,
      entry.locationName,
      ...entry.locationAliases,
      ...entry.tags,
      ...entry.nearby,
    ],
    status: "PUBLISHED",
    isPublishedVisible: true,
    createdByLogin: existingOverride?.createdByLogin ?? "code",
    createdAt: existingOverride?.createdAt ?? importedAt,
    updatedAt: importedAt,
  };
}

async function main() {
  const [seoMarkdown, overridesRaw] = await Promise.all([
    readFile(seoFilePath, "utf8"),
    readFile(overridesPath, "utf8"),
  ]);
  const pages = new Map(splitSeoPages(seoMarkdown).map((page) => [page.title, page]));
  const overrides = JSON.parse(overridesRaw);

  for (const entry of entries) {
    const page = pages.get(entry.sourceTitle);
    if (!page) {
      throw new Error(`SEO page not found: ${entry.sourceTitle}`);
    }
    overrides[entry.id] = await buildAttraction(entry, page, overrides[entry.id]);
  }

  await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  console.log(`Imported ${entries.length} attractions and image galleries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
