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
  buildTransferPaymentPayload,
  getTransferPaymentTariffCode,
  serializePayment,
} from "@/lib/payments";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";
import { TRANSFER_PUBLICATION_FEE_RUB } from "@/lib/site-tariffs";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  autoSubmitTransferAfterSuccessfulPayment,
  deriveTransferSummaryFromFleet,
  getTransferFleet,
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

const STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formCoordinate(formData: FormData, key: string): Prisma.Decimal | null {
  const value = formString(formData, key)?.replace(",", ".");
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
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
      select: { ownerId: true, status: true },
    });

    if (!current || current.ownerId !== currentSession.id) {
      notFound();
    }

    const locationId = formString(formData, "locationId");
    const selectedLocation = locationId
      ? await db.excursionLocation.findUnique({
          where: { id: locationId },
          select: { name: true, districtId: true },
        })
      : null;
    const title = formString(formData, "title") ?? "Новый трансфер";
    const fleet = normalizeTransferFleet(parseJsonField(formData, "fleetJson"));
    const serviceTags = normalizeTransferServiceTags(parseJsonField(formData, "serviceTagsJson"));
    const fleetSummary = deriveTransferSummaryFromFleet({
      fleet,
      photoUrls: [],
      priceUnitLabel: null,
    });
    const intent = formString(formData, "intent");
    const paymentProvider = parseTransferPaymentProvider(formString(formData, "paymentProvider"));
    const previewPath = `${buildPublicTransferPath({ id, title })}?preview=1`;
    const transferType = formString(formData, "transferType");
    const locationName = selectedLocation?.name ?? formString(formData, "locationName");
    const description = formString(formData, "description");
    const routeExamples = formString(formData, "routeExamples");
    const contactName = formString(formData, "contactName");
    const phone = formString(formData, "phone");
    const phone2 = formString(formData, "phone2");
    const websiteUrl = formString(formData, "websiteUrl");
    const whatsappUrl = normalizeWhatsappUrl(formString(formData, "whatsappUrl")) ?? null;
    const telegramUrl = normalizeTelegramProfileUrl(formString(formData, "telegramUrl")) ?? null;
    const vkUrl = normalizeVkProfileUrl(formString(formData, "vkUrl")) ?? null;
    const maxUrl = normalizeMaxProfileUrl(formString(formData, "maxUrl")) ?? null;
    const okUrl = normalizeOkProfileUrl(formString(formData, "okUrl")) ?? null;
    const latitude = formCoordinate(formData, "latitude");
    const longitude = formCoordinate(formData, "longitude");
    const shouldReturnToModeration = current.status === TransferStatus.PUBLISHED;
    const nextStatus = shouldReturnToModeration
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
        districtId: selectedLocation?.districtId ?? null,
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
        moderationNotes: shouldReturnToModeration ? null : undefined,
      },
    });

    if (intent === "preview") {
      redirect(previewPath);
    }

    if (intent === "submit") {
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

      if (!publishReady) {
        redirect(`/dashboard/transfers/${id}?saved=1&payment=not-ready`);
      }

      try {
        ensurePaymentProviderAllowed(paymentProvider);
      } catch {
        redirect(`/dashboard/transfers/${id}?saved=1&payment=provider-disabled`);
      }

      const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", [
        "transferId",
      ]);

      const transferPaymentPayload = buildTransferPaymentPayload({
        transferId: id,
        transferTitle: title,
      });
      const transferPaymentTariffCode = transferPaymentsSupported
        ? "transfer_standard"
        : getTransferPaymentTariffCode(id);
      const transferPaymentWhere = transferPaymentsSupported
        ? {
            transferId: id,
            ownerId: currentSession.id,
            provider: {
              in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
            },
          }
        : {
            ownerId: currentSession.id,
            tariffCode: transferPaymentTariffCode,
            provider: {
              in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
            },
          };

      const payments = await db.payment.findMany({
        where: transferPaymentWhere,
        orderBy: [{ createdAt: "desc" }],
      });
      const succeededPayment =
        payments.find((item) => item.status === PaymentStatus.SUCCEEDED) ?? null;
      if (succeededPayment) {
        if (transferPaymentsSupported) {
          await autoSubmitTransferAfterSuccessfulPayment(db, id);
        } else {
          await submitTransferToModerationIfReady(db, id);
        }
        redirect(`/dashboard/transfers/${id}?saved=1&payment=paid`);
      }

      const openPayment =
        payments.find(
          (item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING,
        ) ?? null;
      if (openPayment) {
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
            amount: TRANSFER_PUBLICATION_FEE_RUB,
            tariffCode: transferPaymentTariffCode,
            roomCount: 0,
            status: PaymentStatus.PENDING,
            provider: PaymentProvider.MANAGER,
            idempotenceKey,
            providerPayload: transferPaymentPayload,
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
          amount: TRANSFER_PUBLICATION_FEE_RUB,
          tariffCode: transferPaymentTariffCode,
          roomCount: 0,
          status: PaymentStatus.CREATED,
          provider: PaymentProvider.YOOKASSA,
          idempotenceKey,
          providerPayload: transferPaymentPayload,
        },
      });

      let paymentRedirectUrl: string | null = null;

      try {
        const yooPayment = await createYookassaPayment({
          idempotenceKey,
          amountRub: TRANSFER_PUBLICATION_FEE_RUB,
          description: `Публикация трансфера «${title}»`,
          metadata: {
            paymentId: created.id,
            transferId: id,
          },
        });

        const updated = await db.payment.update({
          where: { id: created.id },
          data: {
            providerPaymentId: yooPayment.id,
            confirmationUrl: yooPayment.confirmation?.confirmation_url ?? null,
            providerPayload: yooPayment,
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
  const publicPath =
    transfer.status === TransferStatus.PUBLISHED
      ? buildPublicTransferPath({ id: transfer.id, title: transfer.title })
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

  return (
    <TransferEditorPage
      action={saveTransfer}
      transfer={{
        id: transfer.id,
        status: transfer.status,
        statusLabel: STATUS_LABELS[transfer.status],
        title: transfer.title ?? "",
        transferType: transfer.transferType ?? "",
        description: transfer.description ?? "",
        locationId: transfer.locationId ?? "",
        locationName: transfer.locationName ?? transfer.location?.name ?? "",
        routeExamples: transfer.routeExamples ?? "",
        latitude: transfer.latitude ? Number(transfer.latitude).toString() : "",
        longitude: transfer.longitude ? Number(transfer.longitude).toString() : "",
        contactName: transfer.contactName ?? `${session.firstName} ${session.lastName}`.trim(),
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
      publicationFeeRub={TRANSFER_PUBLICATION_FEE_RUB}
      initialPayments={payments.map(serializePayment)}
      saved={saved}
      paymentNotice={paymentNotice}
      initialStep={initialStep}
    />
  );
}
