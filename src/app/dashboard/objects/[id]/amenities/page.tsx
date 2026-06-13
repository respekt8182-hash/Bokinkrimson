// Next.js page for route /dashboard/objects/[id]/amenities.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { RoomAmenitiesManager } from "@/components/rooms/room-amenities-manager";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPropertyDisplayNumberFromOrderedIds } from "@/lib/properties";

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
    <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
      <ObjectSectionNav propertyId={property.id} activeSection="amenities" />

      <div className="min-w-0 space-y-5">
        <div className="rounded-[22px] border border-olive/10 bg-white/95 p-5 shadow-[0_22px_58px_rgba(58,43,35,0.08)] ring-1 ring-white/70 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-semibold leading-tight text-olive sm:text-3xl">
                Удобства объекта
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-olive/64">
                Выберите удобства, которые действительно доступны вашим гостям. Не отмечайте то,
                чего нет на объекте.
              </p>
              <div className="mt-5 flex items-center gap-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-olive/8">
                  <div className="h-full w-[80%] rounded-full bg-primary" />
                </div>
                <span className="text-xs font-semibold text-olive/55">~80%</span>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-olive/64">
              Объект #{displayPropertyNumber}
            </span>
          </div>
        </div>

        <div className="rounded-[18px] border border-primary/12 bg-foam px-4 py-3 text-[13px] leading-relaxed text-olive/70">
          Выберите удобства, которые есть в номерах вашего объекта. Гости фильтруют жильё по удобствам — чем больше отметите, тем легче вас найти.
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
