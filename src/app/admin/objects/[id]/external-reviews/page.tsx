import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectSectionNav } from "@/components/objects/object-section-nav";
import { ImportedReviewsManager } from "@/components/reviews/imported-reviews-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { db } from "@/lib/db";
import { hasExternalReviewSupport, listExternalReviews } from "@/lib/external-reviews";
import { getPropertyDisplayNumberFromOrderedIds } from "@/lib/properties";

type AdminObjectExternalReviewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminObjectExternalReviewsPage({
  params,
}: AdminObjectExternalReviewsPageProps) {
  const { id } = await params;
  const [property, schemaAvailable] = await Promise.all([
    db.property.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        name: true,
        publicId: true,
        owner: {
          select: {
            firstName: true,
            phone: true,
          },
        },
      },
    }),
    hasExternalReviewSupport("property"),
  ]);

  if (!property) {
    notFound();
  }

  const [ownerPropertyIds, importedReviews] = await Promise.all([
    db.property.findMany({
      where: {
        ownerId: property.ownerId,
        OR: [{ ownerDeletedAt: null }, { id: property.id }],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
    schemaAvailable
      ? listExternalReviews({ entityType: "property", entityId: property.id })
      : Promise.resolve([]),
  ]);
  const displayPropertyNumber =
    getPropertyDisplayNumberFromOrderedIds(
      property.id,
      ownerPropertyIds.map((item) => item.id),
    ) ?? 1;

  return (
    <div className="space-y-5">
      <ObjectSectionNav
        propertyId={property.id}
        activeSection="external-reviews"
        basePath="/admin/objects"
        backHref={`/admin/objects/${property.id}`}
        backLabel="Быстрая админ-правка"
        includePayment={false}
        showChessboardTab
      />

      <div className="overflow-hidden rounded-2xl border border-olive/10 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-primary/70 via-sage to-terra/70" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <AppIcon icon={MessageSquareText} className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-olive/40">
                  Админ-панель · ID объекта: {property.publicId ?? displayPropertyNumber}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold leading-tight text-olive">
                  Отзывы с других сайтов
                </h1>
                <p className="mt-1 text-sm text-olive/62">
                  {property.name?.trim() || "Объект без названия"} · владелец{" "}
                  {property.owner.firstName}
                  {property.owner.phone ? `, ${property.owner.phone}` : ""}
                </p>
              </div>
            </div>
            <Link
              href={`/admin/objects/${property.id}`}
              className="inline-flex items-center justify-center rounded-xl border border-olive/14 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/20 hover:text-primary"
            >
              К карточке
            </Link>
          </div>
        </div>
      </div>

      <ImportedReviewsManager
        entityType="property"
        entityId={property.id}
        initialReviews={importedReviews}
        mode="admin"
        schemaAvailable={schemaAvailable}
        description="Администратор может добавить внешний отзыв по объекту и отправить его в проверку отзывов. После одобрения отзыв появится в публичной карточке."
      />
    </div>
  );
}
