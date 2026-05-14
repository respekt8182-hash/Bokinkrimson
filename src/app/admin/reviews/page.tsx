import Link from "next/link";
import { ReviewStatus } from "@prisma/client";
import { ImportedReviewModerationList } from "@/components/admin/imported-review-moderation-list";
import { AdminPageHeader, AdminPanel, AdminStatCard } from "@/components/admin/admin-ui";
import { cn } from "@/lib/cn";
import { hasExternalReviewSupport, listImportedReviewsForAdmin } from "@/lib/external-reviews";

type AdminImportedReviewsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const statusTabs = [
  { id: ReviewStatus.PENDING, label: "На проверке" },
  { id: ReviewStatus.ACTIVE, label: "Проверены" },
  { id: ReviewStatus.DELETED, label: "Отклонены" },
  { id: ReviewStatus.DUPLICATE, label: "Дубли" },
  { id: "ALL", label: "Все" },
] as const;

function parseStatus(value: string | undefined): ReviewStatus | "ALL" {
  if (value === "ALL") {
    return "ALL";
  }

  if (
    value === ReviewStatus.ACTIVE ||
    value === ReviewStatus.DELETED ||
    value === ReviewStatus.DUPLICATE ||
    value === ReviewStatus.FAILED ||
    value === ReviewStatus.PENDING
  ) {
    return value;
  }

  return ReviewStatus.PENDING;
}

export default async function AdminImportedReviewsPage({
  searchParams,
}: AdminImportedReviewsPageProps) {
  const filters = await searchParams;
  const status = parseStatus(filters.status);
  const schemaAvailable = await hasExternalReviewSupport("property");

  if (!schemaAvailable) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Проверка отзывов"
          description="База данных ещё не обновлена для отзывов с других сайтов."
        />
        <AdminPanel>
          <p className="text-sm leading-6 text-olive/70">
            Примените последнюю Prisma-миграцию, чтобы открыть добавление и модерацию внешних
            отзывов.
          </p>
        </AdminPanel>
      </div>
    );
  }

  const { items, countByStatus, totalCount } = await listImportedReviewsForAdmin({
    status,
    take: 200,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Проверка отзывов"
        description="Отзывы с других сайтов, добавленные вручную по объектам, экскурсиям, турам и трансферам. Проверьте текст и источник перед публикацией."
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <AdminStatCard label="На проверке" value={countByStatus.get(ReviewStatus.PENDING) ?? 0} />
        <AdminStatCard label="Проверены" value={countByStatus.get(ReviewStatus.ACTIVE) ?? 0} />
        <AdminStatCard label="Отклонены" value={countByStatus.get(ReviewStatus.DELETED) ?? 0} />
        <AdminStatCard label="Дубли" value={countByStatus.get(ReviewStatus.DUPLICATE) ?? 0} />
        <AdminStatCard label="Всего" value={totalCount} />
      </div>

      <AdminPanel>
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Link
              key={tab.id}
              href={
                tab.id === ReviewStatus.PENDING
                  ? "/admin/reviews"
                  : `/admin/reviews?status=${tab.id}`
              }
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                status === tab.id
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-olive/10 bg-white text-olive/68 hover:border-primary/18 hover:text-primary",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </AdminPanel>

      <ImportedReviewModerationList initialReviews={items} activeStatus={status} />
    </div>
  );
}
