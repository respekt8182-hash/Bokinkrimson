import { PaymentStatus, Prisma, ReviewEntityType, TransferStatus } from "@prisma/client";
import { ArrowUpRight, Car, Eye, FileText, MapPin, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { ReviewModerationList } from "@/components/admin/review-moderation-list";
import { PlacementPromoNotice, PlacementPromoPrice } from "@/components/pricing/placement-promo";
import { ListingStatsButton } from "@/components/statistics/listing-stats-button";
import { TransferFleetBuilder } from "@/components/transfers/transfer-fleet-builder";
import { AppIcon } from "@/components/ui/app-icon";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { db } from "@/lib/db";
import {
  getPaymentStatusLabel,
  getProviderLabel,
  getTransferPaymentBaseTariffCode,
  getTransferPaymentTariffCode,
  resolvePaymentPlacementValidUntil,
} from "@/lib/payments";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";
import { serializeReview } from "@/lib/reviews";
import {
  calculateTransferPublicationFeeRub,
  calculateTransferPublicationOriginalFeeRub,
} from "@/lib/site-tariffs";
import {
  applyPublishedTransferSnapshotToRow,
  refreshPublishedTransferSnapshot,
} from "@/lib/transfer-public-snapshot";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";
import {
  deriveTransferSummaryFromFleet,
  getTransferFleet,
  getTransferStatusLabel,
  getTransferWorkflowStatus,
  normalizeTransferFleet,
  normalizeTransferServiceTags,
  transferTypeOptions,
} from "@/lib/transfers";

type AdminTransferEditPageProps = {
  params: Promise<{ id: string }>;
};

const inputClass =
  "w-full rounded-2xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

const textareaClass = `${inputClass} min-h-[120px] resize-y`;

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

function parseStatus(value: string | null): TransferStatus {
  if (
    value === TransferStatus.PENDING_MODERATION ||
    value === TransferStatus.PUBLISHED ||
    value === TransferStatus.REJECTED
  ) {
    return value;
  }

  return TransferStatus.DRAFT;
}

function formatRub(value: number | Prisma.Decimal): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(value))} ₽`;
}

function formatPaymentTariff(tariffCode: string): string {
  const baseCode = getTransferPaymentBaseTariffCode(tariffCode);
  return baseCode === "transfer_standard" ? "Публикация карточки трансфера" : baseCode;
}

export default async function AdminTransferEditPage({ params }: AdminTransferEditPageProps) {
  const { id } = await params;
  const transferReviewsSupported = await hasTransferReviewSupport();
  const [transfer, locations, reviews, payments] = await Promise.all([
    db.transfer.findUnique({
      where: { id },
      include: {
        owner: { select: { firstName: true, phone: true, avatarUrl: true } },
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
      select: {
        id: true,
        amount: true,
        tariffCode: true,
        status: true,
        provider: true,
        createdAt: true,
        paidAt: true,
        canceledAt: true,
        placementValidUntil: true,
        providerPayload: true,
        managerNotes: true,
      },
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

    const current = await db.transfer.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        pendingEditStatus: true,
        publishedAt: true,
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
    const intent = formString(formData, "intent");
    const selectedStatus = parseStatus(formString(formData, "status"));
    const targetStatus =
      intent === "publish"
        ? TransferStatus.PUBLISHED
        : intent === "reject"
          ? TransferStatus.REJECTED
          : selectedStatus;
    const isPublishedEdit =
      current.status === TransferStatus.PUBLISHED && current.pendingEditStatus !== null;
    const status = isPublishedEdit ? TransferStatus.PUBLISHED : targetStatus;
    const nextPendingEditStatus = isPublishedEdit
      ? intent === "publish"
        ? null
        : intent === "reject"
          ? TransferStatus.REJECTED
          : current.pendingEditStatus
      : null;

    await db.transfer.update({
      where: { id },
      data: {
        title,
        slug: buildTransferSlug(title, id),
        transferType: formString(formData, "transferType"),
        vehicleClass: fleetSummary.vehicleClass,
        vehicleModel: fleetSummary.vehicleModel,
        seats: fleetSummary.seats,
        luggage: fleetSummary.luggage,
        locationId,
        locationName: selectedLocation?.name ?? formString(formData, "locationName"),
        districtId: selectedLocation?.districtId ?? null,
        serviceArea: null,
        routeExamples: formString(formData, "routeExamples"),
        latitude: formCoordinate(formData, "latitude"),
        longitude: formCoordinate(formData, "longitude"),
        priceFrom: fleetSummary.priceFrom ? new Prisma.Decimal(fleetSummary.priceFrom) : null,
        priceUnitLabel: fleetSummary.priceUnitLabel,
        shortDescription: null,
        description: formString(formData, "description"),
        photoUrls: fleetSummary.photoUrls,
        serviceTags,
        fleet,
        contactName: formString(formData, "contactName"),
        phone: formString(formData, "phone"),
        phone2: formString(formData, "phone2"),
        websiteUrl: formString(formData, "websiteUrl"),
        whatsappUrl: formString(formData, "whatsappUrl"),
        telegramUrl: formString(formData, "telegramUrl"),
        vkUrl: formString(formData, "vkUrl"),
        maxUrl: formString(formData, "maxUrl"),
        okUrl: formString(formData, "okUrl"),
        receiveRequests: false,
        status,
        pendingEditStatus: nextPendingEditStatus,
        isPublishedVisible: formData.get("isPublishedVisible") === "on",
        moderationNotes: formString(formData, "moderationNotes"),
        publishedAt:
          status === TransferStatus.PUBLISHED ? (current.publishedAt ?? new Date()) : null,
      },
    });

    if (targetStatus === TransferStatus.PUBLISHED) {
      await refreshPublishedTransferSnapshot(db, id);
    }

    redirect(`/admin/transfers/${id}?saved=1`);
  }

  const fleet = getTransferFleet(transfer);
  const serviceTags = normalizeTransferServiceTags(transfer.serviceTags);
  const fleetSummary = deriveTransferSummaryFromFleet(transfer);
  const firstPhoto = fleetSummary.primaryVehicle?.photoUrl ?? fleetSummary.photoUrls[0] ?? null;
  const workflowStatus = getTransferWorkflowStatus(
    transfer.status,
    transfer.pendingEditStatus ?? null,
  );
  const publicTransfer = applyPublishedTransferSnapshotToRow(transfer);
  const publicPath =
    transfer.status === TransferStatus.PUBLISHED && transfer.isPublishedVisible
      ? buildPublicTransferPath({ id: transfer.id, title: publicTransfer.title })
      : null;
  const contactName = transfer.contactName ?? transfer.owner.firstName;
  const hasReviews = transfer.reviewsCount > 0 && Number(transfer.avgRating) > 0;
  const latestPayment = payments[0] ?? null;
  const succeededPayment =
    payments.find((payment) => payment.status === PaymentStatus.SUCCEEDED) ?? null;
  const paidUntil = succeededPayment ? resolvePaymentPlacementValidUntil(succeededPayment) : null;
  const currentPublicationFeeRub = calculateTransferPublicationFeeRub(fleet.length);
  const originalPublicationFeeRub = calculateTransferPublicationOriginalFeeRub(fleet.length);

  return (
    <div className="space-y-6">
      <datalist id="transfer-type-options">
        {transferTypeOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

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

      <form action={saveTransfer} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_16px_40px_rgba(58,43,35,0.05)]">
            <div className="flex items-center gap-2">
              <AppIcon icon={FileText} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">Карточка трансфера</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Название</span>
                <input
                  name="title"
                  defaultValue={transfer.title ?? ""}
                  placeholder="Название карточки"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Статус</span>
                <select name="status" defaultValue={workflowStatus} className={inputClass}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Тип услуги</span>
                <input
                  name="transferType"
                  list="transfer-type-options"
                  defaultValue={transfer.transferType ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Подробное описание</span>
                <textarea
                  name="description"
                  defaultValue={transfer.description ?? ""}
                  className="min-h-[180px] w-full rounded-2xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/30 focus:ring-4 focus:ring-primary/10"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_16px_40px_rgba(58,43,35,0.05)]">
            <div className="flex items-center gap-2">
              <AppIcon icon={MapPin} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">География и маршруты</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Город из справочника</span>
                <select
                  name="locationId"
                  defaultValue={transfer.locationId ?? ""}
                  className={inputClass}
                >
                  <option value="">Не выбран</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Город вручную</span>
                <input
                  name="locationName"
                  defaultValue={transfer.locationName ?? transfer.location?.name ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Маршруты</span>
                <textarea
                  name="routeExamples"
                  defaultValue={transfer.routeExamples ?? ""}
                  className={textareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Широта</span>
                <input
                  name="latitude"
                  defaultValue={transfer.latitude ? Number(transfer.latitude).toString() : ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Долгота</span>
                <input
                  name="longitude"
                  defaultValue={transfer.longitude ? Number(transfer.longitude).toString() : ""}
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_16px_40px_rgba(58,43,35,0.05)]">
            <div className="flex items-center gap-2">
              <AppIcon icon={Car} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">Автопарк</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-olive/62">
              Администратор видит тот же состав автопарка, что и владелец: можно поправить модели,
              цены, фото и порядок транспорта в итоговой карточке.
            </p>
            <div className="mt-4">
              <TransferFleetBuilder
                transferId={transfer.id}
                initialFleet={fleet}
                initialServiceTags={serviceTags}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_16px_40px_rgba(58,43,35,0.05)]">
            <div className="flex items-center gap-2">
              <AppIcon icon={ShieldCheck} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">Контакты и модерация</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Имя для связи</span>
                <input
                  name="contactName"
                  defaultValue={transfer.contactName ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Телефон</span>
                <input name="phone" defaultValue={transfer.phone ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Второй телефон</span>
                <input name="phone2" defaultValue={transfer.phone2 ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Сайт</span>
                <input
                  name="websiteUrl"
                  defaultValue={transfer.websiteUrl ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">WhatsApp</span>
                <input
                  name="whatsappUrl"
                  defaultValue={transfer.whatsappUrl ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Telegram</span>
                <input
                  name="telegramUrl"
                  defaultValue={transfer.telegramUrl ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">VK</span>
                <input name="vkUrl" defaultValue={transfer.vkUrl ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">MAX</span>
                <input name="maxUrl" defaultValue={transfer.maxUrl ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Одноклассники</span>
                <input name="okUrl" defaultValue={transfer.okUrl ?? ""} className={inputClass} />
              </label>
              <label className="flex items-start gap-3 rounded-[22px] bg-[#f7f4eb] px-4 py-3 text-sm text-olive/72 md:col-span-2">
                <input
                  type="checkbox"
                  name="isPublishedVisible"
                  defaultChecked={transfer.isPublishedVisible}
                  className="mt-1 h-4 w-4 rounded border-olive/25 text-primary focus:ring-primary/20"
                />
                <span>
                  Показывать карточку на сайте, если статус установлен как опубликованный.
                </span>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Комментарий модератора</span>
                <textarea
                  name="moderationNotes"
                  defaultValue={transfer.moderationNotes ?? ""}
                  className={textareaClass}
                />
              </label>
            </div>
          </section>

          {transferReviewsSupported ? (
            <ReviewModerationList
              title="Отзывы трансфера"
              initialReviews={reviews.map(serializeReview)}
              initialAvgRating={Number(transfer.avgRating)}
              initialReviewsCount={transfer.reviewsCount}
            />
          ) : (
            <section className="rounded-2xl border border-olive/10 bg-white p-4">
              <h2 className="text-xl text-olive">Отзывы трансфера</h2>
              <p className="mt-2 text-sm leading-6 text-olive/68">
                В этой локальной базе блок отзывов для трансферов будет включён после применения
                владельцем PostgreSQL полного обновления схемы `Review`.
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-olive/10 bg-white shadow-[0_18px_48px_rgba(58,43,35,0.06)]">
            <div className="aspect-[16/10] bg-cream">
              {firstPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firstPhoto}
                  alt={transfer.title ?? "Трансфер"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Car className="h-8 w-8 text-olive/35" />
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-base font-semibold text-olive">
                {transfer.title || "Трансфер без названия"}
              </p>
              <p className="mt-1 text-sm leading-6 text-olive/58">
                На витрине карточка покажет основное фото, тип услуги, цену от минимального
                предложения и рейтинг после публикации отзывов.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-olive/70">
                {transfer.transferType ? (
                  <span className="rounded-full bg-cream px-2.5 py-1">{transfer.transferType}</span>
                ) : null}
                {fleetSummary.primaryVehicle?.vehicleModel ? (
                  <span className="rounded-full bg-cream px-2.5 py-1">
                    {fleetSummary.primaryVehicle.vehicleModel}
                  </span>
                ) : null}
                {fleet.length > 1 ? (
                  <span className="rounded-full border border-dashed border-olive/16 px-2.5 py-1">
                    Автопарк: {fleet.length}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_18px_48px_rgba(58,43,35,0.06)]">
            <h3 className="text-lg font-semibold text-olive">Оплата размещения</h3>
            <PlacementPromoNotice compact className="mt-3" />
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="rounded-2xl bg-cream/80 px-3 py-3">
                <dt className="text-olive/50">Тип карточки</dt>
                <dd className="font-semibold text-olive">Трансфер</dd>
              </div>
              <div className="rounded-2xl bg-cream/80 px-3 py-3">
                <dt className="text-olive/50">Тариф</dt>
                <dd className="font-semibold text-olive">
                  {formatPaymentTariff(latestPayment?.tariffCode ?? "transfer_standard")}
                </dd>
                <dd className="mt-0.5 text-xs text-olive/50">
                  {getTransferPaymentBaseTariffCode(
                    latestPayment?.tariffCode ?? "transfer_standard",
                  )}
                </dd>
              </div>
              <div className="rounded-2xl bg-cream/80 px-3 py-3">
                <dt className="text-olive/50">Стоимость</dt>
                <dd>
                  <PlacementPromoPrice
                    originalAmountRub={originalPublicationFeeRub}
                    finalAmountRub={Number(latestPayment?.amount ?? currentPublicationFeeRub)}
                  />
                </dd>
              </div>
              <div className="rounded-2xl bg-cream/80 px-3 py-3">
                <dt className="text-olive/50">Оплачено до</dt>
                <dd className="font-semibold text-olive">
                  {paidUntil ? paidUntil.toLocaleDateString("ru-RU") : "Нет активной оплаты"}
                </dd>
              </div>
            </dl>

            {latestPayment ? (
              <div className="mt-3 rounded-2xl border border-olive/10 bg-white px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-olive">
                      {getPaymentStatusLabel(latestPayment.status, latestPayment.provider)}
                    </p>
                    <p className="mt-0.5 text-xs text-olive/55">
                      {getProviderLabel(latestPayment.provider)} •{" "}
                      {new Date(latestPayment.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <span
                    className={
                      latestPayment.status === PaymentStatus.SUCCEEDED
                        ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : latestPayment.status === PaymentStatus.CANCELED
                          ? "rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
                    }
                  >
                    {latestPayment.status === PaymentStatus.SUCCEEDED
                      ? "Оплачено"
                      : latestPayment.status === PaymentStatus.CANCELED
                        ? "Отклонено"
                        : "Ожидает"}
                  </span>
                </div>
                {latestPayment.managerNotes ? (
                  <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-xs text-olive/70">
                    Комментарий: {latestPayment.managerNotes}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
                По карточке пока нет платежей. Владелец сможет отправить заявку на оплату из личного
                кабинета.
              </p>
            )}

            {payments.length > 1 ? (
              <div className="mt-3 space-y-2">
                {payments.slice(1, 4).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-cream/70 px-3 py-2 text-xs text-olive/65"
                  >
                    <span>{getPaymentStatusLabel(payment.status, payment.provider)}</span>
                    <span>{formatRub(payment.amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <Link
              href="/admin/payments"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              Все заявки на оплату
            </Link>
          </section>

          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-[0_18px_48px_rgba(58,43,35,0.06)]">
            <h3 className="text-lg font-semibold text-olive">Сводка</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-olive/45">Тип карточки</dt>
                <dd className="text-right font-semibold text-olive">Трансфер</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-olive/45">Владелец</dt>
                <dd className="text-right font-semibold text-olive">
                  {transfer.owner.firstName}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="inline-flex items-center gap-2 text-olive/45">
                  <AppIcon icon={Star} className="h-4 w-4" />
                  Рейтинг
                </dt>
                <dd className="text-right font-semibold text-olive">
                  {hasReviews ? Number(transfer.avgRating).toFixed(1) : "Пока без рейтинга"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="inline-flex items-center gap-2 text-olive/45">
                  <AppIcon icon={Eye} className="h-4 w-4" />
                  Отзывы
                </dt>
                <dd className="text-right font-semibold text-olive">{transfer.reviewsCount}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-olive/45">Контакт</dt>
                <dd className="text-right font-semibold text-olive">{contactName}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-olive/45">Цена от</dt>
                <dd className="text-right font-semibold text-olive">
                  {fleetSummary.priceFrom
                    ? `${fleetSummary.priceFrom.toLocaleString("ru-RU")} ₽`
                    : "Не указана"}
                </dd>
              </div>
            </dl>

            <button
              type="submit"
              name="intent"
              value="save"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              Сохранить изменения
            </button>
            {workflowStatus !== TransferStatus.PUBLISHED ? (
              <button
                type="submit"
                name="intent"
                value="publish"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/12"
              >
                Сохранить и опубликовать
              </button>
            ) : null}
            {workflowStatus === TransferStatus.PENDING_MODERATION ? (
              <button
                type="submit"
                name="intent"
                value="reject"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Отклонить
              </button>
            ) : null}
          </section>
        </aside>
      </form>
    </div>
  );
}
