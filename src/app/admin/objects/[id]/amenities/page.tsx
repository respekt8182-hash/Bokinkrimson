import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyStatus } from "@prisma/client";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { RoomAmenitiesManager } from "@/components/rooms/room-amenities-manager";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import {
  getAdminPropertyBaseStatusLabel,
  getAdminPropertyPendingEditLabel,
} from "@/lib/admin-status";
import { db } from "@/lib/db";
import { getPropertyDisplayNumberFromOrderedIds } from "@/lib/properties";

type AdminObjectAmenitiesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminObjectAmenitiesPage({
  params,
}: AdminObjectAmenitiesPageProps) {
  const { id } = await params;
  await purgeExpiredDeletedProperties(db, new Date());
  const property = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      pendingEditStatus: true,
      moderationNotes: true,
      ownerId: true,
      ownerDeletedAt: true,
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
  const isPublished = property.status === PropertyStatus.PUBLISHED;
  const pendingEditLabel = isPublished
    ? getAdminPropertyPendingEditLabel(property.pendingEditStatus, property.moderationNotes)
    : null;

  return (
    <div className="space-y-5">
      <ObjectSectionNav
        propertyId={property.id}
        activeSection="amenities"
        basePath="/admin/objects"
        backHref={`/admin/objects/${property.id}`}
        backLabel="Быстрая админ-правка"
        includePayment={false}
        showChessboardTab
      />

      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl bg-cream p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-olive/60">
                ID объекта: {displayPropertyNumber}
              </p>
              <h1 className="text-3xl text-olive">Удобства в номерах</h1>
              <p className="mt-1 text-sm text-olive/55">
                Что есть в номерах карточки пользователя
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold uppercase text-olive">
                {getAdminPropertyBaseStatusLabel(property.status)}
              </span>
              {pendingEditLabel ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                  {pendingEditLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] leading-relaxed text-olive/70">
          Здесь админ заполняет удобства точно в том же формате, который увидит модерация и
          будущая публичная карточка.
        </div>

        <RoomAmenitiesManager propertyId={property.id} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4">
          <Link
            href={`/admin/objects/${property.id}/room-categories`}
            className="text-sm font-semibold text-terra hover:underline"
          >
            Назад
          </Link>
          <Link
            href={`/admin/objects/${property.id}/chessboard`}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            К шахматке
          </Link>
        </div>
      </div>
    </div>
  );
}
