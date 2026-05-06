import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AdminMediaPreview } from "@/components/admin/admin-media-preview";
import { RegistryModerationActions } from "@/components/admin/registry-moderation-actions";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { ReviewModerationList } from "@/components/admin/review-moderation-list";
import { AdminUnavailableState } from "@/components/admin/admin-ui";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { serializePayment } from "@/lib/payments";
import { getPropertyWorkflowStatusLabel } from "@/lib/properties";
import { buildPublicPropertyPath } from "@/lib/public-properties";
import { serializeReview } from "@/lib/reviews";
import {
  additionalPlaceTypeOptions,
  bathroomLocationOptions,
  bathroomToiletOptions,
  bedTypeOptions,
  calculateBedCapacity,
  roomTypeLabelById,
  type RoomBedConfiguration,
} from "@/lib/room-catalog";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type AdminModerationObjectPageProps = {
  params: Promise<{ id: string }>;
};

const propertyInclude = Prisma.validator<Prisma.PropertyInclude>()({
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  amenities: {
    include: { amenity: true },
  },
  customAmenities: true,
  rooms: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: roomInclude,
  },
  payments: {
    orderBy: [{ createdAt: "desc" }],
    take: 10,
    include: {
      property: {
        select: { name: true },
      },
    },
  },
  reviews: {
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
});

function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

const bedTypeLabelById = Object.fromEntries(
  bedTypeOptions.map((item) => [item.id, item.label]),
) as Record<string, string>;
const additionalPlaceTypeLabelById = Object.fromEntries(
  additionalPlaceTypeOptions.map((item) => [item.id, item.label]),
) as Record<string, string>;
const bathroomLocationLabelById = Object.fromEntries(
  bathroomLocationOptions.map((item) => [item.id, item.label]),
) as Record<string, string>;
const bathroomToiletLabelById = Object.fromEntries(
  bathroomToiletOptions.map((item) => [item.id, item.label]),
) as Record<string, string>;

function formatBedConfiguration(configuration: RoomBedConfiguration[]): string {
  if (configuration.length === 0) {
    return "Не указана";
  }

  return configuration
    .map((item) => `${item.count} × ${bedTypeLabelById[item.type] ?? item.type}`)
    .join(", ");
}

function formatMappedList(values: string[], labelsById: Record<string, string>): string {
  if (values.length === 0) {
    return "Не указано";
  }

  return values.map((item) => labelsById[item] ?? item).join(", ");
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export default async function AdminModerationObjectPage({
  params,
}: AdminModerationObjectPageProps) {
  const { id } = await params;

  const { property, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-moderation-detail",
      unavailableMessage:
        "Admin moderation detail: database is unavailable. Rendering unavailable state.",
      fallbackEligibleMessage:
        "Admin moderation detail: database is unavailable or credentials are invalid. Rendering unavailable state.",
    },
    async () => ({
      property: await db.property.findUnique({
        where: { id },
        include: propertyInclude,
      }),
      isDatabaseFallback: false,
    }),
    { property: null, isDatabaseFallback: true },
  );

  if (isDatabaseFallback) {
    return (
      <AdminUnavailableState
        backHref="/admin/moderation"
        backLabel="К модерации жилья"
        title="Карточка модерации временно недоступна"
      />
    );
  }

  if (!property) {
    notFound();
  }

  const rooms = property.rooms.map(serializeRoom);
  const payments = property.payments.map(serializePayment);
  const reviews = property.reviews.map(serializeReview);
  const publicPath = buildPublicPropertyPath({
    id: property.id,
    locationId: property.locationId,
    name: property.name,
  });
  const ownerEmail = optionalText(property.owner.email);
  const contactPersonName = optionalText(property.contactPersonName);
  const contactPersonRole = optionalText(property.contactPersonRole);
  const listingChannels = optionalText(property.listingChannels);
  const hasContactPerson = Boolean(contactPersonName || contactPersonRole);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl text-olive">{property.name ?? "Объект без названия"}</h1>
          <p className="text-xs text-olive/60">ID: {property.id}</p>
          <p className="mt-1 text-sm text-olive/75">
            Статус:{" "}
            <span className="font-semibold text-olive">
              {getPropertyWorkflowStatusLabel(
                property.status,
                property.moderationNotes,
                property.pendingEditStatus,
              )}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/moderation"
            className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Назад к очереди
          </Link>
          <Link
            href={`/admin/objects/${property.id}/about`}
            className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Полный редактор
          </Link>
          <Link
            href={publicPath}
            className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Публичная карточка
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">Основные данные</h2>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Владелец</dt>
            <dd className="font-medium text-olive">
              {property.owner.firstName} {property.owner.lastName}
            </dd>
            {ownerEmail ? <dd className="text-olive/75">{ownerEmail}</dd> : null}
          </div>
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Населенный пункт</dt>
            <dd className="font-medium text-olive">{property.locationName ?? "Не указан"}</dd>
          </div>
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Адрес</dt>
            <dd className="font-medium text-olive">{property.address ?? "Не указан"}</dd>
          </div>
        </dl>

        <dl className="mt-2 grid gap-2 text-sm md:grid-cols-3">
          {hasContactPerson ? (
            <div className="rounded-xl bg-cream px-3 py-2">
              <dt className="text-olive/60">Контактное лицо</dt>
              {contactPersonName ? (
                <dd className="font-medium text-olive">{contactPersonName}</dd>
              ) : null}
              {contactPersonRole ? <dd className="text-olive/75">{contactPersonRole}</dd> : null}
            </div>
          ) : null}
          {listingChannels ? (
            <div className="rounded-xl bg-cream px-3 py-2">
              <dt className="text-olive/60">Где еще размещается</dt>
              <dd className="font-medium text-olive">{listingChannels}</dd>
            </div>
          ) : null}
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Реестр КСР</dt>
            <dd className="font-medium text-olive">
              {property.registryNumber ?? "Номер записи не добавлен"}
            </dd>
            <a
              href="https://tourism.fsa.gov.ru/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-terra hover:underline"
            >
              Проверить в реестре
            </a>
            <dd className="mt-1 text-xs text-amber-800">
              {property.registryNumberPending
                ? `На проверке: ${property.registryNumberPending}`
                : "Новых номеров КСР на проверке нет"}
            </dd>
          </div>
        </dl>
        {property.registryNumberPending ? (
          <RegistryModerationActions
            propertyId={property.id}
            pendingRegistryNumber={property.registryNumberPending}
          />
        ) : null}

        {property.description ? (
          <p className="mt-3 rounded-xl bg-cream/70 p-3 text-sm whitespace-pre-line text-olive/85">
            {property.description}
          </p>
        ) : null}

        {property.amenities.length > 0 || property.customAmenities.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {property.amenities.map((item) => (
              <span
                key={item.amenityId}
                className="rounded-full bg-sage/25 px-3 py-1 text-xs text-olive"
              >
                {item.amenity.name}
              </span>
            ))}
            {property.customAmenities.map((item) => (
              <span key={item.id} className="rounded-full bg-terra/15 px-3 py-1 text-xs text-olive">
                {item.name}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {property.media.length > 0 ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h2 className="text-xl text-olive">Медиа объекта</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {property.media.map((media) => (
              <div key={media.id} className="overflow-hidden rounded-xl bg-cream">
                {media.type === "IMAGE" ? (
                  <AdminMediaPreview
                    src={media.url}
                    alt={property.name ?? "Фото объекта"}
                    className="h-44 w-full object-cover"
                    fallbackLabel="Фото недоступно"
                  />
                ) : (
                  <video
                    src={media.url}
                    controls
                    className="h-44 w-full object-cover bg-black/80"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">Номерной фонд</h2>
        {rooms.length === 0 ? (
          <p className="mt-2 text-sm text-olive/70">Активных номеров нет.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rooms.map((room) => (
              <article key={room.id} className="rounded-xl bg-cream/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg text-olive">{room.title}</h3>
                    <p className="text-sm text-olive/70">
                      Мест: {room.beds}, доп. мест: {room.extraBeds}
                    </p>
                  </div>
                  <p className="text-sm text-olive/70">
                    Санузел:{" "}
                    <span className="font-semibold text-olive">{room.bathroomTypeLabel}</span>
                  </p>
                </div>
                {room.meta ? (
                  <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Тип категории</dt>
                      <dd className="font-medium text-olive">
                        {roomTypeLabelById[room.meta.roomType] ?? room.meta.roomType}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Название в экстранете</dt>
                      <dd className="font-medium text-olive">
                        {room.meta.nameInExtranet?.trim() || "Не указано"}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Категорий этого типа</dt>
                      <dd className="font-medium text-olive">{room.roomsCount}</dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Площадь</dt>
                      <dd className="font-medium text-olive">
                        {room.areaSqm === null ? "Не указана" : `${room.areaSqm} м²`}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 md:col-span-2">
                      <dt className="text-olive/60">Конфигурация кроватей (основная)</dt>
                      <dd className="font-medium text-olive">
                        {formatBedConfiguration(room.meta.bedConfiguration)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 md:col-span-2">
                      <dt className="text-olive/60">Варианты спальных мест</dt>
                      <dd className="font-medium text-olive">
                        {room.meta.bedSets.length <= 1
                          ? "Один вариант"
                          : room.meta.bedSets
                              .map(
                                (bedSet, index) =>
                                  `Вариант ${index + 1}: ${formatBedConfiguration(bedSet)}`,
                              )
                              .join(" | ")}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Дополнительные места</dt>
                      <dd className="font-medium text-olive">
                        {room.meta.hasAdditionalPlaces
                          ? formatMappedList(
                              room.meta.additionalPlaceTypes,
                              additionalPlaceTypeLabelById,
                            )
                          : "Нет"}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Собственный санузел</dt>
                      <dd className="font-medium text-olive">
                        {room.meta.hasPrivateBathroom
                          ? `${formatMappedList(room.meta.privateBathroomLocations, bathroomLocationLabelById)}; туалет: ${formatMappedList(room.meta.privateToiletLocations, bathroomToiletLabelById)}; кол-во: ${room.meta.privateBathroomCount ?? "не указано"}`
                          : "Нет"}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <dt className="text-olive/60">Общий санузел</dt>
                      <dd className="font-medium text-olive">
                        {room.meta.hasSharedBathroom
                          ? `${formatMappedList(room.meta.sharedBathroomLocations, bathroomLocationLabelById)}; туалет: ${formatMappedList(room.meta.sharedToiletLocations, bathroomToiletLabelById)}`
                          : "Нет"}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {room.beds > 20 ||
                room.extraBeds > 8 ||
                (room.meta?.bedConfiguration.length
                  ? room.beds > calculateBedCapacity(room.meta.bedConfiguration)
                  : false) ? (
                  <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    Проверьте вместимость: значения выглядят подозрительно для этой категории
                    номера.
                  </p>
                ) : null}

                {room.features.length > 0 || room.customFeatures.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-olive">Оснащение номера</p>
                    <div className="flex flex-wrap gap-2">
                      {room.features.map((feature) => (
                        <span
                          key={`${room.id}-feature-${feature.id}`}
                          className="rounded-full bg-sage/25 px-3 py-1 text-xs text-olive"
                        >
                          {feature.name}
                        </span>
                      ))}
                      {room.customFeatures.map((feature, featureIndex) => (
                        <span
                          key={`${room.id}-custom-feature-${featureIndex}`}
                          className="rounded-full bg-terra/15 px-3 py-1 text-xs text-olive"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {room.media.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-olive">Медиа номера</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {room.media.map((media) => (
                        <div
                          key={`${room.id}-media-${media.id}`}
                          className="overflow-hidden rounded-xl border border-olive/10 bg-white"
                        >
                          {media.type === "IMAGE" ? (
                            <AdminMediaPreview
                              src={media.url}
                              alt={room.title}
                              className="h-36 w-full object-cover"
                              fallbackLabel="Фото номера недоступно"
                            />
                          ) : (
                            <video
                              src={media.url}
                              controls
                              className="h-36 w-full object-cover bg-black/80"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {room.prices.length > 0 ? (
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-olive/65">
                          <th className="py-1 pr-4">Период</th>
                          <th className="py-1">Цена</th>
                          <th className="py-1 pl-4">Мин. гостей</th>
                        </tr>
                      </thead>
                      <tbody>
                        {room.prices.map((price) => (
                          <tr key={price.id} className="border-t border-olive/10">
                            <td className="py-1 pr-4 text-olive">
                              {price.dateFrom} - {price.dateTo}
                            </td>
                            <td className="py-1 font-semibold text-olive">
                              {formatMoney(price.price, price.currency)}
                            </td>
                            <td className="py-1 pl-4 text-olive">
                              {price.minGuests === null ? "Без ограничений" : price.minGuests}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-olive/70">Цены не заданы.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">История платежей</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-olive/70">Платежей пока нет.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-olive/65">
                  <th className="py-1 pr-4">ID</th>
                  <th className="py-1 pr-4">Сумма</th>
                  <th className="py-1 pr-4">Тариф</th>
                  <th className="py-1 pr-4">Статус</th>
                  <th className="py-1">Создан</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-olive/10">
                    <td className="py-1 pr-4 font-mono text-xs text-olive">
                      {payment.id.slice(0, 10)}...
                    </td>
                    <td className="py-1 pr-4 text-olive">{formatMoney(payment.amount, "RUB")}</td>
                    <td className="py-1 pr-4 text-olive">{payment.tariffCode}</td>
                    <td className="py-1 pr-4 text-olive">{payment.statusLabel}</td>
                    <td className="py-1 text-olive">
                      {new Date(payment.createdAt).toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReviewModerationList
        initialReviews={reviews}
        initialAvgRating={Number(property.avgRating)}
        initialReviewsCount={property.reviewsCount}
      />

      <ModerationActions
        propertyId={property.id}
        currentStatus={getPropertyWorkflowStatusLabel(
          property.status,
          property.moderationNotes,
          property.pendingEditStatus,
        )}
        initialComment={property.moderationNotes ?? ""}
      />
    </div>
  );
}
