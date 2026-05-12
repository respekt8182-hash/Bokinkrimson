#!/usr/bin/env node
// Maintenance script that scans repository text files for mojibake and obvious encoding corruption.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { TextDecoder } from "node:util";

const ROOTS = ["src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css"]);
const MAX_REPORT_LINES = 80;
const cp1251Decoder = new TextDecoder("windows-1251");
const cp1251ContinuationChars = Array.from({ length: 64 }, (_, index) =>
  cp1251Decoder.decode(Uint8Array.of(0x80 + index)),
).join("");

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

const PATTERNS = [
  {
    name: "utf8-cp1251-mojibake",
    regex: new RegExp(
      `[\\u0420\\u0421][${escapeRegExp(cp1251ContinuationChars)}]|\\u0432\\u0402`,
      "u",
    ),
  },
  {
    name: "cp1251-mojibake",
    regex: /[РС][\u0400\u0402-\u040F\u0450\u0452-\u045F]|в[\u0400\u0402-\u040F\u0450\u0452-\u045F]/u,
  },
  {
    name: "latin1-mojibake",
    regex: /[ÐÑ][\u0080-\u00FFA-Za-z]|â[\u0080-\u00BF]/u,
  },
];

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files", ...ROOTS], { encoding: "utf8" });
  if (result.status !== 0) {
    return ROOTS.flatMap((root) => listFilesRecursively(root));
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => EXTENSIONS.has(extname(file).toLowerCase()));
}

function listFilesRecursively(directoryPath) {
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursively(fullPath);
    }

    return EXTENSIONS.has(extname(fullPath).toLowerCase()) ? [fullPath] : [];
  });
}

function scanFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        hits.push({
          filePath,
          line: i + 1,
          pattern: pattern.name,
          sample: line.trim().slice(0, 180),
        });
        break;
      }
    }
  }

  return hits;
}

function main() {
  const files = listTrackedFiles();
  const allHits = [];

  for (const filePath of files) {
    if (!existsSync(filePath)) {
      continue;
    }

    allHits.push(...scanFile(filePath));
  }

  if (allHits.length === 0) {
    console.log("check-mojibake: no suspicious encoding patterns found.");
    return;
  }

  console.error("check-mojibake: found suspicious encoding patterns:");
  for (const hit of allHits.slice(0, MAX_REPORT_LINES)) {
    console.error(`- ${hit.filePath}:${hit.line} [${hit.pattern}] ${hit.sample}`);
  }
  if (allHits.length > MAX_REPORT_LINES) {
    console.error(`... and ${allHits.length - MAX_REPORT_LINES} more matches`);
  }
  process.exitCode = 1;
}

main();
