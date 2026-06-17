import { PaymentStatus, Prisma, ReviewEntityType, TransferStatus } from "@prisma/client";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";
import { AdminListingPaymentConfirmation } from "@/components/admin/admin-listing-payment-confirmation";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminTransferModerationPreview } from "@/components/admin/admin-moderation-preview";
import { ReviewModerationList } from "@/components/admin/review-moderation-list";
import { PlacementPromoNotice } from "@/components/pricing/placement-promo";
import { ListingStatsButton } from "@/components/statistics/listing-stats-button";
import { TransferEditorPage } from "@/components/transfers/transfer-editor-page";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { hasAdminPermission } from "@/lib/admin-rbac";
import {
  normalizeEmailAddress,
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { db } from "@/lib/db";
import { getTransferPaymentTariffCode, serializePayment } from "@/lib/payments";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";
import { serializeReview } from "@/lib/reviews";
import {
  applyPublishedTransferSnapshotToRow,
  refreshPublishedTransferSnapshot,
} from "@/lib/transfer-public-snapshot";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  deriveTransferSummaryFromFleet,
  getTransferFleet,
  getTransferStatusLabel,
  getTransferWorkflowStatus,
  isTransferReadyForModeration,
  normalizeTransferFleet,
  normalizeTransferServiceTags,
} from "@/lib/transfers";

type AdminTransferEditPageProps = {
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

function getFirstSearchParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
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

export default async function AdminTransferEditPage({
  params,
  searchParams,
}: AdminTransferEditPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const transferReviewsSupported = await hasTransferReviewSupport();
  const [transfer, locations, reviews, payments] = await Promise.all([
    db.transfer.findUnique({
      where: { id },
      include: {
        owner: { select: { firstName: true, lastName: true, phone: true, avatarUrl: true } },
        location: { select: { id: true, name: true } },
      },
    }),
    db.excursionLocation.findMany({
      orderBy: [{ isMajor: "desc" }, { name: "asc" }],
      select: { id: true, name: true, districtId: true },
    }),
    transferReviewsSupported
      ? db.review.findMany({
          where: {
            entityType: ReviewEntityType.TRANSFER,
            transferId: id,
          },
          orderBy: [{ createdAt: "desc" }],
          include: {
            user: {
              select: { firstName: true, avatarUrl: true },
            },
          },
          take: 50,
        })
      : Promise.resolve([]),
    db.payment.findMany({
      where: {
        OR: [{ transferId: id }, { tariffCode: getTransferPaymentTariffCode(id) }],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
    }),
  ]);

  if (!transfer) {
    notFound();
  }

  async function saveTransfer(formData: FormData) {
    "use server";

    const admin = await verifyAdminSession();
    if (!admin) {
      redirect("/admin/login");
    }
    if (!hasAdminPermission(admin.role, "content:manage")) {
      redirect("/admin");
    }

    const current = await db.transfer.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        pendingEditStatus: true,
        publishedAt: true,
        isPublishedVisible: true,
      },
    });

    if (!current) {
      notFound();
    }

    const locationId = formString(formData, "locationId");
    const selectedLocation = locationId
      ? await db.excursionLocation.findUnique({
          where: { id: locationId },
          select: { name: true, districtId: true },
        })
      : null;
    const title = formString(formData, "title") ?? "Трансфер";
    const fleet = normalizeTransferFleet(parseJsonField(formData, "fleetJson"));
    const serviceTags = normalizeTransferServiceTags(parseJsonField(formData, "serviceTagsJson"));
    const fleetSummary = deriveTransferSummaryFromFleet({
      fleet,
      photoUrls: [],
      priceUnitLabel: null,
    });
    const transferType = formString(formData, "transferType");
    const locationName = selectedLocation?.name ?? formString(formData, "locationName");
    const description = formString(formData, "description");
    const contactName = formString(formData, "contactName");
    const phone = formString(formData, "phone");
    const intent = formString(formData, "intent");
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
    const shouldPublish = intent === "submit" && publishReady;
    const status = shouldPublish
      ? TransferStatus.PUBLISHED
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
        routeExamples: formString(formData, "routeExamples"),
        latitude: formCoordinate(formData, "latitude"),
        longitude: formCoordinate(formData, "longitude"),
        priceFrom: fleetSummary.priceFrom ? new Prisma.Decimal(fleetSummary.priceFrom) : null,
        priceUnitLabel: fleetSummary.priceUnitLabel,
        shortDescription: null,
        description,
        photoUrls: fleetSummary.photoUrls,
        serviceTags,
        fleet,
        contactName,
        phone,
        phoneName: formString(formData, "phoneName"),
        phone2: formString(formData, "phone2"),
        phone2Name: formString(formData, "phone2Name"),
        phone3: formString(formData, "phone3"),
        phone3Name: formString(formData, "phone3Name"),
        websiteUrl: formString(formData, "websiteUrl"),
        contactEmail: normalizeEmailAddress(formString(formData, "contactEmail")),
        whatsappUrl: normalizeWhatsappUrl(formString(formData, "whatsappUrl")) ?? null,
        telegramUrl: normalizeTelegramProfileUrl(formString(formData, "telegramUrl")) ?? null,
        vkUrl: normalizeVkProfileUrl(formString(formData, "vkUrl")) ?? null,
        maxUrl: normalizeMaxProfileUrl(formString(formData, "maxUrl")) ?? null,
        okUrl: normalizeOkProfileUrl(formString(formData, "okUrl")) ?? null,
        receiveRequests: false,
        status,
        pendingEditStatus: shouldPublish ? null : current.pendingEditStatus,
        moderationNotes: shouldPublish ? null : undefined,
        publishedAt:
          status === TransferStatus.PUBLISHED ? (current.publishedAt ?? new Date()) : null,
        isPublishedVisible: current.isPublishedVisible,
      },
    });

    if (shouldPublish) {
      await refreshPublishedTransferSnapshot(db, id);
    }

    if (intent === "preview") {
      redirect(`${buildPublicTransferPath({ id, title })}?preview=1`);
    }

    redirect(`/admin/transfers/${id}?saved=1`);
  }

  const fleet = getTransferFleet(transfer);
  const serviceTags = normalizeTransferServiceTags(transfer.serviceTags);
  const workflowStatus = getTransferWorkflowStatus(
    transfer.status,
    transfer.pendingEditStatus ?? null,
  );
  const publicTransfer = applyPublishedTransferSnapshotToRow(transfer);
  const publicPath =
    transfer.status === TransferStatus.PUBLISHED && transfer.isPublishedVisible
      ? buildPublicTransferPath({ id: transfer.id, title: publicTransfer.title })
      : null;
  const saved = getFirstSearchParam(resolvedSearchParams.saved) === "1";
  const initialStep = parseTransferEditorStep(getFirstSearchParam(resolvedSearchParams.step));
  const contactName = transfer.contactName ?? transfer.owner.firstName;
  const hasReviews = transfer.reviewsCount > 0 && Number(transfer.avgRating) > 0;
  const succeededPayment =
    payments.find((payment) => payment.status === PaymentStatus.SUCCEEDED) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/55">
            Трансферы
          </p>
          <h1 className="mt-2 text-3xl text-olive">{transfer.title || "Трансфер без названия"}</h1>
          <p className="mt-1 text-sm text-olive/64">
            Статус: {getTransferStatusLabel(transfer.status, transfer.pendingEditStatus ?? null)}.
            Владелец: {transfer.owner.firstName}
            {transfer.owner.phone ? `, ${transfer.owner.phone}` : ""}.
          </p>
          <p className="mt-1 text-xs text-olive/50">
            ID трансфера: {transfer.publicId ?? "—"} · Технический ID: {transfer.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ListingStatsButton
            endpoint={`/api/admin/statistics/listing?entityType=transfer&id=${transfer.id}`}
            entityName={transfer.title || "Трансфер без названия"}
            storageKey={`admin:transfer:${transfer.id}`}
            buttonLabel="Аналитика"
          />
          <Link
            href="/admin/transfers"
            className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
          >
            К трансферам
          </Link>
          <Link
            href={`/admin/transfers/${transfer.id}/external-reviews`}
            className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
          >
            Отзывы с других сайтов
          </Link>
          {transfer.status === TransferStatus.DRAFT ? (
            <AdminDeleteDraftButton
              endpoint={`/api/admin/transfers/${transfer.id}`}
              draftLabel="Черновик трансфера"
              entityName={transfer.title ?? "Трансфер без названия"}
              redirectTo="/admin/transfers"
              buttonClassName="border border-red-200 bg-red-50 px-4 py-3 text-red-700 hover:bg-red-100 hover:text-red-800"
            />
          ) : null}
          {transfer.status === TransferStatus.PUBLISHED ? (
            <AdminListingVisibilityToggle
              endpoint={`/api/admin/transfers/${transfer.id}`}
              entityLabel="трансфер"
              isVisible={transfer.isPublishedVisible}
            />
          ) : null}
          {publicPath ? (
            <Link
              href={publicPath}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary/8 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/12"
            >
              <ArrowUpRight className="h-4 w-4" />
              Открыть на сайте
            </Link>
          ) : null}
        </div>
      </div>

      <PlacementPromoNotice compact />

      {workflowStatus === TransferStatus.PENDING_MODERATION ? (
        <AdminTransferModerationPreview transfer={transfer} />
      ) : null}

      <AdminListingPaymentConfirmation
        entityType="transfer"
        entityId={transfer.id}
        entityLabel="Трансфер"
        tariffOptions={[
          { value: "season", label: "Сезон" },
          { value: "year", label: "Год" },
        ]}
      />

      {transferReviewsSupported ? (
        <ReviewModerationList
          title="Отзывы трансфера"
          initialReviews={reviews.map(serializeReview)}
          initialAvgRating={Number(transfer.avgRating)}
          initialReviewsCount={transfer.reviewsCount}
        />
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-olive/10 bg-white p-4 text-sm text-olive/65 md:grid-cols-4">
        <div>
          <p className="text-olive/45">Владелец</p>
          <p className="font-semibold text-olive">{transfer.owner.firstName}</p>
        </div>
        <div>
          <p className="text-olive/45">Контакт</p>
          <p className="font-semibold text-olive">{contactName}</p>
        </div>
        <div>
          <p className="text-olive/45">Рейтинг</p>
          <p className="font-semibold text-olive">
            {hasReviews ? Number(transfer.avgRating).toFixed(1) : "Пока без рейтинга"}
          </p>
        </div>
        <div>
          <p className="text-olive/45">Оплата</p>
          <p className="font-semibold text-olive">
            {succeededPayment ? "Есть подтверждённая" : "Нет активной оплаты"}
          </p>
        </div>
      </div>

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
          contactName,
          phone: transfer.phone ?? transfer.owner.phone,
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
        publicationFeeRub={0}
        originalPublicationFeeRub={0}
        extraVehicleFeeRub={0}
        initialPayments={payments.map(serializePayment)}
        onlinePaymentAvailable={false}
        saved={saved}
        initialStep={initialStep}
        externalReviewsHref={`/admin/transfers/${transfer.id}/external-reviews`}
        hideHelpAside
      />
    </div>
  );
}
