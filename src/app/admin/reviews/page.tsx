import Link from "next/link";
import { MediaType, PropertyStatus, ReviewStatus } from "@prisma/client";
import { ImportedReviewModerationList } from "@/components/admin/imported-review-moderation-list";
import { ReviewPropertyPicker } from "@/components/admin/review-property-picker";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
} from "@/components/admin/admin-ui";
import { ImportedReviewsManager } from "@/components/reviews/imported-reviews-manager";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import {
  hasExternalReviewSupport,
  listExternalReviews,
  listImportedReviewsForAdmin,
} from "@/lib/external-reviews";

type AdminImportedReviewsPageProps = {
  searchParams: Promise<{ status?: string; propertyId?: string }>;
};

const statusTabs = [
  { id: ReviewStatus.PENDING, label: "На проверке" },
  { id: ReviewStatus.ACTIVE, label: "Видимые" },
  { id: ReviewStatus.DELETED, label: "Скрытые" },
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

function buildStatusHref(status: ReviewStatus | "ALL", propertyId: string | null): string {
  const params = new URLSearchParams();
  if (status !== ReviewStatus.PENDING) {
    params.set("status", status);
  }
  if (propertyId) {
    params.set("propertyId", propertyId);
  }

  const search = params.toString();
  return search ? `/admin/reviews?${search}` : "/admin/reviews";
}

export default async function AdminImportedReviewsPage({
  searchParams,
}: AdminImportedReviewsPageProps) {
  const filters = await searchParams;
  const status = parseStatus(filters.status);
  const requestedPropertyId = filters.propertyId?.trim() || null;
  const schemaAvailable = await hasExternalReviewSupport("property");

  if (!schemaAvailable) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Подгруженные отзывы"
          description="База данных ещё не обновлена для отзывов с других сайтов."
        />
        <AdminPanel>
          <p className="text-sm leading-6 text-olive/70">
            Примените последнюю Prisma-миграцию, чтобы открыть добавление и управление внешними
            отзывами.
          </p>
        </AdminPanel>
      </div>
    );
  }

  const [publishedProperties, importedOverview] = await Promise.all([
    db.property.findMany({
      where: {
        status: PropertyStatus.PUBLISHED,
        ownerDeletedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        locationName: true,
        media: {
          where: {
            roomId: null,
            type: MediaType.IMAGE,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            url: true,
          },
          take: 1,
        },
      },
      take: 300,
    }),
    listImportedReviewsForAdmin({
      status,
      take: 200,
    }),
  ]);

  const selectedProperty =
    publishedProperties.find((property) => property.id === requestedPropertyId) ??
    publishedProperties[0] ??
    null;
  const selectedPropertyReviews = selectedProperty
    ? await listExternalReviews({ entityType: "property", entityId: selectedProperty.id })
    : [];
  const selectedPropertyTitle = selectedProperty
    ? selectedProperty.name?.trim() || "Объект без названия"
    : "";
  const propertyPickerItems = publishedProperties.map((property, index) => ({
    id: property.id,
    number: index + 1,
    name: property.name?.trim() || "Объект без названия",
    locationName: property.locationName?.trim() || "Город не указан",
    previewUrl: property.media[0]?.url ?? null,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Подгруженные отзывы"
        description="Выберите опубликованный объект, загрузите JSON с отзывами с других сайтов, а затем правьте источник, дату, автора, рейтинг, видимость и текст."
        actions={
          selectedProperty ? (
            <Link
              href={`/admin/objects/${selectedProperty.id}/external-reviews`}
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              Открыть страницу объекта
            </Link>
          ) : null
        }
      />

      <AdminPanel
        title="Импорт в опубликованный объект"
        description="В списке доступны только опубликованные объекты. Найдите объект по названию, городу или номеру, выберите карточку, затем загрузите JSON-файл с отзывами."
      >
        {publishedProperties.length > 0 ? (
          <ReviewPropertyPicker
            items={propertyPickerItems}
            selectedPropertyId={selectedProperty?.id ?? null}
            activeStatus={status}
          />
        ) : (
          <AdminEmptyState
            title="Нет опубликованных объектов"
            description="Подгружать отзывы можно только к объектам, которые уже опубликованы."
          />
        )}
      </AdminPanel>

      {selectedProperty ? (
        <ImportedReviewsManager
          key={selectedProperty.id}
          entityType="property"
          entityId={selectedProperty.id}
          initialReviews={selectedPropertyReviews}
          mode="admin"
          schemaAvailable={schemaAvailable}
          canCreate
          title={`Отзывы: ${selectedPropertyTitle}`}
          description="Загрузите JSON, проверьте распознанные отзывы и управляйте каждым отзывом отдельно. Видимые отзывы сразу попадают в публичную карточку объекта."
        />
      ) : (
        <AdminNotice tone="info">
          Выберите опубликованный объект, чтобы открыть импорт JSON.
        </AdminNotice>
      )}

      <div className="grid gap-4 sm:grid-cols-5">
        <AdminStatCard
          label="На проверке"
          value={importedOverview.countByStatus.get(ReviewStatus.PENDING) ?? 0}
        />
        <AdminStatCard
          label="Видимые"
          value={importedOverview.countByStatus.get(ReviewStatus.ACTIVE) ?? 0}
        />
        <AdminStatCard
          label="Скрытые"
          value={importedOverview.countByStatus.get(ReviewStatus.DELETED) ?? 0}
        />
        <AdminStatCard
          label="Дубли"
          value={importedOverview.countByStatus.get(ReviewStatus.DUPLICATE) ?? 0}
        />
        <AdminStatCard label="Всего" value={importedOverview.totalCount} />
      </div>

      <AdminPanel
        title="Все подгруженные отзывы"
        description="Общий список нужен для быстрой проверки, правки, скрытия и удаления уже созданных отзывов."
      >
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Link
              key={tab.id}
              href={buildStatusHref(tab.id, selectedProperty?.id ?? null)}
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

      <ImportedReviewModerationList
        initialReviews={importedOverview.items}
        activeStatus={status}
      />
    </div>
  );
}
