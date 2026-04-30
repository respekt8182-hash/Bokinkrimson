#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym");
const seoFilePaths = [
  path.join(sourceRoot, "201-210.txt"),
  path.join(sourceRoot, "211-220.txt"),
];
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const importedAt = "2026-04-29T13:20:00.000Z";

const entries = [
  {
    id: "attraction_karantinnye_vorota_feodosiya",
    sourceTitle: "Крепостные ворота «Карантин», Феодосия",
    sourceDir: "201 Крепостные ворота «Карантин» (Феодосия)",
    title: "Крепостные ворота «Карантин»",
    category: "Крепости",
    locationName: "Феодосия",
    locationAliases: ["Карантинный холм", "Кафа", "Генуэзская крепость", "Старый город Феодосии"],
    districtName: "Феодосийский регион",
    address: "Карантинный холм, старая часть Феодосии",
    latitude: 45.022255,
    longitude: 35.39912,
    tags: ["Феодосия", "Кафа", "генуэзская крепость", "средневековье", "история"],
    nearby: ["Генуэзская крепость Кафа", "башня Константина", "галерея Айвазовского", "дача Стамболи"],
  },
  {
    id: "attraction_centr_vinodeliya_massandra",
    sourceTitle: "Завод марочных вин «Массандра»",
    sourceDir: "202 Центр Виноделия Массандра",
    title: "Центр Виноделия Массандра",
    category: "Винодельни",
    locationName: "Массандра",
    locationAliases: ["Ялта", "Южный берег Крыма", "Массандровский дворец", "Никита"],
    districtName: "Ялтинский регион",
    address: "ул. Винодела Егорова, 9, Массандра",
    latitude: 44.5189,
    longitude: 34.1884,
    tags: ["винодельня", "дегустация", "подвалы", "Массандра", "Ялта"],
    nearby: ["Массандровский дворец", "Ялта", "Никитский ботанический сад", "Ливадийский дворец"],
    websiteUrl: "https://massandra.ru/",
  },
  {
    id: "attraction_zavod_shampanskih_vin_novyy_svet",
    sourceTitle: "Завод шампанских вин «Новый Свет»",
    sourceDir: "203 Завод шампанских вин «Новый Свет»",
    title: "Завод шампанских вин «Новый Свет»",
    category: "Винодельни",
    locationName: "Новый Свет",
    locationAliases: ["Судак", "тропа Голицына", "Зелёная бухта", "Коба-Кая"],
    districtName: "Судакский регион",
    address: "ул. Шаляпина, 1, Новый Свет",
    latitude: 44.8285,
    longitude: 34.9133,
    tags: ["винодельня", "шампанское", "Голицын", "дегустация", "Новый Свет"],
    nearby: ["тропа Голицына", "гора Сокол", "Судакская крепость", "Караул-Оба"],
    websiteUrl: "https://nsvet-crimea.ru/",
  },
  {
    id: "attraction_zavod_inkerman",
    sourceTitle: "Завод «Инкерман»",
    sourceDir: "204 Завод «Инкерман»",
    title: "Завод «Инкерман»",
    category: "Винодельни",
    locationName: "Инкерман",
    locationAliases: ["Севастополь", "Каламита", "Чернореченская долина", "Севастопольский регион"],
    districtName: "Севастопольский регион",
    address: "ул. Малиновского, 20, Инкерман",
    latitude: 44.6101,
    longitude: 33.6027,
    tags: ["винодельня", "подземные галереи", "дегустация", "Инкерман", "Севастополь"],
    nearby: ["крепость Каламита", "Инкерманский монастырь", "Чернореченский каньон", "Севастополь"],
    websiteUrl: "https://www.inkerman.ru/",
  },
  {
    id: "attraction_zavod_koktebel",
    sourceTitle: "Завод «Коктебель»",
    sourceDir: "205 Завод «Коктебель»",
    title: "Завод «Коктебель»",
    category: "Винодельни",
    locationName: "Коктебель",
    locationAliases: ["Щебетовка", "Феодосия", "Кара-Даг", "Планерское"],
    districtName: "Феодосийский регион",
    address: "Коктебель, район Щебетовки",
    latitude: 44.938,
    longitude: 35.158,
    tags: ["винодельня", "мадера", "коньяк", "дегустация", "Коктебель"],
    nearby: ["Кара-Даг", "Коктебель", "Тихая бухта", "гора Клементьева"],
    websiteUrl: "https://koktebelwine.ru/",
  },
  {
    id: "attraction_solnechnaya_dolina_vinodelnya",
    sourceTitle: "Завод «Солнечная Долина»",
    sourceDir: "206 Завод «Солнечная долина»",
    title: "Завод «Солнечная долина»",
    category: "Винодельни",
    locationName: "Солнечная Долина",
    locationAliases: ["Судак", "Архадерессе", "Меганом", "Козская долина"],
    districtName: "Судакский регион",
    address: "с. Солнечная Долина, Судакский регион",
    latitude: 44.858945,
    longitude: 35.04787,
    tags: ["винодельня", "дегустация", "Голицын", "Солнечная Долина", "Судак"],
    nearby: ["мыс Меганом", "Судак", "Новый Свет", "Капсель"],
    websiteUrl: "https://sunvalley1888.ru/",
  },
  {
    id: "attraction_polyana_skazok_yalta",
    sourceTitle: "Поляна сказок, Ялта",
    sourceDir: "208 Поляна сказок (Ялта)",
    title: "Поляна сказок",
    category: "Парки и семейный отдых",
    locationName: "Ялта",
    locationAliases: ["Поляна сказок", "зоопарк Сказка", "Ставри-Кая", "Учан-Су"],
    districtName: "Ялтинский регион",
    address: "ул. Кирова, район Поляны сказок, Ялта",
    latitude: 44.4953,
    longitude: 34.1011,
    tags: ["музей под открытым небом", "детям", "сказочные скульптуры", "Ялта", "семейная прогулка"],
    nearby: ["Ялтинский зоопарк «Сказка»", "Учан-Су", "Ставри-Кая", "Боткинская тропа"],
    websiteUrl: "https://polyana-skazok-yalta.ru/",
  },
  {
    id: "attraction_yaltinskiy_zoopark_skazka",
    sourceTitle: "Ялтинский зоопарк «Сказка»",
    sourceDir: "209 Ялтинский зоопарк «Сказка»",
    title: "Ялтинский зоопарк «Сказка»",
    category: "Парки и семейный отдых",
    locationName: "Ялта",
    locationAliases: ["Поляна сказок", "Ставри-Кая", "Учан-Су", "Большая Ялта"],
    districtName: "Ялтинский регион",
    address: "ул. Кирова, 156, Ялта",
    latitude: 44.4958,
    longitude: 34.1002,
    tags: ["зоопарк", "детям", "животные", "Ялта", "семейный отдых"],
    nearby: ["Поляна сказок", "Учан-Су", "Ставри-Кая", "Ялта"],
    websiteUrl: "https://yalta-zoo.ru/",
  },
  {
    id: "attraction_istochnik_paniya_bolshoy_kanon",
    sourceTitle: "Источник Пания, Большой каньон Крыма",
    sourceDir: "211 Источник Пания (Большой каньон)",
    title: "Источник Пания",
    category: "Природа и водопады",
    locationName: "Большой каньон Крыма",
    locationAliases: ["Соколиное", "Бахчисарайский район", "Ванна Молодости", "Аузун-Узень", "Ай-Петри"],
    districtName: "Бахчисарайский район",
    address: "Большой каньон Крыма, район села Соколиное",
    latitude: 44.524722,
    longitude: 34.011612,
    tags: ["источник", "Большой каньон", "горный маршрут", "природа", "Соколиное"],
    nearby: ["Большой каньон Крыма", "Ванна Молодости", "Голубое озеро", "Ай-Петри"],
  },
  {
    id: "attraction_krymskaya_astrofizicheskaya_observatoriya",
    sourceTitle: "Крымская астрофизическая обсерватория",
    sourceDir: "212 Крымская астрофизическая обсерватория",
    title: "Крымская астрофизическая обсерватория",
    category: "История и мемориалы",
    locationName: "Научный",
    locationAliases: ["Бахчисарайский район", "Симферополь", "КрАО", "обсерватория"],
    districtName: "Бахчисарайский район",
    address: "пгт Научный, Бахчисарайский район",
    latitude: 44.7277,
    longitude: 34.013,
    tags: ["обсерватория", "астрономия", "телескопы", "Научный", "экскурсия"],
    nearby: ["посёлок Научный", "Бахчисарай", "Симферополь", "плато Ай-Петри"],
    websiteUrl: "https://crao.ru/",
  },
  {
    id: "attraction_simferopolskoe_vodohranilishche",
    sourceTitle: "Симферопольское водохранилище",
    sourceDir: "213 Симферопольское водохранилище",
    title: "Симферопольское водохранилище",
    category: "Природа и озёра",
    locationName: "Симферополь",
    locationAliases: ["Лозовое", "Аян", "Салгир", "Симферопольский район"],
    districtName: "Симферопольский район",
    address: "юго-восточная окраина Симферополя, район Лозового",
    latitude: 44.923187,
    longitude: 34.154657,
    tags: ["водохранилище", "озеро", "Симферополь", "прогулка", "виды"],
    nearby: ["Симферополь", "Лозовое", "Аянское водохранилище", "Чатыр-Даг"],
  },
  {
    id: "attraction_yashmovy_plyazh_fiolent",
    sourceTitle: "Яшмовый пляж, мыс Фиолент",
    sourceDir: "214 Яшмовый пляж (мыс Фиолент)",
    title: "Яшмовый пляж",
    category: "Природа и пляжи",
    locationName: "Фиолент",
    locationAliases: ["Севастополь", "мыс Фиолент", "Георгиевский монастырь", "Балаклава"],
    districtName: "Севастопольский регион",
    address: "мыс Фиолент, район Георгиевского монастыря",
    latitude: 44.5047,
    longitude: 33.507,
    tags: ["пляж", "Фиолент", "море", "скалы", "Севастополь"],
    nearby: ["мыс Фиолент", "Георгиевский монастырь", "грот Дианы", "Балаклава"],
  },
  {
    id: "attraction_kara_dag_krym",
    sourceTitle: "Кара-Даг, вулканический массив",
    sourceDir: "220 Кара-Даг (вулканический массив)",
    title: "Кара-Даг",
    category: "Горы и смотровые",
    locationName: "Коктебель",
    locationAliases: ["Курортное", "Феодосия", "Биостанция", "Золотые ворота", "Карадагский заповедник"],
    districtName: "Феодосийский регион",
    address: "между Коктебелем и Курортным, восточный Крым",
    latitude: 44.9141,
    longitude: 35.2308,
    tags: ["Кара-Даг", "вулканический массив", "заповедник", "Золотые ворота", "Коктебель"],
    nearby: ["Коктебель", "Курортное", "Золотые ворота", "Тихая бухта", "Биостанция Кара-Дага"],
    websiteUrl: "https://karadag.com.ru/",
  },
  {
    id: "attraction_tihaya_buhta_koktebel",
    sourceTitle: "Тихая бухта, Коктебель",
    sourceDir: "221 Тихая бухта",
    title: "Тихая бухта",
    category: "Природа и пляжи",
    locationName: "Коктебель",
    locationAliases: ["Орджоникидзе", "мыс Хамелеон", "Феодосия", "Восточный Крым"],
    districtName: "Феодосийский регион",
    address: "между Коктебелем и Орджоникидзе",
    latitude: 44.967924,
    longitude: 35.309895,
    tags: ["Тихая бухта", "пляж", "мыс Хамелеон", "Коктебель", "кемпинг"],
    nearby: ["мыс Хамелеон", "Коктебель", "Кара-Даг", "Орджоникидзе", "гора Клементьева"],
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

function slugFromPage(markdown, fallback) {
  const match = markdown.match(/\*\*URL \/ slug:\*\*\s*`?\/?([^`\r\n]+)`?/);
  const slug = cleanup(match?.[1] ?? fallback)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return slug;
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
    "Подходит ли для пожилых людей",
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
  if (entry.latitude !== null && entry.longitude !== null) {
    withoutCoordinates.push({
      label: "Координаты",
      value: `${entry.latitude}, ${entry.longitude}`,
    });
  }

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
    "Подходит ли для пожилых людей",
  ];

  return withoutCoordinates.sort((left, right) => order.indexOf(left.label) - order.indexOf(right.label));
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
    const numbered = line.trim().match(/^\d+\.\s+(.+)/);
    const sentenceList = line
      .split(";")
      .map((item) => cleanup(item))
      .filter(Boolean);

    if (numbered) {
      alts.push(cleanup(numbered[1]));
      continue;
    }
    if (sentenceList.length > 1) {
      alts.push(...sentenceList);
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
  const slug = slugFromPage(page.markdown, entry.id.replace(/^attraction_/, "").replaceAll("_", "-"));
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
  const [overridesRaw, ...seoMarkdownFiles] = await Promise.all([
    readFile(overridesPath, "utf8"),
    ...seoFilePaths.map((filePath) => readFile(filePath, "utf8")),
  ]);
  const pages = new Map(seoMarkdownFiles.flatMap(splitSeoPages).map((page) => [page.title, page]));
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
