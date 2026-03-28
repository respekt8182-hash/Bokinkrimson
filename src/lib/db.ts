// Domain/service module for db.
import { PrismaClient } from "@prisma/client";
import {
  getConfiguredDatabaseTargetLabel,
  isDatabaseAuthenticationMessage,
  isDatabaseUnavailableMessage,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const isDevelopment = process.env.NODE_ENV === "development";
  const client = new PrismaClient({
    log: isDevelopment
      ? [
          { emit: "stdout", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : ["error"],
  });

  if (isDevelopment) {
    client.$on("error", (event) => {
      if (isDatabaseUnavailableMessage(event.message)) {
        return;
      }

      if (isDatabaseAuthenticationMessage(event.message)) {
        const databaseTarget = getConfiguredDatabaseTargetLabel();
        const targetLabel = databaseTarget ? ` Current target: ${databaseTarget}.` : "";
        logDatabaseFallbackOnce(
          "database-auth",
          `Prisma failed to authenticate with PostgreSQL. Check DATABASE_URL in .env.${targetLabel}`,
        );
        return;
      }

      console.error(`prisma:error ${event.message}`);
    });
  }

  return client;
}

export const db = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
