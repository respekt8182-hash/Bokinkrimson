import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcursionStatus } from "@prisma/client";
import { ExcursionEditor } from "@/components/excursions/excursion-editor";
import { db } from "@/lib/db";
import {
  getExcursionDisplayNumberFromOrderedIds,
  getExcursionStatusLabel,
  serializeExcursion,
} from "@/lib/excursions";

type AdminExcursionEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminExcursionEditPage({
  params,
}: AdminExcursionEditPageProps) {
  const { id } = await params;
  const excursion = await db.excursion.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
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
    notFound();
  }

  const ownerExcursionIds = await db.excursion.findMany({
    where: { ownerId: excursion.ownerId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const displayExcursionNumber =
    getExcursionDisplayNumberFromOrderedIds(
      excursion.id,
      ownerExcursionIds.map((item) => item.id),
    ) ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-olive/10 bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-olive/45">Админский редактор экскурсии</p>
          <h1 className="mt-1 text-2xl font-semibold text-olive">
            {excursion.title ?? "Экскурсия без названия"}
          </h1>
          <p className="mt-1 text-sm text-olive/60">{getExcursionStatusLabel(excursion.status)}</p>
          <p className="mt-2 text-xs text-olive/55">
            Владелец: {excursion.owner.firstName} {excursion.owner.lastName}
            {excursion.owner.phone ? `, ${excursion.owner.phone}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/excursions"
            className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            К списку
          </Link>
          <Link
            href={`/admin/excursions/${excursion.id}/settings`}
            className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Быстрая админ-правка
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
      </div>

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
