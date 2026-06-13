/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const managedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const managedPort = "5433";
const managedDatabase = "boking";

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    if (key) {
      values[key] = unquoteEnvValue(value);
    }
  }

  return values;
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const rootDir = process.cwd();
  const loaded = {
    ...readEnvFile(path.join(rootDir, ".env")),
    ...readEnvFile(path.join(rootDir, ".env.local")),
  };

  return loaded.DATABASE_URL;
}

function isManagedLocalDatabase(databaseUrl) {
  if (!databaseUrl) {
    return false;
  }

  try {
    const parsed = new URL(databaseUrl);
    const database = parsed.pathname.replace(/^\/+/, "").split("?")[0];
    const port = parsed.port || "5432";
    return (
      (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") &&
      managedHosts.has(parsed.hostname) &&
      port === managedPort &&
      database === managedDatabase
    );
  } catch {
    return false;
  }
}

if (process.env.SKIP_LOCAL_DB_START === "1" || process.env.SKIP_LOCAL_DB_START === "true") {
  console.log("Skipping local PostgreSQL startup because SKIP_LOCAL_DB_START is set.");
  process.exit(0);
}

const databaseUrl = getDatabaseUrl();
if (!isManagedLocalDatabase(databaseUrl)) {
  console.log("DATABASE_URL is not the managed local PostgreSQL target; skipping local DB startup.");
  process.exit(0);
}

if (process.platform !== "win32") {
  console.warn("Managed local PostgreSQL startup is configured for Windows; skipping on this OS.");
  process.exit(0);
}

const scriptPath = path.join(process.cwd(), "scripts", "local-db-start.ps1");
const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
