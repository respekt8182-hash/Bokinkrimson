// Next.js page for route /dashboard/objects/[id]/amenities.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { RoomAmenitiesManager } from "@/components/rooms/room-amenities-manager";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPropertyWorkflowStatusLabel,
  getPropertyDisplayNumberFromOrderedIds,
} from "@/lib/properties";

type DashboardObjectAmenitiesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectAmenitiesPage({
  params,
}: DashboardObjectAmenitiesPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;
  const [property, ownerPropertyIds] = await Promise.all([
    db.property.findUnique({
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
    }),
    db.property.findMany({
      where: { ownerId: session.id, ownerDeletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
  ]);

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    notFound();
  }
  const displayPropertyNumber =
    getPropertyDisplayNumberFromOrderedIds(
      property.id,
      ownerPropertyIds.map((item) => item.id),
    ) ?? 1;

  return (
    <div className="space-y-5">
      <ObjectSectionNav propertyId={property.id} activeSection="amenities" />

      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl bg-cream p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-olive/60">
                ID объекта: {displayPropertyNumber}
              </p>
              <h1 className="text-3xl text-olive">Удобства в номерах</h1>
            </div>
            <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold uppercase text-olive">
              {getPropertyWorkflowStatusLabel(property.status, property.moderationNotes, property.pendingEditStatus)}
            </span>
          </div>
        </div>

        <RoomAmenitiesManager propertyId={property.id} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4">
          <Link
            href={`/dashboard/objects/${property.id}/room-categories`}
            className="text-sm font-semibold text-terra hover:underline"
          >
            Назад
          </Link>
          <Link
            href={`/dashboard/objects/${property.id}/payment`}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Далее
          </Link>
        </div>
      </div>
    </div>
  );
}
