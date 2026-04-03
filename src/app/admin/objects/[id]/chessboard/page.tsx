import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { PropertyChessboardWorkspace } from "@/components/rooms/property-chessboard-workspace";
import { db } from "@/lib/db";
import {
  getPropertyDisplayNumberFromOrderedIds,
  getPropertyWorkflowStatusLabel,
} from "@/lib/properties";

type AdminObjectChessboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminObjectChessboardPage({
  params,
}: AdminObjectChessboardPageProps) {
  const { id } = await params;
  const property = await db.property.findUnique({
    where: { id },
    include: {
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  if (!property || property.ownerDeletedAt) {
    notFound();
  }

  const ownerPropertyIds = await db.property.findMany({
    where: { ownerId: property.ownerId, ownerDeletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const displayPropertyNumber =
    getPropertyDisplayNumberFromOrderedIds(
      property.id,
      ownerPropertyIds.map((item) => item.id),
    ) ?? 1;

  const item = {
    id: property.id,
    name: property.name,
    statusLabel: getPropertyWorkflowStatusLabel(
      property.status,
      property.moderationNotes,
      property.pendingEditStatus,
    ),
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
