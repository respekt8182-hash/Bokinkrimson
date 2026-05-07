import { PaymentProvider, PaymentStatus, Prisma, TransferStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { TransferEditorPage } from "@/components/transfers/transfer-editor-page";
import { getSession } from "@/lib/auth";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { ensurePaymentProviderAllowed } from "@/lib/payment-security";
import {
  buildFreePlacementPaymentPayload,
  buildTransferPaymentPayload,
  getTransferPaymentTariffCode,
  getTransferPlacementCoverageState,
  serializePayment,
} from "@/lib/payments";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";
import {
  TRANSFER_EXTRA_VEHICLE_FEE_RUB,
} from "@/lib/site-tariffs";
import {
  buildPlacementPromoMetadata,
  buildPlacementPromoPayload,
  getPlacementPromoDemoValidUntil,
  getPlacementPromoPrice,
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
import { createYookassaPayment, isYookassaConfigured } from "@/lib/yookassa";

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

function parseTransferPaymentProvider(value: string | null): PaymentProvider {
  return value === "YOOKASSA" ? PaymentProvider.YOOKASSA : PaymentProvider.MANAGER;
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
        phone2: true,
        websiteUrl: true,
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
    const paymentProvider = parseTransferPaymentProvider(formString(formData, "paymentProvider"));
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
    const phone2 = resolveString("phone2", current.phone2);
    const websiteUrl = resolveString("websiteUrl", current.websiteUrl);
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

    if (publishedEditSupported) {
      await ensurePublishedTransferSnapshotBeforeOwnerEdit(db, id);
    }

    const transferPlacementPricing = await getPlacementPrice({
      userId: currentSession.id,
      category: "transfer",
      period: "year",
      additionalOptions: { additionalCars: Math.max(0, fleet.length - 1) },
    });
    const publicationFeeRub = getPlacementPromoPrice(transferPlacementPricing.totalPrice)
      .finalAmountRub;
    const originalPublicationFeeRub =
      transferPlacementPricing.basePrice + transferPlacementPricing.additionalOptionsPrice;
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
            in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
          },
          OR: [{ transferId: id }, { tariffCode: legacyTransferPaymentTariffCode }],
        }
      : {
          ownerId: currentSession.id,
          tariffCode: transferPaymentTariffCode,
          provider: {
            in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
          },
        };
    const payments = shouldPreparePayment
      ? await db.payment.findMany({
          where: transferPaymentWhere,
          orderBy: [{ createdAt: "desc" }],
        })
      : [];
    const transferPaymentCoverage = getTransferPlacementCoverageState({
      payments,
      publicationFeeRub,
      originalPublicationFeeRub,
    });
    const hasFullPaymentCoverage = transferPaymentCoverage.fullyCovered;
    const shouldSubmitPublishedEdit =
      publishedEditSupported && shouldPreparePayment && hasFullPaymentCoverage;
    const nextPendingEditStatus = publishedEditSupported
      ? shouldSubmitPublishedEdit
        ? TransferStatus.PENDING_MODERATION
        : current.pendingEditStatus === TransferStatus.PENDING_MODERATION
          ? TransferStatus.PENDING_MODERATION
          : TransferStatus.DRAFT
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
        phone2,
        websiteUrl,
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
          const now = new Date();
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
              paidAt: now,
              placementValidUntil: getPlacementPromoDemoValidUntil(),
              providerPayload: buildFreePlacementPaymentPayload({
                originalAmountRub: originalPublicationFeeRub,
                now,
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

      try {
        ensurePaymentProviderAllowed(paymentProvider);
      } catch {
        redirect(`/dashboard/transfers/${id}?saved=1&payment=provider-disabled`);
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
      const promoMetadata = buildPlacementPromoMetadata({
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
                placementValidUntil: transferPaymentCoverage.paidUntil
                  ? new Date(transferPaymentCoverage.paidUntil)
                  : null,
              },
            });
          }
        }

        if (openPayment.provider === PaymentProvider.YOOKASSA && openPayment.confirmationUrl) {
          redirect(openPayment.confirmationUrl);
        }

        redirect(`/dashboard/transfers/${id}?saved=1&payment=pending`);
      }

      const idempotenceKey = crypto.randomUUID();

      if (paymentProvider === PaymentProvider.MANAGER) {
        await db.payment.create({
          data: {
            ...(transferPaymentsSupported ? { transferId: id } : {}),
            ownerId: currentSession.id,
            amount: requiredPaymentAmount,
            tariffCode: transferPaymentTariffCode,
            roomCount: fleet.length,
            status: PaymentStatus.PENDING,
            provider: PaymentProvider.MANAGER,
            idempotenceKey,
            providerPayload: { ...transferPaymentPayload, ...placementPricingPayload },
            placementValidUntil: transferPaymentCoverage.paidUntil
              ? new Date(transferPaymentCoverage.paidUntil)
              : null,
          },
        });

        redirect(`/dashboard/transfers/${id}?saved=1&payment=manager`);
      }

      if (!transferPaymentsSupported) {
        redirect(`/dashboard/transfers/${id}?saved=1&payment=yookassa-unavailable`);
      }

      if (!isYookassaConfigured()) {
        redirect(`/dashboard/transfers/${id}?saved=1&payment=yookassa-unavailable`);
      }

      const created = await db.payment.create({
        data: {
          ...(transferPaymentsSupported ? { transferId: id } : {}),
          ownerId: currentSession.id,
          amount: requiredPaymentAmount,
          tariffCode: transferPaymentTariffCode,
          roomCount: fleet.length,
          status: PaymentStatus.CREATED,
          provider: PaymentProvider.YOOKASSA,
          idempotenceKey,
          providerPayload: { ...transferPaymentPayload, ...placementPricingPayload },
          placementValidUntil: transferPaymentCoverage.paidUntil
            ? new Date(transferPaymentCoverage.paidUntil)
            : null,
        },
      });

      let paymentRedirectUrl: string | null = null;

      try {
        const yooPayment = await createYookassaPayment({
          idempotenceKey,
          amountRub: requiredPaymentAmount,
          description:
            paymentReason === "fleet_topup"
              ? `Доплата за автопарк трансфера «${title}»`
              : `Публикация трансфера «${title}»`,
          metadata: {
            paymentId: created.id,
            transferId: id,
            ...promoMetadata,
          },
        });
        const providerPayload = {
          ...yooPayment,
          metadata: { ...(yooPayment.metadata ?? {}), ...promoMetadata },
          ...placementPricingPayload,
        };

        const updated = await db.payment.update({
          where: { id: created.id },
          data: {
            providerPaymentId: yooPayment.id,
            confirmationUrl: yooPayment.confirmation?.confirmation_url ?? null,
            providerPayload,
            status: PaymentStatus.PENDING,
          },
        });

        paymentRedirectUrl = updated.confirmationUrl;
      } catch (error) {
        await db.payment.update({
          where: { id: created.id },
          data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
        });

        console.error("YooKassa transfer payment creation failed", error);
        redirect(`/dashboard/transfers/${id}?saved=1&payment=yookassa-error`);
      }

      if (paymentRedirectUrl) {
        redirect(paymentRedirectUrl);
      }

      redirect(`/dashboard/transfers/${id}?saved=1&payment=pending`);
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
          in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
        },
        OR: [{ transferId: id }, { tariffCode: transferPaymentTariffCode }],
      }
    : {
        ownerId: session.id,
        tariffCode: transferPaymentTariffCode,
        provider: {
          in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
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
  const initialTransferPlacementPricing = await getPlacementPrice({
    userId: session.id,
    category: "transfer",
    period: "year",
    additionalOptions: { additionalCars: Math.max(0, fleet.length - 1) },
  });
  const transferPublicationPrice = getPlacementPromoPrice(initialTransferPlacementPricing.finalPrice);

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
        phone2: transfer.phone2 ?? "",
        websiteUrl: transfer.websiteUrl ?? "",
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
      publicationFeeRub={transferPublicationPrice.finalAmountRub}
      originalPublicationFeeRub={initialTransferPlacementPricing.basePrice}
      extraVehicleFeeRub={TRANSFER_EXTRA_VEHICLE_FEE_RUB}
      initialPayments={payments.map(serializePayment)}
      saved={saved}
      paymentNotice={paymentNotice}
      initialStep={initialStep}
    />
  );
}
