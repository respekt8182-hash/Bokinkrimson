import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcursionOfferType, ExcursionStatus } from "@prisma/client";
import { AdminExcursionEditor } from "@/components/admin/admin-excursion-editor";
import { db } from "@/lib/db";

type AdminExcursionSettingsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminExcursionSettingsPage({
  params,
}: AdminExcursionSettingsPageProps) {
  const { id } = await params;

  const excursion = await db.excursion.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
      mainLocation: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
    },
  });

  if (!excursion) {
    notFound();
  }

  const [users, excursionLocations, excursionCategories, excursionDistricts] = await Promise.all([
    db.user.findMany({
      where: { role: "USER" },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true },
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

  const statusLabels: Record<string, string> = {
    DRAFT: "Черновик",
    PENDING_MODERATION: "На модерации",
    PUBLISHED: "Опубликована",
    NEEDS_FIX: "Нужна доработка",
    REJECTED: "Отклонена",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/excursions/${excursion.id}`}
          className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
        >
          К полному редактору
        </Link>
        <Link
          href="/admin/excursions"
          className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
        >
          К списку
        </Link>
        {excursion.status === ExcursionStatus.PENDING_MODERATION ? (
          <Link
            href={`/admin/moderation/excursions/${excursion.id}`}
            className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
          >
            Модерация
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-olive">
          {excursion.title || "Экскурсия без названия"}
        </h1>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-olive/70">
          {statusLabels[excursion.status] ?? excursion.status}
        </span>
        <span className="rounded-full bg-cream px-3 py-1 text-xs text-olive/50">
          {excursion.offerType === ExcursionOfferType.TOUR ? "Тур" : "Экскурсия"}
        </span>
      </div>

      <div className="text-xs text-olive/50">
        ID: {excursion.id} | Создано: {new Date(excursion.createdAt).toLocaleString("ru-RU")} |
        Обновлено: {new Date(excursion.updatedAt).toLocaleString("ru-RU")}
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
