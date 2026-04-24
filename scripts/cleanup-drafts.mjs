/**
 * CLI utility: delete empty property/excursion drafts older than 15 days.
 *
 * Usage:
 *   node scripts/cleanup-drafts.mjs [--dry-run]
 *
 * Requires DATABASE_URL in the environment (reads from .env automatically via Prisma).
 * For S3 deletion: also set S3_* env vars.
 */
import { PrismaClient } from "@prisma/client";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RETENTION_DAYS = 15;
const DRY_RUN = process.argv.includes("--dry-run");

function hasNonEmptyText(...values) {
  return values.some((value) => typeof value === "string" && value.trim().length > 0);
}

function hasJsonItems(value) {
  return Array.isArray(value) && value.length > 0;
}

async function deleteFile(storageKey) {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (bucket && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  } else {
    const key = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    const fullPath = path.join(__dirname, "..", "public", "uploads", ...key.split("/"));
    await unlink(fullPath).catch(() => null);
  }
}

function normalizeStorageKey(key) {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function startsWithNormalizedUrl(input, base) {
  const normalizedInput = input.replace(/\/+$/, "");
  const normalizedBase = base.replace(/\/+$/, "");
  return normalizedInput.startsWith(`${normalizedBase}/`);
}

function getStorageKeyFromPublicUrl(url) {
  const trimmedUrl = typeof url === "string" ? url.trim() : "";
  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith("/uploads/")) {
    return normalizeStorageKey(trimmedUrl.slice("/uploads/".length));
  }

  const region = process.env.S3_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  const candidates = [
    publicBaseUrl,
    endpoint && bucket ? `${endpoint}/${bucket}` : null,
    bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : null,
  ].filter(Boolean);

  for (const base of candidates) {
    if (!startsWithNormalizedUrl(trimmedUrl, base)) {
      continue;
    }

    const key = trimmedUrl.slice(base.replace(/\/+$/, "").length + 1);
    return normalizeStorageKey(decodeURIComponent(key));
  }

  return null;
}

async function deleteManagedUrl(url) {
  const key = getStorageKeyFromPublicUrl(url);
  if (!key) {
    return;
  }

  await deleteFile(key).catch(() => null);
}

function isPropertyEmptyDraft(property) {
  const hasMeaningfulText = hasNonEmptyText(
    property.type,
    property.locationId,
    property.locationName,
    property.name,
    property.address,
    property.seaDistance,
    property.phone,
    property.phoneName,
    property.phone2,
    property.phone2Name,
    property.phone3,
    property.phone3Name,
    property.websiteUrl,
    property.contactEmail,
    property.contactPersonName,
    property.contactPersonRole,
    property.listingChannels,
    property.whatsappUrl,
    property.telegramUrl,
    property.vkUrl,
    property.maxUrl,
    property.okUrl,
    property.description,
    property.checkInFrom,
    property.checkOutUntil,
    property.quietHoursFrom,
    property.quietHoursTo,
    property.parkingInfo,
    property.mealOptions,
    property.prepaymentPolicy,
    property.registryNumber,
    property.registryNumberPending,
  );
  const hasCoordinates = property.latitude !== null || property.longitude !== null;
  const hasConfiguredRules =
    property.childrenAllowed !== null ||
    property.childrenMinAge !== null ||
    property.petsPolicy !== null ||
    property.smokingPolicy !== null ||
    property.quietHoursEnabled !== null;
  const hasClassificationData =
    property.classificationApplicable ||
    property.starRating !== null ||
    property.registryModerationSubmittedAt !== null ||
    property.selfAssessmentPassed !== null;
  const hasAttachedData =
    property.amenities.length > 0 ||
    property.customAmenities.length > 0 ||
    property.media.length > 0 ||
    property.rooms.length > 0 ||
    property.documents.length > 0;
  const hasSuccessfulPayment = property.payments.length > 0;

  return !(
    hasMeaningfulText ||
    hasCoordinates ||
    hasConfiguredRules ||
    hasClassificationData ||
    hasAttachedData ||
    hasSuccessfulPayment
  );
}

function isExcursionEmptyDraft(excursion) {
  const hasMeaningfulText = hasNonEmptyText(
    excursion.subtypeLabel,
    excursion.title,
    excursion.locationId,
    excursion.locationName,
    excursion.mainLocationId,
    excursion.anchorLocationId,
    excursion.districtId,
    excursion.categoryId,
    excursion.address,
    excursion.startPoint,
    excursion.meetingPointText,
    excursion.meetingLocationId,
    excursion.description,
    excursion.shortDescription,
    excursion.fullDescription,
    excursion.routeDescription,
    excursion.finishPoint,
    excursion.scheduleText,
    excursion.availabilityNote,
    excursion.includedText,
    excursion.notIncludedText,
    excursion.cancellationPolicy,
    excursion.transferDetails,
    excursion.contactFirstName,
    excursion.contactLastName,
    excursion.contactPhone,
    excursion.contactEmail,
    excursion.websiteUrl,
    excursion.whatsappUrl,
    excursion.telegramUrl,
    excursion.vkUrl,
    excursion.maxUrl,
    excursion.okUrl,
    excursion.priceUnitLabel,
    excursion.accommodationType,
    excursion.accommodationFormat,
    excursion.accommodationComment,
    excursion.tourKind,
    excursion.departureMode,
    excursion.arrivalInfo,
    excursion.departureInfo,
    excursion.insuranceComment,
    excursion.safetyInfo,
    excursion.routeConditions,
  );
  const hasCoordinates = excursion.latitude !== null || excursion.longitude !== null;
  const hasNumericValues = [
    excursion.durationMinutes,
    excursion.durationDays,
    excursion.durationNights,
    excursion.groupSizeMin,
    excursion.groupSizeMax,
    excursion.ageLimit,
    excursion.priceFrom === null ? null : Number(excursion.priceFrom),
    excursion.priceTo === null ? null : Number(excursion.priceTo),
    excursion.minBookingNoticeHours,
    excursion.accommodationNights,
  ].some((value) => value !== null);
  const hasBooleanSettings =
    excursion.isKidFriendly !== null ||
    excursion.accommodationProvided !== null ||
    excursion.insuranceIncluded !== null;
  const hasEnumSelections = excursion.format !== null || excursion.difficulty !== null;
  const hasAttachedContent =
    excursion.photoUrls.length > 0 ||
    excursion.videoUrls.length > 0 ||
    excursion.includedItems.length > 0 ||
    excursion.excludedItems.length > 0 ||
    excursion.languageCodes.length > 0 ||
    excursion.physicalRequirements.length > 0 ||
    excursion.whatToBring.length > 0 ||
    excursion.tags.length > 0 ||
    excursion.transportModes.length > 0 ||
    excursion.roomTypes.length > 0 ||
    excursion.documentsRequired.length > 0 ||
    excursion.equipmentProvided.length > 0 ||
    excursion.pickupLocations.length > 0 ||
    excursion.routeLocations.length > 0 ||
    excursion.sessions.length > 0 ||
    excursion.scheduleRules.length > 0 ||
    hasJsonItems(excursion.timeline) ||
    hasJsonItems(excursion.pricingTiers) ||
    hasJsonItems(excursion.faqItems) ||
    hasJsonItems(excursion.extraOptions) ||
    hasJsonItems(excursion.itineraryDays);
  const hasSuccessfulPayment = excursion.payments.length > 0;

  return !(
    hasMeaningfulText ||
    hasCoordinates ||
    hasNumericValues ||
    hasBooleanSettings ||
    hasEnumSelections ||
    hasAttachedContent ||
    hasSuccessfulPayment
  );
}

async function main() {
  const db = new PrismaClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const [propertyDrafts, excursionDrafts] = await Promise.all([
    db.property.findMany({
      where: { ownerDeletedAt: null, status: "draft", updatedAt: { lt: cutoff } },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        type: true,
        locationId: true,
        locationName: true,
        address: true,
        seaDistance: true,
        latitude: true,
        longitude: true,
        phone: true,
        phoneName: true,
        phone2: true,
        phone2Name: true,
        phone3: true,
        phone3Name: true,
        websiteUrl: true,
        contactEmail: true,
        contactPersonName: true,
        contactPersonRole: true,
        listingChannels: true,
        whatsappUrl: true,
        telegramUrl: true,
        vkUrl: true,
        maxUrl: true,
        okUrl: true,
        description: true,
        checkInFrom: true,
        checkOutUntil: true,
        childrenAllowed: true,
        childrenMinAge: true,
        petsPolicy: true,
        smokingPolicy: true,
        quietHoursEnabled: true,
        quietHoursFrom: true,
        quietHoursTo: true,
        parkingInfo: true,
        mealOptions: true,
        prepaymentPolicy: true,
        classificationApplicable: true,
        starRating: true,
        registryNumber: true,
        registryNumberPending: true,
        registryModerationSubmittedAt: true,
        selfAssessmentPassed: true,
        amenities: { select: { amenityId: true } },
        customAmenities: { select: { name: true } },
        media: { select: { id: true, storageKey: true } },
        rooms: { select: { id: true, media: { select: { storageKey: true } } } },
        documents: { select: { id: true, storageKey: true } },
        payments: {
          where: { status: "succeeded" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    db.excursion.findMany({
      where: { status: "draft", updatedAt: { lt: cutoff } },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        subtypeLabel: true,
        locationId: true,
        locationName: true,
        mainLocationId: true,
        anchorLocationId: true,
        districtId: true,
        categoryId: true,
        address: true,
        latitude: true,
        longitude: true,
        startPoint: true,
        meetingPointText: true,
        meetingLocationId: true,
        description: true,
        shortDescription: true,
        fullDescription: true,
        routeDescription: true,
        durationMinutes: true,
        durationDays: true,
        durationNights: true,
        finishPoint: true,
        scheduleText: true,
        availabilityNote: true,
        format: true,
        groupSizeMin: true,
        groupSizeMax: true,
        ageLimit: true,
        isKidFriendly: true,
        difficulty: true,
        priceFrom: true,
        priceTo: true,
        includedText: true,
        notIncludedText: true,
        cancellationPolicy: true,
        transferDetails: true,
        minBookingNoticeHours: true,
        contactFirstName: true,
        contactLastName: true,
        contactPhone: true,
        contactEmail: true,
        websiteUrl: true,
        whatsappUrl: true,
        telegramUrl: true,
        vkUrl: true,
        maxUrl: true,
        okUrl: true,
        priceUnitLabel: true,
        accommodationProvided: true,
        accommodationType: true,
        accommodationNights: true,
        accommodationFormat: true,
        accommodationComment: true,
        tourKind: true,
        departureMode: true,
        arrivalInfo: true,
        departureInfo: true,
        insuranceIncluded: true,
        insuranceComment: true,
        safetyInfo: true,
        routeConditions: true,
        photoUrls: true,
        videoUrls: true,
        timeline: true,
        pricingTiers: true,
        faqItems: true,
        extraOptions: true,
        itineraryDays: true,
        includedItems: true,
        excludedItems: true,
        languageCodes: true,
        physicalRequirements: true,
        whatToBring: true,
        tags: true,
        transportModes: true,
        roomTypes: true,
        documentsRequired: true,
        equipmentProvided: true,
        pickupLocations: { select: { locationId: true } },
        routeLocations: { select: { locationId: true, sortOrder: true } },
        sessions: { select: { id: true } },
        scheduleRules: { select: { id: true } },
        payments: {
          where: { status: "succeeded" },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  const emptyPropertyDrafts = propertyDrafts.filter(isPropertyEmptyDraft);
  const emptyExcursionDrafts = excursionDrafts.filter(isExcursionEmptyDraft);

  if (emptyPropertyDrafts.length === 0 && emptyExcursionDrafts.length === 0) {
    console.log("No expired empty drafts found.");
    await db.$disconnect();
    return;
  }

  console.log(
    `Found ${emptyPropertyDrafts.length} property draft(s) and ${emptyExcursionDrafts.length} excursion draft(s)${DRY_RUN ? " [DRY RUN - no changes]" : ""}:`,
  );

  for (const property of emptyPropertyDrafts) {
    const files =
      property.media.length +
      property.rooms.reduce((acc, room) => acc + room.media.length, 0) +
      property.documents.length;
    console.log(
      `  [property] ${property.id} "${property.name ?? "(no name)"}" updated=${property.updatedAt.toISOString()} files=${files}`,
    );
  }

  for (const excursion of emptyExcursionDrafts) {
    const files = excursion.photoUrls.length + excursion.videoUrls.length;
    console.log(
      `  [excursion] ${excursion.id} "${excursion.title ?? "(no title)"}" updated=${excursion.updatedAt.toISOString()} files=${files}`,
    );
  }

  if (DRY_RUN) {
    await db.$disconnect();
    return;
  }

  const propertyKeys = emptyPropertyDrafts.flatMap((property) => [
    ...property.media.map((media) => media.storageKey),
    ...property.rooms.flatMap((room) => room.media.map((media) => media.storageKey)),
    ...property.documents.map((document) => document.storageKey),
  ]);
  await Promise.all(propertyKeys.map((key) => deleteFile(key).catch(() => null)));

  const excursionUrls = emptyExcursionDrafts.flatMap((excursion) => [
    ...excursion.photoUrls,
    ...excursion.videoUrls,
  ]);
  await Promise.all(excursionUrls.map((url) => deleteManagedUrl(url)));

  const [deletedProperties, deletedExcursions] = await Promise.all([
    emptyPropertyDrafts.length > 0
      ? db.property.deleteMany({
          where: { id: { in: emptyPropertyDrafts.map((property) => property.id) } },
        })
      : Promise.resolve({ count: 0 }),
    emptyExcursionDrafts.length > 0
      ? db.excursion.deleteMany({
          where: { id: { in: emptyExcursionDrafts.map((excursion) => excursion.id) } },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  console.log(`Deleted ${propertyKeys.length} property file(s) from storage.`);
  console.log(`Deleted ${excursionUrls.length} excursion file(s) from storage.`);
  console.log(`Deleted ${deletedProperties.count} property record(s) from the database.`);
  console.log(`Deleted ${deletedExcursions.count} excursion record(s) from the database.`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
