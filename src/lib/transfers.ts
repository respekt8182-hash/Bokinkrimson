import { PaymentStatus, TransferStatus } from "@prisma/client";
import type { DbClientLike } from "@/lib/db";
import {
  getTransferPaymentTariffCode,
  getTransferPlacementCoverageState,
} from "@/lib/payments";
import { calculateTransferPublicationFeeRub } from "@/lib/site-tariffs";
import { ensurePublishedTransferSnapshotBeforeOwnerEdit } from "@/lib/transfer-public-snapshot";

type NumericLike = number | string | { toString(): string } | null | undefined;

export type TransferFleetItem = {
  id: string;
  title: string;
  transportKind: string;
  vehicleClass: string;
  vehicleModel: string;
  seats: number | null;
  luggage: number | null;
  luggageNote: string;
  priceFrom: number | null;
  priceUnitLabel: string;
  photoUrl: string | null;
  description: string;
};

type TransferSummaryInput = {
  fleet?: unknown;
  serviceTags?: string[] | null;
  photoUrls?: string[] | null;
  vehicleClass?: string | null;
  vehicleModel?: string | null;
  seats?: number | null;
  luggage?: number | null;
  priceFrom?: NumericLike;
  priceUnitLabel?: string | null;
};

const defaultPriceUnitLabel = "/ поездка";

export const transferTypeOptions = [
  "Трансфер в/из аэропорта",
  "Такси по городу",
  "Междугородний трансфер",
  "Трансфер по Крыму",
  "Трансфер на экскурсии",
  "VIP-трансфер",
  "Минивэн",
  "Микроавтобус",
  "Автобус",
  "Джиппинг",
  "Трансфер для мероприятий",
] as const;

export const transferTransportKindOptions = [
  "Седан",
  "Универсал",
  "Кроссовер",
  "Внедорожник",
  "Минивэн",
  "Микроавтобус",
  "Автобус",
  "Кабриолет",
  "Бизнес-класс",
  "Джип",
  "Катер",
] as const;

export const transferServiceTagOptions = [
  "Трансфер",
  "Такси",
  "Аэропорт",
  "Вокзал",
  "Межгород",
  "Поездки по Крыму",
  "VIP",
  "Минивэн",
  "Микроавтобус",
  "Автобус",
  "Джиппинг",
  "Детское кресло",
  "Встреча с табличкой",
] as const;

export const transferPriceUnitOptions = [
  "/ поездка",
  "/ авто",
  "/ час",
  "/ день",
  "/ маршрут",
] as const;

export const maxTransferServiceTags = 5;

export function getTransferWorkflowStatus(
  status: TransferStatus,
  pendingEditStatus: TransferStatus | null = null,
): TransferStatus {
  if (status === TransferStatus.PUBLISHED && pendingEditStatus) {
    return pendingEditStatus;
  }

  return status;
}

export function getTransferStatusLabel(
  status: TransferStatus,
  pendingEditStatus: TransferStatus | null = null,
): string {
  const workflowStatus = getTransferWorkflowStatus(status, pendingEditStatus);

  if (
    status === TransferStatus.PUBLISHED &&
    pendingEditStatus === TransferStatus.PENDING_MODERATION
  ) {
    return "Изменения на модерации";
  }

  if (status === TransferStatus.PUBLISHED && pendingEditStatus === TransferStatus.DRAFT) {
    return "Правки сохранены";
  }

  if (status === TransferStatus.PUBLISHED && pendingEditStatus === TransferStatus.REJECTED) {
    return "Правки отклонены";
  }

  switch (workflowStatus) {
    case TransferStatus.DRAFT:
      return "Черновик";
    case TransferStatus.PENDING_MODERATION:
      return "На модерации";
    case TransferStatus.PUBLISHED:
      return "Опубликовано";
    case TransferStatus.REJECTED:
      return "Отклонено";
    default:
      return workflowStatus;
  }
}

export function canSubmitPublishedTransferEdit(
  pendingEditStatus: TransferStatus | null = null,
): boolean {
  return (
    pendingEditStatus === null ||
    pendingEditStatus === TransferStatus.DRAFT ||
    pendingEditStatus === TransferStatus.REJECTED
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

function toPositiveNumber(value: NumericLike): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : Number(value.toString());

  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  return Number(raw);
}

function normalizePhotoUrl(value: unknown): string | null {
  const trimmed = toOptionalString(value);
  return trimmed ?? null;
}

function hasMeaningfulFleetData(item: TransferFleetItem): boolean {
  return Boolean(
    item.title ||
    item.transportKind ||
    item.vehicleClass ||
    item.vehicleModel ||
    item.seats ||
    item.luggage ||
    item.luggageNote ||
    item.priceFrom ||
    item.photoUrl ||
    item.description,
  );
}

function normalizeTitleToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compactTitlePart(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isSameTitlePart(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeTitleToken(left);
  const normalizedRight = normalizeTitleToken(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

function isGenericServiceTag(value: string | null | undefined): boolean {
  const normalized = normalizeTitleToken(value);
  return normalized === "трансфер" || normalized === "поездки по крыму";
}

export function createTransferFleetId(prefix = "fleet"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyTransferFleetItem(): TransferFleetItem {
  return {
    id: createTransferFleetId(),
    title: "",
    transportKind: "",
    vehicleClass: "",
    vehicleModel: "",
    seats: null,
    luggage: null,
    luggageNote: "",
    priceFrom: null,
    priceUnitLabel: defaultPriceUnitLabel,
    photoUrl: null,
    description: "",
  };
}

export function normalizeTransferServiceTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const candidate of value) {
    const tag = toOptionalString(candidate);
    if (!tag) {
      continue;
    }

    const normalizedKey = normalizeTitleToken(tag);
    if (seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    items.push(tag);
  }

  return items.slice(0, maxTransferServiceTags);
}

export function normalizeTransferFleet(value: unknown): TransferFleetItem[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  const items = rawItems
    .map((candidate, index) => {
      if (!isPlainObject(candidate)) {
        return null;
      }

      const item: TransferFleetItem = {
        id: toOptionalString(candidate.id) ?? `fleet-${index + 1}`,
        title: toOptionalString(candidate.title) ?? "",
        transportKind: toOptionalString(candidate.transportKind) ?? "",
        vehicleClass: toOptionalString(candidate.vehicleClass) ?? "",
        vehicleModel: toOptionalString(candidate.vehicleModel) ?? "",
        seats: toPositiveInteger(candidate.seats),
        luggage: toPositiveInteger(candidate.luggage),
        luggageNote: toOptionalString(candidate.luggageNote) ?? "",
        priceFrom: toPositiveNumber(candidate.priceFrom as NumericLike),
        priceUnitLabel: toOptionalString(candidate.priceUnitLabel) ?? defaultPriceUnitLabel,
        photoUrl: normalizePhotoUrl(candidate.photoUrl),
        description: toOptionalString(candidate.description) ?? "",
      };

      return hasMeaningfulFleetData(item) ? item : null;
    })
    .filter((item): item is TransferFleetItem => Boolean(item));

  return items.slice(0, 20);
}

export function buildLegacyTransferFleet(input: TransferSummaryInput): TransferFleetItem[] {
  const legacyItem: TransferFleetItem = {
    id: "legacy-primary",
    title: "",
    transportKind: "",
    vehicleClass: input.vehicleClass?.trim() ?? "",
    vehicleModel: input.vehicleModel?.trim() ?? "",
    seats: input.seats ?? null,
    luggage: input.luggage ?? null,
    luggageNote: "",
    priceFrom: toPositiveNumber(input.priceFrom),
    priceUnitLabel: input.priceUnitLabel?.trim() || defaultPriceUnitLabel,
    photoUrl: (input.photoUrls ?? []).map((url) => url.trim()).find(Boolean) ?? null,
    description: "",
  };

  return hasMeaningfulFleetData(legacyItem) ? [legacyItem] : [];
}

export function getTransferFleet(input: TransferSummaryInput): TransferFleetItem[] {
  const normalized = normalizeTransferFleet(input.fleet);
  return normalized.length > 0 ? normalized : buildLegacyTransferFleet(input);
}

export function getTransferPrimaryFleetItem(items: TransferFleetItem[]): TransferFleetItem | null {
  if (items.length === 0) {
    return null;
  }

  return items[0] ?? null;
}

export function getTransferPhotoUrlsFromFleet(items: TransferFleetItem[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of items) {
    const url = item.photoUrl?.trim();
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function deriveTransferSummaryFromFleet(input: TransferSummaryInput): {
  fleet: TransferFleetItem[];
  primaryVehicle: TransferFleetItem | null;
  vehicleClass: string | null;
  vehicleModel: string | null;
  seats: number | null;
  luggage: number | null;
  priceFrom: number | null;
  priceUnitLabel: string | null;
  photoUrls: string[];
} {
  const fleet = getTransferFleet(input);
  const primaryVehicle = getTransferPrimaryFleetItem(fleet);
  const cheapestVehicle =
    fleet
      .filter((item) => item.priceFrom !== null)
      .sort((left, right) => Number(left.priceFrom) - Number(right.priceFrom))[0] ?? null;
  const maxSeats =
    fleet
      .map((item) => item.seats)
      .filter((value): value is number => value !== null)
      .sort((left, right) => right - left)[0] ?? null;
  const maxLuggage =
    fleet
      .map((item) => item.luggage)
      .filter((value): value is number => value !== null)
      .sort((left, right) => right - left)[0] ?? null;
  const fleetPhotoUrls = getTransferPhotoUrlsFromFleet(fleet);

  return {
    fleet,
    primaryVehicle,
    vehicleClass: primaryVehicle?.vehicleClass || null,
    vehicleModel: primaryVehicle?.vehicleModel || null,
    seats: maxSeats ?? primaryVehicle?.seats ?? null,
    luggage: maxLuggage ?? primaryVehicle?.luggage ?? null,
    priceFrom: cheapestVehicle?.priceFrom ?? primaryVehicle?.priceFrom ?? null,
    priceUnitLabel:
      cheapestVehicle?.priceUnitLabel ||
      primaryVehicle?.priceUnitLabel ||
      input.priceUnitLabel?.trim() ||
      defaultPriceUnitLabel,
    photoUrls: fleetPhotoUrls.length > 0 ? fleetPhotoUrls : (input.photoUrls ?? []).filter(Boolean),
  };
}

export function buildTransferTitleSuggestion(input: {
  transferType?: string | null;
  locationName?: string | null;
  serviceTags?: string[] | null;
  fleet?: unknown;
  vehicleClass?: string | null;
  vehicleModel?: string | null;
}): string {
  const summary = deriveTransferSummaryFromFleet(input);
  const normalizedTags = normalizeTransferServiceTags(input.serviceTags ?? []);
  const baseTitle =
    compactTitlePart(input.transferType) ??
    normalizedTags.find((tag) => !isGenericServiceTag(tag)) ??
    "Трансфер";
  const locationName = compactTitlePart(input.locationName);
  const vehicleHint =
    compactTitlePart(summary.primaryVehicle?.transportKind) ??
    compactTitlePart(summary.vehicleClass ?? input.vehicleClass) ??
    compactTitlePart(summary.vehicleModel ?? input.vehicleModel);

  const parts = [baseTitle];
  if (locationName && !isSameTitlePart(baseTitle, locationName)) {
    parts.push(locationName);
  }

  if (
    vehicleHint &&
    !parts.some((part) => isSameTitlePart(part, vehicleHint)) &&
    !normalizedTags.some((tag) => isSameTitlePart(tag, vehicleHint))
  ) {
    const withVehicle = [...parts, vehicleHint].join(" - ");
    if (withVehicle.length <= 72) {
      return withVehicle;
    }
  }

  return parts.join(" - ");
}

export function isTransferReadyForModeration(input: {
  title?: string | null;
  description?: string | null;
  transferType?: string | null;
  locationName?: string | null;
  priceFrom?: NumericLike;
  contactName?: string | null;
  phone?: string | null;
  fleet?: unknown;
  photoUrls?: string[] | null;
  vehicleClass?: string | null;
  vehicleModel?: string | null;
  seats?: number | null;
  luggage?: number | null;
  priceUnitLabel?: string | null;
}): boolean {
  const summary = deriveTransferSummaryFromFleet(input);
  const hasVehicleSummary = Boolean(
    summary.primaryVehicle?.vehicleModel ||
    summary.primaryVehicle?.vehicleClass ||
    summary.primaryVehicle?.transportKind ||
    summary.primaryVehicle?.title,
  );

  return (
    Boolean(input.title?.trim()) &&
    Boolean(input.description?.trim()) &&
    Boolean(input.transferType?.trim()) &&
    hasVehicleSummary &&
    Boolean(input.locationName?.trim()) &&
    Boolean(summary.priceFrom ?? toPositiveNumber(input.priceFrom)) &&
    Boolean(input.contactName?.trim()) &&
    Boolean(input.phone?.trim()) &&
    summary.photoUrls.length > 0
  );
}

export async function autoSubmitTransferAfterSuccessfulPayment(
  client: DbClientLike,
  transferId: string,
): Promise<boolean> {
  const [transfer, payments] = await Promise.all([
    client.transfer.findUnique({
      where: { id: transferId },
      select: {
        fleet: true,
        photoUrls: true,
        vehicleClass: true,
        vehicleModel: true,
        seats: true,
        luggage: true,
        priceFrom: true,
        priceUnitLabel: true,
      },
    }),
    client.payment.findMany({
      where: {
        status: PaymentStatus.SUCCEEDED,
        OR: [{ transferId }, { tariffCode: getTransferPaymentTariffCode(transferId) }],
      },
      select: {
        amount: true,
        roomCount: true,
        status: true,
        provider: true,
        paidAt: true,
        createdAt: true,
        placementValidUntil: true,
      },
    }),
  ]);

  if (!transfer) {
    return false;
  }

  const fleet = getTransferFleet(transfer);
  const coverage = getTransferPlacementCoverageState({
    payments,
    publicationFeeRub: calculateTransferPublicationFeeRub(fleet.length),
  });

  if (!coverage.fullyCovered) {
    return false;
  }

  return submitTransferToModerationIfReady(client, transferId);
}

export async function submitTransferToModerationIfReady(
  client: DbClientLike,
  transferId: string,
): Promise<boolean> {
  const transfer = await client.transfer.findUnique({
    where: { id: transferId },
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
      title: true,
      description: true,
      transferType: true,
      locationName: true,
      priceFrom: true,
      contactName: true,
      phone: true,
      fleet: true,
      photoUrls: true,
      vehicleClass: true,
      vehicleModel: true,
      seats: true,
      luggage: true,
      priceUnitLabel: true,
    },
  });

  if (!transfer) {
    return false;
  }

  if (!isTransferReadyForModeration(transfer)) {
    return false;
  }

  const workflowStatus = getTransferWorkflowStatus(
    transfer.status,
    transfer.pendingEditStatus ?? null,
  );

  if (workflowStatus === TransferStatus.PENDING_MODERATION) {
    return true;
  }

  if (transfer.status === TransferStatus.PUBLISHED) {
    await ensurePublishedTransferSnapshotBeforeOwnerEdit(client, transfer.id);
    await client.transfer.update({
      where: { id: transfer.id },
      data: {
        pendingEditStatus: TransferStatus.PENDING_MODERATION,
        moderationNotes: null,
      },
    });

    return true;
  }

  if (transfer.status !== TransferStatus.DRAFT && transfer.status !== TransferStatus.REJECTED) {
    return false;
  }

  await client.transfer.update({
    where: { id: transfer.id },
    data: {
      status: TransferStatus.PENDING_MODERATION,
      moderationNotes: null,
    },
  });

  return true;
}
