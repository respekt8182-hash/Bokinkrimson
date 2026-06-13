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
  const returnMode =
    filters.from === "payment" || filters.from === "prices" || filters.from === "rooms"
      ? filters.from
      : null;
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
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
    returnMode === "payment" && initialPropertyId
      ? `/dashboard/objects/${initialPropertyId}/payment`
      : null;
  const returnLabel = returnMode === "payment" ? "Вернуться к оплате" : "К объектам";
  const initialBoardMode =
    returnMode === "payment" || returnMode === "prices" ? "prices" : "occupancy";

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-cream/92 [@media(orientation:landscape)_and_(max-height:560px)]:top-0">
      <div className="mx-auto w-full max-w-[1560px] space-y-3 px-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+6.75rem)] pt-4 md:px-5 md:pt-10 lg:pt-12 lg:pb-[calc(env(safe-area-inset-bottom,0px)+6.75rem)] [@media(orientation:landscape)_and_(max-height:560px)]:space-y-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] [@media(orientation:landscape)_and_(max-height:560px)]:pt-1.5">
        <PropertyChessboardWorkspace
          properties={items}
          initialPropertyId={initialPropertyId}
          returnHref={returnHref}
          returnLabel={returnLabel}
          initialBoardMode={initialBoardMode}
          avoidDashboardBottomNav
        />
      </div>
    </div>
  );
}
