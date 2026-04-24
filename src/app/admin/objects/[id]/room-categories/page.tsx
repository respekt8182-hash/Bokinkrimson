import { PropertyStatus } from "@prisma/client";
import { BedDouble, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { RoomFundManager } from "@/components/rooms/room-fund-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import {
  getAdminPropertyBaseStatusLabel,
  getAdminPropertyPendingEditLabel,
} from "@/lib/admin-status";
import { db } from "@/lib/db";
import {
  getPropertyDisplayNumberFromOrderedIds,
} from "@/lib/properties";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type AdminObjectRoomCategoriesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ create?: string }>;
};

function getStatusBadgeClass(status: PropertyStatus): string {
  switch (status) {
    case PropertyStatus.PUBLISHED:
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case PropertyStatus.PENDING_MODERATION:
      return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
    case PropertyStatus.REJECTED:
      return "bg-red-100 text-red-800 ring-1 ring-red-200";
    default:
      return "bg-sand text-olive/70 ring-1 ring-olive/15";
  }
}

export default async function AdminObjectRoomCategoriesPage({
  params,
  searchParams,
}: AdminObjectRoomCategoriesPageProps) {
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

  const [rooms, ownerPropertyIds] = await Promise.all([
    db.room.findMany({
      where: {
        propertyId: id,
        isActive: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      include: roomInclude,
    }),
    db.property.findMany({
      where: {
        ownerId: property.ownerId,
        OR: [{ ownerDeletedAt: null }, { id: property.id }],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
  ]);

  const displayPropertyNumber =
    getPropertyDisplayNumberFromOrderedIds(
      property.id,
      ownerPropertyIds.map((item) => item.id),
    ) ?? 1;
  const filters = await searchParams;
  const isCreateRequested = filters.create === "1";
  const isPublished = property.status === PropertyStatus.PUBLISHED;
  const pendingEditLabel = isPublished
    ? getAdminPropertyPendingEditLabel(property.pendingEditStatus, property.moderationNotes)
    : null;

  return (
    <div className="space-y-5">
      <ObjectSectionNav
        propertyId={property.id}
        activeSection="room-categories"
        basePath="/admin/objects"
        backHref={`/admin/objects/${property.id}`}
        backLabel="Быстрая админ-правка"
        includePayment={false}
        showChessboardTab
      />

      <div className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-2xl border border-olive/10 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-terra/70 via-sage to-primary/70" />

          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sage/30 to-terra/15 text-olive shadow-inner">
                  <AppIcon icon={BedDouble} className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-olive/40">
                    ID объекта: {displayPropertyNumber}
                  </p>
                  <h1 className="mt-0.5 text-2xl font-bold leading-tight text-olive">Номера</h1>
                  <p className="mt-0.5 text-sm text-olive/55">Категории номеров и цены</p>
                  <p className="mt-0.5 truncate text-xs text-olive/45">
                    {property.name ?? "Объект без названия"}
                  </p>
                </div>
              </div>

              <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getStatusBadgeClass(
                    property.status,
                  )}`}
                >
                  {getAdminPropertyBaseStatusLabel(property.status)}
                </span>
                {pendingEditLabel ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                    {pendingEditLabel}
                  </span>
                ) : null}
                {!isCreateRequested ? (
                  <Link
                    href={`/admin/objects/${property.id}/room-categories?create=1#room-category-form`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-midnight shadow-sm transition hover:bg-sage/85 active:scale-95"
                  >
                    <AppIcon icon={Plus} className="h-4 w-4" />
                    Создать номер
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-terra/5 px-4 py-3 text-[13px] leading-relaxed text-olive/70">
          Создайте категории номеров для карточки пользователя. Админ работает в том же редакторе,
          поэтому можно собрать фонд, цены, описание и фото так же, как это делает сам владелец.
        </div>

        <RoomFundManager
          propertyId={property.id}
          initialRooms={rooms.map(serializeRoom)}
          initialCreateMode={isCreateRequested}
          showCreateButton={false}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4">
          <Link
            href={`/admin/objects/${property.id}/rules`}
            className="text-sm font-semibold text-terra hover:underline"
          >
            Назад
          </Link>
          <Link
            href={`/admin/objects/${property.id}/amenities`}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Далее
          </Link>
        </div>
      </div>
    </div>
  );
}
