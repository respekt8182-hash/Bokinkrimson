// Next.js page for route /dashboard/objects/[id]/room-categories.
import { BedDouble, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { RoomFundManager } from "@/components/rooms/room-fund-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPropertyDisplayNumberFromOrderedIds } from "@/lib/properties";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type DashboardObjectRoomCategoriesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ create?: string }>;
};

export default async function DashboardObjectRoomCategoriesPage({
  params,
  searchParams,
}: DashboardObjectRoomCategoriesPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;
  const [property, rooms, ownerPropertyIds] = await Promise.all([
    db.property.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        ownerDeletedAt: true,
      },
    }),
    db.room.findMany({
      where: {
        propertyId: id,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: roomInclude,
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
  const filters = await searchParams;
  const isCreateRequested = filters.create === "1";

  return (
    <div className="space-y-5">
      <ObjectSectionNav propertyId={property.id} activeSection="room-categories" />

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
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <Link
                  href={`/dashboard/objects/${property.id}/external-reviews`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/15 active:scale-95"
                >
                  <AppIcon icon={MessageSquareText} className="h-4 w-4" />
                  Добавить отзывы
                </Link>
                {!isCreateRequested ? (
                  <Link
                    href={`/dashboard/objects/${property.id}/room-categories?create=1#room-category-form`}
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

        <RoomFundManager
          propertyId={property.id}
          initialRooms={rooms.map(serializeRoom)}
          initialCreateMode={isCreateRequested}
          showCreateButton={false}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4">
          <Link
            href={`/dashboard/objects/${property.id}/rules`}
            className="text-sm font-semibold text-terra hover:underline"
          >
            Назад
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/objects/${property.id}/amenities`}
              className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Далее
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
