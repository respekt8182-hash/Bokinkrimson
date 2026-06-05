import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    write: false,
    rulesPath: null,
    overridesPath: path.join(process.cwd(), "data", "attractions-overrides.json"),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") {
      args.write = true;
      continue;
    }
    if (value === "--overrides") {
      args.overridesPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (!args.rulesPath) {
      args.rulesPath = path.resolve(value);
    }
  }

  if (!args.rulesPath) {
    throw new Error(
      "Usage: node scripts/apply-attraction-title-rules.mjs <rules-file> [--write] [--overrides <path>]",
    );
  }

  return args;
}

function extractSection(text, startMarker, endMarker) {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) {
    return "";
  }
  const fromStart = text.slice(startIndex + startMarker.length);
  if (!endMarker) {
    return fromStart;
  }
  const endIndex = fromStart.indexOf(endMarker);
  return endIndex === -1 ? fromStart : fromStart.slice(0, endIndex);
}

function cleanRuleValue(value) {
  return value.trim().replace(/\.\s*$/, "");
}

function parseDedupRules(text) {
  const section = extractSection(text, "## 1. Что объединить как дубли", "## 2. Что не объединять");
  const rules = [];

  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\d+\.\s+\*\*(.+)\*\*\s+→\s+оставить\s+\*\*(.+?)\*\*\.?$/);
    if (!match) {
      continue;
    }

    const sources = match[1]
      .split(/\s+\+\s+/)
      .map((item) => cleanRuleValue(item))
      .filter(Boolean);
    const keep = cleanRuleValue(match[2]);

    if (sources.length > 0 && keep) {
      rules.push({ sources, keep });
    }
  }

  return rules;
}

function parseRenameRules(text) {
  const section = extractSection(text, "## 3. Что переименовать", "");
  const rules = [];

  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\*\s+(.+?)\s+→\s+\*\*(.+?)\*\*\.?$/);
    if (!match) {
      continue;
    }

    rules.push({
      from: cleanRuleValue(match[1]),
      to: cleanRuleValue(match[2]),
    });
  }

  return rules;
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е")
    .replace(/[«»"'`“”„‟’]/g, "")
    .replace(/[(){}\[\],.:;!?/\\|]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEntries(overrides) {
  return Object.entries(overrides).map(([id, item]) => ({ id, item }));
}

function findMatches(overrides, targetTitle) {
  const entries = buildEntries(overrides);
  const normalizedTarget = normalizeName(targetTitle);
  const exact = entries.filter(({ item }) => normalizeName(item.title) === normalizedTarget);
  if (exact.length > 0) {
    return exact;
  }

  const fuzzy = entries.filter(({ item }) => {
    const normalizedTitle = normalizeName(item.title);
    return (
      normalizedTitle.startsWith(normalizedTarget) ||
      normalizedTarget.startsWith(normalizedTitle) ||
      normalizedTitle.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedTitle)
    );
  });

  return fuzzy.length === 1 ? fuzzy : [];
}

function dedupeMatches(matches) {
  const byId = new Map();
  for (const match of matches) {
    byId.set(match.id, match);
  }
  return [...byId.values()];
}

function scoreItem(item) {
  const descriptionLength = String(item.description ?? "").length;
  const shortLength = String(item.shortDescription ?? "").length;
  const sectionsLength = Array.isArray(item.sections)
    ? item.sections.reduce((sum, section) => {
        const bodyLength = Array.isArray(section?.body)
          ? section.body.reduce((acc, value) => acc + String(value ?? "").length, 0)
          : 0;
        const listLength = Array.isArray(section?.list)
          ? section.list.reduce((acc, value) => acc + String(value ?? "").length, 0)
          : 0;
        return sum + bodyLength + listLength + String(section?.title ?? "").length;
      }, 0)
    : 0;
  const publishedBonus = item.status === "PUBLISHED" && item.isPublishedVisible ? 100000 : 0;
  return publishedBonus + descriptionLength + shortLength + sectionsLength;
}

function chooseCanonicalMatch(matches, canonicalTitle) {
  const normalizedCanonical = normalizeName(canonicalTitle);
  const exactCanonical = matches.find(({ item }) => normalizeName(item.title) === normalizedCanonical);
  if (exactCanonical) {
    return exactCanonical;
  }

  return [...matches].sort((left, right) => scoreItem(right.item) - scoreItem(left.item))[0] ?? null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(left, right) {
  if (
    !Number.isFinite(left?.latitude) ||
    !Number.isFinite(left?.longitude) ||
    !Number.isFinite(right?.latitude) ||
    !Number.isFinite(right?.longitude)
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLng = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function isGeoConsistent(matches, keepMatch, thresholdKm = 10) {
  if (!keepMatch || matches.length <= 1) {
    return true;
  }

  const keepPoint = {
    latitude: keepMatch.item.latitude,
    longitude: keepMatch.item.longitude,
  };
  const keepLocation = normalizeName(keepMatch.item.locationName);

  for (const match of matches) {
    if (match.id === keepMatch.id) {
      continue;
    }

    const matchPoint = {
      latitude: match.item.latitude,
      longitude: match.item.longitude,
    };
    const gapKm = distanceKm(keepPoint, matchPoint);
    if (gapKm !== null) {
      if (gapKm > thresholdKm) {
        return false;
      }
      continue;
    }

    const matchLocation = normalizeName(match.item.locationName);
    if (keepLocation && matchLocation && keepLocation !== matchLocation) {
      return false;
    }
  }

  return true;
}

function deepReplace(value, replacements) {
  if (typeof value === "string") {
    let updated = value;
    for (const [from, to] of replacements) {
      if (from) {
        updated = updated.split(from).join(to);
      }
    }
    return updated;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepReplace(item, replacements));
  }

  if (value && typeof value === "object") {
    const result = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = deepReplace(nestedValue, replacements);
    }
    return result;
  }

  return value;
}

function renameItem(item, nextTitle, variants, now) {
  const replacements = [...new Set([item.title, ...variants].filter(Boolean))].map((from) => [from, nextTitle]);
  const updated = deepReplace(item, replacements);
  updated.title = nextTitle;
  updated.updatedAt = now;
  return updated;
}

function hideItem(item, now) {
  return {
    ...item,
    status: "HIDDEN",
    isPublishedVisible: false,
    updatedAt: now,
  };
}

function ensurePublished(item, now) {
  return {
    ...item,
    status: "PUBLISHED",
    isPublishedVisible: true,
    updatedAt: now,
  };
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const args = parseArgs(process.argv);
  const rulesText = fs.readFileSync(args.rulesPath, "utf8");
  const overrides = loadJson(args.overridesPath);
  const dedupRules = parseDedupRules(rulesText);
  const renameRules = parseRenameRules(rulesText);
  const now = new Date().toISOString();

  const stats = {
    renamed: [],
    hidden: [],
    unresolvedDedupTitles: [],
    unresolvedRenameTitles: [],
    skippedDedupGroups: [],
    dedupGroupsApplied: 0,
  };

  const manualRenameRules = [
    { from: "Гора Алчак (152 м)", to: "Гора Алчак-Кая" },
    { from: "Хапхал, Демерджи-яйла и водопад Джур-Джур", to: "Урочище Хапхал" },
  ];

  const manualHideTitles = ["Буковый лес Хапхала", "Хапхальский заповедник"];

  for (const rule of dedupRules) {
    const matches = dedupeMatches(
      rule.sources.flatMap((source) => findMatches(overrides, source)).concat(findMatches(overrides, rule.keep)),
    );

    if (matches.length === 0) {
      if (findMatches(overrides, rule.keep).length === 0) {
        stats.unresolvedDedupTitles.push(...rule.sources, rule.keep);
      }
      continue;
    }

    const keepMatch = chooseCanonicalMatch(matches, rule.keep);
    if (!keepMatch) {
      stats.unresolvedDedupTitles.push(...rule.sources, rule.keep);
      continue;
    }

    if (!isGeoConsistent(matches, keepMatch)) {
      stats.skippedDedupGroups.push({
        keep: rule.keep,
        titles: matches.map((match) => `${match.item.title} (${match.item.locationName ?? "без локации"})`),
      });
      continue;
    }

    const keepVariants = [...rule.sources, keepMatch.item.title].filter(Boolean);
    const renamedKeep = renameItem(ensurePublished(keepMatch.item, now), rule.keep, keepVariants, now);
    overrides[keepMatch.id] = renamedKeep;
    if (keepMatch.item.title !== rule.keep) {
      stats.renamed.push({
        id: keepMatch.id,
        from: keepMatch.item.title,
        to: rule.keep,
        reason: "dedup-keep",
      });
    }

    for (const match of matches) {
      if (match.id === keepMatch.id) {
        continue;
      }
      const wasVisible = match.item.status !== "HIDDEN" || match.item.isPublishedVisible !== false;
      overrides[match.id] = hideItem(match.item, now);
      if (wasVisible) {
        stats.hidden.push({
          id: match.id,
          title: match.item.title,
          reason: `duplicate-of:${rule.keep}`,
        });
      }
    }

    stats.dedupGroupsApplied += 1;
  }

  for (const rule of manualRenameRules) {
    const matches = findMatches(overrides, rule.from);
    if (matches.length === 0) {
      if (findMatches(overrides, rule.to).length === 0) {
        stats.unresolvedRenameTitles.push(rule.from);
      }
      continue;
    }

    for (const match of matches) {
      const updated = renameItem(ensurePublished(match.item, now), rule.to, [rule.from], now);
      overrides[match.id] = updated;
      if (match.item.title !== rule.to) {
        stats.renamed.push({
          id: match.id,
          from: match.item.title,
          to: rule.to,
          reason: "manual-rename",
        });
      }
    }
  }

  for (const title of manualHideTitles) {
    const matches = findMatches(overrides, title);
    if (matches.length === 0) {
      stats.unresolvedDedupTitles.push(title);
      continue;
    }

    for (const match of matches) {
      const wasVisible = match.item.status !== "HIDDEN" || match.item.isPublishedVisible !== false;
      overrides[match.id] = hideItem(match.item, now);
      if (wasVisible) {
        stats.hidden.push({
          id: match.id,
          title: match.item.title,
          reason: "manual-hide",
        });
      }
    }
  }

  for (const rule of renameRules) {
    const matches = findMatches(overrides, rule.from);
    if (matches.length === 0) {
      if (findMatches(overrides, rule.to).length === 0) {
        stats.unresolvedRenameTitles.push(rule.from);
      }
      continue;
    }

    for (const match of matches) {
      const updated = renameItem(match.item, rule.to, [rule.from], now);
      overrides[match.id] = updated;
      if (match.item.title !== rule.to) {
        stats.renamed.push({
          id: match.id,
          from: match.item.title,
          to: rule.to,
          reason: "rename",
        });
      }
    }
  }

  if (args.write) {
    fs.writeFileSync(args.overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  }

  const unresolvedDedupTitles = [...new Set(stats.unresolvedDedupTitles)].sort();
  const unresolvedRenameTitles = [...new Set(stats.unresolvedRenameTitles)].sort();

  console.log(`Mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`Dedup groups applied: ${stats.dedupGroupsApplied}`);
  console.log(`Renamed records: ${stats.renamed.length}`);
  console.log(`Hidden records: ${stats.hidden.length}`);

  if (stats.renamed.length > 0) {
    console.log("\nSample renamed records:");
    for (const item of stats.renamed.slice(0, 20)) {
      console.log(`- ${item.id}: ${item.from} -> ${item.to} [${item.reason}]`);
    }
  }

  if (stats.hidden.length > 0) {
    console.log("\nHidden records:");
    for (const item of stats.hidden.slice(0, 20)) {
      console.log(`- ${item.id}: ${item.title} [${item.reason}]`);
    }
  }

  if (unresolvedDedupTitles.length > 0) {
    console.log("\nUnresolved dedup titles:");
    for (const title of unresolvedDedupTitles) {
      console.log(`- ${title}`);
    }
  }

  if (stats.skippedDedupGroups.length > 0) {
    console.log("\nSkipped dedup groups (geography mismatch):");
    for (const item of stats.skippedDedupGroups) {
      console.log(`- ${item.keep}: ${item.titles.join(" | ")}`);
    }
  }

  if (unresolvedRenameTitles.length > 0) {
    console.log("\nUnresolved rename titles:");
    for (const title of unresolvedRenameTitles) {
      console.log(`- ${title}`);
    }
  }
}

main();
