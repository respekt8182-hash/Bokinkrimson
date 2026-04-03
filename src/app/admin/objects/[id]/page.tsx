// Admin page: edit property details.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getPropertyWorkflowStatusLabel } from "@/lib/properties";
import { AdminPropertyEditor } from "@/components/admin/admin-property-editor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminPropertyEditPage({ params }: Props) {
  const { id } = await params;

  const property = await db.property.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
      rooms: {
        where: { isActive: true },
        select: { id: true, title: true },
      },
    },
  });

  if (!property) notFound();

  const [users, locations] = await Promise.all([
    db.user.findMany({
      where: { role: "USER" },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    getLocationDirectoryItems(),
  ]);
  const editorSections = [
    {
      href: `/admin/objects/${property.id}/about`,
      title: "Об объекте",
      description: "Название, локация, описание, контакты и фото",
    },
    {
      href: `/admin/objects/${property.id}/rules`,
      title: "Правила",
      description: "Заезд, выезд и политики проживания",
    },
    {
      href: `/admin/objects/${property.id}/room-categories`,
      title: "Номера",
      description: "Категории номеров, цены, вместимость и медиа",
    },
    {
      href: `/admin/objects/${property.id}/amenities`,
      title: "Удобства",
      description: "Оснащение номеров и наполненность карточки",
    },
    {
      href: `/admin/objects/${property.id}/chessboard`,
      title: "Шахматка",
      description: "Занятость, цены и ручная работа с календарем",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/objects"
          className="rounded-xl border border-olive/20 px-3 py-2 text-sm font-semibold text-olive hover:bg-cream"
        >
          Назад к списку
        </Link>
        {property.status === PropertyStatus.PENDING_MODERATION && (
          <Link
            href={`/admin/moderation/${property.id}`}
            className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
          >
            Модерация
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-olive">
          {property.name || "Объект без названия"}
        </h1>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-olive/70">
          {getPropertyWorkflowStatusLabel(
            property.status,
            property.moderationNotes,
            property.pendingEditStatus,
          )}
        </span>
        {property.type && (
          <span className="rounded-full bg-cream px-3 py-1 text-xs text-olive/50">
            {property.type}
          </span>
        )}
      </div>

      <div className="text-xs text-olive/50">
        ID: {property.id} | Номеров: {property.rooms.length} |
        Рейтинг: {Number(property.avgRating).toFixed(1)} ({property.reviewsCount} отз.) |
        Создано: {new Date(property.createdAt).toLocaleString("ru-RU")}
      </div>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-olive">Полный редактор карточки</h2>
            <p className="mt-1 text-sm text-olive/60">
              Админ может пройти те же шаги, что и владелец: заполнить карточку, доработать
              номера и перейти к шахматке перед публикацией.
            </p>
          </div>
          <Link
            href={`/admin/objects/${property.id}/about`}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Открыть редактор
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {editorSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-2xl border border-olive/10 bg-cream/40 p-4 transition hover:border-primary/20 hover:bg-primary/5"
            >
              <p className="text-sm font-semibold text-olive">{section.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-olive/60">{section.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <AdminPropertyEditor
        property={{
          id: property.id,
          ownerId: property.ownerId,
          name: property.name,
          type: property.type,
          status: property.status,
          locationId: property.locationId,
          locationName: property.locationName,
          address: property.address,
          description: property.description,
          phone: property.phone,
          contactEmail: property.contactEmail,
          contactPersonName: property.contactPersonName,
          websiteUrl: property.websiteUrl,
          whatsappUrl: property.whatsappUrl,
          telegramUrl: property.telegramUrl,
          checkInFrom: property.checkInFrom,
          checkOutUntil: property.checkOutUntil,
          childrenAllowed: property.childrenAllowed,
          petsPolicy: property.petsPolicy,
          smokingPolicy: property.smokingPolicy,
          parkingInfo: property.parkingInfo,
          mealOptions: property.mealOptions,
          seaDistance: property.seaDistance,
          moderationNotes: property.moderationNotes,
          latitude: property.latitude ? Number(property.latitude) : null,
          longitude: property.longitude ? Number(property.longitude) : null,
        }}
        users={users}
        locations={locations}
      />
    </div>
  );
}
