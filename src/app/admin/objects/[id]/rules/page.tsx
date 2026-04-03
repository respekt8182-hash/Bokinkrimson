import Link from "next/link";
import { PropertyStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { ObjectRulesPage } from "@/components/objects/object-rules-page";
import { db } from "@/lib/db";
import {
  getPropertyDisplayNumberFromOrderedIds,
  getPropertyWorkflowStatusLabel,
  serializeProperty,
} from "@/lib/properties";

type AdminObjectRulesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminObjectRulesPage({ params }: AdminObjectRulesPageProps) {
  const { id } = await params;
  const property = await db.property.findUnique({
    where: { id },
    include: {
      media: {
        where: { roomId: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      rooms: {
        where: { isActive: true },
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

  if (!property || property.ownerDeletedAt) {
    notFound();
  }

  const ownerPropertyIds = await db.property.findMany({
    where: {
      ownerId: property.ownerId,
      ownerDeletedAt: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const displayPropertyNumber =
    getPropertyDisplayNumberFromOrderedIds(
      property.id,
      ownerPropertyIds.map((item) => item.id),
    ) ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-olive/10 bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-olive/45">Админский редактор объекта</p>
          <h1 className="mt-1 text-2xl font-semibold text-olive">
            {property.name ?? "Объект без названия"}
          </h1>
          <p className="mt-1 text-sm text-olive/60">
            {getPropertyWorkflowStatusLabel(
              property.status,
              property.moderationNotes,
              property.pendingEditStatus,
            )}
          </p>
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
        </div>
      </div>

      <ObjectSectionNav
        propertyId={property.id}
        activeSection="rules"
        basePath="/admin/objects"
        backHref={`/admin/objects/${property.id}`}
        backLabel="Быстрая админ-правка"
        includePayment={false}
        showChessboardTab
      />

      <div className="min-w-0">
        <ObjectRulesPage
          initialProperty={serializeProperty(property)}
          displayPropertyNumber={displayPropertyNumber}
          basePath="/admin/objects"
        />
      </div>
    </div>
  );
}
