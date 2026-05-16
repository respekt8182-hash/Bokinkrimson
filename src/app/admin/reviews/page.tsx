import Link from "next/link";
import {
  ExcursionOfferType,
  ExcursionStatus,
  MediaType,
  PropertyStatus,
  ReviewStatus,
  TransferStatus,
} from "@prisma/client";
import { ImportedReviewModerationList } from "@/components/admin/imported-review-moderation-list";
import {
  ReviewEntityPicker,
  type ReviewEntityPickerItem,
} from "@/components/admin/review-property-picker";
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
  searchParams: Promise<{
    status?: string;
    propertyId?: string;
    entityType?: string;
    entityId?: string;
  }>;
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

type AdminReviewEntityType = ReviewEntityPickerItem["entityType"];

function parseAdminReviewEntityType(value: string | undefined): AdminReviewEntityType | null {
  return value === "property" || value === "excursion" || value === "transfer" ? value : null;
}

function buildStatusHref(
  status: ReviewStatus | "ALL",
  selectedEntity: ReviewEntityPickerItem | null,
): string {
  const params = new URLSearchParams();
  if (status !== ReviewStatus.PENDING) {
    params.set("status", status);
  }
  if (selectedEntity) {
    params.set("entityType", selectedEntity.entityType);
    params.set("entityId", selectedEntity.id);
  }

  const search = params.toString();
  return search ? `/admin/reviews?${search}` : "/admin/reviews";
}

type PickerItemDraft = Omit<ReviewEntityPickerItem, "number">;

export default async function AdminImportedReviewsPage({
  searchParams,
}: AdminImportedReviewsPageProps) {
  const filters = await searchParams;
  const status = parseStatus(filters.status);
  const requestedEntityType =
    parseAdminReviewEntityType(filters.entityType) ?? (filters.propertyId ? "property" : null);
  const requestedEntityId = filters.entityId?.trim() || filters.propertyId?.trim() || null;
  const [propertyReviewSupport, excursionReviewSupport, transferReviewSupport] = await Promise.all([
    hasExternalReviewSupport("property"),
    hasExternalReviewSupport("excursion"),
    hasExternalReviewSupport("transfer"),
  ]);
  const reviewSupportByEntityType: Record<AdminReviewEntityType, boolean> = {
    property: propertyReviewSupport,
    excursion: excursionReviewSupport,
    transfer: transferReviewSupport,
  };
  const anySchemaAvailable = Object.values(reviewSupportByEntityType).some(Boolean);

  if (!anySchemaAvailable) {
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

  const [publishedProperties, publishedExcursions, publishedTransfers, importedOverview] =
    await Promise.all([
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
      db.excursion.findMany({
        where: {
          status: ExcursionStatus.PUBLISHED,
          isPublishedVisible: true,
          deletedAt: null,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          locationName: true,
          offerType: true,
          photoUrls: true,
        },
        take: 300,
      }),
      db.transfer.findMany({
        where: {
          status: TransferStatus.PUBLISHED,
          isPublishedVisible: true,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          locationName: true,
          photoUrls: true,
        },
        take: 300,
      }),
      listImportedReviewsForAdmin({
        status,
        take: 200,
      }),
    ]);

  const pickerDrafts: PickerItemDraft[] = [
    ...publishedProperties.map(
      (property): PickerItemDraft => ({
        entityType: "property",
        id: property.id,
        name: property.name?.trim() || "Объект без названия",
        locationName: property.locationName?.trim() || "Город не указан",
        previewUrl: property.media[0]?.url ?? null,
        badgeLabel: "Объект",
        adminHref: `/admin/objects/${property.id}/external-reviews`,
      }),
    ),
    ...publishedExcursions.map(
      (excursion): PickerItemDraft => ({
        entityType: "excursion",
        id: excursion.id,
        name: excursion.title?.trim() || "Программа без названия",
        locationName: excursion.locationName?.trim() || "Город не указан",
        previewUrl: excursion.photoUrls[0] ?? null,
        badgeLabel: excursion.offerType === ExcursionOfferType.TOUR ? "Тур" : "Экскурсия",
        adminHref: `/admin/excursions/${excursion.id}/external-reviews`,
      }),
    ),
    ...publishedTransfers.map(
      (transfer): PickerItemDraft => ({
        entityType: "transfer",
        id: transfer.id,
        name: transfer.title?.trim() || "Трансфер без названия",
        locationName: transfer.locationName?.trim() || "Город не указан",
        previewUrl: transfer.photoUrls[0] ?? null,
        badgeLabel: "Трансфер",
        adminHref: `/admin/transfers/${transfer.id}/external-reviews`,
      }),
    ),
  ];
  const pickerItems: ReviewEntityPickerItem[] = pickerDrafts.map((item, index) => ({
    ...item,
    number: index + 1,
  }));
  const selectedEntity =
    pickerItems.find(
      (item) => item.entityType === requestedEntityType && item.id === requestedEntityId,
    ) ??
    pickerItems[0] ??
    null;
  const selectedEntitySchemaAvailable = selectedEntity
    ? reviewSupportByEntityType[selectedEntity.entityType]
    : false;
  const selectedEntityReviews =
    selectedEntity && selectedEntitySchemaAvailable
      ? await listExternalReviews({
          entityType: selectedEntity.entityType,
          entityId: selectedEntity.id,
        })
      : [];
  const selectedEntityTitle = selectedEntity?.name ?? "";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Подгруженные отзывы"
        description="Выберите опубликованный объект, экскурсию, тур или трансфер, загрузите JSON с отзывами с других сайтов, а затем правьте источник, дату, автора, рейтинг, видимость и текст."
        actions={
          selectedEntity ? (
            <Link
              href={selectedEntity.adminHref}
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              Открыть карточку
            </Link>
          ) : null
        }
      />

      <AdminPanel
        title="Импорт в опубликованную карточку"
        description="В списке доступны только опубликованные карточки. Найдите объект, экскурсию, тур или трансфер по названию, городу или номеру, выберите карточку, затем загрузите JSON-файл с отзывами."
      >
        {pickerItems.length > 0 ? (
          <ReviewEntityPicker
            items={pickerItems}
            selectedEntityType={selectedEntity?.entityType ?? null}
            selectedEntityId={selectedEntity?.id ?? null}
            activeStatus={status}
          />
        ) : (
          <AdminEmptyState
            title="Нет опубликованных карточек"
            description="Подгружать отзывы можно только к опубликованным объектам, экскурсиям, турам и трансферам."
          />
        )}
      </AdminPanel>

      {selectedEntity ? (
        <ImportedReviewsManager
          key={`${selectedEntity.entityType}-${selectedEntity.id}`}
          entityType={selectedEntity.entityType}
          entityId={selectedEntity.id}
          initialReviews={selectedEntityReviews}
          mode="admin"
          schemaAvailable={selectedEntitySchemaAvailable}
          canCreate
          title={`Отзывы: ${selectedEntityTitle}`}
          description="Загрузите JSON, проверьте распознанные отзывы и управляйте каждым отзывом отдельно. Видимые отзывы сразу попадают в выбранную публичную карточку."
        />
      ) : (
        <AdminNotice tone="info">
          Выберите опубликованную карточку, чтобы открыть импорт JSON.
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
              href={buildStatusHref(tab.id, selectedEntity)}
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

      <ImportedReviewModerationList initialReviews={importedOverview.items} activeStatus={status} />
    </div>
  );
}
