import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcursionOfferType, ExcursionStatus } from "@prisma/client";
import { AdminExcursionEditor } from "@/components/admin/admin-excursion-editor";
import { AdminListingVisibilityToggle } from "@/components/admin/admin-listing-visibility-toggle";
import { AdminSoftDeleteAction } from "@/components/admin/admin-soft-delete-action";
import { AdminPageHeader, AdminUnavailableState } from "@/components/admin/admin-ui";
import { purgeExpiredDeletedExcursions } from "@/lib/admin-entity-lifecycle";
import {
  isExcursionSoftDeleteAvailable,
  isExcursionVisibilityControlAvailable,
} from "@/lib/admin-schema-compat";
import { getAdminExcursionStatusLabel } from "@/lib/admin-status";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";

type AdminExcursionSettingsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminExcursionSettingsPage({
  params,
}: AdminExcursionSettingsPageProps) {
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

  const {
    excursion,
    users,
    excursionLocations,
    excursionCategories,
    excursionDistricts,
    isDatabaseFallback,
  } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-excursions-settings",
      unavailableMessage:
        "Admin excursion settings: database is unavailable. Rendering unavailable state.",
      fallbackEligibleMessage:
        "Admin excursion settings: database is unavailable or credentials are invalid. Rendering unavailable state.",
    },
    async () => {
      const excursion = await db.excursion.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, firstName: true, phone: true } },
          mainLocation: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
        },
      });

      if (!excursion) {
        return {
          excursion: null,
          users: [],
          excursionLocations: [],
          excursionCategories: [],
          excursionDistricts: [],
          isDatabaseFallback: false,
        };
      }

      const [users, excursionLocations, excursionCategories, excursionDistricts] =
        await Promise.all([
          db.user.findMany({
            where: { role: "USER", deletedAt: null },
            orderBy: [{ firstName: "asc" }],
            select: { id: true, firstName: true, phone: true },
          }),
          db.excursionLocation.findMany({
            orderBy: [{ name: "asc" }],
            select: { id: true, name: true },
          }),
          db.excursionCategory.findMany({
            orderBy: [{ name: "asc" }],
            select: { id: true, name: true },
          }),
          db.excursionDistrict.findMany({
            orderBy: [{ name: "asc" }],
            select: { id: true, name: true },
          }),
        ]);

      return {
        excursion,
        users,
        excursionLocations,
        excursionCategories,
        excursionDistricts,
        isDatabaseFallback: false,
      };
    },
    {
      excursion: null,
      users: [],
      excursionLocations: [],
      excursionCategories: [],
      excursionDistricts: [],
      isDatabaseFallback: true,
    },
  );

  if (isDatabaseFallback) {
    return (
      <AdminUnavailableState
        backHref="/admin/excursions"
        backLabel="К каталогу экскурсий"
        title="Быстрая правка временно недоступна"
      />
    );
  }

  if (!excursion) {
    notFound();
  }
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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог экскурсий"
        title={excursion.title || "Экскурсия без названия"}
        description={`Статус: ${statusBits.join(" • ")}. ID: ${excursion.id}`}
        actions={
          <>
            <Link
              href={`/admin/excursions/${excursion.id}`}
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              Полный редактор
            </Link>
            <Link
              href="/admin/excursions"
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              К каталогу экскурсий
            </Link>
            {excursion.status === ExcursionStatus.PENDING_MODERATION ? (
              <Link
                href={`/admin/moderation/excursions/${excursion.id}`}
                className="inline-flex items-center rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-200"
              >
                Модерация
              </Link>
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

      <div className="flex flex-wrap items-center gap-3 text-xs text-olive/50">
        <span>Создано: {new Date(excursion.createdAt).toLocaleString("ru-RU")}</span>
        <span>Обновлено: {new Date(excursion.updatedAt).toLocaleString("ru-RU")}</span>
        <span>{excursion.offerType === ExcursionOfferType.TOUR ? "Тур" : "Экскурсия"}</span>
      </div>

      <AdminExcursionEditor
        excursion={{
          id: excursion.id,
          ownerId: excursion.ownerId,
          offerType: excursion.offerType,
          title: excursion.title,
          description: excursion.description,
          shortDescription: excursion.shortDescription,
          fullDescription: excursion.fullDescription,
          mainLocationId: excursion.mainLocationId,
          categoryId: excursion.categoryId,
          districtId: excursion.districtId,
          locationName: excursion.locationName,
          address: excursion.address,
          startPoint: excursion.startPoint,
          finishPoint: excursion.finishPoint,
          durationMinutes: excursion.durationMinutes,
          durationDays: excursion.durationDays,
          durationNights: excursion.durationNights,
          format: excursion.format,
          groupSizeMin: excursion.groupSizeMin,
          groupSizeMax: excursion.groupSizeMax,
          priceFrom: excursion.priceFrom ? Number(excursion.priceFrom) : null,
          priceTo: excursion.priceTo ? Number(excursion.priceTo) : null,
          priceType: excursion.priceType,
          difficulty: excursion.difficulty,
          isKidFriendly: excursion.isKidFriendly,
          contactFirstName: excursion.contactFirstName,
          contactLastName: excursion.contactLastName,
          contactPhone: excursion.contactPhone,
          contactPhone2: excursion.contactPhone2,
          contactEmail: excursion.contactEmail,
          status: excursion.status,
          moderationNotes: excursion.moderationNotes,
        }}
        users={users}
        locations={excursionLocations}
        categories={excursionCategories}
        districts={excursionDistricts}
      />
    </div>
  );
}
