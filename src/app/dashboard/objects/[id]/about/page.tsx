// Next.js page for route /dashboard/objects/[id]/about.
import { notFound, redirect } from "next/navigation";
import { ObjectAboutPage } from "@/components/objects/object-about-page";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPropertyDisplayNumberFromOrderedIds, serializeProperty } from "@/lib/properties";

type DashboardObjectAboutPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getInitialBlockFromSearchParam(
  value: string | string[] | undefined,
): "info" | "location" | "ksr" | "contacts" | "photo" | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return undefined;
  }

  if (raw === "info" || raw === "location" || raw === "ksr" || raw === "contacts" || raw === "photo") {
    return raw;
  }

  return undefined;
}

export default async function DashboardObjectAboutPage({
  params,
  searchParams,
}: DashboardObjectAboutPageProps) {
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
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialBlock = getInitialBlockFromSearchParam(resolvedSearchParams.block);

  return (
    <div className="space-y-5">
      <ObjectSectionNav propertyId={property.id} activeSection="about" />
      <div className="min-w-0">
        <ObjectAboutPage
          initialProperty={serializeProperty(property)}
          displayPropertyNumber={displayPropertyNumber}
          initialBlock={initialBlock}
        />
      </div>
    </div>
  );
}
