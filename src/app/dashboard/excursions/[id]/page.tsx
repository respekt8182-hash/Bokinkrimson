import { notFound, redirect } from "next/navigation";
import { ExcursionEditor } from "@/components/excursions/excursion-editor";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeExcursion } from "@/lib/excursions";

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
  const excursion = await db.excursion.findUnique({
    where: { id },
    include: {
      mainLocation: { select: { name: true } },
      anchorLocation: { select: { name: true } },
      district: { select: { name: true } },
      category: { select: { name: true } },
      meetingLocation: { select: { name: true } },
      pickupLocations: { select: { locationId: true } },
      routeLocations: {
        select: { locationId: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!excursion || excursion.ownerId !== session.id) {
    notFound();
  }

  return <ExcursionEditor initialExcursion={serializeExcursion(excursion)} />;
}
