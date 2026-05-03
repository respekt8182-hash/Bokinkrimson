#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym", "NEW");
const dataPath = path.join(root, "data", "attractions-overrides.json");
const selectedDirs = new Set(
  (process.argv.find((argument) => argument.startsWith("--dirs="))?.slice("--dirs=".length) ??
    "1,2,3,4,5,6,7,8,9,10")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

const CRIMEA_QUERY = "\u0420\u0435\u0441\u043f\u0443\u0431\u043b\u0438\u043a\u0430 \u041a\u0440\u044b\u043c";
const GENERIC_CRIMEA_CENTER = { latitude: 45.3892, longitude: 33.993751 };

function slugify(value) {
  const map = {
    "\u0430": "a",
    "\u0431": "b",
    "\u0432": "v",
    "\u0433": "g",
    "\u0434": "d",
    "\u0435": "e",
    "\u0451": "e",
    "\u0436": "zh",
    "\u0437": "z",
    "\u0438": "i",
    "\u0439": "y",
    "\u043a": "k",
    "\u043b": "l",
    "\u043c": "m",
    "\u043d": "n",
    "\u043e": "o",
    "\u043f": "p",
    "\u0440": "r",
    "\u0441": "s",
    "\u0442": "t",
    "\u0443": "u",
    "\u0444": "f",
    "\u0445": "h",
    "\u0446": "ts",
    "\u0447": "ch",
    "\u0448": "sh",
    "\u0449": "sch",
    "\u044b": "y",
    "\u044d": "e",
    "\u044e": "yu",
    "\u044f": "ya",
  };

  return value
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[\u044c\u044a]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function stripSourceNumber(value) {
  return value.replace(/^\d+\.\s*/, "").trim();
}

function inCrimea(coords) {
  const [latitude, longitude] = coords ?? [];
  return latitude >= 44 && latitude <= 46.35 && longitude >= 32 && longitude <= 37;
}

function isGenericCrimeaCenter(coords) {
  const [latitude, longitude] = coords ?? [];
  return (
    Math.abs(latitude - GENERIC_CRIMEA_CENTER.latitude) < 0.001 &&
    Math.abs(longitude - GENERIC_CRIMEA_CENTER.longitude) < 0.001
  );
}

function cleanMapUrl(value) {
  return (
    String(value ?? "").match(
      /https?:\/\/(?:yandex\.ru|yandex\.com)\/maps\/org\/[^\s\])]+\/\d+\/?/,
    )?.[0] ?? null
  );
}

function extractDeclaredSlugs(text) {
  const slugs = new Set();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (!/URL\s*\/\s*slug/i.test(line)) {
      continue;
    }

    const slug = line.match(/\/attractions\/([a-z0-9-]+)/i)?.[1];
    if (slug) {
      slugs.add(slug);
    }
  }

  return slugs;
}

function extractOrgId(value) {
  return cleanMapUrl(value)?.match(/\/org\/[^/]+\/(\d+)\/?/)?.[1] ?? null;
}

function tokenize(value) {
  return (
    String(value ?? "")
      .toLowerCase()
      .replaceAll("\u0451", "\u0435")
      .match(/[\p{L}0-9]{3,}/gu)
      ?.filter(
        (token) =>
          ![
            "krym",
            "crimea",
            "respublika",
            "rayon",
            "gorod",
            "ulitsa",
            "prospekt",
            "naberezhnaya",
            "dostoprimechatelnost",
          ].includes(token),
      ) ?? []
  );
}

function overlapScore(title, text) {
  const titleTokens = new Set(tokenize(title));
  let score = 0;
  for (const token of new Set(tokenize(text))) {
    if (titleTokens.has(token)) {
      score += 1;
    }
  }
  return score;
}

function factsText(item) {
  return (Array.isArray(item.facts) ? item.facts : [])
    .map((fact) => `${fact.label ?? ""} ${fact.value ?? ""}`)
    .join(" ")
    .slice(0, 900);
}

function queryList(item) {
  const aliases = Array.isArray(item.locationAliases) ? item.locationAliases.slice(0, 4).join(" ") : "";
  const facts = factsText(item);
  return [
    [item.title, item.address, item.locationName, item.districtName, aliases, CRIMEA_QUERY],
    [item.title, facts, CRIMEA_QUERY],
    [item.title, item.locationName, CRIMEA_QUERY],
  ]
    .map((parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((query, index, values) => values.indexOf(query) === index);
}

function loadYandexKey() {
  for (const fileName of [".env.local", ".env"]) {
    if (!existsSync(fileName)) {
      continue;
    }

    const raw = readFileSync(fileName, "utf8");
    const key =
      raw.match(/YANDEX_GEOCODER_API_KEY="?([^"\r\n]+)"?/)?.[1] ??
      raw.match(/NEXT_PUBLIC_YANDEX_MAPS_API_KEY="?([^"\r\n]+)"?/)?.[1];
    if (key) {
      return key;
    }
  }

  return process.env.YANDEX_GEOCODER_API_KEY ?? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";
}

async function collectTargetSlugs() {
  const slugs = new Set();
  for (const directory of selectedDirs) {
    const directoryPath = path.join(sourceRoot, directory);
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const file of entries.filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))) {
      const text = readFileSync(path.join(directoryPath, file.name), "utf8");
      for (const slug of extractDeclaredSlugs(text)) {
        slugs.add(slug);
      }
    }

    for (const childDirectory of entries.filter((entry) => entry.isDirectory())) {
      slugs.add(slugify(stripSourceNumber(childDirectory.name)));
    }
  }

  return slugs;
}

async function initYandexPage(apiKey) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(
    `<script src="https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU"></script>`,
    { waitUntil: "networkidle", timeout: 30000 },
  );
  await page.evaluate(() => new Promise((resolve, reject) => ymaps.ready(resolve, reject)));

  return { browser, page };
}

async function findOrganization(page, oid) {
  return page.evaluate(async (organizationId) => {
    const organization = await ymaps.findOrganization(organizationId);
    if (!organization) {
      return null;
    }

    return {
      coords: organization.geometry.getCoordinates(),
      name: organization.properties.get("name") || "",
      description: organization.properties.get("description") || "",
    };
  }, oid);
}

async function geocode(page, query) {
  return page.evaluate(async (geocodeQuery) => {
    const response = await ymaps.geocode(geocodeQuery, { results: 8 });
    const items = [];
    response.geoObjects.each((object) => {
      items.push({
        coords: object.geometry.getCoordinates(),
        name: object.properties.get("name") || "",
        description: object.properties.get("description") || "",
      });
    });
    return items;
  }, query);
}

async function resolvePoint(page, item) {
  const oid = extractOrgId(item.mapUrl);
  if (oid) {
    try {
      const result = await findOrganization(page, oid);
      if (
        result?.coords &&
        inCrimea(result.coords) &&
        !isGenericCrimeaCenter(result.coords) &&
        overlapScore(item.title, `${result.name} ${result.description}`) > 0
      ) {
        return { ...result, source: "org" };
      }
    } catch {
      // Fall back to geocoding below.
    }
  }

  let best = null;
  for (const query of queryList(item)) {
    try {
      const results = await geocode(page, query);
      for (const result of results) {
        if (!inCrimea(result.coords) || isGenericCrimeaCenter(result.coords)) {
          continue;
        }

        const score =
          overlapScore(item.title, `${result.name} ${result.description}`) +
          overlapScore(item.locationName ?? "", `${result.name} ${result.description}`);
        const candidate = { ...result, score, source: "geocode" };
        if (!best || candidate.score > best.score) {
          best = candidate;
        }
      }
    } catch {
      // Try the next query.
    }
  }

  if (best && (best.score > 0 || isGenericCrimeaCenter([item.latitude, item.longitude]))) {
    return best;
  }

  return null;
}

async function main() {
  const apiKey = loadYandexKey();
  if (!apiKey) {
    throw new Error("Yandex maps API key not found");
  }

  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const targetSlugs = await collectTargetSlugs();
  const targetEntries = Object.entries(data).filter(([, item]) => targetSlugs.has(item.slug));
  const { browser, page } = await initYandexPage(apiKey);
  const stillGeneric = [];
  const stats = {
    entries: targetEntries.length,
    updated: 0,
    org: 0,
    geocode: 0,
    kept: 0,
  };

  try {
    for (const [, item] of targetEntries) {
      const result = await resolvePoint(page, item);
      if (!result) {
        stats.kept += 1;
        if (isGenericCrimeaCenter([item.latitude, item.longitude])) {
          stillGeneric.push(`${item.slug} | ${item.title}`);
        }
        continue;
      }

      const oldCoords = `${item.latitude},${item.longitude}`;
      item.latitude = Number(result.coords[0].toFixed(6));
      item.longitude = Number(result.coords[1].toFixed(6));
      if (!item.address && result.description) {
        item.address = result.description;
      }
      const cleanedMapUrl = cleanMapUrl(item.mapUrl);
      if (result.source === "org" && cleanedMapUrl) {
        item.mapUrl = cleanedMapUrl;
      }

      if (`${item.latitude},${item.longitude}` !== oldCoords) {
        stats.updated += 1;
        stats[result.source] += 1;
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...stats, stillGeneric: stillGeneric.length }, null, 2));
  if (stillGeneric.length > 0) {
    console.log(stillGeneric.join("\n"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
