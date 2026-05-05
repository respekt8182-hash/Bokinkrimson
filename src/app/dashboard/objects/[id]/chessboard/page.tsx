// Next.js page for route /dashboard/objects/[id]/chessboard.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { PropertyChessboardWorkspace } from "@/components/rooms/property-chessboard-workspace";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPropertyWorkflowStatusLabel,
  getPropertyDisplayNumberFromOrderedIds,
} from "@/lib/properties";

type DashboardObjectChessboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectChessboardPage({
  params,
}: DashboardObjectChessboardPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;
  const [property, ownerPropertyIds] = await Promise.all([
    db.property.findUnique({
      where: { id },
      include: {
        rooms: {
          where: { isActive: true },
          select: { id: true },
        },
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
    <div className="space-y-4">
      <ObjectSectionNav propertyId={property.id} activeSection="chessboard" />

      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-olive/10 bg-cream/70 px-3 py-3 shadow-[0_12px_30px_-30px_rgba(58,43,35,0.4)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-olive/60">
                ID объекта: {displayPropertyNumber}
              </p>
              <h1 className="text-2xl text-olive">Шахматка</h1>
              <p className="mt-1 text-sm text-olive/68">
                Календарь занятости и цен по текущему объекту.
              </p>
            </div>
            <Link
              href={`/dashboard/objects/${property.id}/amenities`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-terra/40 px-3 text-xs font-semibold text-terra transition hover:bg-terra/10 sm:text-sm"
            >
              Назад к удобствам
            </Link>
          </div>
        </div>

        <PropertyChessboardWorkspace
          properties={[item]}
          initialPropertyId={property.id}
        />
      </div>
    </div>
  );
}
