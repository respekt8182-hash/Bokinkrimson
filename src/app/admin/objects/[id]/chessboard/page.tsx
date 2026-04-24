import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { PropertyChessboardWorkspace } from "@/components/rooms/property-chessboard-workspace";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import {
  getAdminPropertyBaseStatusLabel,
  getAdminPropertyPendingEditLabel,
} from "@/lib/admin-status";
import { db } from "@/lib/db";
import { getPropertyDisplayNumberFromOrderedIds } from "@/lib/properties";

type AdminObjectChessboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminObjectChessboardPage({
  params,
}: AdminObjectChessboardPageProps) {
  const { id } = await params;
  await purgeExpiredDeletedProperties(db, new Date());
  const property = await db.property.findUnique({
    where: { id },
    include: {
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
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

  const pendingEditLabel = getAdminPropertyPendingEditLabel(
    property.pendingEditStatus,
    property.moderationNotes,
  );

  const item = {
    id: property.id,
    name: property.name,
    statusLabel: getAdminPropertyBaseStatusLabel(property.status),
    activeRoomsCount: property.rooms.length,
  };

  return (
    <div className="space-y-5">
      <ObjectSectionNav
        propertyId={property.id}
        activeSection="chessboard"
        basePath="/admin/objects"
        backHref={`/admin/objects/${property.id}`}
        backLabel="Быстрая админ-правка"
        includePayment={false}
        showChessboardTab
      />

      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl bg-cream p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-olive/60">
                ID объекта: {displayPropertyNumber}
              </p>
              <h1 className="text-3xl text-olive">Шахматка</h1>
              <p className="mt-1 text-sm text-olive/70">
                Календарь занятости и цен для объекта пользователя.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-olive/70">
                  {getAdminPropertyBaseStatusLabel(property.status)}
                </span>
                {pendingEditLabel ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {pendingEditLabel}
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              href={`/admin/objects/${property.id}/amenities`}
              className="inline-flex items-center justify-center rounded-xl border border-terra/45 px-4 py-2.5 text-sm font-semibold text-terra hover:bg-terra/10"
            >
              Назад к удобствам
            </Link>
          </div>
        </div>

        <PropertyChessboardWorkspace
          properties={[item]}
          initialPropertyId={property.id}
          returnHref={`/admin/objects/${property.id}/amenities`}
          returnLabel="К удобствам"
        />
      </div>
    </div>
  );
}
