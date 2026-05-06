import Link from "next/link";
import { PropertyStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import { ObjectAboutPage } from "@/components/objects/object-about-page";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import { isPropertyPublicationControlAvailable } from "@/lib/admin-schema-compat";
import {
  getAdminPropertyBaseStatusLabel,
  getAdminPropertyPendingEditLabel,
} from "@/lib/admin-status";
import { db } from "@/lib/db";
import {
  getPropertyDisplayNumberFromOrderedIds,
  serializeProperty,
} from "@/lib/properties";

type AdminObjectAboutPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getInitialBlockFromSearchParam(
  value: string | string[] | undefined,
): "info" | "location" | "ksr" | "contacts" | "photo" | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return undefined;
  }

  if (
    raw === "info" ||
    raw === "location" ||
    raw === "ksr" ||
    raw === "contacts" ||
    raw === "photo"
  ) {
    return raw;
  }

  return undefined;
}

export default async function AdminObjectAboutPage({
  params,
  searchParams,
}: AdminObjectAboutPageProps) {
  const { id } = await params;
  await purgeExpiredDeletedProperties(db, new Date());
  const isPropertyVisibilityControlAvailable = await isPropertyPublicationControlAvailable();
  const propertyVisibilityUnavailableReason = isPropertyVisibilityControlAvailable
    ? null
    : "Переключение видимости недоступно, пока база данных не обновлена до миграции публикации.";
  const property = await db.property.findUnique({
    where: { id },
    include: {
      media: {
        where: { roomId: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          prices: {
            select: { id: true },
          },
        },
      },
      amenities: {
        include: {
          amenity: true,
        },
      },
      customAmenities: true,
    },
  });

  if (!property) {
    notFound();
  }

  const ownerPropertyIds = await db.property.findMany({
    where: {
      ownerId: property.ownerId,
      OR: [{ ownerDeletedAt: null }, { id: property.id }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const displayPropertyNumber =
    getPropertyDisplayNumberFromOrderedIds(
      property.id,
      ownerPropertyIds.map((item) => item.id),
    ) ?? 1;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialBlock = getInitialBlockFromSearchParam(resolvedSearchParams.block);
  const isPublished = property.status === PropertyStatus.PUBLISHED;
  const isPendingDeletion = Boolean(property.ownerDeletedAt);
  const pendingEditLabel = isPublished
    ? getAdminPropertyPendingEditLabel(property.pendingEditStatus, property.moderationNotes)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-olive/10 bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-olive/45">
            Админский редактор объекта
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-olive">
            {property.name ?? "Объект без названия"}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/objects"
            className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            К списку
          </Link>
          <Link
            href={`/admin/objects/${property.id}`}
            className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Быстрая админ-правка
          </Link>
          {property.status === PropertyStatus.PENDING_MODERATION ? (
            <Link
              href={`/admin/moderation/${property.id}`}
              className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
            >
              Модерация
            </Link>
          ) : null}
          {property.status === PropertyStatus.DRAFT ? (
            <AdminDeleteDraftButton
              endpoint={`/api/admin/properties/${property.id}`}
              draftLabel="Черновик объекта"
              entityName={property.name ?? "Объект без названия"}
              redirectTo="/admin/objects"
              buttonClassName="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
            />
          ) : null}
          {isPublished && !isPendingDeletion ? (
            <AdminListingVisibilityToggle
              endpoint={`/api/admin/properties/${property.id}`}
              entityLabel="объект"
              isVisible={property.isPublishedVisible}
              disabled={!isPropertyVisibilityControlAvailable}
              disabledReason={propertyVisibilityUnavailableReason}
            />
          ) : null}
          {isPublished ? (
            <AdminSoftDeleteAction
              deleteEndpoint={`/api/admin/properties/${property.id}`}
              restoreEndpoint={`/api/admin/properties/${property.id}/restore`}
              entityLabel="объект"
              entityName={property.name ?? "Объект без названия"}
              isPendingDeletion={isPendingDeletion}
              restoreUntil={property.ownerDeletionExpiresAt?.toISOString() ?? null}
            />
          ) : null}
        </div>
      </div>

      <ObjectSectionNav
        propertyId={property.id}
        activeSection="about"
        basePath="/admin/objects"
        backHref={`/admin/objects/${property.id}`}
        backLabel="Быстрая админ-правка"
        includePayment={false}
        showChessboardTab
      />

      <div className="min-w-0">
        <ObjectAboutPage
          initialProperty={serializeProperty(property)}
          displayPropertyNumber={displayPropertyNumber}
          initialBlock={initialBlock}
          basePath="/admin/objects"
        />
      </div>
    </div>
  );
}
