#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const preparedMissingPath = path.join(
  root,
  "dostoprimechatelnosti-bez-foto-v-kartochke",
  "missing-attractions.json",
);
const sourcesPath = path.join(root, "data", "attractions-photo-sources.json");
const cachePath = path.join(root, "tmp-attraction-photo-search-cache.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const placeholderUrl = "/attractions/zaglushka.png";
const userAgent = "KrymVokrugPhotoFill/1.0 (https://krymvokrug.ru; local maintenance)";

const genericTokens = new Set([
  "a",
  "ai",
  "aya",
  "aquapark",
  "beach",
  "crimea",
  "crimean",
  "delfinariy",
  "dostoprimechatelnost",
  "gora",
  "hram",
  "krym",
  "krymu",
  "more",
  "mount",
  "mys",
  "naberezhnaya",
  "park",
  "plyazh",
  "skala",
  "v",
  "waterpark",
  "ya",
  "yalta",
  "аквапарк",
  "аквариум",
  "аллея",
  "бухта",
  "дельфинарий",
  "в",
  "вокруг",
  "гора",
  "город",
  "городской",
  "достопримечательность",
  "достопримечательности",
  "и",
  "им",
  "имени",
  "крым",
  "крыму",
  "место",
  "море",
  "музей",
  "мыс",
  "на",
  "набережная",
  "озеро",
  "парк",
  "пляж",
  "площадка",
  "площадь",
  "республика",
  "скала",
  "смотровая",
  "у",
  "урочище",
  "храм",
]);

const badCandidateWords = [
  "map",
  "schema",
  "scheme",
  "logo",
  "icon",
  "poster",
  "emblem",
  "seal",
  "flag",
  "карта",
  "схема",
  "логотип",
  "афиша",
  "герб",
  "флаг",
];

const strictTypeTokens = new Set(
  [
    "аквапарк",
    "akvapark",
    "waterpark",
    "aquapark",
    "аквариум",
    "akvarium",
    "aquarium",
    "батарея",
    "batareya",
    "battery",
    "береговая",
    "coastal",
    "бухта",
    "buhta",
    "bay",
    "башня",
    "bashnya",
    "tower",
    "водопад",
    "vodopad",
    "waterfall",
    "гора",
    "gora",
    "mountain",
    "городище",
    "gorodische",
    "settlement",
    "дельфинарий",
    "delfinariy",
    "dolphinarium",
    "дендропарк",
    "dendropark",
    "динопарк",
    "dinopark",
    "дом",
    "dom",
    "house",
    "дворец",
    "dvorets",
    "palace",
    "коса",
    "kosa",
    "spit",
    "крепость",
    "krepost",
    "fortress",
    "fort",
    "маяк",
    "mayak",
    "lighthouse",
    "мемориал",
    "memorial",
    "мечеть",
    "mechet",
    "mosque",
    "монастырь",
    "monastyr",
    "monastery",
    "музей",
    "muzey",
    "museum",
    "мыс",
    "mys",
    "cape",
    "набережная",
    "naberezhnaya",
    "embankment",
    "озеро",
    "ozero",
    "lake",
    "памятник",
    "pamyatnik",
    "monument",
    "парк",
    "park",
    "пещера",
    "peshchera",
    "cave",
    "пляж",
    "plyazh",
    "beach",
    "собор",
    "sobor",
    "cathedral",
    "скала",
    "skala",
    "rock",
    "тропа",
    "tropa",
    "trail",
    "церковь",
    "tserkov",
    "church",
  ].map(stemToken),
);

const translitMap = {
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

const englishSlugWords = new Map([
  ["akvapark", "waterpark"],
  ["beregovaya", "coastal"],
  ["beregovoy", "coastal"],
  ["batareya", "battery"],
  ["bashnya", "tower"],
  ["buhta", "bay"],
  ["dacha", "villa"],
  ["dvorets", "palace"],
  ["fort", "fort"],
  ["gora", "mountain"],
  ["gorodische", "settlement"],
  ["grota", "grotto"],
  ["grot", "grotto"],
  ["hram", "church"],
  ["kanon", "canyon"],
  ["kamenolomni", "quarries"],
  ["kostel", "church"],
  ["krepost", "fortress"],
  ["mayak", "lighthouse"],
  ["mechet", "mosque"],
  ["monastyr", "monastery"],
  ["mys", "cape"],
  ["naberezhnaya", "embankment"],
  ["ozero", "lake"],
  ["park", "park"],
  ["peshchera", "cave"],
  ["plyazh", "beach"],
  ["ploshchad", "square"],
  ["skala", "rock"],
  ["sobor", "cathedral"],
  ["tropa", "trail"],
  ["tserkov", "church"],
  ["vodopad", "waterfall"],
  ["vodokhranilishche", "reservoir"],
  ["yayla", "yayla"],
]);

const englishLocationWords = new Map([
  ["алупка", "Alupka"],
  ["алушта", "Alushta"],
  ["балаклава", "Balaklava"],
  ["бахчисарай", "Bakhchisaray"],
  ["белогорск", "Belogorsk"],
  ["евпатория", "Eupatoria"],
  ["ялта", "Yalta"],
  ["керчь", "Kerch"],
  ["коктебель", "Koktebel"],
  ["крым", "Crimea"],
  ["новый свет", "Novy Svet"],
  ["оленевка", "Olenevka"],
  ["партенит", "Partenit"],
  ["севастополь", "Sevastopol Sebastopol"],
  ["симеиз", "Simeiz"],
  ["симферополь", "Simferopol"],
  ["судак", "Sudak"],
  ["феодосия", "Feodosia"],
  ["форос", "Foros"],
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const valueOf = (name, fallback = "") => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  };

  const ids = valueOf("ids")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const minScore = Number(valueOf("min-score", "5.5"));

  return {
    dryRun: args.includes("--dry-run"),
    onlyPrepared: args.includes("--only-prepared"),
    overwrite: args.includes("--overwrite"),
    includeOpenverse: !args.includes("--no-openverse"),
    includeWikidata: !args.includes("--no-wikidata"),
    limit: Number(valueOf("limit", "0")) || Infinity,
    maxImages: Math.max(1, Math.min(3, Number(valueOf("max-images", "1")) || 1)),
    minScore: Number.isFinite(minScore) ? minScore : 5.5,
    ids: new Set(ids),
  };
}

const options = parseArgs();

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"']/g, " ")
    .replace(/[-‐‑‒–—―−_+:/\\()[\]{}.,;!?|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transliterate(value) {
  return String(value ?? "")
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] ?? char)
    .join("");
}

function cleanTitle(value) {
  return stripHtml(value)
    .replace(/\s+—\s+достопримечательность.*$/iu, "")
    .replace(/\s+достопримечательность\s+Крыма\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stemToken(token) {
  if (/^[a-z0-9]+$/i.test(token)) {
    return token.replace(/(skaya|skiy|sky|aya|iy|yy|yi|oe|aya|ogo|ogo|om|em|ye|y|i|a)$/i, "");
  }

  return token.replace(
    /(ского|цкого|ская|цкая|ский|цкий|ское|цкое|ыми|ими|ого|его|ому|ему|ами|ями|ной|ний|ой|ый|ий|ая|ое|ые|ых|их|ью|ия|ие|а|я|ы|и|е|у|ю|ом|ем)$/u,
    "",
  );
}

function tokens(value, { keepGeneric = false } = {}) {
  const normalized = `${normalizeText(value)} ${normalizeText(transliterate(value))}`;
  return normalized
    .split(" ")
    .map(stemToken)
    .filter((token) => token.length > 2 || /^\d+$/.test(token))
    .filter((token) => keepGeneric || !genericTokens.has(token));
}

function uniqueBy(values, key) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const currentKey = key(value);
    if (!currentKey || seen.has(currentKey)) {
      continue;
    }
    seen.add(currentKey);
    result.push(value);
  }
  return result;
}

function queryVariants(item) {
  const title = cleanTitle(item.title);
  const location = item.locationName ? cleanTitle(item.locationName) : "";
  const district = item.districtName ? cleanTitle(item.districtName) : "";
  const slugWords = String(item.slug ?? "").replace(/-/g, " ");
  const englishSlug = englishFromSlug(slugWords);
  const englishLocation = englishFromLocation(location || district);

  return uniqueBy(
    [
      location ? `${title} ${location} Крым` : "",
      `${title} Крым`,
      location ? `${title} ${location}` : "",
      district ? `${title} ${district}` : "",
      title,
      englishLocation ? `${englishSlug} ${englishLocation} Crimea` : "",
      `${slugWords} Crimea`,
    ]
      .map((query) => query.replace(/\s+/g, " ").trim())
      .filter(Boolean),
    (query) => normalizeText(query),
  ).slice(0, 5);
}

function englishFromSlug(slugWords) {
  return String(slugWords ?? "")
    .split(/\s+/)
    .map((word) => englishSlugWords.get(word) ?? word)
    .join(" ");
}

function englishFromLocation(location) {
  return englishLocationWords.get(normalizeText(location)) || transliterate(location);
}

function isPlaceholderOnlyGallery(gallery) {
  return (
    Array.isArray(gallery) &&
    gallery.length > 0 &&
    gallery.every((image) => image?.url === placeholderUrl)
  );
}

function needsPhoto(item) {
  return !Array.isArray(item.gallery) || item.gallery.length === 0 || isPlaceholderOnlyGallery(item.gallery);
}

function localUrlFor(rootRelativePath) {
  return `/${rootRelativePath.replace(/\\/g, "/").replace(/^public\//, "")}`;
}

function sourceValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value ?? "");
}

function encodeParams(params) {
  return new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  ).toString();
}

const cache = await readJson(cachePath, {});
let cacheDirty = false;

async function flushCache() {
  if (!cacheDirty || options.dryRun) {
    return;
  }
  await writeJson(cachePath, cache);
  cacheDirty = false;
}

async function fetchJsonCached(key, url) {
  if (cache[key]) {
    return cache[key];
  }

  const json = await fetchJson(url);
  cache[key] = json;
  cacheDirty = true;
  return json;
}

async function fetchJson(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function commonsApi(params, cacheKey) {
  const url = `https://commons.wikimedia.org/w/api.php?${encodeParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  return fetchJsonCached(cacheKey ?? url, url);
}

async function wikidataApi(params, cacheKey) {
  const url = `https://www.wikidata.org/w/api.php?${encodeParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  return fetchJsonCached(cacheKey ?? url, url);
}

function commonsCandidateFromPage(page, context) {
  const info = page?.imageinfo?.[0];
  if (!info || !isUsableMime(info.mime)) {
    return null;
  }

  const metadata = info.extmetadata ?? {};
  return {
    provider: context.provider,
    query: context.query,
    title: stripHtml(page.title ?? sourceValue(metadata, "ObjectName")),
    description: stripHtml(`${sourceValue(metadata, "ImageDescription")} ${sourceValue(metadata, "Categories")}`),
    fileTitle: page.title,
    imageUrl: info.thumburl || info.url,
    originalUrl: info.url,
    landingUrl: info.descriptionurl,
    width: info.thumbwidth ?? info.width ?? null,
    height: info.thumbheight ?? info.height ?? null,
    mime: info.mime,
    license: sourceValue(metadata, "LicenseShortName") || sourceValue(metadata, "UsageTerms"),
    licenseUrl: sourceValue(metadata, "LicenseUrl"),
    author: sourceValue(metadata, "Artist") || sourceValue(metadata, "Credit"),
    source: "wikimedia-commons",
  };
}

function isUsableMime(mime) {
  return typeof mime === "string" && mime.startsWith("image/") && mime !== "image/svg+xml";
}

async function commonsSearchCandidates(query) {
  const json = await commonsApi(
    {
      action: "query",
      generator: "search",
      gsrnamespace: 6,
      gsrlimit: 12,
      gsrsearch: query,
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: 1600,
    },
    `commons-search:${query}`,
  );

  return Object.values(json.query?.pages ?? {})
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((page) => commonsCandidateFromPage(page, { provider: "commons", query }))
    .filter(Boolean);
}

async function commonsCategoryCandidates(query) {
  const search = await commonsApi(
    {
      action: "query",
      list: "search",
      srnamespace: 14,
      srlimit: 6,
      srsearch: query,
    },
    `commons-category-search:${query}`,
  );
  const queryLooseTokens = uniqueBy(tokens(query, { keepGeneric: true }), (token) => token);
  const queryTypeTokens = queryLooseTokens.filter((token) => strictTypeTokens.has(token));
  const queryNameTokens = uniqueBy(tokens(query), (token) => token);
  const categories = (search.query?.search ?? [])
    .map((entry) => entry.title)
    .filter((title) => /^Category:/i.test(title))
    .filter((title) => {
      const categoryHay = normalizeText(title);
      const typeMatched =
        queryTypeTokens.length === 0 || queryTypeTokens.some((token) => categoryHay.includes(token));
      const nameMatches = queryNameTokens.filter((token) => categoryHay.includes(token));
      return typeMatched && (queryNameTokens.length <= 1 || nameMatches.length >= 1);
    });
  const candidates = [];

  for (const categoryTitle of categories) {
    const members = await commonsApi(
      {
        action: "query",
        list: "categorymembers",
        cmtitle: categoryTitle,
        cmtype: "file",
        cmlimit: 12,
      },
      `commons-category-members:${categoryTitle}`,
    );
    const fileNames = (members.query?.categorymembers ?? [])
      .map((entry) => entry.title?.replace(/^File:/, ""))
      .filter(Boolean);
    const files = await commonsInfoForFiles(fileNames, {
      provider: "commons-category",
      query,
      categoryTitle,
    });
    for (const file of files) {
      file.description = [file.description, categoryTitle].filter(Boolean).join(" | ");
      candidates.push(file);
    }
  }

  return candidates;
}

async function commonsInfoForFiles(fileNames, context) {
  if (fileNames.length === 0) {
    return [];
  }

  const titles = fileNames.map((fileName) => `File:${fileName}`).join("|");
  const json = await commonsApi(
    {
      action: "query",
      titles,
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: 1600,
    },
    `commons-files:${titles}`,
  );

  return Object.values(json.query?.pages ?? {})
    .map((page) => commonsCandidateFromPage(page, context))
    .filter(Boolean);
}

async function wikipediaApi(params, cacheKey) {
  const url = `https://ru.wikipedia.org/w/api.php?${encodeParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  return fetchJsonCached(cacheKey ?? url, url);
}

async function wikipediaPageImageCandidates(query) {
  const json = await wikipediaApi(
    {
      action: "query",
      generator: "search",
      gsrnamespace: 0,
      gsrlimit: 5,
      gsrsearch: query,
      prop: "pageimages|pageprops",
      piprop: "name",
      pilicense: "free",
    },
    `wikipedia-pageimages:${query}`,
  );

  const pages = Object.values(json.query?.pages ?? {});
  const files = pages
    .map((page) => page.pageprops?.page_image_free ?? page.pageimage)
    .filter(Boolean);
  const candidates = await commonsInfoForFiles(files, { provider: "wikipedia", query });
  for (const candidate of candidates) {
    const page = pages.find((entry) => {
      const file = entry.pageprops?.page_image_free ?? entry.pageimage;
      return candidate.fileTitle?.endsWith(file);
    });
    candidate.description = [candidate.description, page?.title].filter(Boolean).join(" | ");
  }
  return candidates;
}

async function wikidataCandidates(query) {
  const search = await wikidataApi(
    {
      action: "wbsearchentities",
      language: "ru",
      uselang: "ru",
      type: "item",
      limit: 5,
      search: query,
    },
    `wikidata-search:${query}`,
  );
  const ids = (search.search ?? []).map((entry) => entry.id).filter(Boolean);
  if (ids.length === 0) {
    return [];
  }

  const entities = await wikidataApi(
    {
      action: "wbgetentities",
      ids: ids.join("|"),
      languages: "ru|en",
      props: "labels|descriptions|aliases|claims",
    },
    `wikidata-entities:${ids.join("|")}`,
  );

  const files = [];
  const byFile = new Map();
  for (const entity of Object.values(entities.entities ?? {})) {
    const labels = [entity.labels?.ru?.value, entity.labels?.en?.value].filter(Boolean);
    const descriptions = [entity.descriptions?.ru?.value, entity.descriptions?.en?.value].filter(Boolean);
    const aliases = [
      ...(entity.aliases?.ru ?? []).map((entry) => entry.value),
      ...(entity.aliases?.en ?? []).map((entry) => entry.value),
    ];
    const claims = entity.claims?.P18 ?? [];
    for (const claim of claims.slice(0, 3)) {
      const fileName = claim.mainsnak?.datavalue?.value;
      if (typeof fileName !== "string" || !fileName) {
        continue;
      }
      files.push(fileName);
      byFile.set(fileName, {
        wikidataId: entity.id,
        labels,
        descriptions,
        aliases,
      });
    }
  }

  const candidates = await commonsInfoForFiles(files, { provider: "wikidata", query });
  for (const candidate of candidates) {
    const fileName = candidate.fileTitle?.replace(/^File:/, "") ?? "";
    const entity = byFile.get(fileName);
    if (!entity) {
      continue;
    }
    candidate.wikidataId = entity.wikidataId;
    candidate.title = [candidate.title, ...entity.labels].filter(Boolean).join(" | ");
    candidate.description = [candidate.description, ...entity.descriptions, ...entity.aliases]
      .filter(Boolean)
      .join(" | ");
  }
  return candidates;
}

async function openverseCandidates(query) {
  const url = `https://api.openverse.engineering/v1/images/?${encodeParams({
    q: query,
    page_size: 12,
    license_type: "commercial",
  })}`;
  const json = await fetchJsonCached(`openverse:${query}`, url);

  return (json.results ?? [])
    .map((entry) => ({
      provider: "openverse",
      query,
      title: stripHtml(entry.title),
      description: stripHtml([entry.description, entry.tags?.map((tag) => tag.name).join(" ")].filter(Boolean).join(" ")),
      imageUrl: entry.url || entry.thumbnail,
      originalUrl: entry.url,
      landingUrl: entry.foreign_landing_url,
      width: entry.width ?? null,
      height: entry.height ?? null,
      mime: null,
      license: entry.license,
      licenseUrl: entry.license_url,
      author: stripHtml(entry.creator),
      source: entry.source,
    }))
    .filter((candidate) => candidate.imageUrl);
}

function scoreCandidate(item, candidate) {
  const targetTitle = cleanTitle(item.title);
  const targetSlug = String(item.slug ?? "").replace(/-/g, " ");
  const englishTarget = englishFromSlug(targetSlug);
  const targetTokens = uniqueBy(tokens(`${targetTitle} ${targetSlug} ${englishTarget}`), (token) => token).slice(0, 12);
  const looseTokens = uniqueBy(tokens(`${targetTitle} ${targetSlug} ${englishTarget}`, { keepGeneric: true }), (token) => token);
  const haystack = normalizeText(
    [
      candidate.title,
      candidate.description,
      candidate.fileTitle,
      candidate.landingUrl,
      candidate.originalUrl,
    ].join(" "),
  );
  const ownHaystack = normalizeText([candidate.title, candidate.fileTitle, candidate.originalUrl].join(" "));
  const normalizedTitle = normalizeText(targetTitle);

  const relevantTokens = targetTokens.length > 0 ? targetTokens : looseTokens.slice(0, 5);
  const matched = relevantTokens.filter((token) => haystack.includes(token));
  const matchedLoose = looseTokens.filter((token) => haystack.includes(token));
  const locationTokens = uniqueBy(
    tokens(
      [
        item.locationName,
        item.districtName,
        ...(Array.isArray(item.locationAliases) ? item.locationAliases : []),
        englishFromLocation(item.locationName ?? ""),
        englishFromLocation(item.districtName ?? ""),
      ].join(" "),
    ),
    (token) => token,
  );
  const locationMatches = locationTokens.filter((token) => haystack.includes(token));
  const targetTypeTokens = uniqueBy(
    looseTokens.filter((token) => strictTypeTokens.has(token)),
    (token) => token,
  );
  const typeMatches = targetTypeTokens.filter((token) => haystack.includes(token));
  const ownTypeMatches = targetTypeTokens.filter((token) => ownHaystack.includes(token));
  const nonTypeNameMatches = matched.filter(
    (token) => !strictTypeTokens.has(token) && !locationTokens.includes(token),
  );
  const ownNonTypeNameMatches = nonTypeNameMatches.filter((token) => ownHaystack.includes(token));
  const exactTitleMatch = normalizedTitle.length > 4 && haystack.includes(normalizedTitle);
  const strongSpecificNameMatch = nonTypeNameMatches.length >= 2;

  let score = 0;
  score += matched.length * 2.4;
  score += matchedLoose.length * 0.35;
  score += locationMatches.length * 1.2;
  if (exactTitleMatch) {
    score += 8;
  }
  if (haystack.includes("крым") || haystack.includes("crimea") || haystack.includes("krym")) {
    score += 1.6;
  }
  if (candidate.provider === "wikidata") {
    score += 2;
  }
  if (candidate.provider === "wikipedia" || candidate.provider === "commons-category") {
    score += 1.6;
  }
  if (candidate.provider === "commons") {
    score += 0.8;
  }
  if ((candidate.width ?? 0) >= 900 || (candidate.height ?? 0) >= 700) {
    score += 0.5;
  }
  if (badCandidateWords.some((word) => haystack.includes(word))) {
    score -= 4;
  }
  if (targetTypeTokens.length > 0 && typeMatches.length === 0 && !exactTitleMatch && !strongSpecificNameMatch) {
    score -= 6;
  }
  if (
    ["wikipedia", "commons-category"].includes(candidate.provider) &&
    targetTypeTokens.length > 0 &&
    ownTypeMatches.length === 0 &&
    ownNonTypeNameMatches.length < 2 &&
    !ownHaystack.includes(normalizedTitle)
  ) {
    score -= 6;
  }
  if (
    targetTypeTokens.length > 0 &&
    ownTypeMatches.length > 0 &&
    ownNonTypeNameMatches.length === 0 &&
    locationMatches.length === 0 &&
    !exactTitleMatch
  ) {
    score -= 4;
  }
  if (typeMatches.length > 0) {
    score += 1.2;
  }

  const tokenRatio = relevantTokens.length > 0 ? matched.length / relevantTokens.length : 0;
  if (matched.length === 0 && !exactTitleMatch) {
    score -= 6;
  }
  if (relevantTokens.length <= 2 && locationTokens.length > 0 && locationMatches.length === 0) {
    score -= 1.5;
  }

  return {
    ...candidate,
    score,
    tokenRatio,
    matchedTokens: matched,
    locationMatches,
    typeMatches,
    ownTypeMatches,
  };
}

function candidateKey(candidate) {
  return normalizeText(candidate.landingUrl || candidate.originalUrl || candidate.imageUrl || candidate.title);
}

async function findCandidates(item) {
  const candidates = [];
  for (const query of queryVariants(item)) {
    const tasks = [
      commonsSearchCandidates(query).catch(() => []),
      commonsCategoryCandidates(query).catch(() => []),
      options.includeWikidata ? wikidataCandidates(query).catch(() => []) : Promise.resolve([]),
      options.includeWikidata ? wikipediaPageImageCandidates(query).catch(() => []) : Promise.resolve([]),
      options.includeOpenverse ? openverseCandidates(query).catch(() => []) : Promise.resolve([]),
    ];
    const groups = await Promise.all(tasks);
    candidates.push(...groups.flat());

    const scored = uniqueBy(candidates.map((candidate) => scoreCandidate(item, candidate)), candidateKey)
      .filter((candidate) => candidate.score >= options.minScore)
      .sort((left, right) => right.score - left.score);
    if (scored.length >= options.maxImages * 2 || scored.some((candidate) => candidate.score >= 10)) {
      break;
    }
  }

  return uniqueBy(candidates.map((candidate) => scoreCandidate(item, candidate)), candidateKey)
    .filter((candidate) => candidate.score >= options.minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.maxImages * 4);
}

async function downloadBuffer(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function saveWebp(candidate, item, index) {
  const buffer = await downloadBuffer(candidate.imageUrl);
  const image = sharp(buffer, { limitInputPixels: 120_000_000 }).rotate();
  const metadata = await image.metadata();
  if ((metadata.width ?? 0) < 280 || (metadata.height ?? 0) < 220) {
    throw new Error(`image is too small: ${metadata.width}x${metadata.height}`);
  }

  const directory = path.join(publicAttractionsRoot, item.slug);
  await mkdir(directory, { recursive: true });
  const fileName = `image-${String(index + 1).padStart(2, "0")}.webp`;
  const outputPath = path.join(directory, fileName);
  if (existsSync(outputPath) && !options.overwrite) {
    return {
      fileName,
      outputPath,
      bytes: (await stat(outputPath)).size,
      width: metadata.width,
      height: metadata.height,
    };
  }

  await image
    .resize({
      width: 1400,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 76, effort: 5 })
    .toFile(outputPath);

  return {
    fileName,
    outputPath,
    bytes: (await stat(outputPath)).size,
    width: metadata.width,
    height: metadata.height,
  };
}

async function localExistingGallery(item) {
  const directory = path.join(publicAttractionsRoot, item.slug);
  try {
    const files = await readdir(directory);
    return files
      .filter((fileName) => /\.(?:jpe?g|png|webp)$/i.test(fileName))
      .filter((fileName) => !/zaglushka/i.test(fileName))
      .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
      .slice(0, options.maxImages)
      .map((fileName, index) => ({
        url: localUrlFor(path.join("public", "attractions", item.slug, fileName)),
        alt: `${cleanTitle(item.title)}: фото ${index + 1}`,
      }));
  } catch {
    return [];
  }
}

function sourceRecordFor(candidate, localUrl, saved) {
  return {
    localUrl,
    provider: candidate.provider,
    source: candidate.source,
    title: candidate.title,
    landingUrl: candidate.landingUrl,
    originalUrl: candidate.originalUrl,
    downloadedUrl: candidate.imageUrl,
    license: candidate.license,
    licenseUrl: candidate.licenseUrl,
    author: candidate.author,
    width: saved.width ?? candidate.width ?? null,
    height: saved.height ?? candidate.height ?? null,
    bytes: saved.bytes,
    score: Number(candidate.score.toFixed(2)),
    query: candidate.query,
  };
}

function buildTargets(data, preparedIds) {
  let targets = Object.entries(data)
    .filter(([, item]) => needsPhoto(item))
    .filter(([id]) => (options.onlyPrepared ? preparedIds.has(id) : true))
    .filter(([id]) => (options.ids.size > 0 ? options.ids.has(id) : true));

  targets = targets.sort(([leftId, left], [rightId, right]) => {
    const leftPrepared = preparedIds.has(leftId) ? 0 : 1;
    const rightPrepared = preparedIds.has(rightId) ? 0 : 1;
    if (leftPrepared !== rightPrepared) {
      return leftPrepared - rightPrepared;
    }
    return cleanTitle(left.title).localeCompare(cleanTitle(right.title), "ru");
  });

  return targets.slice(0, options.limit);
}

const data = await readJson(overridesPath, {});
const preparedMissing = await readJson(preparedMissingPath, []);
const preparedIds = new Set(preparedMissing.map((item) => item.id).filter(Boolean));
const sources = await readJson(sourcesPath, {});
const targets = buildTargets(data, preparedIds);
const now = new Date().toISOString();

const stats = {
  targets: targets.length,
  filledFromExistingLocal: 0,
  filledFromRemote: 0,
  failed: 0,
  images: 0,
};
const failures = [];

console.log(
  JSON.stringify(
    {
      dryRun: options.dryRun,
      targets: targets.length,
      maxImages: options.maxImages,
      minScore: options.minScore,
      onlyPrepared: options.onlyPrepared,
    },
    null,
    2,
  ),
);

for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
  const [id, item] = targets[targetIndex];
  const label = `${targetIndex + 1}/${targets.length} ${item.title}`;
  const localGallery = await localExistingGallery(item);

  if (localGallery.length > 0) {
    if (!options.dryRun) {
      data[id] = {
        ...item,
        gallery: localGallery,
        status: "PUBLISHED",
        isPublishedVisible: true,
        updatedAt: now,
      };
      sources[id] = {
        title: item.title,
        slug: item.slug,
        updatedAt: now,
        note: "Existing local files were linked; original external source was not changed.",
        images: localGallery.map((image) => ({ localUrl: image.url, provider: "local-existing" })),
      };
    }
    stats.filledFromExistingLocal += 1;
    stats.images += localGallery.length;
    console.log(`local ${label}: ${localGallery.map((image) => image.url).join(", ")}`);
    continue;
  }

  const candidates = await findCandidates(item);
  if (options.dryRun) {
    console.log(
      `dry ${label}: ${
        candidates
          .slice(0, options.maxImages)
          .map((candidate) => `${candidate.score.toFixed(1)} ${candidate.title}`)
          .join(" | ") || "no candidates"
      }`,
    );
    continue;
  }

  const gallery = [];
  const imageSources = [];
  for (const candidate of candidates) {
    if (gallery.length >= options.maxImages) {
      break;
    }
    try {
      const saved = await saveWebp(candidate, item, gallery.length);
      const localUrl = localUrlFor(path.join("public", "attractions", item.slug, saved.fileName));
      gallery.push({
        url: localUrl,
        alt: `${cleanTitle(item.title)}: фото ${gallery.length + 1}`,
      });
      imageSources.push(sourceRecordFor(candidate, localUrl, saved));
    } catch (error) {
      console.log(`skip ${label}: ${candidate.title} (${error.message})`);
    }
  }

  if (gallery.length === 0) {
    stats.failed += 1;
    failures.push({ id, title: item.title, slug: item.slug, queries: queryVariants(item) });
    console.log(`fail ${label}`);
    await flushCache();
    continue;
  }

  data[id] = {
    ...item,
    gallery,
    status: "PUBLISHED",
    isPublishedVisible: true,
    updatedAt: now,
  };
  sources[id] = {
    title: item.title,
    slug: item.slug,
    updatedAt: now,
    images: imageSources,
  };
  stats.filledFromRemote += 1;
  stats.images += gallery.length;
  console.log(`filled ${label}: ${gallery.map((image) => image.url).join(", ")}`);

  if ((targetIndex + 1) % 10 === 0) {
    await writeJson(overridesPath, data);
    await writeJson(sourcesPath, sources);
    await flushCache();
  }
}

if (!options.dryRun) {
  await writeJson(overridesPath, data);
  await writeJson(sourcesPath, sources);
  await flushCache();
}

console.log(JSON.stringify({ stats, failures: failures.slice(0, 50) }, null, 2));
