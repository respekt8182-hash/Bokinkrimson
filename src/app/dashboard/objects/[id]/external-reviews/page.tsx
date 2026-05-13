import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImportedReviewsManager } from "@/components/reviews/imported-reviews-manager";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasExternalReviewSupport, listExternalReviews } from "@/lib/external-reviews";

type DashboardObjectExternalReviewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardObjectExternalReviewsPage({
  params,
}: DashboardObjectExternalReviewsPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { id } = await params;
  const [property, schemaAvailable] = await Promise.all([
    db.property.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        ownerDeletedAt: true,
      },
    }),
    hasExternalReviewSupport("property"),
  ]);

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    notFound();
  }

  const importedReviews = schemaAvailable
    ? await listExternalReviews({ entityType: "property", entityId: property.id })
    : [];

  return (
    <div className="space-y-5">
      <ImportedReviewsManager
        entityType="property"
        entityId={property.id}
        initialReviews={importedReviews}
        schemaAvailable={schemaAvailable}
      />

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
  );
}
