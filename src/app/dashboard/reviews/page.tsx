// Next.js page for route /dashboard/reviews.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadDashboardPageData } from "@/lib/dashboard-page-db";
import { DashboardReviewsEntityPanel } from "@/components/reviews/dashboard-reviews-entity-panel";

export default async function DashboardReviewsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/reviews");
  }

  const { properties, excursions } = await loadDashboardPageData(
    {
      contextId: "dashboard-reviews",
      pageLabel: "Reviews dashboard",
      fallbackDescription: "Showing empty state.",
    },
    async () => {
      const [properties, excursions] = await Promise.all([
        db.property.findMany({
          where: {
            ownerId: session.id,
            ownerDeletedAt: null,
          },
          orderBy: [{ reviewsCount: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            name: true,
            reviewsCount: true,
            avgRating: true,
          },
        }),
        db.excursion.findMany({
          where: {
            ownerId: session.id,
          },
          orderBy: [{ reviewsCount: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            title: true,
            reviewsCount: true,
            avgRating: true,
          },
        }),
      ]);

      return { properties, excursions };
    },
    { properties: [], excursions: [] },
  );

  const propertyReviewsCount = properties.reduce((sum, item) => sum + item.reviewsCount, 0);
  const excursionReviewsCount = excursions.reduce((sum, item) => sum + item.reviewsCount, 0);
  const totalReviewsCount = propertyReviewsCount + excursionReviewsCount;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl text-olive">Отзывы</h1>
        <p className="text-sm text-olive/70">
          Просматривайте отзывы по объектам и экскурсиям. При необходимости отправьте жалобу администратору.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Всего отзывов</p>
          <p className="text-xl font-semibold text-olive">{totalReviewsCount}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">По объектам</p>
          <p className="text-xl font-semibold text-olive">{propertyReviewsCount}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">По экскурсиям</p>
          <p className="text-xl font-semibold text-olive">{excursionReviewsCount}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-lg text-olive">Объекты размещения</h2>
        {properties.length === 0 ? (
          <p className="mt-3 text-sm text-olive/65">Объекты не найдены.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {properties.map((item) => (
              <DashboardReviewsEntityPanel
                key={item.id}
                entityType="property"
                entityId={item.id}
                entityName={item.name ?? "Объект без названия"}
                reviewsCount={item.reviewsCount}
                avgRating={Number(item.avgRating)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-lg text-olive">Экскурсии</h2>
        {excursions.length === 0 ? (
          <p className="mt-3 text-sm text-olive/65">Экскурсии не найдены.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {excursions.map((item) => (
              <DashboardReviewsEntityPanel
                key={item.id}
                entityType="excursion"
                entityId={item.id}
                entityName={item.title ?? "Экскурсия без названия"}
                reviewsCount={item.reviewsCount}
                avgRating={Number(item.avgRating)}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
