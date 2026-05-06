import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcursionStatus } from "@prisma/client";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import { AdminPageHeader, AdminUnavailableState } from "@/components/admin/admin-ui";
import { PlacementPromoNotice } from "@/components/pricing/placement-promo";
import { ExcursionEditor } from "@/components/excursions/excursion-editor";
import { purgeExpiredDeletedExcursions } from "@/lib/admin-entity-lifecycle";
import {
  isExcursionSoftDeleteAvailable,
  isExcursionVisibilityControlAvailable,
} from "@/lib/admin-schema-compat";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import {
  getExcursionDisplayNumberFromOrderedIds,
  serializeExcursion,
} from "@/lib/excursions";
import { getAdminExcursionStatusLabel } from "@/lib/admin-status";

type AdminExcursionEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminExcursionEditPage({
  params,
}: AdminExcursionEditPageProps) {
  const { id } = await params;
  await purgeExpiredDeletedExcursions(db, new Date());
  const [isExcursionVisibilityAvailable, isExcursionSoftDeleteControlsAvailable] =
    await Promise.all([
      isExcursionVisibilityControlAvailable(),
      isExcursionSoftDeleteAvailable(),
    ]);
  const excursionVisibilityUnavailableReason = isExcursionVisibilityAvailable
    ? null
    : "Переключение видимости недоступно, пока база данных не обновлена до миграции публикации.";
  const excursionSoftDeleteUnavailableReason = isExcursionSoftDeleteControlsAvailable
    ? null
    : "Скрытие и восстановление программы недоступны, пока база данных не обновлена до последней миграции.";
  const { excursion, ownerExcursionIds, isDatabaseFallback } =
    await loadDataWithDatabaseFallback(
      {
        contextId: "admin-excursions-detail",
        unavailableMessage:
          "Admin excursion detail: database is unavailable. Rendering unavailable state.",
        fallbackEligibleMessage:
          "Admin excursion detail: database is unavailable or credentials are invalid. Rendering unavailable state.",
      },
      async () => {
        const excursion = await db.excursion.findUnique({
          where: { id },
          include: {
            owner: {
              select: {
                firstName: true,
                phone: true,
                email: true,
              },
            },
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

        if (!excursion) {
          return {
            excursion: null,
            ownerExcursionIds: [],
            isDatabaseFallback: false,
          };
        }

        const ownerExcursionIds = await db.excursion.findMany({
          where: { ownerId: excursion.ownerId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        });

        return {
          excursion,
          ownerExcursionIds,
          isDatabaseFallback: false,
        };
      },
      { excursion: null, ownerExcursionIds: [], isDatabaseFallback: true },
    );

  if (isDatabaseFallback) {
    return (
      <AdminUnavailableState
        backHref="/admin/excursions"
        backLabel="К каталогу экскурсий"
        title="Карточка экскурсии временно недоступна"
      />
    );
  }

  if (!excursion) {
    notFound();
  }

  const displayExcursionNumber =
    getExcursionDisplayNumberFromOrderedIds(
      excursion.id,
      ownerExcursionIds.map((item) => item.id),
    ) ?? 1;
  const isPublished = excursion.status === ExcursionStatus.PUBLISHED;
  const isPendingDeletion = Boolean(excursion.deletedAt);
  const statusBits = [getAdminExcursionStatusLabel(excursion.status)];
  if (isPublished && !excursion.isPublishedVisible && !isPendingDeletion) {
    statusBits.push("скрыта из публикации");
  }
  if (isPendingDeletion) {
    statusBits.push("ожидает удаления");
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Каталог экскурсий"
        title={excursion.title ?? "Экскурсия без названия"}
        description={`Статус: ${statusBits.join(" • ")}. Владелец: ${excursion.owner.firstName}${excursion.owner.phone ? `, ${excursion.owner.phone}` : ""}`}
        actions={
          <>
            <Link
              href="/admin/excursions"
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              К каталогу экскурсий
            </Link>
            <Link
              href={`/admin/excursions/${excursion.id}/settings`}
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              Быстрая правка
            </Link>
            {excursion.status === ExcursionStatus.PENDING_MODERATION ? (
              <Link
                href={`/admin/moderation/excursions/${excursion.id}`}
                className="inline-flex items-center rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-200"
              >
                Модерация
              </Link>
            ) : null}
            {excursion.status === ExcursionStatus.DRAFT ? (
              <AdminDeleteDraftButton
                endpoint={`/api/admin/excursions/${excursion.id}`}
                draftLabel="Черновик экскурсии"
                entityName={excursion.title ?? "Экскурсия без названия"}
                redirectTo="/admin/excursions"
                buttonClassName="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
              />
            ) : null}
            {isPublished && !isPendingDeletion ? (
              <AdminListingVisibilityToggle
                endpoint={`/api/admin/excursions/${excursion.id}`}
                entityLabel="программу"
                isVisible={excursion.isPublishedVisible}
                disabled={!isExcursionVisibilityAvailable}
                disabledReason={excursionVisibilityUnavailableReason}
              />
            ) : null}
            {isPublished ? (
              <AdminSoftDeleteAction
                deleteEndpoint={`/api/admin/excursions/${excursion.id}`}
                restoreEndpoint={`/api/admin/excursions/${excursion.id}/restore`}
                entityLabel="программу"
                entityName={excursion.title ?? "Экскурсия без названия"}
                isPendingDeletion={isPendingDeletion}
                restoreUntil={excursion.deletionExpiresAt?.toISOString() ?? null}
                disabled={!isExcursionSoftDeleteControlsAvailable}
                disabledReason={excursionSoftDeleteUnavailableReason}
              />
            ) : null}
          </>
        }
      />
      <PlacementPromoNotice compact />

      <ExcursionEditor
        initialExcursion={serializeExcursion(excursion)}
        displayExcursionNumber={displayExcursionNumber}
        adminMode
        backHref="/admin/excursions"
        backLabel="Все экскурсии"
        listHref="/admin/excursions"
        moderationHref={`/admin/moderation/excursions/${excursion.id}`}
      />
    </div>
  );
}
