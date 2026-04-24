import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const CONTENT_TABLES = [
  "ViewLog",
  "WebhookReceipt",
  "AdminActionLog",
  "AdminMessage",
  "ReviewReport",
  "ReviewReaction",
  "Review",
  "FavoriteProperty",
  "Payment",
  "Application",
  "RoomOccupancy",
  "RoomPrice",
  "Media",
  "PropertyDocument",
  "RoomCustomFeature",
  "RoomFeatureOnRoom",
  "Room",
  "PropertyCustomAmenity",
  "PropertyAmenity",
  "ObjectRoomAmenitySetting",
  "Property",
  "ExcursionScheduleException",
  "ExcursionScheduleRule",
  "ExcursionSession",
  "ExcursionRouteLocation",
  "ExcursionPickupLocation",
  "Excursion",
  "CustomLocation",
];

const USER_TABLES = [
  "PasswordResetToken",
  "PasswordResetRequest",
  "support_messages",
  "support_chats",
  "User",
];

const TARGET_TABLES = [...new Set([...CONTENT_TABLES, ...USER_TABLES])];

const LOCAL_UPLOAD_DIRS = [
  "public/uploads/properties",
  "public/uploads/excursions",
  "public/uploads/avatars",
  "public/uploads/users",
];

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function formatCount(value) {
  return Number(value).toLocaleString("ru-RU");
}

async function getExistingTables(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;

  return new Set(rows.map((row) => row.table_name));
}

async function getTableCounts(prisma, tableNames) {
  const counts = {};

  for (const tableName of tableNames) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(tableName)}`,
    );
    counts[tableName] = Number(rows[0]?.count ?? 0);
  }

  return counts;
}

function printCountBlock(title, counts) {
  const nonZeroEntries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);

  const total = nonZeroEntries.reduce((sum, [, count]) => sum + count, 0);

  console.log(`\n${title}`);
  console.log(`Всего строк в очищаемых таблицах: ${formatCount(total)}`);

  if (nonZeroEntries.length === 0) {
    console.log("Ненулевых таблиц не найдено.");
    return;
  }

  for (const [tableName, count] of nonZeroEntries) {
    console.log(`- ${tableName}: ${formatCount(count)}`);
  }
}

async function removeLocalUploads() {
  const removedDirs = [];

  for (const relativeDir of LOCAL_UPLOAD_DIRS) {
    const absoluteDir = path.resolve(process.cwd(), relativeDir);

    try {
      await fs.access(absoluteDir);
    } catch {
      continue;
    }

    await fs.rm(absoluteDir, { recursive: true, force: true });
    removedDirs.push(relativeDir);
  }

  return removedDirs;
}

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--yes");
const shouldKeepUploads = args.has("--keep-uploads");

const prisma = new PrismaClient();

try {
  const existingTables = await getExistingTables(prisma);
  const targetTables = TARGET_TABLES.filter((tableName) => existingTables.has(tableName));

  if (targetTables.length === 0) {
    console.log("Подходящих таблиц для очистки не найдено.");
    process.exit(0);
  }

  const beforeCounts = await getTableCounts(prisma, targetTables);
  printCountBlock("Состояние до очистки", beforeCounts);

  if (!shouldExecute) {
    console.log(
      "\nДля выполнения очистки повторите команду с флагом --yes. Пример: npm run db:purge-marketplace -- --yes",
    );
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `TRUNCATE TABLE ${targetTables.map(quoteIdentifier).join(", ")} RESTART IDENTITY CASCADE`,
    );
  });

  const removedDirs = shouldKeepUploads ? [] : await removeLocalUploads();
  const afterCounts = await getTableCounts(prisma, targetTables);

  printCountBlock("Состояние после очистки", afterCounts);

  if (removedDirs.length > 0) {
    console.log("\nУдалены локальные каталоги загрузок:");
    for (const relativeDir of removedDirs) {
      console.log(`- ${relativeDir}`);
    }
  }

  console.log(
    "\nОчистка завершена. Справочники локаций, категорий, удобств, менеджеров чата и настройки сайта не затрагивались.",
  );
} catch (error) {
  console.error("Не удалось очистить marketplace-данные.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
