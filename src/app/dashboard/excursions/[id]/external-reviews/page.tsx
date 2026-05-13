import { ExcursionOfferType } from "@prisma/client";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImportedReviewsManager } from "@/components/reviews/imported-reviews-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getExcursionDisplayNumberFromOrderedIds,
} from "@/lib/excursions";
import { hasExternalReviewSupport, listExternalReviews } from "@/lib/external-reviews";

type DashboardExcursionExternalReviewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardExcursionExternalReviewsPage({
  params,
}: DashboardExcursionExternalReviewsPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/excursions");
  }

  const { id } = await params;
  const [excursion, ownerExcursionIds, schemaAvailable] = await Promise.all([
    db.excursion.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        offerType: true,
      },
    }),
    db.excursion.findMany({
      where: { ownerId: session.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
    hasExternalReviewSupport("excursion"),
  ]);

  if (!excursion || excursion.ownerId !== session.id) {
    notFound();
  }

  const importedReviews = schemaAvailable
    ? await listExternalReviews({ entityType: "excursion", entityId: excursion.id })
    : [];
  const displayExcursionNumber =
    getExcursionDisplayNumberFromOrderedIds(
      excursion.id,
      ownerExcursionIds.map((item) => item.id),
    ) ?? 1;
  const entityLabel = excursion.offerType === ExcursionOfferType.TOUR ? "тура" : "экскурсии";

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
                  ID {entityLabel}: {displayExcursionNumber}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold leading-tight text-olive">
                  Отзывы с других сайтов
                </h1>
                <p className="mt-1 text-sm text-olive/62">
                  {excursion.title?.trim() || "Программа без названия"}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/excursions/${excursion.id}`}
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
        schemaAvailable={schemaAvailable}
        description="Добавьте внешний отзыв по этой программе: имя автора, оценку, текст, сайт-источник, город и дату, если они известны. После проверки он появится в публичной карточке."
      />
    </div>
  );
}
