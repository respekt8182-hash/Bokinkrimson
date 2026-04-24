/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = process.cwd();
const schemaPath = path.resolve(rootDir, "prisma", "schema.prisma");
const generatedSchemaPath = path.resolve(rootDir, "node_modules", ".prisma", "client", "schema.prisma");
const generatedClientPath = path.resolve(rootDir, "node_modules", ".prisma", "client", "index.js");
const generatedSchemaHashPath = path.resolve(rootDir, "node_modules", ".prisma", "client", "schema.sha256");
const prismaCliEntrypointPath = path.resolve(
  rootDir,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

function readNormalizedFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function getSchemaHash(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function shouldGeneratePrismaClient() {
  const schema = readNormalizedFile(schemaPath);
  if (schema === null) {
    throw new Error(`Prisma schema not found at ${schemaPath}`);
  }

  if (!fs.existsSync(generatedClientPath)) {
    return true;
  }

  const generatedSchema = readNormalizedFile(generatedSchemaPath);
  if (generatedSchema === null) {
    return true;
  }

  const storedHash = readNormalizedFile(generatedSchemaHashPath);
  if (storedHash === null) {
    return true;
  }

  return storedHash.trim() !== getSchemaHash(schema);
}

function runPrismaGenerate(schema) {
  if (!fs.existsSync(prismaCliEntrypointPath)) {
    throw new Error(`Prisma CLI entrypoint not found at ${prismaCliEntrypointPath}`);
  }

  console.log("Prisma schema changed. Running prisma generate...");

  const result = spawnSync(process.execPath, [prismaCliEntrypointPath, "generate"], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  fs.writeFileSync(generatedSchemaHashPath, `${getSchemaHash(schema)}\n`, "utf8");
}

function main() {
  const schema = readNormalizedFile(schemaPath);
  if (schema === null) {
    throw new Error(`Prisma schema not found at ${schemaPath}`);
  }

  if (!shouldGeneratePrismaClient()) {
    console.log("Prisma Client is up to date.");
    return;
  }

  runPrismaGenerate(schema);
}

main();
