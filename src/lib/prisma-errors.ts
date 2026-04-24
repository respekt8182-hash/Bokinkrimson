// Prisma/database error helpers for availability checks and friendly fallback behavior.
import { Prisma } from "@prisma/client";
import net from "node:net";
import { URL } from "node:url";

const DATABASE_UNREACHABLE_CODE = "P1001";
const DATABASE_AUTHENTICATION_CODE = "P1000";
const DATABASE_SCHEMA_MISSING_CODES = new Set(["P2021", "P2022"]);
const DATABASE_UNREACHABLE_MESSAGE_FRAGMENT = "can't reach database server";
const DATABASE_AUTHENTICATION_MESSAGE_FRAGMENT = "authentication failed against database server";
const DATABASE_URL_MISSING_MESSAGE_FRAGMENT = "environment variable not found: database_url";
const DATABASE_URL_INVALID_PROTOCOL_FRAGMENT = "the url must start with the protocol";
const DATABASE_URL_VALIDATION_FRAGMENT = "error validating datasource";
const DEFAULT_POSTGRES_PORT = 5432;
const DATABASE_PROBE_TIMEOUT_MS = 300;
const DATABASE_PROBE_CACHE_TTL_MS = 10_000;

type ProbeCache = {
  databaseUrl: string;
  checkedAt: number;
  isReachable: boolean;
};

let probeCache: ProbeCache | null = null;
const loggedContexts = new Set<string>();

export function isDatabaseUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(DATABASE_UNREACHABLE_MESSAGE_FRAGMENT) ||
    normalized.includes(DATABASE_UNREACHABLE_CODE.toLowerCase())
  );
}

export function isDatabaseAuthenticationMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(DATABASE_AUTHENTICATION_MESSAGE_FRAGMENT) ||
    normalized.includes(DATABASE_AUTHENTICATION_CODE.toLowerCase())
  );
}

export function isDatabaseConfigurationMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(DATABASE_URL_MISSING_MESSAGE_FRAGMENT) ||
    (normalized.includes(DATABASE_URL_VALIDATION_FRAGMENT) &&
      normalized.includes(DATABASE_URL_INVALID_PROTOCOL_FRAGMENT))
  );
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return isDatabaseUnavailableMessage(error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === DATABASE_UNREACHABLE_CODE;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return isDatabaseUnavailableMessage(error.message);
}

export function isDatabaseAuthenticationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return isDatabaseAuthenticationMessage(error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === DATABASE_AUTHENTICATION_CODE;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return isDatabaseAuthenticationMessage(error.message);
}

export function isDatabaseConfigurationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return isDatabaseConfigurationMessage(error.message);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return isDatabaseConfigurationMessage(error.message);
}

export function isDatabaseSchemaMissingError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return DATABASE_SCHEMA_MISSING_CODES.has(error.code);
  }

  return false;
}

export function isDatabaseFallbackEligibleError(error: unknown): boolean {
  return (
    isDatabaseUnavailableError(error) ||
    isDatabaseAuthenticationError(error) ||
    isDatabaseConfigurationError(error)
  );
}

function parseDatabaseTarget(databaseUrl: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(databaseUrl);
    const port = parsed.port ? Number(parsed.port) : DEFAULT_POSTGRES_PORT;
    if (!parsed.hostname || !Number.isFinite(port) || port < 1 || port > 65_535) {
      return null;
    }
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

type DatabaseTargetSummary = {
  database: string;
  host: string;
  port: number;
  protocol: string;
  username: string | null;
};

function parseDatabaseTargetSummary(databaseUrl: string): DatabaseTargetSummary | null {
  try {
    const parsed = new URL(databaseUrl);
    const port = parsed.port ? Number(parsed.port) : DEFAULT_POSTGRES_PORT;
    if (!parsed.hostname || !Number.isFinite(port) || port < 1 || port > 65_535) {
      return null;
    }

    const database = parsed.pathname.replace(/^\/+/, "");
    const username = parsed.username ? decodeURIComponent(parsed.username) : null;

    return {
      database,
      host: parsed.hostname,
      port,
      protocol: parsed.protocol.replace(/:$/, ""),
      username,
    };
  } catch {
    return null;
  }
}

export function getConfiguredDatabaseTargetLabel(): string | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return null;
  }

  const target = parseDatabaseTargetSummary(databaseUrl);
  if (!target) {
    return null;
  }

  const usernamePrefix = target.username ? `${target.username}@` : "";
  const databaseSuffix = target.database ? `/${target.database}` : "";
  return `${target.protocol}://${usernamePrefix}${target.host}:${target.port}${databaseSuffix}`;
}

function probeTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host, port });

    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(DATABASE_PROBE_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function isConfiguredDatabaseReachable(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return false;
  }

  const now = Date.now();
  if (
    probeCache &&
    probeCache.databaseUrl === databaseUrl &&
    now - probeCache.checkedAt < DATABASE_PROBE_CACHE_TTL_MS
  ) {
    return probeCache.isReachable;
  }

  const target = parseDatabaseTarget(databaseUrl);
  const isReachable = target ? await probeTcp(target.host, target.port) : false;

  probeCache = {
    databaseUrl,
    checkedAt: now,
    isReachable,
  };

  return isReachable;
}

export function logDatabaseFallbackOnce(context: string, message: string): void {
  if (loggedContexts.has(context)) {
    return;
  }

  loggedContexts.add(context);
  console.warn(`[${context}] ${message}`);
}
