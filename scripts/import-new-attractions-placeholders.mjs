#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym", "NEW");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const placeholderSourcePath = path.join(sourceRoot, "zaglushka.png");
const placeholderPublicPath = path.join(publicAttractionsRoot, "zaglushka.png");
const placeholderUrl = "/attractions/zaglushka.png";
const importedAt = "2026-05-03T13:00:00.000Z";
const dryRun = process.argv.includes("--dry-run");
const onlyDirs = new Set(
  process.argv
    .find((argument) => argument.startsWith("--dirs="))
    ?.slice("--dirs=".length)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [],
);

const knownLocations = [
  "Симферополь",
  "Севастополь",
  "Ялта",
  "Алушта",
  "Евпатория",
  "Керчь",
  "Феодосия",
  "Судак",
  "Бахчисарай",
  "Балаклава",
  "Саки",
  "Белогорск",
  "Алупка",
  "Гурзуф",
  "Коктебель",
  "Старый Крым",
  "Партенит",
  "Ливадия",
  "Инкерман",
  "Симеиз",
  "Форос",
  "Новый Свет",
  "Массандра",
  "Гаспра",
  "Кореиз",
  "Никита",
  "Оленевка",
  "Черноморское",
  "Орджоникидзе",
  "Новофедоровка",
  "Щелкино",
  "Щёлкино",
  "Научный",
  "Мирный",
  "Уютное",
  "Приморский",
  "Кача",
  "Николаевка",
  "Заозерное",
  "Морское",
  "Рыбачье",
  "Солнечная Долина",
  "Малореченское",
  "Курортное",
  "Поворотное",
  "Черемисовка",
];

const sectionLabels = [
  "Краткое описание",
  "Основное описание",
  "История и особенности",
  "Что посмотреть на месте",
  "Как добраться",
  "Когда лучше ехать",
  "Сколько времени нужно",
  "Кому подойдёт",
  "Кому подойдет",
  "Что взять с собой",
  "Что посмотреть рядом",
  "Экскурсии, туры, жильё и трансфер",
  "Экскурсии, туры, жилье и трансфер",
  "Практическая информация",
  "Итоговый вывод",
];

const outputSectionTitles = new Map([
  ["Краткое описание", "Краткое описание"],
  ["Основное описание", "Основное описание"],
  ["История и особенности", "История и особенности"],
  ["Что посмотреть на месте", "Что посмотреть на месте"],
  ["Как добраться", "Как добраться"],
  ["Когда лучше ехать", "Когда лучше ехать"],
  ["Сколько времени нужно", "Сколько времени нужно"],
  ["Кому подойдёт", "Кому подойдёт"],
  ["Кому подойдет", "Кому подойдёт"],
  ["Что взять с собой", "Что взять с собой"],
  ["Что посмотреть рядом", "Что посмотреть рядом"],
  ["Экскурсии, туры, жильё и трансфер", "Экскурсии, туры, жильё и трансфер"],
  ["Экскурсии, туры, жилье и трансфер", "Экскурсии, туры, жильё и трансфер"],
  ["Практическая информация", "Практическая информация"],
  ["Итоговый вывод", "Итоговый вывод"],
]);

const sectionNumberTitles = new Map([
  [2, "Краткое описание"],
  [3, "Основное описание"],
  [4, "История и особенности"],
  [5, "Что посмотреть на месте"],
  [6, "Как добраться"],
  [7, "Когда лучше ехать"],
  [8, "Сколько времени нужно"],
  [9, "Кому подойдёт"],
  [10, "Что взять с собой"],
  [11, "Что посмотреть рядом"],
  [12, "Экскурсии, туры, жильё и трансфер"],
  [13, "Практическая информация"],
  [16, "Итоговый вывод"],
]);

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function normalizeWhitespace(value) {
  return value.replace(/\r/g, "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function cleanText(value) {
  return normalizeWhitespace(value)
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\[\d+]/g, "$1")
    .replace(/\s*\(\[[^\]]+]\[\d+]\)/g, "")
    .replace(/^\[\d+]:\s+.+$/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[“”]/g, "\"")
    .replace(/[«»]/g, "\"")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toParagraphs(value) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/\n{2,}/)
    .map((item) => cleanText(item.replace(/\n+/g, " ")))
    .filter(Boolean);
}

function shorten(value, maxLength) {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }

  const slice = text.slice(0, maxLength);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd > Math.floor(maxLength * 0.55)) {
    return slice.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxLength).trim()}...`;
}

function slugify(value) {
  const map = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return value
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/ь|ъ/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeSlug(value, fallbackTitle) {
  const raw = cleanText(value)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^attractions\//, "");
  const lastSegment = raw.split("/").filter(Boolean).at(-1) ?? raw;
  return slugify(lastSegment || fallbackTitle) || slugify(fallbackTitle) || "attraction";
}

function stripSourceNumber(value) {
  return cleanText(value).replace(/^\d+\.\s*/, "");
}

function normalizeTitleKey(value) {
  return stripSourceNumber(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\([^)]*\)/g, " ")
    .replace(/["«»]/g, "")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleKeyMatches(heading, titleKey) {
  if (heading === titleKey || heading.startsWith(`${titleKey} `) || titleKey.startsWith(`${heading} `)) {
    return true;
  }

  const headingTokens = heading.split(" ").filter(Boolean);
  const titleTokens = titleKey.split(" ").filter(Boolean);
  if (headingTokens.length === 0 || titleTokens.length === 0) {
    return false;
  }

  let headingIndex = 0;
  for (const titleToken of titleTokens) {
    while (headingIndex < headingTokens.length && headingTokens[headingIndex] !== titleToken) {
      headingIndex += 1;
    }

    if (headingIndex >= headingTokens.length) {
      return false;
    }

    headingIndex += 1;
  }

  return true;
}

function buildFallbackTextFromDirectoryNames(entries) {
  return entries
    .map((entry) => {
      const title = stripSourceNumber(entry.name);
      const slug = slugify(title) || `attraction-${entry.name.replace(/\D+/g, "")}`;
      return `# ${title}

## 1. SEO-блок для страницы

* **SEO Title:** ${title}: как добраться и что посмотреть — Крым Вокруг
* **Meta Description:** ${title} в Крыму: краткое описание, как добраться, что посмотреть рядом и что проверить перед поездкой.
* **H1:** ${title}
* **URL / slug:** \`/attractions/${slug}\`
* **Основной запрос:** ${title} Крым
* **Дополнительные запросы:** ${title} как добраться; ${title} фото; ${title} координаты; что посмотреть рядом
* **Alt-тексты для фото:**
  * ${title}: общий вид

## 2. Краткое описание достопримечательности

${title} — достопримечательность Крыма для самостоятельной поездки или включения в маршрут по полуострову. Перед посещением стоит сверить точку на карте, состояние подъезда и актуальные правила доступа.

## 3. Основное описание

${title} удобно добавить в маршрут по Крыму, если вы планируете знакомство с историческими местами, природными локациями или городскими прогулками. Для карточки используется базовое описание, потому что подробный текстовый блок для этого объекта в исходной папке не заполнен.

## 6. Как добраться

Точный маршрут зависит от выбранной точки старта. Перед поездкой проверьте навигацию по карте, состояние дороги, парковку и возможность прохода к объекту.

## 13. Практическая информация

* **Тип:** достопримечательность
* **Важно:** координаты и доступ нужно сверять перед поездкой

## 14. FAQ для SEO

**Как добраться до ${title}?**
Постройте маршрут по карте от вашей точки старта и заранее проверьте подъезд, парковку и сезонные ограничения.
`;
    })
    .join("\n---\n\n");
}

function appendFallbackTextForMissingDirectoryNames(text, entries) {
  const headings = [...text.replace(/\r/g, "").matchAll(/^#\s+(.+)$/gm)]
    .map((match) => normalizeTitleKey(match[1]))
    .filter(Boolean);
  const missing = entries.filter((entry) => {
    const titleKey = normalizeTitleKey(entry.name);
    if (!titleKey) {
      return false;
    }

    return !headings.some((heading) => titleKeyMatches(heading, titleKey));
  });

  if (missing.length === 0) {
    return text;
  }

  return `${text.trim()}\n\n---\n\n${buildFallbackTextFromDirectoryNames(missing)}`;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const cleaned = cleanText(String(value ?? "")).replace(/[.;]$/, "");
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function extractField(block, label) {
  const escaped = escapeRegExp(label);
  const boldPattern = new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?\\*\\*${escaped}:\\*\\*\\s*([^\\n]*)`, "i");
  const boldMatch = block.match(boldPattern);
  if (boldMatch) {
    const inlineValue = cleanText(boldMatch[1] ?? "");
    if (inlineValue) {
      return inlineValue;
    }

    const after = block.slice((boldMatch.index ?? 0) + boldMatch[0].length);
    const nextLine = after
      .split(/\n/)
      .map((line) => cleanText(line))
      .find(Boolean);
    if (nextLine) {
      return nextLine;
    }
  }

  const tablePattern = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[\\t:]\\s*([^\\n]+)`, "i");
  return cleanText(block.match(tablePattern)?.[1] ?? "");
}

function extractFieldAny(block, labels) {
  for (const label of labels) {
    const value = extractField(block, label);
    if (value) {
      return value;
    }
  }

  return "";
}

function getObjectBlocks(text, fileName) {
  const normalized = text.replace(/\r/g, "");
  const hashNumberMatches = [...normalized.matchAll(/^#{1,3}\s*(\d{3})\.\s+(.+)$/gm)];
  if (hashNumberMatches.length > 0) {
    return hashNumberMatches.map((match, index) => {
      const next = hashNumberMatches[index + 1];
      return {
        sourceNumber: Number(match[1]),
        sourceTitle: cleanText(match[2]),
        markdown: normalized.slice(match.index, next?.index ?? normalized.length),
      };
    });
  }

  const plainNumberMatches = [...normalized.matchAll(/^(\d{3})\.\s+(.+)$/gm)];
  if (plainNumberMatches.length > 0) {
    return plainNumberMatches.map((match, index) => {
      const next = plainNumberMatches[index + 1];
      return {
        sourceNumber: Number(match[1]),
        sourceTitle: cleanText(match[2]),
        markdown: normalized.slice(match.index, next?.index ?? normalized.length),
      };
    });
  }

  const topHeadings = [...normalized.matchAll(/^#\s+(.+)$/gm)].filter((match) => {
    const title = cleanText(match[1]);
    return !/^SEO-/i.test(title) && !/^\d+\./.test(title);
  });
  if (topHeadings.length > 0) {
    const startNumber = Number(fileName.match(/^(\d{3})/)?.[1] ?? 0);
    return topHeadings.map((match, index) => {
      const next = topHeadings[index + 1];
      return {
        sourceNumber: startNumber > 0 ? startNumber + index : null,
        sourceTitle: cleanText(match[1]),
        markdown: normalized.slice(match.index, next?.index ?? normalized.length),
      };
    });
  }

  const startNumber = Number(fileName.match(/^(\d{3})/)?.[1] ?? 0);
  return [
    {
      sourceNumber: startNumber || null,
      sourceTitle: "",
      markdown: normalized,
    },
  ];
}

function parseNumberedSections(block) {
  const matches = [
    ...block.matchAll(/^(?:#{1,4}\s*)?(\d+)(?:[–-]\d+)?\.\s+(.+)$/gm),
  ].filter((match) => Number(match[1]) <= 17);
  const sections = new Map();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const number = Number(match[1]);
    const mappedTitle = sectionNumberTitles.get(number);
    if (!mappedTitle || sections.has(mappedTitle)) {
      continue;
    }

    const body = block.slice((match.index ?? 0) + match[0].length, next?.index ?? block.length);
    sections.set(mappedTitle, body.trim());
  }

  return sections;
}

function parseBoldSections(block) {
  const labelPattern = sectionLabels.map(escapeRegExp).join("|");
  const regex = new RegExp(
    `\\*\\*(${labelPattern})(?:\\.|:)?\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*(?:${labelPattern})(?:\\.|:)?\\*\\*|\\n#{1,4}\\s+\\d+\\.|\\n---|\\n\\[\\d+]:|$)`,
    "g",
  );
  const sections = new Map();

  for (const match of block.matchAll(regex)) {
    const title = outputSectionTitles.get(match[1]) ?? match[1];
    if (!sections.has(title)) {
      sections.set(title, match[2].trim());
    }
  }

  return sections;
}

function parseListAndBody(raw) {
  const list = [];
  const nonListLines = [];

  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*•]\s+(.+)/);
    const numbered = trimmed.match(/^\d+\.\s+(.+)/);
    if (bullet || numbered) {
      list.push(cleanText((bullet ?? numbered)?.[1] ?? ""));
      continue;
    }
    nonListLines.push(line);
  }

  return {
    body: toParagraphs(nonListLines.join("\n")),
    list: uniqueStrings(list),
  };
}

function buildSections(block) {
  const numbered = parseNumberedSections(block);
  const bold = parseBoldSections(block);
  const sections = [];
  const seen = new Set();

  for (const title of sectionNumberTitles.values()) {
    const raw = numbered.get(title) || bold.get(title) || "";
    if (!raw || seen.has(title)) {
      continue;
    }

    const parsed = parseListAndBody(raw);
    if (parsed.body.length === 0 && parsed.list.length === 0) {
      continue;
    }

    sections.push({
      title,
      body: parsed.body.slice(0, 4),
      ...(parsed.list.length > 0 ? { list: parsed.list.slice(0, 8) } : {}),
    });
    seen.add(title);
  }

  return sections;
}

function getSectionText(sections, title) {
  const section = sections.find((item) => item.title === title);
  if (!section) {
    return "";
  }

  return cleanText([...section.body, ...(section.list ?? [])].join(" "));
}

function splitSeoList(value) {
  return uniqueStrings(
    value
      .split(/[;\n]/)
      .flatMap((item) => item.split(/,\s+(?=[А-ЯA-ZЁ])/))
      .map((item) => item.trim()),
  );
}

function extractAltTexts(block, title) {
  const raw = extractFieldAny(block, ["Alt-тексты для фото", "Alt-тексты"]);
  const inline = splitSeoList(raw);
  if (inline.length > 0) {
    return inline;
  }

  const altHeading = block.match(/\*\*Alt-[^*]+:\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*|$)/i);
  if (!altHeading) {
    return [`${title}: фото появится позже`];
  }

  return uniqueStrings(
    altHeading[1]
      .split(/\n/)
      .map((line) => line.replace(/^\s*\d+\.\s+/, "").trim()),
  );
}

function parseFactsFromPracticalInfo(text) {
  const facts = [];

  for (const line of text.split(/\n/)) {
    const match =
      line.match(/^\s*[-*•]\s+\*\*([^:*]+):\*\*\s*(.+)$/) ??
      line.match(/^\s*[-*•]\s+([^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = cleanText(match[1]);
    const value = cleanText(match[2]);
    if (label && value) {
      facts.push({ label, value: shorten(value, 180) });
    }
  }

  return facts;
}

function parseFactsFromPracticalSection(section) {
  if (!section) {
    return [];
  }

  const candidates = [
    ...(section.list ?? []),
    ...section.body.flatMap((paragraph) => paragraph.split(/;\s+|\.\s+(?=[А-ЯЁA-Z])/)),
  ];

  return candidates
    .map((line) => {
      const match = cleanText(line).match(/^([^:]{2,48}):\s*(.+)$/);
      if (!match) {
        return null;
      }

      return {
        label: cleanText(match[1]),
        value: shorten(match[2], 180),
      };
    })
    .filter(Boolean);
}

function extractCoordinates(text) {
  const match = text.match(/(?:координаты|coordinates)[^\d]*(4[4-6]\.\d+)[^\d]+(3[2-6]\.\d+)/i);
  if (!match) {
    return { latitude: null, longitude: null };
  }

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

function inferCategory(title, block) {
  const titleValue = title.toLowerCase();
  const blockValue = block.slice(0, 5000).toLowerCase();

  if (/музей|галере|экспозиц|выстав/.test(titleValue)) return "Музеи и выставки";
  if (/храм|собор|церк|мечет|монастыр|кирх|кост[её]л|кенас|синагог|часовн/.test(titleValue)) {
    return "Храмы и исторические места";
  }
  if (/крепост|форт|башн|ворота|руин|городищ|курган|мавзол|караван-сарай|усыпальниц/.test(titleValue)) {
    return "Крепости и древности";
  }
  if (/памятник|обелиск|мемориал|батаре|диорам|панорам/.test(titleValue)) return "История и мемориалы";
  if (/театр|аквариум|крокодил|зоопарк|дельфинар|дримвуд|аттракцион|тайган|тропик-парк/.test(titleValue)) {
    return "Семейный отдых";
  }
  if (/вин|шампан|винодель|завод/.test(titleValue)) return "Винодельни";
  if (/пляж|набережн/.test(titleValue)) return "Пляжи и набережные";
  if (/водопад|озер|мыс|скал|гора|ущель|пещер|заповедник|урочище|долина|каньон|бухта|тропа/.test(titleValue)) {
    return "Природа и маршруты";
  }
  if (/дворец|парк|сад|сквер|аллея|роща/.test(titleValue)) return "Парки и дворцы";
  if (/бан[ия]/.test(titleValue)) return "Храмы и исторические места";

  if (/музей|галере|экспозиц|выстав/.test(blockValue)) return "Музеи и выставки";
  if (/храм|собор|церк|мечет|монастыр|кирх|кост[её]л|кенас|синагог|часовн|бан[ия]/.test(blockValue)) {
    return "Храмы и исторические места";
  }
  if (/крепост|форт|башн|ворота|руин|городищ|курган|мавзол|караван-сарай|усыпальниц/.test(blockValue)) {
    return "Крепости и древности";
  }
  if (/памятник|обелиск|мемориал|батаре|диорам|панорам/.test(blockValue)) return "История и мемориалы";
  if (/театр|аквариум|крокодил|зоопарк|дельфинар|дримвуд|аттракцион|тайган|тропик-парк/.test(blockValue)) {
    return "Семейный отдых";
  }
  if (/вин|шампан|винодель|завод/.test(blockValue)) return "Винодельни";
  if (/водопад|озер|мыс|скал|гора|ущель|пещер|заповедник|урочище|долина|каньон|бухта|тропа/.test(blockValue)) {
    return "Природа и маршруты";
  }
  if (/пляж|набережн/.test(blockValue)) return "Пляжи и набережные";
  if (/дворец|парк|сад|сквер|аллея|роща/.test(blockValue)) return "Парки и дворцы";
  return "Достопримечательности";
}

function inferLocation(title, block, facts) {
  const fromFacts = facts.find((fact) => /^(город|насел[её]нный пункт)$/i.test(fact.label))?.value;
  if (fromFacts) {
    return cleanText(fromFacts.split(/[,.;]/)[0]);
  }

  const candidates = [
    title.match(/\(([^)]+)\)/)?.[1] ?? "",
    title.includes(",") ? title.split(",").at(-1) ?? "" : "",
    block.slice(0, 5000),
  ];

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const found = knownLocations.find((location) => {
      const locationKey = location.toLowerCase();
      return new RegExp(`(^|[^а-яё])${escapeRegExp(locationKey)}([^а-яё]|$)`, "i").test(normalized);
    });
    if (found) {
      return found === "Щелкино" ? "Щёлкино" : found;
    }
  }

  return null;
}

function extractNearby(sections) {
  const text = getSectionText(sections, "Что посмотреть рядом");
  if (!text) {
    return [];
  }

  return uniqueStrings(
    text
      .replace(/^рядом удобно добавить[:\s]*/i, "")
      .split(/[,;]\s+|\s+и\s+/)
      .map((item) => item.replace(/\.$/, "")),
  ).slice(0, 8);
}

function extractFaq(block) {
  const faq = [];
  const qaRegex = /(?:Вопрос:\s*)?(.+?\?)\s*\n(?:Ответ:\s*)?(.+?)(?=\n(?:Вопрос:|[^.\n]{3,120}\?)|\n\s*\*\*|$)/g;
  const faqArea =
    block.match(/(?:FAQ[^#\n]*\n)([\s\S]*?)(?=\n(?:#{1,4}\s+15\.|#{1,4}\s+16\.|17\.|---|\[\d+]:)|$)/i)?.[1] ??
    "";

  for (const match of faqArea.matchAll(qaRegex)) {
    const question = cleanText(match[1]);
    const answer = cleanText(match[2]);
    if (question && answer && question.length < 180 && answer.length < 500) {
      faq.push({ question, answer: shorten(answer, 320) });
    }
  }

  return faq.slice(0, 5);
}

function firstSourceUrl(block) {
  const urls = [...block.matchAll(/https?:\/\/[^\s)"']+/g)].map((match) =>
    match[0].replace(/[).,]+$/, ""),
  );
  return (
    urls.find((url) => !/yandex|bing|tse\d|wikipedia/i.test(url)) ??
    urls.find((url) => !/yandex|bing|tse\d/i.test(url)) ??
    null
  );
}

function firstMapUrl(block) {
  return [...block.matchAll(/https?:\/\/[^\s)"']+/g)]
    .map((match) => match[0].replace(/[).,]+$/, ""))
    .find((url) => /yandex\.ru\/maps/i.test(url)) ?? null;
}

function buildSearchKeywords(block, title, h1) {
  return uniqueStrings([
    title,
    h1,
    extractFieldAny(block, ["Основной поисковый запрос", "Основной запрос"]),
    ...splitSeoList(extractFieldAny(block, ["Дополнительные SEO-запросы", "Дополнительные запросы"])),
    ...splitSeoList(extractFieldAny(block, ["LSI-фразы"])),
  ]).slice(0, 18);
}

function parseAttraction(blockInfo, existingSlugIds, usedIds) {
  const { markdown, sourceNumber, sourceTitle } = blockInfo;
  const seoTitle = extractField(markdown, "SEO Title");
  const metaDescription = extractField(markdown, "Meta Description");
  const h1 = extractField(markdown, "H1") || sourceTitle;
  const title = cleanText(h1 || sourceTitle).replace(/: путеводитель.+$/i, "");
  const slug = normalizeSlug(extractField(markdown, "URL / slug"), title);
  const sections = buildSections(markdown);
  const practicalSection = sections.find((section) => section.title === "Практическая информация");
  const practicalInfo = getSectionText(sections, "Практическая информация");
  const facts = [
    ...parseFactsFromPracticalInfo(practicalInfo),
    ...parseFactsFromPracticalSection(practicalSection),
  ];
  const locationName = inferLocation(title, markdown, facts);
  const coordinates = extractCoordinates(markdown);
  const altTexts = extractAltTexts(markdown, title);
  const shortDescription =
    extractField(markdown, "Короткое описание для карточки") ||
    shorten(getSectionText(sections, "Краткое описание"), 260) ||
    shorten(metaDescription, 260);
  const description =
    shorten(getSectionText(sections, "Основное описание") || getSectionText(sections, "Краткое описание"), 900) ||
    shortDescription;
  const nearby = extractNearby(sections);
  const category = inferCategory(title, markdown);
  const existingId = existingSlugIds.get(slug) ?? null;
  let id = existingId?.startsWith("attraction_new_") ? existingId : "";
  if (!id) {
    const idBase = `attraction_new_${slug.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
    id = idBase;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${idBase}_${suffix}`;
      suffix += 1;
    }
  }

  return {
    id,
    slug,
    existingId,
    sourceNumber,
    item: {
      title,
      slug,
      h1: cleanText(h1 || title),
      seoTitle: seoTitle || `${title} — достопримечательность Крыма`,
      metaDescription: metaDescription || shortDescription,
      category,
      tags: uniqueStrings([category, locationName, ...buildSearchKeywords(markdown, title, h1).slice(2, 8)]),
      locationName,
      locationAliases: uniqueStrings([locationName, ...(nearby.slice(0, 4) ?? [])]),
      districtName: facts.find((fact) => /^район$/i.test(fact.label))?.value ?? null,
      address: facts.find((fact) => /^адрес$/i.test(fact.label))?.value ?? null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      shortDescription,
      description,
      gallery: [
        {
          url: placeholderUrl,
          alt: altTexts[0] || `${title}: фото появится позже`,
        },
      ],
      websiteUrl: firstSourceUrl(markdown),
      mapUrl: firstMapUrl(markdown),
      facts: uniqueFacts([
        ...facts,
        factFromSection("Время на посещение", getSectionText(sections, "Сколько времени нужно")),
        factFromSection("Лучший сезон", getSectionText(sections, "Когда лучше ехать")),
      ]),
      sections: sections.filter((section) => section.title !== "Краткое описание"),
      nearby,
      faq: extractFaq(markdown),
      searchKeywords: buildSearchKeywords(markdown, title, h1),
      status: "PUBLISHED",
      isPublishedVisible: true,
      createdByLogin: "code",
      createdAt: importedAt,
      updatedAt: importedAt,
    },
  };
}

function factFromSection(label, value) {
  const shortened = shorten(value, 180);
  return shortened ? { label, value: shortened } : null;
}

function uniqueFacts(facts) {
  const result = [];
  const seen = new Set();

  for (const fact of facts) {
    if (!fact?.label || !fact?.value) {
      continue;
    }

    const key = fact.label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ label: fact.label, value: fact.value });
  }

  return result.slice(0, 8);
}

async function readSourceFiles() {
  const directories = (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .filter((entry) => onlyDirs.size === 0 || onlyDirs.has(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => Number(left) - Number(right));
  const files = [];

  for (const directory of directories) {
    const directoryPath = path.join(sourceRoot, directory);
    const fileNames = (await readdir(directoryPath)).filter((fileName) => fileName.endsWith(".txt"));
    const childDirectories = (await readdir(directoryPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name, "ru", { numeric: true }));
    for (const fileName of fileNames.sort()) {
      const filePath = path.join(directoryPath, fileName);
      let text = await readFile(filePath, "utf8");
      if (!text.trim()) {
        text = buildFallbackTextFromDirectoryNames(childDirectories);
      } else {
        text = appendFallbackTextForMissingDirectoryNames(text, childDirectories);
      }

      files.push({
        directory,
        fileName,
        path: filePath,
        text,
      });
    }
  }

  return files;
}

async function main() {
  const existing = JSON.parse(await readFile(overridesPath, "utf8"));
  const existingSlugIds = new Map();
  for (const [id, item] of Object.entries(existing)) {
    if (item?.slug) {
      existingSlugIds.set(item.slug, id);
    }
  }

  const usedIds = new Set(Object.keys(existing));
  const parsed = [];
  for (const file of await readSourceFiles()) {
    for (const block of getObjectBlocks(file.text, file.fileName)) {
      const parsedItem = parseAttraction(block, existingSlugIds, usedIds);
      usedIds.add(parsedItem.id);
      parsed.push({ ...parsedItem, sourceFile: `${file.directory}/${file.fileName}` });
    }
  }

  const uniqueBySlug = new Map();
  const duplicateInBatch = [];
  for (const entry of parsed) {
    if (uniqueBySlug.has(entry.slug)) {
      duplicateInBatch.push(entry);
      continue;
    }
    uniqueBySlug.set(entry.slug, entry);
  }

  const upserts = [...uniqueBySlug.values()].filter(
    (entry) => !entry.existingId || entry.existingId.startsWith("attraction_new_"),
  );
  const skippedExisting = [...uniqueBySlug.values()].filter(
    (entry) => entry.existingId && !entry.existingId.startsWith("attraction_new_"),
  );

  console.log(`Parsed objects: ${parsed.length}`);
  console.log(`Unique new-source slugs: ${uniqueBySlug.size}`);
  console.log(`Skipped existing slugs: ${skippedExisting.length}`);
  console.log(`Skipped duplicate slugs in source batch: ${duplicateInBatch.length}`);
  console.log(`Will add/update: ${upserts.length}`);

  if (skippedExisting.length > 0) {
    console.log("\nExisting slugs:");
    for (const entry of skippedExisting.slice(0, 30)) {
      console.log(`- ${entry.slug} -> ${entry.existingId} (${entry.item.title})`);
    }
    if (skippedExisting.length > 30) {
      console.log(`...and ${skippedExisting.length - 30} more`);
    }
  }

  if (dryRun) {
    return;
  }

  await mkdir(publicAttractionsRoot, { recursive: true });
  if (!existsSync(placeholderPublicPath)) {
    await copyFile(placeholderSourcePath, placeholderPublicPath);
  }

  for (const entry of upserts) {
    existing[entry.id] = entry.item;
  }

  await writeFile(overridesPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
