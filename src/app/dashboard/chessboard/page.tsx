// Next.js page for route /dashboard/chessboard.
import { redirect } from "next/navigation";
import { PropertyChessboardWorkspace } from "@/components/rooms/property-chessboard-workspace";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPropertyWorkflowStatusLabel } from "@/lib/properties";

type DashboardChessboardPageProps = {
  searchParams: Promise<{
    propertyId?: string;
    from?: string;
  }>;
};

export default async function DashboardChessboardPage({
  searchParams,
}: DashboardChessboardPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/chessboard");
  }

  const filters = await searchParams;
  const returnMode = filters.from === "prices" || filters.from === "rooms" ? filters.from : null;
  const properties = await db.property.findMany({
    where: { ownerId: session.id, ownerDeletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const items = properties.map((property) => ({
    id: property.id,
    name: property.name,
    statusLabel: getPropertyWorkflowStatusLabel(
      property.status,
      property.moderationNotes,
      property.pendingEditStatus,
    ),
    activeRoomsCount: property.rooms.length,
  }));

  const initialPropertyId =
    (filters.propertyId && items.some((item) => item.id === filters.propertyId)
      ? filters.propertyId
      : null) ??
    items[0]?.id ??
    null;

  const returnHref =
    returnMode && initialPropertyId
      ? `/dashboard/objects/${initialPropertyId}/${returnMode === "prices" ? "chessboard" : "room-categories"}`
      : returnMode
        ? "/dashboard/objects"
        : null;
  const returnLabel =
    returnMode === "prices"
      ? "К странице «Шахматка»"
      : returnMode === "rooms"
        ? "К вкладке «Номера»"
        : "К объектам";

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-cream [@media(orientation:landscape)_and_(max-height:560px)]:top-0">
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-3 md:px-6 md:py-5 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
        <div className="rounded-2xl border border-olive/10 bg-white p-4 [@media(orientation:landscape)_and_(max-height:560px)]:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl text-olive md:text-3xl">Шахматка</h1>
            </div>
          </div>
        </div>
        <PropertyChessboardWorkspace
          properties={items}
          initialPropertyId={initialPropertyId}
          returnHref={returnHref}
          returnLabel={returnLabel}
        />
      </div>
    </div>
  );
}
