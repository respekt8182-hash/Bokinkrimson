// Unit tests for Prisma error helpers and masked database target labels.
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  isDatabaseConfigurationError,
  isDatabaseConfigurationMessage,
  getConfiguredDatabaseTargetLabel,
  isDatabaseAuthenticationError,
  isDatabaseAuthenticationMessage,
  isDatabaseFallbackEligibleError,
  isDatabaseSchemaMissingError,
  isDatabaseUnavailableError,
  isDatabaseUnavailableMessage,
} from "../../src/lib/prisma-errors";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("prisma error helpers", () => {
  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
      return;
    }

    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("detects Prisma authentication failures", () => {
    expect(
      isDatabaseAuthenticationMessage(
        "Authentication failed against database server, the provided database credentials are not valid.",
      ),
    ).toBe(true);
    expect(isDatabaseAuthenticationMessage("Error code: P1000")).toBe(true);
    expect(isDatabaseAuthenticationMessage("Can't reach database server")).toBe(false);
  });

  it("keeps database unavailability detection focused on connectivity failures", () => {
    expect(isDatabaseUnavailableMessage("Can't reach database server at localhost:5432")).toBe(true);
    expect(isDatabaseUnavailableMessage("Error code: P1001")).toBe(true);
    expect(
      isDatabaseUnavailableMessage(
        "Authentication failed against database server, the provided database credentials are not valid.",
      ),
    ).toBe(false);
  });

  it("does not classify authentication init errors as database downtime", () => {
    const authError = new Prisma.PrismaClientInitializationError(
      "Authentication failed against database server, the provided database credentials are not valid.",
      "6.16.2",
      "P1000",
    );

    expect(isDatabaseUnavailableError(authError)).toBe(false);
    expect(isDatabaseAuthenticationError(authError)).toBe(true);
  });

  it("detects missing or invalid DATABASE_URL configuration", () => {
    expect(
      isDatabaseConfigurationMessage(
        "error: Environment variable not found: DATABASE_URL.",
      ),
    ).toBe(true);
    expect(
      isDatabaseConfigurationMessage(
        "Error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`.",
      ),
    ).toBe(true);
    expect(isDatabaseConfigurationMessage("Can't reach database server")).toBe(false);
  });

  it("allows dev fallbacks for both downtime and auth failures", () => {
    const authError = new Prisma.PrismaClientInitializationError(
      "Authentication failed against database server, the provided database credentials are not valid.",
      "6.16.2",
      "P1000",
    );
    const downError = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at localhost:5432",
      "6.16.2",
      "P1001",
    );

    expect(isDatabaseFallbackEligibleError(authError)).toBe(true);
    expect(isDatabaseFallbackEligibleError(downError)).toBe(true);
    expect(
      isDatabaseFallbackEligibleError(
        new Error("error: Environment variable not found: DATABASE_URL."),
      ),
    ).toBe(true);
    expect(isDatabaseFallbackEligibleError(new Error("something else"))).toBe(false);
  });

  it("classifies missing DATABASE_URL errors as configuration issues", () => {
    const configError = new Prisma.PrismaClientInitializationError(
      "error: Environment variable not found: DATABASE_URL.",
      "6.16.2",
    );

    expect(isDatabaseConfigurationError(configError)).toBe(true);
    expect(isDatabaseUnavailableError(configError)).toBe(false);
    expect(isDatabaseAuthenticationError(configError)).toBe(false);
  });

  it("detects missing database tables and columns as schema gaps", () => {
    const missingTableError = new Prisma.PrismaClientKnownRequestError(
      "The table does not exist in the current database.",
      {
        clientVersion: "6.16.2",
        code: "P2021",
      },
    );
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      "The column does not exist in the current database.",
      {
        clientVersion: "6.16.2",
        code: "P2022",
      },
    );

    expect(isDatabaseSchemaMissingError(missingTableError)).toBe(true);
    expect(isDatabaseSchemaMissingError(missingColumnError)).toBe(true);
    expect(isDatabaseSchemaMissingError(new Error("other"))).toBe(false);
  });

  it("returns a masked label without exposing the password", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:super-secret@localhost:5432/boking?schema=public";

    expect(getConfiguredDatabaseTargetLabel()).toBe("postgresql://postgres@localhost:5432/boking");
  });

  it("returns null when DATABASE_URL is missing or invalid", () => {
    delete process.env.DATABASE_URL;
    expect(getConfiguredDatabaseTargetLabel()).toBeNull();

    process.env.DATABASE_URL = "not-a-url";
    expect(getConfiguredDatabaseTargetLabel()).toBeNull();
  });
});
