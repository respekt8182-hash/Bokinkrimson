// Domain/service module for db.
import { Prisma, PrismaClient } from "@prisma/client";
import {
  getConfiguredDatabaseTargetLabel,
  isDatabaseAuthenticationMessage,
  isDatabaseConfigurationMessage,
  isDatabaseUnavailableMessage,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";

const EXCURSION_COMPAT_COLUMNS = [
  "contactPhoneName",
  "contactPhone2",
  "contactPhone2Name",
  "contactPhone3",
  "contactPhone3Name",
  "pendingEditStatus",
  "publishedSnapshot",
  "tourKind",
  "transportModes",
  "departureMode",
  "arrivalInfo",
  "departureInfo",
  "roomTypes",
  "documentsRequired",
  "insuranceIncluded",
  "insuranceComment",
  "equipmentProvided",
  "safetyInfo",
  "routeConditions",
  "accommodationStars",
  "singleSupplementAvailable",
  "singleSupplementPrice",
  "mealDetails",
  "sectionPhotoGroups",
] as const;

const USER_COMPAT_COLUMNS = [
  "pendingEmail",
  "emailChangeTokenHash",
  "emailChangeTokenExpiresAt",
  "emailChangeRequestedAt",
  "emailVerifiedAt",
  "passwordChangedAt",
  "sessionVersion",
  "lastLoginAt",
  "lastSeenAt",
  "lastLogoutAt",
  "deletedAt",
  "deletionExpiresAt",
] as const;

const TRANSFER_COMPAT_COLUMNS = [
  "publicId",
  "isPublishedVisible",
  "serviceTags",
  "fleet",
  "phoneName",
  "phone2Name",
  "phone3",
  "phone3Name",
  "contactEmail",
  "pendingEditStatus",
  "publishedSnapshot",
] as const;
const PROPERTY_COMPAT_COLUMNS = [
  "publicId",
  "isPublishedVisible",
  "paymentStatus",
  "tariffType",
  "paidFrom",
  "paidUntil",
  "paidAmount",
  "paidAt",
] as const;
const ROOM_COMPAT_COLUMNS = ["sortOrder"] as const;
const ROOM_PRICE_COMPAT_COLUMNS = ["priceType", "minNights"] as const;
const ROOM_OCCUPANCY_COMPAT_COLUMNS = [
  "externalCalendarSyncId",
  "externalCalendarSourceId",
  "externalCalendarUid",
] as const;
const REVIEW_COMPAT_COLUMNS = [
  "transferId",
  "isImported",
  "importedAuthorName",
  "externalSourceUrl",
  "externalSourceName",
  "externalPlatform",
  "externalReviewSourceId",
  "externalReviewId",
  "externalReviewFingerprint",
  "externalStayPeriod",
  "externalRating",
  "externalRatingScale",
  "externalImportedAt",
  "externalLastSeenAt",
  "externalChangedAt",
  "externalPendingData",
  "importedByOwnerId",
  "verifiedAt",
  "verifiedByAdminId",
  "guestCity",
  "reviewedAt",
  "reviewCategory",
  "reviewHighlight",
  "reviewCategoryMatches",
] as const;
const PAYMENT_COMPAT_COLUMNS = ["transferId", "tariffType", "paidFrom"] as const;

const SCHEMA_COMPAT_MODELS = {
  User: {
    columns: USER_COMPAT_COLUMNS,
    defaults: {
      pendingEmail: null,
      emailChangeTokenHash: null,
      emailChangeTokenExpiresAt: null,
      emailChangeRequestedAt: null,
      emailVerifiedAt: null,
      passwordChangedAt: null,
      sessionVersion: 0,
      lastLoginAt: null,
      lastSeenAt: null,
      lastLogoutAt: null,
      deletedAt: null,
      deletionExpiresAt: null,
    },
    logContext: "user-schema-compat",
    label: "User",
  },
  Property: {
    columns: PROPERTY_COMPAT_COLUMNS,
    defaults: {
      publicId: null,
      isPublishedVisible: true,
      paymentStatus: "UNPAID",
      tariffType: null,
      paidFrom: null,
      paidUntil: null,
      paidAmount: null,
      paidAt: null,
    },
    logContext: "property-schema-compat",
    label: "Property",
  },
  Excursion: {
    columns: [
      ...EXCURSION_COMPAT_COLUMNS,
      "publicId",
      "isPublishedVisible",
      "deletedAt",
      "deletionExpiresAt",
    ],
    defaults: {
      contactPhoneName: null,
      contactPhone2: null,
      contactPhone2Name: null,
      contactPhone3: null,
      contactPhone3Name: null,
      publicId: null,
      pendingEditStatus: null,
      publishedSnapshot: null,
      tourKind: null,
      transportModes: [],
      departureMode: null,
      arrivalInfo: null,
      departureInfo: null,
      roomTypes: [],
      documentsRequired: [],
      insuranceIncluded: null,
      insuranceComment: null,
      equipmentProvided: [],
      safetyInfo: null,
      routeConditions: null,
      accommodationStars: null,
      singleSupplementAvailable: null,
      singleSupplementPrice: null,
      mealDetails: null,
      sectionPhotoGroups: {},
      isPublishedVisible: true,
      deletedAt: null,
      deletionExpiresAt: null,
    },
    logContext: "excursion-schema-compat",
    label: "Excursion",
  },
  Transfer: {
    columns: TRANSFER_COMPAT_COLUMNS,
    defaults: {
      publicId: null,
      isPublishedVisible: true,
      serviceTags: [],
      fleet: [],
      phoneName: null,
      phone2Name: null,
      phone3: null,
      phone3Name: null,
      contactEmail: null,
      pendingEditStatus: null,
      publishedSnapshot: null,
    },
    logContext: "transfer-schema-compat",
    label: "Transfer",
  },
  Room: {
    columns: ROOM_COMPAT_COLUMNS,
    defaults: {
      sortOrder: 0,
    },
    logContext: "room-schema-compat",
    label: "Room",
  },
  RoomPrice: {
    columns: ROOM_PRICE_COMPAT_COLUMNS,
    defaults: {
      priceType: "PER_ROOM",
      minNights: null,
    },
    logContext: "room-price-schema-compat",
    label: "RoomPrice",
  },
  RoomOccupancy: {
    columns: ROOM_OCCUPANCY_COMPAT_COLUMNS,
    defaults: {
      externalCalendarSyncId: null,
      externalCalendarSourceId: null,
      externalCalendarUid: null,
    },
    logContext: "room-occupancy-schema-compat",
    label: "RoomOccupancy",
  },
  Review: {
    columns: REVIEW_COMPAT_COLUMNS,
    defaults: {
      transferId: null,
      isImported: false,
      importedAuthorName: null,
      externalSourceUrl: null,
      externalSourceName: null,
      externalPlatform: null,
      externalReviewSourceId: null,
      externalReviewId: null,
      externalReviewFingerprint: null,
      externalStayPeriod: null,
      externalRating: null,
      externalRatingScale: null,
      externalImportedAt: null,
      externalLastSeenAt: null,
      externalChangedAt: null,
      externalPendingData: null,
      importedByOwnerId: null,
      verifiedAt: null,
      verifiedByAdminId: null,
      guestCity: null,
      reviewedAt: null,
      reviewCategory: null,
      reviewHighlight: null,
      reviewCategoryMatches: null,
    },
    logContext: "review-schema-compat",
    label: "Review",
  },
  Payment: {
    columns: PAYMENT_COMPAT_COLUMNS,
    defaults: {
      transferId: null,
      tariffType: null,
      paidFrom: null,
    },
    logContext: "payment-schema-compat",
    label: "Payment",
  },
} as const satisfies Record<
  string,
  {
    columns: readonly string[];
    defaults: Record<string, unknown>;
    logContext: string;
    label: string;
  }
>;

type CompatModelName = keyof typeof SCHEMA_COMPAT_MODELS;
type MissingCompatColumnsByModel = Map<string, Set<string>>;
type CompatTraversalMode = "plain" | "modelArgs" | "selectionMap";
type CompatColumnQueryClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};
const PRISMA_COMPAT_SIGNATURE = JSON.stringify(
  Object.entries(SCHEMA_COMPAT_MODELS).map(([modelName, config]) => [
    modelName,
    [...config.columns],
    Object.keys(config.defaults).sort(),
  ]),
);

const MODEL_METADATA = Prisma.dmmf.datamodel.models.map((model) => ({
  name: model.name,
  tableName: model.dbName ?? model.name,
  scalarFields: model.fields.filter((field) => field.kind !== "object").map((field) => field.name),
  relations: new Map(
    model.fields
      .filter((field) => field.kind === "object")
      .map((field) => [field.name, field.type] as const),
  ),
}));

const TABLE_NAME_BY_MODEL = new Map(
  MODEL_METADATA.map((model) => [model.name, model.tableName] as const),
);

const RELATION_FIELDS_BY_MODEL = new Map(
  MODEL_METADATA.map((model) => [model.name, model.relations] as const),
);

const SCALAR_FIELDS_BY_MODEL = new Map(
  MODEL_METADATA.map((model) => [model.name, model.scalarFields] as const),
);

const EMPTY_STRING_SET = new Set<string>();
const EMPTY_STRING_ARRAY: readonly string[] = [];
const EMPTY_RELATION_MAP = new Map<string, string>();
const NORMALIZED_COMPAT_MODEL_NAMES = new Map(
  Object.keys(SCHEMA_COMPAT_MODELS).map(
    (modelName) => [modelName.toLowerCase(), modelName] as const,
  ),
);
const RECORD_RETURNING_OPERATIONS = new Set([
  "create",
  "createManyAndReturn",
  "delete",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "updateManyAndReturn",
  "upsert",
]);

declare global {
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
  var prismaCompatSignature: string | undefined;
}

let missingCompatColumnsPromise: Promise<MissingCompatColumnsByModel> | null = null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneCompatDefaultValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }

  return value;
}

function normalizeCompatModelName(modelName: string): string {
  return NORMALIZED_COMPAT_MODEL_NAMES.get(modelName.toLowerCase()) ?? modelName;
}

function buildCompatSelect(
  modelName: string,
  missingColumnsByModel: MissingCompatColumnsByModel,
  extraSelections?: Record<string, unknown>,
): Record<string, unknown> {
  const normalizedModelName = normalizeCompatModelName(modelName);
  const missingColumns = missingColumnsByModel.get(normalizedModelName) ?? EMPTY_STRING_SET;
  const scalarFields = SCALAR_FIELDS_BY_MODEL.get(normalizedModelName) ?? EMPTY_STRING_ARRAY;
  const nextSelect: Record<string, unknown> = {};

  for (const fieldName of scalarFields) {
    if (missingColumns.has(fieldName)) {
      continue;
    }

    nextSelect[fieldName] = true;
  }

  if (extraSelections) {
    for (const [key, value] of Object.entries(extraSelections)) {
      nextSelect[key] = value;
    }
  }

  return nextSelect;
}

function sanitizeCompatArgs<T>(
  value: T,
  modelName: string,
  missingColumnsByModel: MissingCompatColumnsByModel,
  mode: CompatTraversalMode = "plain",
): T {
  if (Array.isArray(value)) {
    let changed = false;
    const nextItems = value.map((item) => {
      const nextItem = sanitizeCompatArgs(item, modelName, missingColumnsByModel);
      if (nextItem !== item) {
        changed = true;
      }
      return nextItem;
    });

    return (changed ? nextItems : value) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const normalizedModelName = normalizeCompatModelName(modelName);
  const missingColumns = missingColumnsByModel.get(normalizedModelName) ?? EMPTY_STRING_SET;
  const relationFields = RELATION_FIELDS_BY_MODEL.get(normalizedModelName) ?? EMPTY_RELATION_MAP;
  const isModelArgs = mode === "modelArgs";

  let changed = false;
  const nextValue: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (missingColumns.has(key)) {
      changed = true;
      continue;
    }

    if ((key === "by" || key === "distinct") && Array.isArray(child)) {
      const filtered = child.filter(
        (entry) => typeof entry !== "string" || !missingColumns.has(entry),
      );
      if (filtered.length !== child.length) {
        changed = true;
      }
      nextValue[key] = filtered;
      continue;
    }

    if (isModelArgs && (key === "select" || key === "include")) {
      const nextChild = sanitizeCompatArgs(child, modelName, missingColumnsByModel, "selectionMap");
      if (nextChild !== child) {
        changed = true;
      }
      nextValue[key] = nextChild;
      continue;
    }

    const relatedModelName = relationFields.get(key);
    if (relatedModelName) {
      const relatedMissingColumns = missingColumnsByModel.get(relatedModelName) ?? EMPTY_STRING_SET;

      if (mode === "selectionMap" && child === true && relatedMissingColumns.size > 0) {
        nextValue[key] = {
          select: buildCompatSelect(relatedModelName, missingColumnsByModel),
        };
        changed = true;
        continue;
      }

      const nextChild = sanitizeCompatArgs(
        child,
        relatedModelName,
        missingColumnsByModel,
        mode === "selectionMap" && isPlainObject(child) ? "modelArgs" : "plain",
      );
      if (nextChild !== child) {
        changed = true;
      }
      nextValue[key] = nextChild;
      continue;
    }

    const nextChild = sanitizeCompatArgs(child, modelName, missingColumnsByModel);
    if (nextChild !== child) {
      changed = true;
    }
    nextValue[key] = nextChild;
  }

  if (
    isModelArgs &&
    "select" in nextValue &&
    isPlainObject(nextValue.select) &&
    Object.keys(nextValue.select).length === 0 &&
    missingColumns.size > 0
  ) {
    nextValue.select = buildCompatSelect(modelName, missingColumnsByModel);
    changed = true;
  }

  if (
    isModelArgs &&
    missingColumns.size > 0 &&
    "include" in nextValue &&
    isPlainObject(nextValue.include)
  ) {
    nextValue.select = buildCompatSelect(
      modelName,
      missingColumnsByModel,
      nextValue.include as Record<string, unknown>,
    );
    delete nextValue.include;
    changed = true;
  } else if (isModelArgs && missingColumns.size > 0 && !("select" in nextValue)) {
    nextValue.select = buildCompatSelect(modelName, missingColumnsByModel);
    changed = true;
  }

  return (changed ? nextValue : value) as T;
}

function hydrateCompatResult<T>(
  value: T,
  modelName: string,
  missingColumnsByModel: MissingCompatColumnsByModel,
): T {
  if (Array.isArray(value)) {
    let changed = false;
    const nextItems = value.map((item) => {
      const nextItem = hydrateCompatResult(item, modelName, missingColumnsByModel);
      if (nextItem !== item) {
        changed = true;
      }
      return nextItem;
    });

    return (changed ? nextItems : value) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const normalizedModelName = normalizeCompatModelName(modelName);
  const compatConfig = SCHEMA_COMPAT_MODELS[normalizedModelName as CompatModelName];
  const missingColumns = missingColumnsByModel.get(normalizedModelName) ?? EMPTY_STRING_SET;
  const relationFields = RELATION_FIELDS_BY_MODEL.get(normalizedModelName) ?? EMPTY_RELATION_MAP;

  let changed = false;
  const nextValue = { ...value } as Record<string, unknown>;

  if (compatConfig && missingColumns.size > 0) {
    for (const [column, defaultValue] of Object.entries(compatConfig.defaults)) {
      if (!missingColumns.has(column) || column in nextValue) {
        continue;
      }

      nextValue[column] = cloneCompatDefaultValue(defaultValue);
      changed = true;
    }
  }

  for (const [relationName, relatedModelName] of relationFields) {
    if (!(relationName in nextValue)) {
      continue;
    }

    const child = nextValue[relationName];
    const nextChild = hydrateCompatResult(child, relatedModelName, missingColumnsByModel);
    if (nextChild !== child) {
      nextValue[relationName] = nextChild;
      changed = true;
    }
  }

  return (changed ? nextValue : value) as T;
}

async function loadMissingCompatColumns(
  queryClient: CompatColumnQueryClient,
): Promise<MissingCompatColumnsByModel> {
  return Promise.all(
    (Object.keys(SCHEMA_COMPAT_MODELS) as CompatModelName[]).map(async (modelName) => {
      const compatConfig = SCHEMA_COMPAT_MODELS[modelName];
      const tableName = TABLE_NAME_BY_MODEL.get(modelName) ?? modelName;

      const rows = await queryClient.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name IN (${Prisma.join([...compatConfig.columns])})
      `);

      const presentColumns = new Set(rows.map((row) => row.column_name));
      const missingColumns = compatConfig.columns.filter((column) => !presentColumns.has(column));

      if (missingColumns.length > 0) {
        logDatabaseFallbackOnce(
          compatConfig.logContext,
          `${compatConfig.label} compatibility mode is enabled. Missing DB columns: ${missingColumns.join(", ")}. Apply the latest Prisma migration when DB owner access is available.`,
        );
      }

      return [modelName, new Set<string>(missingColumns)] as const;
    }),
  )
    .then((entries) => new Map(entries))
    .catch(() => new Map<string, Set<string>>());
}

async function getMissingCompatColumns(
  queryClient: CompatColumnQueryClient,
): Promise<MissingCompatColumnsByModel> {
  if (!missingCompatColumnsPromise) {
    missingCompatColumnsPromise = loadMissingCompatColumns(queryClient);
  }

  return missingCompatColumnsPromise;
}

function createPrismaClient() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const shouldLogQueries =
    isDevelopment &&
    (process.env.PRISMA_LOG_QUERIES === "1" || process.env.PRISMA_LOG_QUERIES === "true");
  const baseClient = new PrismaClient({
    log: isDevelopment
      ? [
          ...(shouldLogQueries ? [{ emit: "stdout" as const, level: "query" as const }] : []),
          { emit: "stdout", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : ["error"],
  });

  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, model, operation, query }) {
          if (!model || !args || typeof args !== "object") {
            return query(args);
          }

          const missingColumnsByModel = await getMissingCompatColumns(baseClient);
          const hasMissingColumns = [...missingColumnsByModel.values()].some(
            (missingColumns) => missingColumns.size > 0,
          );

          if (!hasMissingColumns) {
            return query(args);
          }

          const sanitizedArgs = sanitizeCompatArgs(
            args,
            model,
            missingColumnsByModel,
            RECORD_RETURNING_OPERATIONS.has(operation) ? "modelArgs" : "plain",
          );
          const result = await query(sanitizedArgs);

          if (!RECORD_RETURNING_OPERATIONS.has(operation)) {
            return result;
          }

          return hydrateCompatResult(result, model, missingColumnsByModel);
        },
      },
    },
  });

  if (isDevelopment) {
    baseClient.$on("error", (event) => {
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

      if (isDatabaseConfigurationMessage(event.message)) {
        logDatabaseFallbackOnce(
          "database-config",
          "Prisma database configuration is missing or invalid. Check DATABASE_URL in .env.",
        );
        return;
      }

      console.error(`prisma:error ${event.message}`);
    });
  }

  return client;
}

const shouldReuseGlobalPrisma =
  global.prisma !== undefined && global.prismaCompatSignature === PRISMA_COMPAT_SIGNATURE;

if (!shouldReuseGlobalPrisma && global.prisma && process.env.NODE_ENV !== "production") {
  void global.prisma.$disconnect().catch(() => undefined);
  global.prisma = undefined;
}

export const db = shouldReuseGlobalPrisma ? global.prisma! : createPrismaClient();

export type DbClient = typeof db;
export type DbTransactionClient = Omit<
  DbClient,
  "$connect" | "$disconnect" | "$extends" | "$on" | "$transaction"
>;
export type DbClientLike = DbClient | DbTransactionClient;

const tableAvailabilityPromises = new Map<string, Promise<boolean>>();

export async function isDatabaseTableAvailable(
  tableName: string,
  queryClient: CompatColumnQueryClient = db,
): Promise<boolean> {
  const normalizedTableName = tableName.trim();

  if (!normalizedTableName) {
    return false;
  }

  if (queryClient === db) {
    const cached = tableAvailabilityPromises.get(normalizedTableName);
    if (cached) {
      return cached;
    }
  }

  let availabilityPromise = queryClient
    .$queryRaw<Array<{ table_name: string }>>(
      Prisma.sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${normalizedTableName}
      LIMIT 1
    `,
    )
    .then((rows) => rows.length > 0)
    .catch(() => false);

  if (queryClient === db) {
    availabilityPromise = availabilityPromise.then((available) => {
      if (
        !available &&
        tableAvailabilityPromises.get(normalizedTableName) === availabilityPromise
      ) {
        tableAvailabilityPromises.delete(normalizedTableName);
      }

      return available;
    });
    tableAvailabilityPromises.set(normalizedTableName, availabilityPromise);
  }

  return availabilityPromise;
}

export async function areDatabaseColumnsAvailable(
  modelName: CompatModelName,
  columns: readonly string[],
): Promise<boolean> {
  let missingColumnsByModel = await getMissingCompatColumns(db);
  let missingColumns = missingColumnsByModel.get(modelName) ?? EMPTY_STRING_SET;
  if (columns.every((column) => !missingColumns.has(column))) {
    return true;
  }

  missingCompatColumnsPromise = loadMissingCompatColumns(db);
  missingColumnsByModel = await missingCompatColumnsPromise;
  missingColumns = missingColumnsByModel.get(modelName) ?? EMPTY_STRING_SET;
  return columns.every((column) => !missingColumns.has(column));
}

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
  global.prismaCompatSignature = PRISMA_COMPAT_SIGNATURE;
}

export const __compatTestUtils = {
  hydrateCompatResult,
  sanitizeCompatArgs,
};
