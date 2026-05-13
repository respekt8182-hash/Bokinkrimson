import { ExcursionOfferType } from "@prisma/client";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportedReviewsManager } from "@/components/reviews/imported-reviews-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { db } from "@/lib/db";
import { hasExternalReviewSupport, listExternalReviews } from "@/lib/external-reviews";

type AdminExcursionExternalReviewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminExcursionExternalReviewsPage({
  params,
}: AdminExcursionExternalReviewsPageProps) {
  const { id } = await params;
  const [excursion, schemaAvailable] = await Promise.all([
    db.excursion.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        publicId: true,
        offerType: true,
        owner: {
          select: {
            firstName: true,
            phone: true,
          },
        },
      },
    }),
    hasExternalReviewSupport("excursion"),
  ]);

  if (!excursion) {
    notFound();
  }

  const importedReviews = schemaAvailable
    ? await listExternalReviews({ entityType: "excursion", entityId: excursion.id })
    : [];
  const entityName = excursion.offerType === ExcursionOfferType.TOUR ? "тур" : "экскурсия";

  return (
    <div className="space-y-5">
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
                  Админ-панель · {entityName} {excursion.publicId ?? excursion.id}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold leading-tight text-olive">
                  Отзывы с других сайтов
                </h1>
                <p className="mt-1 text-sm text-olive/62">
                  {excursion.title?.trim() || "Программа без названия"} · владелец{" "}
                  {excursion.owner.firstName}
                  {excursion.owner.phone ? `, ${excursion.owner.phone}` : ""}
                </p>
              </div>
            </div>
            <Link
              href={`/admin/excursions/${excursion.id}`}
              className="inline-flex items-center justify-center rounded-xl border border-olive/14 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/20 hover:text-primary"
            >
              К редактору
            </Link>
          </div>
        </div>
      </div>

      <ImportedReviewsManager
        entityType="excursion"
        entityId={excursion.id}
        initialReviews={importedReviews}
        mode="admin"
        schemaAvailable={schemaAvailable}
        description="Администратор может добавить внешний отзыв по программе и отправить его в проверку отзывов. После одобрения отзыв появится в публичной карточке."
      />
    </div>
  );
}
