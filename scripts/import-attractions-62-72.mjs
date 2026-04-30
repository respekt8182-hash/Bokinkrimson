#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym");
const seoFilePath = path.join(sourceRoot, "62-72.txt");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const importedAt = "2026-04-29T12:00:00.000Z";

const entries = [
  {
    id: "attraction_smotrovaya_mysa_fiolent",
    sourceTitle: "Смотровая мыса Фиолент",
    sourceDir: "62 Смотровая мыса Фиолент",
    title: "Смотровая мыса Фиолент",
    category: "Горы и смотровые",
    locationName: "Фиолент",
    locationAliases: ["Севастополь", "Балаклава", "Гераклейский полуостров", "Яшмовый пляж"],
    districtName: "Севастопольский регион",
    address: "мыс Фиолент, Балаклавский район Севастополя",
    latitude: 44.50062,
    longitude: 33.48759,
    tags: ["Фиолент", "море", "скалы", "закаты", "Севастополь"],
    nearby: ["Яшмовый пляж", "Георгиевский монастырь", "Балаклава", "грот Дианы"],
  },
  {
    id: "attraction_smotrovaya_gory_koshka_simeiz",
    sourceTitle: "Смотровая горы Кошка, Симеиз",
    sourceDir: "63 Смотровая горы Кошка (Симеиз)",
    title: "Смотровая горы Кошка, Симеиз",
    category: "Горы и смотровые",
    locationName: "Симеиз",
    locationAliases: ["Ялта", "Большая Ялта", "Кацивели", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "гора Кошка, Симеиз",
    latitude: 44.4034,
    longitude: 33.9976,
    tags: ["Симеиз", "гора Кошка", "скалы", "море", "Южный берег"],
    nearby: ["Симеиз", "скала Дива", "Кацивели", "Кипарисовая аллея"],
  },
  {
    id: "attraction_smotrovaya_u_forosskoj_cerkvi",
    sourceTitle: "Смотровая у Форосской церкви",
    sourceDir: "65 Смотровая у Форосской церкви",
    title: "Смотровая у Форосской церкви",
    category: "Горы и смотровые",
    locationName: "Форос",
    locationAliases: ["Байдарские ворота", "Красная скала", "Южный берег Крыма", "Севастополь"],
    districtName: "Ялтинский регион",
    address: "Красная скала над Форосом, рядом с храмом Воскресения Христова",
    latitude: 44.4049,
    longitude: 33.7881,
    tags: ["Форос", "Форосская церковь", "море", "Байдарские ворота", "смотровая"],
    nearby: ["Форосская церковь", "Байдарские ворота", "Форос", "Байдарская долина"],
  },
  {
    id: "attraction_smotrovaya_gory_alchak_sudak",
    sourceTitle: "Смотровая горы Алчак, Судак",
    sourceDir: "66 Смотровая горы Алчак (Судак)",
    title: "Смотровая горы Алчак, Судак",
    category: "Горы и смотровые",
    locationName: "Судак",
    locationAliases: ["Алчак-Кая", "Капсель", "мыс Алчак", "Новый Свет"],
    districtName: "Судакский регион",
    address: "восточная окраина Судака, мыс Алчак-Кая",
    latitude: 44.8331,
    longitude: 34.99,
    tags: ["Судак", "Алчак-Кая", "экотропа", "море", "Генуэзская крепость"],
    nearby: ["Судакская бухта", "Генуэзская крепость", "Капсель", "мыс Меганом"],
  },
  {
    id: "attraction_smotrovaya_mysa_plaka",
    sourceTitle: "Смотровая мыса Плака",
    sourceDir: "67 Смотровая мыса Плака",
    title: "Смотровая мыса Плака",
    category: "Горы и смотровые",
    locationName: "Утёс",
    locationAliases: ["Партенит", "Алушта", "Кучук-Ламбат", "Карасан"],
    districtName: "Алуштинский регион",
    address: "мыс Плака, посёлок Утёс",
    latitude: 44.591175,
    longitude: 34.367648,
    tags: ["мыс Плака", "Утёс", "Аю-Даг", "дворец Гагариной", "море"],
    nearby: ["дворец княгини Гагариной", "Карасан", "Партенит", "Аю-Даг"],
  },
  {
    id: "attraction_ploshchadka_kamennyj_naves",
    sourceTitle: "Смотровая площадка Аю-Даг",
    sourceDir: "68 Площадка Каменный навес",
    title: "Площадка Каменный навес",
    slug: "ploshchadka-kamennyj-naves-ayu-dag",
    h1: "Площадка Каменный навес на Аю-Даге",
    seoTitle: "Площадка Каменный навес на Аю-Даге — виды на Партенит",
    metaDescription:
      "Площадка Каменный навес на горе Аю-Даг: где находится, что видно, как добраться, кому подойдёт маршрут и что посмотреть рядом.",
    shortDescription:
      "Видовая точка на Аю-Даге с панорамами Партенита, моря и южнобережных склонов. Хороший вариант для активной прогулки и фото.",
    description:
      "Площадка Каменный навес — видовая точка на горе Аю-Даг, связанная с маршрутом по Медведь-горе. Отсюда открываются панорамы Партенита, побережья, моря и склонов Южного берега. Место подходит тем, кто готов к пешей прогулке по природной территории: тропы могут быть каменистыми, летом на подъёме жарко, а правила доступа лучше проверять перед поездкой.",
    category: "Горы и смотровые",
    locationName: "Аю-Даг",
    locationAliases: ["Партенит", "Гурзуф", "Медведь-гора", "Алушта"],
    districtName: "Алуштинский регион",
    address: "гора Аю-Даг, район Партенита и Гурзуфа",
    latitude: 44.5587,
    longitude: 34.3326,
    tags: ["Аю-Даг", "Каменный навес", "Партенит", "пеший маршрут", "панорама моря"],
    nearby: ["Партенит", "Гурзуф", "парк Айвазовского", "мыс Плака"],
    altTexts: [
      "Площадка Каменный навес на Аю-Даге",
      "Вид с Каменного навеса на Партенит",
      "Панорама моря с горы Аю-Даг",
      "Тропа к площадке Каменный навес",
      "Южный берег Крыма с Аю-Дага",
    ],
  },
  {
    id: "attraction_smotrovaya_chufut_kale_burulchak",
    sourceTitle: "Смотровая Чуфут-Кале, плато Бурульчак",
    sourceDir: "69 Смотровая Чуфут-Кале (плато Бурульчак)",
    title: "Смотровая Чуфут-Кале, плато Бурульчак",
    category: "Пещерные города и монастыри",
    locationName: "Бахчисарай",
    locationAliases: ["Чуфут-Кале", "Бурульчак", "Бурунчак", "Успенский монастырь"],
    districtName: "Бахчисарайский район",
    address: "плато Чуфут-Кале над Бахчисараем",
    latitude: 44.735589,
    longitude: 33.931142,
    tags: ["Чуфут-Кале", "Бахчисарай", "пещерный город", "плато", "история"],
    nearby: ["Чуфут-Кале", "Успенский монастырь", "Ханский дворец", "Бахчисарай"],
  },
  {
    id: "attraction_serebryanaya_besedka_yalta_bakhchisaray",
    sourceTitle: "Смотровая Серебряная беседка, трасса Ялта — Бахчисарай",
    sourceDir: "70 Смотровая Серебряная беседка (трасса Ялта–Бахчисарай)",
    title: "Смотровая Серебряная беседка",
    category: "Горы и смотровые",
    locationName: "Ай-Петри",
    locationAliases: ["Ялта", "Бахчисарай", "Пендикюль", "Ай-Петринская дорога"],
    districtName: "Ялтинский регион",
    address: "дорога Ялта — Ай-Петри — Бахчисарай, гора Пендикюль",
    latitude: 44.4701,
    longitude: 34.08315,
    tags: ["Серебряная беседка", "Ай-Петри", "Ялта", "горная дорога", "ротонда"],
    nearby: ["Ай-Петри", "Учан-Су", "Ялта", "Воронцовский дворец"],
  },
  {
    id: "attraction_baydarskie_vorota",
    sourceTitle: "Байдарские ворота, перевал 503 м",
    sourceDir: "71 Байдарские ворота (перевал, 503 м)",
    title: "Байдарские ворота",
    category: "Горы и смотровые",
    locationName: "Форос",
    locationAliases: ["Байдарский перевал", "Байдарская долина", "Севастополь", "Южный берег Крыма"],
    districtName: "Севастопольский регион",
    address: "Байдарский перевал, старая дорога между Байдарской долиной и Форосом",
    latitude: 44.406242,
    longitude: 33.781932,
    tags: ["Байдарские ворота", "Форос", "перевал", "арка", "смотровая"],
    nearby: ["Форосская церковь", "Форос", "Байдарская долина", "Ласпи"],
  },
  {
    id: "attraction_smotrovaya_gory_sokol_novyj_svet",
    sourceTitle: "Смотровая горы Сокол, Новый Свет",
    sourceDir: "72 Смотровая горы Сокол (Новый Свет)",
    title: "Смотровая горы Сокол, Новый Свет",
    category: "Горы и смотровые",
    locationName: "Новый Свет",
    locationAliases: ["Судак", "Куш-Кая", "гора Сокол", "Зелёная бухта"],
    districtName: "Судакский регион",
    address: "гора Сокол между Судаком и Новым Светом",
    latitude: 44.836333,
    longitude: 34.925215,
    tags: ["Новый Свет", "гора Сокол", "Куш-Кая", "Судак", "панорама моря"],
    nearby: ["Новый Свет", "тропа Голицына", "Судакская крепость", "Караул-Оба"],
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
    .replace(/В открытых источниках встречается написание плато Бурунчак; в туристическом употреблении также можно встретить вариант Бурульчак\./g, "В открытых источниках встречаются варианты написания Бурунчак и Бурульчак.")
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

function parseAltTexts(markdown, title, overrideAltTexts) {
  if (overrideAltTexts?.length) {
    return overrideAltTexts;
  }

  const block =
    markdown.match(/\*\*Alt-тексты:\*\*([\s\S]*?)(?=\*\*Коротк(?:ие|ое) описан|\n## 2\.)/)?.[1] ?? "";
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

function overrideFactCoordinates(facts, entry) {
  const value = `${entry.latitude}, ${entry.longitude}`;
  const nextFacts = facts.filter((fact) => fact.label !== "Координаты");
  return [
    ...nextFacts,
    {
      label: "Координаты",
      value,
    },
  ].sort((left, right) => {
    const order = ["Время на посещение", "Лучший сезон", "Где находится", "Координаты", "Что рядом"];
    return order.indexOf(left.label) - order.indexOf(right.label);
  });
}

async function buildAttraction(entry, page) {
  const infoPath = path.join(sourceRoot, entry.sourceDir, "info.txt");
  const infoText = await readFile(infoPath, "utf8");
  const slug = entry.slug ?? slugFromPage(page.markdown);
  const mainDescription = section(page.markdown, 3, 4) || section(page.markdown, 2, 3);
  const altTexts = parseAltTexts(page.markdown, entry.title, entry.altTexts);
  const gallery = await convertGalleryImages(entry, slug, altTexts);
  const facts = overrideFactCoordinates(parseFacts(page.markdown), entry);
  const sections = buildSections(page.markdown);

  return {
    title: entry.title,
    slug,
    h1: entry.h1 ?? field(page.markdown, "H1") ?? entry.title,
    seoTitle: entry.seoTitle ?? field(page.markdown, "SEO Title") ?? `${entry.title} в Крыму`,
    metaDescription: entry.metaDescription ?? field(page.markdown, "Meta Description") ?? shorten(mainDescription, 180),
    category: entry.category,
    tags: [...new Set([...entry.tags, entry.category, entry.locationName])],
    locationName: entry.locationName,
    locationAliases: entry.locationAliases,
    districtName: entry.districtName,
    address: entry.address,
    latitude: entry.latitude,
    longitude: entry.longitude,
    shortDescription: entry.shortDescription ?? shorten(section(page.markdown, 2, 3), 360),
    description: entry.description ?? shorten(mainDescription, 720),
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
