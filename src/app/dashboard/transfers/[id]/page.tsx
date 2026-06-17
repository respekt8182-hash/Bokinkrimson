import { PaymentProvider, PaymentStatus, Prisma, TransferStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { TransferEditorPage } from "@/components/transfers/transfer-editor-page";
import { getSession } from "@/lib/auth";
import {
  normalizeEmailAddress,
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import {
  buildFreePlacementPaymentPayload,
  buildPostLaunchTrialPaymentPayload,
  buildTransferPaymentPayload,
  getPlacementValidUntil,
  getTransferPaymentTariffCode,
  getTransferPlacementCoverageState,
  serializePayment,
} from "@/lib/payments";
import { applyProviderPaymentStatus, getOnlinePaymentProviders } from "@/lib/payment-finalization";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";
import { TRANSFER_EXTRA_VEHICLE_FEE_RUB } from "@/lib/site-tariffs";
import {
  applyPlacementFreePeriodToPricing,
  buildPlacementPromoPayload,
  getPlacementPromoDemoValidUntil,
  getPlacementPromoPrice,
  getPostLaunchTrialValidUntil,
  isPostLaunchTrialEligible,
} from "@/lib/placement-promo";
import { buildPlacementPricingPayload, getPlacementPrice } from "@/lib/placement-pricing";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  applyPublishedTransferSnapshotToRow,
  ensurePublishedTransferSnapshotBeforeOwnerEdit,
} from "@/lib/transfer-public-snapshot";
import {
  autoSubmitTransferAfterSuccessfulPayment,
  deriveTransferSummaryFromFleet,
  getTransferFleet,
  getTransferStatusLabel,
  getTransferWorkflowStatus,
  isTransferReadyForModeration,
  normalizeTransferFleet,
  normalizeTransferServiceTags,
  submitTransferToModerationIfReady,
} from "@/lib/transfers";
import {
  buildAbsoluteAppUrl,
  buildYooKassaPaymentReceipt,
  buildYooKassaReceiptItemDescription,
  createYooKassaPayment,
  isYooKassaConfigured,
  mapYooKassaPaymentStatus,
  mergeYooKassaPaymentPayload,
  YooKassaApiError,
  YooKassaConfigurationError,
} from "@/lib/yookassa";

type DashboardTransferPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TransferEditorStep = "info" | "location" | "fleet" | "contacts" | "publish";

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formOptionalString(formData: FormData, key: string): string | null | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  return formString(formData, key);
}

function formCoordinate(formData: FormData, key: string): Prisma.Decimal | null {
  const value = formString(formData, key)?.replace(",", ".");
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
}

function formOptionalCoordinate(
  formData: FormData,
  key: string,
): Prisma.Decimal | null | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  return formCoordinate(formData, key);
}

function parseJsonField(formData: FormData, key: string): unknown {
  const value = formString(formData, key);
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function parseOptionalJsonField(formData: FormData, key: string): unknown | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  return parseJsonField(formData, key);
}

function getFirstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseTransferEditorStep(value: string | null): TransferEditorStep | null {
  if (
    value === "info" ||
    value === "location" ||
    value === "fleet" ||
    value === "contacts" ||
    value === "publish"
  ) {
    return value;
  }

  return null;
}

function normalizeTransferComparableValue(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeTransferComparableValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeTransferComparableValue(entryValue)]),
    );
  }

  return value ?? null;
}

function areTransferValuesEqual(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeTransferComparableValue(left)) ===
    JSON.stringify(normalizeTransferComparableValue(right))
  );
}

export default async function DashboardTransferEditPage({
  params,
  searchParams,
}: DashboardTransferPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/transfers");
  }

  const { id } = await params;
  const resolvedSearchParams = searchParams
    ? await searchParams
    : ({} as Record<string, string | string[] | undefined>);
  const [transfer, locations] = await Promise.all([
    db.transfer.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
      },
    }),
    db.excursionLocation.findMany({
      orderBy: [{ isMajor: "desc" }, { name: "asc" }],
      select: { id: true, name: true, districtId: true },
    }),
  ]);

  if (!transfer || transfer.ownerId !== session.id) {
    notFound();
  }

  async function saveTransfer(formData: FormData) {
    "use server";

    const currentSession = await getSession();
    if (!currentSession) {
      redirect("/auth/login?next=/dashboard/transfers");
    }

    const current = await db.transfer.findUnique({
      where: { id },
      select: {
        ownerId: true,
        createdAt: true,
        status: true,
        pendingEditStatus: true,
        publishedSnapshot: true,
        moderationNotes: true,
        title: true,
        transferType: true,
        vehicleClass: true,
        vehicleModel: true,
        seats: true,
        luggage: true,
        locationId: true,
        locationName: true,
        districtId: true,
        routeExamples: true,
        latitude: true,
        longitude: true,
        priceFrom: true,
        priceUnitLabel: true,
        description: true,
        photoUrls: true,
        serviceTags: true,
        fleet: true,
        contactName: true,
        phone: true,
        phoneName: true,
        phone2: true,
        phone2Name: true,
        phone3: true,
        phone3Name: true,
        websiteUrl: true,
        contactEmail: true,
        whatsappUrl: true,
        telegramUrl: true,
        vkUrl: true,
        maxUrl: true,
        okUrl: true,
      },
    });

    if (!current || current.ownerId !== currentSession.id) {
      notFound();
    }

    const resolveString = (key: string, currentValue: string | null): string | null => {
      const nextValue = formOptionalString(formData, key);
      return nextValue === undefined ? currentValue : nextValue;
    };

    const locationIdInput = formOptionalString(formData, "locationId");
    const locationId = locationIdInput === undefined ? current.locationId : locationIdInput;
    const selectedLocation = locationId
      ? await db.excursionLocation.findUnique({
          where: { id: locationId },
          select: { name: true, districtId: true },
        })
      : null;
    const titleInput = formOptionalString(formData, "title");
    const title =
      titleInput === undefined
        ? (current.title ?? "Новый трансфер")
        : (titleInput ?? "Новый трансфер");
    const fleetInput = parseOptionalJsonField(formData, "fleetJson");
    const serviceTagsInput = parseOptionalJsonField(formData, "serviceTagsJson");
    const fleet =
      fleetInput === undefined ? getTransferFleet(current) : normalizeTransferFleet(fleetInput);
    const serviceTags =
      serviceTagsInput === undefined
        ? normalizeTransferServiceTags(current.serviceTags)
        : normalizeTransferServiceTags(serviceTagsInput);
    const fleetSummary = deriveTransferSummaryFromFleet({
      fleet,
      photoUrls: fleetInput === undefined ? current.photoUrls : [],
      priceUnitLabel: current.priceUnitLabel,
    });
    const intent = formString(formData, "intent");
    const paymentProvider =
      formString(formData, "paymentProvider") === "YOOKASSA" ? "YOOKASSA" : "MANAGER";
    const previewPath = `${buildPublicTransferPath({ id, title })}?preview=1`;
    const transferType = resolveString("transferType", current.transferType);
    const locationName =
      selectedLocation?.name ??
      (locationIdInput === undefined
        ? current.locationName
        : resolveString("locationName", current.locationName));
    const description = resolveString("description", current.description);
    const routeExamples = resolveString("routeExamples", current.routeExamples);
    const contactName = resolveString("contactName", current.contactName);
    const phone = resolveString("phone", current.phone);
    const phoneName = resolveString("phoneName", current.phoneName);
    const phone2 = resolveString("phone2", current.phone2);
    const phone2Name = resolveString("phone2Name", current.phone2Name);
    const phone3 = resolveString("phone3", current.phone3);
    const phone3Name = resolveString("phone3Name", current.phone3Name);
    const websiteUrl = resolveString("websiteUrl", current.websiteUrl);
    const contactEmail = normalizeEmailAddress(resolveString("contactEmail", current.contactEmail));
    const whatsappInput = formOptionalString(formData, "whatsappUrl");
    const telegramInput = formOptionalString(formData, "telegramUrl");
    const vkInput = formOptionalString(formData, "vkUrl");
    const maxInput = formOptionalString(formData, "maxUrl");
    const okInput = formOptionalString(formData, "okUrl");
    const whatsappUrl =
      whatsappInput === undefined
        ? current.whatsappUrl
        : (normalizeWhatsappUrl(whatsappInput) ?? null);
    const telegramUrl =
      telegramInput === undefined
        ? current.telegramUrl
        : (normalizeTelegramProfileUrl(telegramInput) ?? null);
    const vkUrl = vkInput === undefined ? current.vkUrl : (normalizeVkProfileUrl(vkInput) ?? null);
    const maxUrl =
      maxInput === undefined ? current.maxUrl : (normalizeMaxProfileUrl(maxInput) ?? null);
    const okUrl = okInput === undefined ? current.okUrl : (normalizeOkProfileUrl(okInput) ?? null);
    const latitudeInput = formOptionalCoordinate(formData, "latitude");
    const longitudeInput = formOptionalCoordinate(formData, "longitude");
    const latitude = latitudeInput === undefined ? current.latitude : latitudeInput;
    const longitude = longitudeInput === undefined ? current.longitude : longitudeInput;
    const publishReady = isTransferReadyForModeration({
      title,
      description,
      transferType,
      locationName,
      priceFrom: fleetSummary.priceFrom,
      contactName,
      phone,
      fleet,
      photoUrls: fleetSummary.photoUrls,
      vehicleClass: fleetSummary.vehicleClass,
      vehicleModel: fleetSummary.vehicleModel,
      seats: fleetSummary.seats,
      luggage: fleetSummary.luggage,
      priceUnitLabel: fleetSummary.priceUnitLabel,
    });
    const publishedEditSupported =
      current.status === TransferStatus.PUBLISHED &&
      (await areDatabaseColumnsAvailable("Transfer", ["pendingEditStatus", "publishedSnapshot"]));
    const hasPublishedTransferContentEdit =
      publishedEditSupported &&
      !areTransferValuesEqual(
        {
          title,
          transferType,
          vehicleClass: fleetSummary.vehicleClass,
          vehicleModel: fleetSummary.vehicleModel,
          seats: fleetSummary.seats,
          luggage: fleetSummary.luggage,
          locationId,
          locationName,
          districtId:
            locationIdInput === undefined
              ? current.districtId
              : (selectedLocation?.districtId ?? null),
          routeExamples,
          latitude,
          longitude,
          priceFrom: fleetSummary.priceFrom,
          priceUnitLabel: fleetSummary.priceUnitLabel,
          description,
          photoUrls: fleetSummary.photoUrls,
          serviceTags,
          fleet,
          contactName,
          phone,
          phoneName,
          phone2,
          phone2Name,
          phone3,
          phone3Name,
          websiteUrl,
          contactEmail,
          whatsappUrl,
          telegramUrl,
          vkUrl,
          maxUrl,
          okUrl,
        },
        {
          title: current.title ?? "Новый трансфер",
          transferType: current.transferType,
          vehicleClass: current.vehicleClass,
          vehicleModel: current.vehicleModel,
          seats: current.seats,
          luggage: current.luggage,
          locationId: current.locationId,
          locationName: current.locationName,
          districtId: current.districtId,
          routeExamples: current.routeExamples,
          latitude: current.latitude,
          longitude: current.longitude,
          priceFrom: current.priceFrom,
          priceUnitLabel: current.priceUnitLabel,
          description: current.description,
          photoUrls: current.photoUrls,
          serviceTags: normalizeTransferServiceTags(current.serviceTags),
          fleet: getTransferFleet(current),
          contactName: current.contactName,
          phone: current.phone,
          phoneName: current.phoneName,
          phone2: current.phone2,
          phone2Name: current.phone2Name,
          phone3: current.phone3,
          phone3Name: current.phone3Name,
          websiteUrl: current.websiteUrl,
          contactEmail: current.contactEmail,
          whatsappUrl: current.whatsappUrl,
          telegramUrl: current.telegramUrl,
          vkUrl: current.vkUrl,
          maxUrl: current.maxUrl,
          okUrl: current.okUrl,
        },
      );

    if (hasPublishedTransferContentEdit) {
      await ensurePublishedTransferSnapshotBeforeOwnerEdit(db, id);
    }

    const now = new Date();
    const baseTransferPlacementPricing = await getPlacementPrice({
      userId: currentSession.id,
      category: "transfer",
      period: "year",
      additionalOptions: { additionalCars: Math.max(0, fleet.length - 1) },
      now,
    });
    const originalPublicationFeeRub =
      baseTransferPlacementPricing.basePrice + baseTransferPlacementPricing.additionalOptionsPrice;
    const shouldPreparePayment = intent === "submit" && publishReady;
    const transferPaymentsSupported = shouldPreparePayment
      ? await areDatabaseColumnsAvailable("Payment", ["transferId"])
      : false;
    const legacyTransferPaymentTariffCode = getTransferPaymentTariffCode(id);
    const transferPaymentTariffCode = transferPaymentsSupported
      ? "transfer_standard"
      : legacyTransferPaymentTariffCode;
    const transferPaymentWhere = transferPaymentsSupported
      ? {
          ownerId: currentSession.id,
          provider: {
            in: getOnlinePaymentProviders(),
          },
          OR: [{ transferId: id }, { tariffCode: legacyTransferPaymentTariffCode }],
        }
      : {
          ownerId: currentSession.id,
          tariffCode: transferPaymentTariffCode,
          provider: {
            in: getOnlinePaymentProviders(),
          },
        };
    const payments = shouldPreparePayment
      ? await db.payment.findMany({
          where: transferPaymentWhere,
          orderBy: [{ createdAt: "desc" }],
        })
      : [];
    const trialUntil = isPostLaunchTrialEligible({
      listingCreatedAt: current.createdAt,
      now,
      category: "transfer",
      hasSuccessfulPlacement: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
    })
      ? getPostLaunchTrialValidUntil(current.createdAt)
      : null;
    const transferPlacementPricing = trialUntil
      ? applyPlacementFreePeriodToPricing(baseTransferPlacementPricing, { validUntil: trialUntil })
      : baseTransferPlacementPricing;
    const publicationPrice = getPlacementPromoPrice(transferPlacementPricing.totalPrice, now);
    const publicationFeeRub = transferPlacementPricing.freePeriodActive
      ? 0
      : publicationPrice.finalAmountRub;
    const transferPaymentCoverage = getTransferPlacementCoverageState({
      payments,
      publicationFeeRub,
      originalPublicationFeeRub,
    });
    const hasFullPaymentCoverage = transferPaymentCoverage.fullyCovered;
    const hasPendingPublishedEdit =
      current.pendingEditStatus !== null || hasPublishedTransferContentEdit;
    const shouldSubmitPublishedEdit =
      publishedEditSupported &&
      hasPendingPublishedEdit &&
      shouldPreparePayment &&
      hasFullPaymentCoverage;
    const nextPendingEditStatus = publishedEditSupported
      ? shouldSubmitPublishedEdit
        ? TransferStatus.PENDING_MODERATION
        : current.pendingEditStatus === TransferStatus.PENDING_MODERATION
          ? TransferStatus.PENDING_MODERATION
          : hasPublishedTransferContentEdit
            ? TransferStatus.DRAFT
            : current.pendingEditStatus
      : undefined;
    const shouldReturnToModeration =
      current.status === TransferStatus.PUBLISHED &&
      !publishedEditSupported &&
      shouldPreparePayment &&
      hasFullPaymentCoverage;
    const nextStatus = publishedEditSupported
      ? TransferStatus.PUBLISHED
      : shouldReturnToModeration
        ? TransferStatus.PENDING_MODERATION
        : current.status === TransferStatus.REJECTED
          ? TransferStatus.DRAFT
          : current.status;

    await db.transfer.update({
      where: { id },
      data: {
        title,
        slug: buildTransferSlug(title, id),
        transferType,
        vehicleClass: fleetSummary.vehicleClass,
        vehicleModel: fleetSummary.vehicleModel,
        seats: fleetSummary.seats,
        luggage: fleetSummary.luggage,
        locationId,
        locationName,
        districtId:
          locationIdInput === undefined
            ? current.districtId
            : (selectedLocation?.districtId ?? null),
        serviceArea: null,
        routeExamples,
        latitude,
        longitude,
        priceFrom: fleetSummary.priceFrom ? new Prisma.Decimal(fleetSummary.priceFrom) : null,
        priceUnitLabel: fleetSummary.priceUnitLabel,
        shortDescription: null,
        description,
        photoUrls: fleetSummary.photoUrls,
        serviceTags,
        fleet,
        contactName,
        phone,
        phoneName,
        phone2,
        phone2Name,
        phone3,
        phone3Name,
        websiteUrl,
        contactEmail,
        whatsappUrl,
        telegramUrl,
        vkUrl,
        maxUrl,
        okUrl,
        receiveRequests: false,
        status: nextStatus,
        ...(publishedEditSupported
          ? {
              pendingEditStatus: nextPendingEditStatus,
              moderationNotes:
                nextPendingEditStatus === TransferStatus.PENDING_MODERATION
                  ? null
                  : current.moderationNotes,
            }
          : { moderationNotes: shouldReturnToModeration ? null : undefined }),
      },
    });

    if (intent === "preview") {
      redirect(previewPath);
    }

    if (intent === "submit") {
      if (!publishReady) {
        redirect(`/dashboard/transfers/${id}?saved=1&payment=not-ready`);
      }

      if (hasFullPaymentCoverage) {
        if (publicationFeeRub <= 0 && !transferPaymentCoverage.hasActivePlacement) {
          const freeTransferPaymentPayload = buildTransferPaymentPayload({
            transferId: id,
            transferTitle: title,
            paymentReason: "publication",
            vehicleCount: fleet.length,
            totalAmountRub: publicationFeeRub,
            coveredAmountRub: transferPaymentCoverage.coveredAmount,
            requiredAmountRub: 0,
          });

          await db.payment.create({
            data: {
              ...(transferPaymentsSupported ? { transferId: id } : {}),
              ownerId: currentSession.id,
              amount: 0,
              tariffCode: transferPaymentTariffCode,
              roomCount: fleet.length,
              status: PaymentStatus.SUCCEEDED,
              provider: PaymentProvider.MANAGER,
              idempotenceKey: crypto.randomUUID(),
              paidFrom: now,
              paidAt: now,
              placementValidUntil: trialUntil ?? getPlacementPromoDemoValidUntil(current.createdAt),
              providerPayload: trialUntil
                ? buildPostLaunchTrialPaymentPayload({
                    originalAmountRub: originalPublicationFeeRub,
                    now,
                    validUntil: trialUntil,
                    context: freeTransferPaymentPayload,
                    placementPricing: transferPlacementPricing,
                  })
                : buildFreePlacementPaymentPayload({
                    originalAmountRub: originalPublicationFeeRub,
                    now,
                    validUntil: trialUntil ?? getPlacementPromoDemoValidUntil(current.createdAt),
                    context: freeTransferPaymentPayload,
                    placementPricing: transferPlacementPricing,
                  }),
            },
          });
        }

        if (publishedEditSupported) {
          redirect(`/dashboard/transfers/${id}?saved=1&payment=published-edit`);
        }

        if (transferPaymentsSupported) {
          await autoSubmitTransferAfterSuccessfulPayment(db, id);
        } else {
          await submitTransferToModerationIfReady(db, id);
        }
        redirect(`/dashboard/transfers/${id}?saved=1&payment=paid`);
      }

      const requiredPaymentAmount = transferPaymentCoverage.requiredPaymentAmount;
      const requiredOriginalPaymentAmount = transferPaymentCoverage.requiredOriginalPaymentAmount;
      const paymentReason = transferPaymentCoverage.hasActivePlacement
        ? "fleet_topup"
        : "publication";
      const placementPromo = buildPlacementPromoPayload({
        originalAmountRub: requiredOriginalPaymentAmount,
        discountedAmountRub: requiredPaymentAmount,
      });
      const transferPaymentPayload = buildTransferPaymentPayload({
        transferId: id,
        transferTitle: title,
        paymentReason,
        vehicleCount: fleet.length,
        totalAmountRub: publicationFeeRub,
        coveredAmountRub: transferPaymentCoverage.coveredAmount,
        requiredAmountRub: requiredPaymentAmount,
        placementPromo,
      });
      const placementPricingPayload = buildPlacementPricingPayload(transferPlacementPricing);
      const paymentPaidFrom = now;
      const paymentValidUntil =
        transferPaymentCoverage.hasActivePlacement && transferPaymentCoverage.paidUntil
          ? new Date(transferPaymentCoverage.paidUntil)
          : getPlacementValidUntil(now);
      const tariffLabel =
        paymentReason === "fleet_topup" ? "Доплата за автопарк" : "Годовое размещение";
      const receiptItemDescription = buildYooKassaReceiptItemDescription({
        serviceLabel: "Размещение трансфера на сайте Крым Вокруг",
        listingName: title,
        tariffLabel,
        paidFrom: paymentPaidFrom,
        paidUntil: paymentValidUntil,
      });

      const openPayment =
        payments.find(
          (item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING,
        ) ?? null;
      if (openPayment) {
        if (openPayment.provider === PaymentProvider.MANAGER) {
          const openAmount = Number(openPayment.amount);
          if (openAmount !== requiredPaymentAmount) {
            await db.payment.update({
              where: { id: openPayment.id },
              data: {
                amount: requiredPaymentAmount,
                roomCount: fleet.length,
                providerPayload: { ...transferPaymentPayload, ...placementPricingPayload },
                paidFrom: openPayment.paidFrom ?? paymentPaidFrom,
                placementValidUntil: paymentValidUntil,
              },
            });
          }
        }

        redirect(`/dashboard/transfers/${id}?saved=1&payment=pending`);
      }

      const idempotenceKey = crypto.randomUUID();

      const created = await db.payment.create({
        data: {
          ...(transferPaymentsSupported ? { transferId: id } : {}),
          ownerId: currentSession.id,
          amount: requiredPaymentAmount,
          tariffCode: transferPaymentTariffCode,
          roomCount: fleet.length,
          status: paymentProvider === "YOOKASSA" ? PaymentStatus.CREATED : PaymentStatus.PENDING,
          provider:
            paymentProvider === "YOOKASSA" ? PaymentProvider.YOOKASSA : PaymentProvider.MANAGER,
          idempotenceKey,
          confirmationUrl: null,
          providerPayload: { ...transferPaymentPayload, ...placementPricingPayload },
          paidFrom: paymentPaidFrom,
          placementValidUntil: paymentValidUntil,
        },
      });

      if (paymentProvider === "YOOKASSA") {
        if (!isYooKassaConfigured()) {
          await db.payment.update({
            where: { id: created.id },
            data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
          });
          redirect(`/dashboard/transfers/${id}?saved=1&payment=provider-disabled`);
        }

        let redirectUrl: string | null = null;

        try {
          const yooPayment = await createYooKassaPayment({
            amountRub: requiredPaymentAmount,
            idempotenceKey,
            description: receiptItemDescription,
            returnUrl: buildAbsoluteAppUrl(`/dashboard/transfers/${id}`),
            metadata: {
              local_payment_id: created.id,
              entity_type: "transfer",
              transfer_id: id,
              owner_id: currentSession.id,
              tariff_code: transferPaymentTariffCode,
              payment_reason: paymentReason,
              tariff_label: tariffLabel,
              vehicle_count: fleet.length,
              paid_from: paymentPaidFrom.toISOString(),
              paid_until: paymentValidUntil.toISOString(),
            },
            receipt: buildYooKassaPaymentReceipt({
              amountRub: requiredPaymentAmount,
              itemDescription: receiptItemDescription,
              customer: {
                email: contactEmail,
                phone: phone ?? currentSession.phone,
                fullName: contactName ?? `${currentSession.firstName} ${currentSession.lastName}`,
              },
            }),
          });
          const providerPayload = mergeYooKassaPaymentPayload(created.providerPayload, yooPayment);

          await applyProviderPaymentStatus(
            db,
            created.id,
            mapYooKassaPaymentStatus(yooPayment.status),
            {
              providerPaymentId: yooPayment.id,
              confirmationUrl: yooPayment.confirmation?.confirmation_url ?? null,
              providerPayload,
            },
          );
          redirectUrl = yooPayment.confirmation?.confirmation_url ?? null;
        } catch (error) {
          await db.payment.update({
            where: { id: created.id },
            data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
          });

          const isConfigurationError = error instanceof YooKassaConfigurationError;
          const isApiError = error instanceof YooKassaApiError;
          redirect(
            `/dashboard/transfers/${id}?saved=1&payment=${
              isConfigurationError || isApiError ? "provider-disabled" : "online-payment-error"
            }`,
          );
        }

        if (redirectUrl) {
          redirect(redirectUrl);
        }

        redirect(`/dashboard/transfers/${id}?saved=1&payment=online-created`);
      }

      redirect(`/dashboard/transfers/${id}?saved=1&payment=manager`);
    }

    redirect(`/dashboard/transfers/${id}?saved=1`);
  }

  const fleet = getTransferFleet(transfer);
  const serviceTags = normalizeTransferServiceTags(transfer.serviceTags);
  const workflowStatus = getTransferWorkflowStatus(
    transfer.status,
    transfer.pendingEditStatus ?? null,
  );
  const effectivePublicTransfer = applyPublishedTransferSnapshotToRow(transfer);
  const publicPath =
    transfer.status === TransferStatus.PUBLISHED
      ? buildPublicTransferPath({ id: transfer.id, title: effectivePublicTransfer.title })
      : null;
  const saved = getFirstSearchParam(resolvedSearchParams.saved) === "1";
  const paymentNotice = getFirstSearchParam(resolvedSearchParams.payment);
  const initialStep = parseTransferEditorStep(getFirstSearchParam(resolvedSearchParams.step));
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);
  const transferPaymentTariffCode = getTransferPaymentTariffCode(id);
  const transferPaymentWhere = transferPaymentsSupported
    ? {
        ownerId: session.id,
        provider: {
          in: getOnlinePaymentProviders(),
        },
        OR: [{ transferId: id }, { tariffCode: transferPaymentTariffCode }],
      }
    : {
        ownerId: session.id,
        tariffCode: transferPaymentTariffCode,
        provider: {
          in: getOnlinePaymentProviders(),
        },
      };
  const payments = await db.payment.findMany({
    where: transferPaymentWhere,
    orderBy: [{ createdAt: "desc" }],
    include: transferPaymentsSupported
      ? {
          transfer: {
            select: {
              title: true,
            },
          },
        }
      : undefined,
  });
  const initialPricingNow = new Date();
  const baseInitialTransferPlacementPricing = await getPlacementPrice({
    userId: session.id,
    category: "transfer",
    period: "year",
    additionalOptions: { additionalCars: Math.max(0, fleet.length - 1) },
    now: initialPricingNow,
  });
  const initialTrialUntil = isPostLaunchTrialEligible({
    listingCreatedAt: transfer.createdAt,
    now: initialPricingNow,
    category: "transfer",
    hasSuccessfulPlacement: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
  })
    ? getPostLaunchTrialValidUntil(transfer.createdAt)
    : null;
  const initialTransferPlacementPricing = initialTrialUntil
    ? applyPlacementFreePeriodToPricing(baseInitialTransferPlacementPricing, {
        validUntil: initialTrialUntil,
      })
    : baseInitialTransferPlacementPricing;
  const transferPublicationPrice = getPlacementPromoPrice(
    initialTransferPlacementPricing.totalPrice,
    initialPricingNow,
  );

  return (
    <TransferEditorPage
      action={saveTransfer}
      transfer={{
        id: transfer.id,
        status: transfer.status,
        pendingEditStatus: transfer.pendingEditStatus ?? null,
        workflowStatus,
        statusLabel: getTransferStatusLabel(transfer.status, transfer.pendingEditStatus ?? null),
        title: transfer.title ?? "",
        transferType: transfer.transferType ?? "",
        description: transfer.description ?? "",
        locationId: transfer.locationId ?? "",
        locationName: transfer.locationName ?? transfer.location?.name ?? "",
        routeExamples: transfer.routeExamples ?? "",
        latitude: transfer.latitude ? Number(transfer.latitude).toString() : "",
        longitude: transfer.longitude ? Number(transfer.longitude).toString() : "",
        contactName: transfer.contactName ?? session.firstName.trim(),
        phone: transfer.phone ?? session.phone,
        phoneName: transfer.phoneName ?? "",
        phone2: transfer.phone2 ?? "",
        phone2Name: transfer.phone2Name ?? "",
        phone3: transfer.phone3 ?? "",
        phone3Name: transfer.phone3Name ?? "",
        websiteUrl: transfer.websiteUrl ?? "",
        contactEmail: transfer.contactEmail ?? "",
        whatsappUrl: transfer.whatsappUrl ?? "",
        telegramUrl: transfer.telegramUrl ?? "",
        vkUrl: transfer.vkUrl ?? "",
        maxUrl: transfer.maxUrl ?? "",
        okUrl: transfer.okUrl ?? "",
        moderationNotes: transfer.moderationNotes ?? "",
        reviewsCount: transfer.reviewsCount,
        avgRating: transfer.avgRating ? Number(transfer.avgRating) : null,
      }}
      locations={locations}
      initialFleet={fleet}
      initialServiceTags={serviceTags}
      publicPath={publicPath}
      publicationFeeRub={
        initialTransferPlacementPricing.freePeriodActive
          ? 0
          : transferPublicationPrice.finalAmountRub
      }
      originalPublicationFeeRub={initialTransferPlacementPricing.basePrice}
      extraVehicleFeeRub={TRANSFER_EXTRA_VEHICLE_FEE_RUB}
      initialPayments={payments.map(serializePayment)}
      onlinePaymentAvailable={isYooKassaConfigured()}
      saved={saved}
      paymentNotice={paymentNotice}
      initialStep={initialStep}
      externalReviewsHref={`/dashboard/transfers/${transfer.id}/external-reviews`}
    />
  );
}
