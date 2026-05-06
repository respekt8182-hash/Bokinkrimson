// Next.js page for route /dashboard/objects/[id]/rules.
import { notFound, redirect } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { ObjectRulesPage } from "@/components/objects/object-rules-page";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPropertyDisplayNumberFromOrderedIds, serializeProperty } from "@/lib/properties";

type DashboardObjectRulesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectRulesPage({ params }: DashboardObjectRulesPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;
  const [property, ownerPropertyIds] = await Promise.all([
    db.property.findUnique({
      where: { id },
      include: {
        media: {
          where: { roomId: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        rooms: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
      <ObjectSectionNav propertyId={property.id} activeSection="rules" />
      <div className="min-w-0">
        <ObjectRulesPage
          initialProperty={serializeProperty(property)}
          displayPropertyNumber={displayPropertyNumber}
        />
      </div>
    </div>
  );
}
