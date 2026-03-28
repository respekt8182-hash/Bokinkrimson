/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const includeNext = process.argv.includes("--next");

const targets = [
  ...(includeNext ? [".next"] : []),
  "coverage",
  "test-results",
  "playwright-report",
  "tsconfig.tsbuildinfo",
  ".eslintcache",
];

for (const target of targets) {
  const fullPath = path.resolve(process.cwd(), target);
  fs.rmSync(fullPath, { recursive: true, force: true });
}
