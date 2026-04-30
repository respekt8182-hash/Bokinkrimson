// Next.js page for route /dashboard/chessboard.
import { redirect } from "next/navigation";
import { PropertyChessboardWorkspace } from "@/components/rooms/property-chessboard-workspace";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadDashboardPageData } from "@/lib/dashboard-page-db";
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
  const properties = await loadDashboardPageData(
    {
      contextId: "dashboard-chessboard",
      pageLabel: "Chessboard dashboard",
      fallbackDescription: "Showing empty state.",
    },
    async () =>
      db.property.findMany({
        where: { ownerId: session.id, ownerDeletedAt: null },
        orderBy: [{ updatedAt: "desc" }],
        include: {
          rooms: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      }),
    [],
  );

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
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-cream/92 [@media(orientation:landscape)_and_(max-height:560px)]:top-0">
      <div className="mx-auto w-full max-w-[1560px] space-y-3 px-2.5 py-2.5 md:px-5 md:py-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
        <div className="rounded-xl border border-olive/10 bg-white/94 px-3 py-2.5 shadow-[0_12px_30px_-28px_rgba(58,43,35,0.38)] [@media(orientation:landscape)_and_(max-height:560px)]:hidden">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl text-olive md:text-2xl">Шахматка</h1>
            </div>
          </div>
        </div>
        <PropertyChessboardWorkspace
          properties={items}
          initialPropertyId={initialPropertyId}
          returnHref={returnHref}
          returnLabel={returnLabel}
          avoidDashboardBottomNav
        />
      </div>
    </div>
  );
}
