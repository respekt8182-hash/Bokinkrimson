// Admin page: edit property details.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyStatus } from "@prisma/client";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminListingPaymentConfirmation } from "@/components/admin/admin-listing-payment-confirmation";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import { ReviewModerationList } from "@/components/admin/review-moderation-list";
import { PlacementPromoNotice } from "@/components/pricing/placement-promo";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import { isPropertyPublicationControlAvailable } from "@/lib/admin-schema-compat";
import { db } from "@/lib/db";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import {
  getAdminPropertyBaseStatusLabel,
  getAdminPropertyPendingEditLabel,
} from "@/lib/admin-status";
import { AdminPropertyEditor } from "@/components/admin/admin-property-editor";
import { getExternalReviewSummaryWithFallback, listExternalReviews } from "@/lib/external-reviews";
import { getPropertyWorkflowStatus } from "@/lib/properties";
import { serializeReview } from "@/lib/reviews";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminPropertyEditPage({ params }: Props) {
  const { id } = await params;
  await purgeExpiredDeletedProperties(db, new Date());
  const isPropertyVisibilityControlAvailable = await isPropertyPublicationControlAvailable();
  const propertyVisibilityUnavailableReason = isPropertyVisibilityControlAvailable
    ? null
    : "Переключение видимости недоступно, пока база данных не обновлена до миграции публикации.";

  const property = await db.property.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, phone: true } },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true },
      },
      reviews: {
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        include: {
          user: {
            select: {
              firstName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (!property) notFound();

  const [users, locations, importedReviews] = await Promise.all([
    db.user.findMany({
      where: { role: "USER", deletedAt: null },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, phone: true },
    }),
    getLocationDirectoryItems(),
    listExternalReviews({ entityType: "property", entityId: property.id }),
  ]);
  const reviewsById = new Map(
    property.reviews.map((review) => {
      const serialized = serializeReview(review);
      return [serialized.id, serialized] as const;
    }),
  );
  for (const review of importedReviews) {
    reviewsById.set(review.id, review);
  }
  const mergedReviews = [...reviewsById.values()];
  const reviewSummary = await getExternalReviewSummaryWithFallback({
    entityType: "property",
    entityId: property.id,
    avgRating: Number(property.avgRating),
    reviewsCount: property.reviewsCount,
  });
  const editorSections = [
    {
      href: `/admin/objects/${property.id}/about`,
      title: "Об объекте",
      description: "Название, локация, описание, контакты и фото",
    },
    {
      href: `/admin/objects/${property.id}/rules`,
      title: "Правила",
      description: "Заезд, выезд и политики проживания",
    },
    {
      href: `/admin/objects/${property.id}/room-categories`,
      title: "Номера",
      description: "Категории номеров, цены, вместимость и медиа",
    },
    {
      href: `/admin/objects/${property.id}/external-reviews`,
      title: "Подгруженные отзывы",
      description: "Добавление внешних отзывов в публичную карточку объекта",
    },
    {
      href: `/admin/objects/${property.id}/amenities`,
      title: "Удобства",
      description: "Оснащение номеров и наполненность карточки",
    },
    {
      href: `/admin/objects/${property.id}/chessboard`,
      title: "Шахматка",
      description: "Занятость, цены и ручная работа с календарем",
    },
  ];
  const isPublished = property.status === PropertyStatus.PUBLISHED;
  const isPendingDeletion = Boolean(property.ownerDeletedAt);
  const workflowStatus = getPropertyWorkflowStatus(property.status, property.pendingEditStatus);
  const pendingEditLabel = isPublished
    ? getAdminPropertyPendingEditLabel(property.pendingEditStatus, property.moderationNotes)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/objects"
          className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
        >
          Назад к списку
        </Link>
        {workflowStatus === PropertyStatus.PENDING_MODERATION && (
          <Link
            href={`/admin/moderation/${property.id}`}
            className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
          >
            Модерация
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-olive">{property.name || "Объект без названия"}</h1>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-olive/70">
          {getAdminPropertyBaseStatusLabel(property.status)}
        </span>
        {pendingEditLabel ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {pendingEditLabel}
          </span>
        ) : null}
        {isPublished && !property.isPublishedVisible && !isPendingDeletion ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Скрыт из публикации
          </span>
        ) : null}
        {isPendingDeletion ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            Удаляется
          </span>
        ) : null}
        {property.type && (
          <span className="rounded-full bg-cream px-3 py-1 text-xs text-olive/50">
            {property.type}
          </span>
        )}
      </div>

      {isPublished ? (
        <div className="flex flex-wrap gap-2">
          {!isPendingDeletion ? (
            <AdminListingVisibilityToggle
              endpoint={`/api/admin/properties/${property.id}`}
              entityLabel="объект"
              isVisible={property.isPublishedVisible}
              disabled={!isPropertyVisibilityControlAvailable}
              disabledReason={propertyVisibilityUnavailableReason}
            />
          ) : null}
          <AdminSoftDeleteAction
            deleteEndpoint={`/api/admin/properties/${property.id}`}
            restoreEndpoint={`/api/admin/properties/${property.id}/restore`}
            entityLabel="объект"
            entityName={property.name ?? "Объект без названия"}
            isPendingDeletion={isPendingDeletion}
            restoreUntil={property.ownerDeletionExpiresAt?.toISOString() ?? null}
          />
        </div>
      ) : null}

      <div className="text-xs text-olive/50">
        ID объекта: {property.publicId ?? "—"} | Технический ID: {property.id} | Номеров:{" "}
        {property.rooms.length} | Рейтинг: {Number(property.avgRating).toFixed(1)} (
        {property.reviewsCount} отз.) | Создано:{" "}
        {new Date(property.createdAt).toLocaleString("ru-RU")}
      </div>

      <AdminListingPaymentConfirmation
        entityType="property"
        entityId={property.id}
        entityLabel="Объект"
        tariffOptions={[
          { value: "season", label: "Сезонное размещение — до 31 октября" },
          { value: "yearly", label: "Годовое размещение — 12 месяцев" },
        ]}
      />

      <ReviewModerationList
        initialReviews={mergedReviews}
        initialAvgRating={reviewSummary.avgRating}
        initialReviewsCount={reviewSummary.reviewsCount}
      />

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-olive">Полный редактор карточки</h2>
            <p className="mt-1 text-sm text-olive/60">
              Админ может пройти те же шаги, что и владелец: заполнить карточку, доработать номера и
              перейти к шахматке перед публикацией.
            </p>
          </div>
          <Link
            href={`/admin/objects/${property.id}/about`}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Открыть редактор
          </Link>
        </div>

        <PlacementPromoNotice compact className="mt-4" />

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {editorSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-2xl border border-olive/10 bg-cream/40 p-4 transition hover:border-primary/20 hover:bg-primary/5"
            >
              <p className="text-sm font-semibold text-olive">{section.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-olive/60">{section.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <AdminPropertyEditor
        property={{
          id: property.id,
          ownerId: property.ownerId,
          name: property.name,
          type: property.type,
          status: property.status,
          locationId: property.locationId,
          locationName: property.locationName,
          address: property.address,
          description: property.description,
          phone: property.phone,
          contactEmail: property.contactEmail,
          contactPersonName: property.contactPersonName,
          websiteUrl: property.websiteUrl,
          whatsappUrl: property.whatsappUrl,
          telegramUrl: property.telegramUrl,
          checkInFrom: property.checkInFrom,
          checkOutUntil: property.checkOutUntil,
          childrenAllowed: property.childrenAllowed,
          petsPolicy: property.petsPolicy,
          smokingPolicy: property.smokingPolicy,
          parkingInfo: property.parkingInfo,
          mealOptions: property.mealOptions,
          seaDistance: property.seaDistance,
          moderationNotes: property.moderationNotes,
          latitude: property.latitude ? Number(property.latitude) : null,
          longitude: property.longitude ? Number(property.longitude) : null,
        }}
        users={users}
        locations={locations}
      />
    </div>
  );
}
