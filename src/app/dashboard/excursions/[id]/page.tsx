import { notFound, redirect } from "next/navigation";
import { ExcursionEditor } from "@/components/excursions/excursion-editor";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExcursionDisplayNumberFromOrderedIds, serializeExcursion } from "@/lib/excursions";
import { buildPublicExcursionPath } from "@/lib/public-excursions";

type ExcursionPageProps = {
  params: Promise<{ id: string }>;
};

// Protected excursion editor page (owner-only access by excursion id).
export default async function DashboardExcursionByIdPage({ params }: ExcursionPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/excursions");
  }

  const { id } = await params;
  const [excursion, ownerExcursionIds] = await Promise.all([
    db.excursion.findUnique({
      where: { id },
      include: {
        mainLocation: { select: { name: true } },
        anchorLocation: { select: { slug: true, name: true } },
        district: { select: { name: true } },
        category: { select: { name: true } },
        meetingLocation: { select: { name: true } },
        pickupLocations: { select: { locationId: true } },
        routeLocations: {
          select: { locationId: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    db.excursion.findMany({
      where: { ownerId: session.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
  ]);

  if (!excursion || excursion.ownerId !== session.id) {
    notFound();
  }

  const displayExcursionNumber =
    getExcursionDisplayNumberFromOrderedIds(
      excursion.id,
      ownerExcursionIds.map((item) => item.id),
    ) ?? 1;
  const previewHref = `${buildPublicExcursionPath({
    id: excursion.id,
    locationId: excursion.locationId,
    title: excursion.title,
    anchorLocation: excursion.anchorLocation,
  })}?preview=1`;

  return (
    <ExcursionEditor
      initialExcursion={serializeExcursion(excursion)}
      displayExcursionNumber={displayExcursionNumber}
      previewHref={previewHref}
      externalReviewsHref={`/dashboard/excursions/${excursion.id}/external-reviews`}
    />
  );
}
