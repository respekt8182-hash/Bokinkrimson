// Next.js page for route /dashboard/objects/[id]/rooms.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type DashboardObjectRoomsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectRoomsPage({ params }: DashboardObjectRoomsPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;
  const property = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      ownerId: true,
      ownerDeletedAt: true,
    },
  });

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <ObjectSectionNav propertyId={property.id} activeSection="room-categories" />

      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-olive/10 bg-white p-5">
          <p className="text-sm text-olive/75">
            Управление номерами выполняется во вкладке «Номера».
            На этой странице список не отображается.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/objects/${property.id}/room-categories`}
              className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Перейти к номерам
            </Link>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4">
          <Link
            href={`/dashboard/objects/${property.id}/room-categories`}
            className="text-sm font-semibold text-terra hover:underline"
          >
            Назад
          </Link>
          <Link
            href={`/dashboard/objects/${property.id}/amenities`}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Далее
          </Link>
        </div>
      </div>
    </div>
  );
}
