#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym");
const seoFilePath = path.join(sourceRoot, "50-59.txt");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const importedAt = "2026-04-29T12:00:00.000Z";

const entries = [
  {
    id: "attraction_kush_kaya",
    sourceTitle: "Гора Куш-Кая",
    sourceDir: "50 Гора Куш-Кая",
    title: "Гора Куш-Кая",
    category: "Горы и смотровые",
    locationName: "Ласпи",
    locationAliases: ["Батилиман", "бухта Ласпи", "мыс Айя", "Форос", "Севастополь"],
    districtName: "Севастопольский регион",
    address: "район бухты Ласпи и урочища Батилиман",
    latitude: 44.425131,
    longitude: 33.67988,
    tags: ["Ласпи", "Батилиман", "мыс Айя", "пеший маршрут", "панорамы моря"],
    nearby: ["Ласпинский перевал", "бухта Ласпи", "Батилиман", "мыс Айя", "Форос"],
  },
  {
    id: "attraction_sapun_gora",
    sourceTitle: "Сапун-гора, Севастополь",
    sourceDir: "51 Гора Сапун (255 м)",
    title: "Сапун-гора, Севастополь",
    category: "История и мемориалы",
    locationName: "Севастополь",
    locationAliases: ["Балаклава", "Ялтинское шоссе", "Сапун-гора"],
    districtName: "Севастополь",
    address: "Ялтинское шоссе, мемориальный комплекс Сапун-гора",
    latitude: 44.552,
    longitude: 33.584,
    tags: ["мемориал", "диорама", "военная история", "музей", "Севастополь"],
    nearby: ["Балаклава", "Федюхины высоты", "центр Севастополя", "Малахов курган"],
    websiteUrl: "https://sevmuseum.ru/museums/detail/diorama-shturm-sapun-gory-7-maya-1944-g/",
  },
  {
    id: "attraction_babugan_yayla",
    sourceTitle: "Бабуган-яйла",
    sourceDir: "52 Бабуган-яйла",
    title: "Бабуган-яйла",
    category: "Горы и смотровые",
    locationName: "Алушта",
    locationAliases: ["Гурзуф", "Ялта", "Роман-Кош", "Крымский природный заповедник"],
    districtName: "Алуштинский регион",
    address: "Главная гряда Крымских гор, территория Крымского природного заповедника",
    latitude: 44.63,
    longitude: 34.29,
    tags: ["яйла", "Роман-Кош", "заповедник", "горный маршрут", "Главная гряда"],
    nearby: ["Роман-Кош", "Гурзуф", "Алушта", "Крымский природный заповедник"],
    websiteUrl: "https://zapovedcrimea.ru/visiting-rules",
  },
  {
    id: "attraction_chilter_marmara",
    sourceTitle: "Гора Чилтер-Кая и пещерный монастырь Чилтер-Мармара",
    sourceDir: "53 пещерный монастырь Чилтер-Мармара",
    title: "Гора Чилтер-Кая и пещерный монастырь Чилтер-Мармара",
    category: "Пещерные города и монастыри",
    locationName: "Терновка",
    locationAliases: ["Севастополь", "Шульская долина", "Чилтер-Кая", "Челтер-Мармара"],
    districtName: "Севастопольский регион",
    address: "район села Терновка, гора Чилтер-Кая",
    latitude: 44.5956,
    longitude: 33.732,
    tags: ["пещерный монастырь", "Чилтер-Кая", "Терновка", "пещерный Крым", "история"],
    nearby: ["Шулдан", "Мангуп-Кале", "Эски-Кермен", "Терновка"],
    websiteUrl: "https://savvynsky-mon.cerkov.ru/",
  },
  {
    id: "attraction_meganom",
    sourceTitle: "Мыс-гора Меганом",
    sourceDir: "54 Мыс-гора Меганом",
    title: "Мыс-гора Меганом",
    category: "Горы и смотровые",
    locationName: "Судак",
    locationAliases: ["Капсель", "Солнечная Долина", "Новый Свет", "Феодосия"],
    districtName: "Судакский регион",
    address: "юго-восточнее Судака, район Капселя и Солнечной Долины",
    latitude: 44.794156,
    longitude: 35.080172,
    tags: ["мыс", "маяк", "дикие пляжи", "Судак", "морские виды"],
    nearby: ["Судак", "Алчак-Кая", "Капсель", "Солнечная Долина", "Новый Свет"],
  },
  {
    id: "attraction_ai_georgiy",
    sourceTitle: "Гора Ай-Георгий",
    sourceDir: "55 Гора Ай-Георгий",
    title: "Гора Ай-Георгий",
    category: "Горы и смотровые",
    locationName: "Судак",
    locationAliases: ["Долинный", "Алчак", "Капсель", "Меганом"],
    districtName: "Судакский регион",
    address: "восточнее Судака, район посёлка Долинный",
    latitude: 44.86749,
    longitude: 35.0178,
    tags: ["Судак", "источник", "святой Георгий", "пеший маршрут", "видовая вершина"],
    nearby: ["Судак", "Алчак-Кая", "Меганом", "Капсель", "Солнечная Долина"],
  },
  {
    id: "attraction_haphal_demerdzhi",
    sourceTitle: "Хапхал, Демерджи-яйла и водопад Джур-Джур",
    sourceDir: "56 Хапхал (Демерджи-яйла) Ущелье Хапхал",
    title: "Хапхал, Демерджи-яйла и водопад Джур-Джур",
    category: "Природа и водопады",
    locationName: "Генеральское",
    locationAliases: ["Алушта", "Демерджи", "Джур-Джур", "Улу-Узень Восточный"],
    districtName: "Алуштинский регион",
    address: "ущелье Хапхал, район села Генеральское",
    latitude: 44.809281,
    longitude: 34.445805,
    tags: ["ущелье", "водопад Джур-Джур", "экотропа", "Демерджи", "лесной маршрут"],
    nearby: ["водопад Джур-Джур", "Демерджи", "крепость Фуна", "Долина привидений"],
  },
  {
    id: "attraction_smotrovaya_ai_petri",
    sourceTitle: "Смотровая Ай-Петри, 1234 м",
    sourceDir: "57 Смотровая Ай-Петри (1234 м)",
    title: "Смотровая Ай-Петри, 1234 м",
    category: "Горы и смотровые",
    locationName: "Ай-Петри",
    locationAliases: ["Ялта", "Алупка", "Кореиз", "Мисхор", "Ай-Петринская яйла"],
    districtName: "Ялтинский регион",
    address: "плато Ай-Петри над Алупкой, Кореизом и Мисхором",
    latitude: 44.451625,
    longitude: 34.060326,
    tags: ["Ай-Петри", "канатная дорога", "зубцы Ай-Петри", "плато", "Южный берег"],
    nearby: ["Учан-Су", "Алупка", "Воронцовский дворец", "Ялта", "Мисхор"],
    websiteUrl: "https://zapovedcrimea.ru/yaltinskiy",
  },
  {
    id: "attraction_besedka_vetrov",
    sourceTitle: "Беседка Ветров, гора Шаган-Кая",
    sourceDir: "58 Беседка Ветров (гора Шаган-Кая, ~1400 м)",
    title: "Беседка Ветров, гора Шаган-Кая",
    category: "Горы и смотровые",
    locationName: "Гурзуф",
    locationAliases: ["Ялта", "Алушта", "Шаган-Кая", "Гурзуфская яйла", "Крымский природный заповедник"],
    districtName: "Ялтинский регион",
    address: "гора Шаган-Кая, Гурзуфская яйла",
    latitude: 44.578106,
    longitude: 34.225293,
    tags: ["смотровая", "ротонда", "Гурзуф", "Айю-Даг", "заповедник"],
    nearby: ["Гурзуф", "Айю-Даг", "Никитский ботанический сад", "Бабуган-яйла"],
  },
  {
    id: "attraction_laspinskiy_pereval",
    sourceTitle: "Ласпинский перевал, смотровая площадка",
    sourceDir: "59 Ласпинский перевал (смотровая, 325 м)",
    title: "Ласпинский перевал, смотровая площадка",
    category: "Горы и смотровые",
    locationName: "Ласпи",
    locationAliases: ["Севастополь", "Форос", "Батилиман", "бухта Ласпи", "мыс Айя"],
    districtName: "Севастопольский регион",
    address: "дорога Севастополь — Ялта, район бухты Ласпи",
    latitude: 44.428279,
    longitude: 33.707473,
    tags: ["смотровая площадка", "Ласпи", "Батилиман", "мыс Айя", "Южнобережное шоссе"],
    nearby: ["бухта Ласпи", "Батилиман", "Куш-Кая", "мыс Айя", "Форос"],
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
  return cleanup(markdown.match(/\*\*URL \/ slug:\*\*\s*`\/([^`]+)`/)?.[1] ?? "");
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
    .replace(
      /Высота перевала в разных источниках указывается около 325–329 м, поэтому на странице лучше писать «около 325 м» или «примерно 329 м», чтобы не спорить с картографическими данными\./g,
      "Высота перевала — около 325–329 м.",
    )
    .replace(
      /Туристические источники отмечают, что часовня появилась в 2003 году, но перед публикацией точную информацию лучше дополнительно сверить с актуальными местными данными\./g,
      "Рядом со смотровой расположена небольшая часовня.",
    )
    .replace(
      /Поэтому для публикации корректно писать: «точная датировка в открытых источниках различается»\./g,
      "В открытых источниках точная датировка комплекса различается.",
    )
    .replace(
      /Высота в источниках указывается около 1400–1427 м, поэтому на сайте корректно писать «примерно 1400 м»\./g,
      "Высота смотровой — примерно 1400 м.",
    )
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

function parseFacts(markdown) {
  const raw = cleanup(section(markdown, 13, 14));
  const preferred = new Set([
    "Где находится",
    "Координаты",
    "Время на посещение",
    "Лучший сезон",
    "Что рядом",
  ]);
  const facts = [];

  for (const line of raw.split("\n")) {
    const match = line.trim().match(/^\*\s+(.+?):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const label = cleanup(match[1]);
    const value = cleanup(match[2]).replace(/\.$/, ".");
    if (preferred.has(label) && value) {
      facts.push({ label, value });
    }
  }

  return facts.sort((left, right) => {
    const order = ["Время на посещение", "Лучший сезон", "Где находится", "Координаты", "Что рядом"];
    return order.indexOf(left.label) - order.indexOf(right.label);
  });
}

function parseFaq(markdown) {
  const raw = section(markdown, 14, 15);
  const faq = [];
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
    markdown.match(/\*\*Alt-тексты:\*\*([\s\S]*?)(?=\*\*Короткие описания|\n## 2\.)/)?.[1] ?? "";
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
  return infoText.match(/https:\/\/yandex\.ru\/maps\/\?text=\S+/)?.[0] ?? null;
}

async function buildAttraction(entry, page) {
  const infoPath = path.join(sourceRoot, entry.sourceDir, "info.txt");
  const infoText = await readFile(infoPath, "utf8");
  const slug = slugFromPage(page.markdown);
  const mainDescription = section(page.markdown, 3, 4) || section(page.markdown, 2, 3);
  const altTexts = parseAltTexts(page.markdown, entry.title);
  const gallery = await convertGalleryImages(entry, slug, altTexts);
  const facts = parseFacts(page.markdown);
  const sections = buildSections(page.markdown);

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
    facts,
    sections,
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
    createdByLogin: "code",
    createdAt: importedAt,
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
    overrides[entry.id] = await buildAttraction(entry, page);
  }

  await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  console.log(`Imported ${entries.length} attractions and image galleries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
