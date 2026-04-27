import { Prisma, TransferStatus } from "@prisma/client";
import { ArrowUpRight, Car, Save } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AdminPageHeader,
  AdminPanel,
  adminInputClass,
  adminTextareaClass,
} from "@/components/admin/admin-ui";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { db } from "@/lib/db";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";

type AdminTransferEditPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formInt(formData: FormData, key: string): number | null {
  const value = formString(formData, key);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formDecimal(formData: FormData, key: string): Prisma.Decimal | null {
  const value = formString(formData, key)?.replace(",", ".");
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? new Prisma.Decimal(parsed) : null;
}

function formCoordinate(formData: FormData, key: string): Prisma.Decimal | null {
  const value = formString(formData, key)?.replace(",", ".");
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
}

function parsePhotoUrls(value: string | null): string[] {
  return (value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStatus(value: string | null): TransferStatus {
  if (
    value === TransferStatus.PENDING_MODERATION ||
    value === TransferStatus.PUBLISHED ||
    value === TransferStatus.REJECTED
  ) {
    return value;
  }

  return TransferStatus.DRAFT;
}

export default async function AdminTransferEditPage({ params }: AdminTransferEditPageProps) {
  const { id } = await params;
  const [transfer, locations] = await Promise.all([
    db.transfer.findUnique({
      where: { id },
      include: {
        owner: { select: { firstName: true, lastName: true, phone: true, avatarUrl: true } },
        location: { select: { id: true, name: true } },
      },
    }),
    db.excursionLocation.findMany({
      orderBy: [{ isMajor: "desc" }, { name: "asc" }],
      select: { id: true, name: true, districtId: true },
    }),
  ]);

  if (!transfer) {
    notFound();
  }

  async function saveTransfer(formData: FormData) {
    "use server";

    const admin = await verifyAdminSession();
    if (!admin) {
      redirect("/admin/login");
    }

    const current = await db.transfer.findUnique({
      where: { id },
      select: { id: true, publishedAt: true },
    });

    if (!current) {
      notFound();
    }

    const locationId = formString(formData, "locationId");
    const selectedLocation = locationId
      ? await db.excursionLocation.findUnique({
          where: { id: locationId },
          select: { name: true, districtId: true },
        })
      : null;
    const title = formString(formData, "title") ?? "Трансфер";
    const status = parseStatus(formString(formData, "status"));

    await db.transfer.update({
      where: { id },
      data: {
        title,
        slug: buildTransferSlug(title, id),
        transferType: formString(formData, "transferType"),
        vehicleClass: formString(formData, "vehicleClass"),
        vehicleModel: formString(formData, "vehicleModel"),
        seats: formInt(formData, "seats"),
        luggage: formInt(formData, "luggage"),
        locationId,
        locationName: selectedLocation?.name ?? formString(formData, "locationName"),
        districtId: selectedLocation?.districtId ?? null,
        serviceArea: formString(formData, "serviceArea"),
        routeExamples: formString(formData, "routeExamples"),
        latitude: formCoordinate(formData, "latitude"),
        longitude: formCoordinate(formData, "longitude"),
        priceFrom: formDecimal(formData, "priceFrom"),
        priceUnitLabel: formString(formData, "priceUnitLabel"),
        shortDescription: formString(formData, "shortDescription"),
        description: formString(formData, "description"),
        photoUrls: parsePhotoUrls(formString(formData, "photoUrls")),
        contactName: formString(formData, "contactName"),
        phone: formString(formData, "phone"),
        phone2: formString(formData, "phone2"),
        websiteUrl: formString(formData, "websiteUrl"),
        whatsappUrl: formString(formData, "whatsappUrl"),
        telegramUrl: formString(formData, "telegramUrl"),
        vkUrl: formString(formData, "vkUrl"),
        maxUrl: formString(formData, "maxUrl"),
        okUrl: formString(formData, "okUrl"),
        status,
        isPublishedVisible: formData.get("isPublishedVisible") === "on",
        moderationNotes: formString(formData, "moderationNotes"),
        publishedAt:
          status === TransferStatus.PUBLISHED ? (current.publishedAt ?? new Date()) : null,
      },
    });

    redirect(`/admin/transfers/${id}?saved=1`);
  }

  const publicPath =
    transfer.status === TransferStatus.PUBLISHED && transfer.isPublishedVisible
      ? buildPublicTransferPath({ id: transfer.id, title: transfer.title })
      : null;
  const firstPhoto = transfer.photoUrls[0] ?? null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Трансферы"
        title={transfer.title || "Трансфер без названия"}
        description={`Статус: ${STATUS_LABELS[transfer.status]}. Владелец: ${transfer.owner.firstName} ${transfer.owner.lastName}${transfer.owner.phone ? `, ${transfer.owner.phone}` : ""}.`}
        actions={
          <>
            <Link
              href="/admin/transfers"
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              К трансферам
            </Link>
            {publicPath ? (
              <Link
                href={publicPath}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary/8 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/12"
              >
                <ArrowUpRight className="h-4 w-4" />
                Открыть на сайте
              </Link>
            ) : null}
          </>
        }
      />

      <form action={saveTransfer} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <AdminPanel title="Карточка трансфера">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Название</span>
                <input
                  name="title"
                  defaultValue={transfer.title ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Статус</span>
                <select name="status" defaultValue={transfer.status} className={adminInputClass}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Вид трансфера</span>
                <input
                  name="transferType"
                  defaultValue={transfer.transferType ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Класс автомобиля</span>
                <input
                  name="vehicleClass"
                  defaultValue={transfer.vehicleClass ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Автомобиль</span>
                <input
                  name="vehicleModel"
                  defaultValue={transfer.vehicleModel ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Мест</span>
                <input
                  name="seats"
                  defaultValue={transfer.seats ?? ""}
                  inputMode="numeric"
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Багаж</span>
                <input
                  name="luggage"
                  defaultValue={transfer.luggage ?? ""}
                  inputMode="numeric"
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Короткое описание</span>
                <textarea
                  name="shortDescription"
                  defaultValue={transfer.shortDescription ?? ""}
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Описание</span>
                <textarea
                  name="description"
                  defaultValue={transfer.description ?? ""}
                  className={adminTextareaClass}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="Локация, маршруты и цена">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Город из справочника</span>
                <select
                  name="locationId"
                  defaultValue={transfer.locationId ?? ""}
                  className={adminInputClass}
                >
                  <option value="">Не выбран</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Город вручную</span>
                <input
                  name="locationName"
                  defaultValue={transfer.locationName ?? transfer.location?.name ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Зона работы</span>
                <input
                  name="serviceArea"
                  defaultValue={transfer.serviceArea ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Примеры маршрутов</span>
                <textarea
                  name="routeExamples"
                  defaultValue={transfer.routeExamples ?? ""}
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Цена от, ₽</span>
                <input
                  name="priceFrom"
                  defaultValue={transfer.priceFrom ? Number(transfer.priceFrom).toString() : ""}
                  inputMode="decimal"
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Единица цены</span>
                <input
                  name="priceUnitLabel"
                  defaultValue={transfer.priceUnitLabel ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Широта</span>
                <input
                  name="latitude"
                  defaultValue={transfer.latitude ? Number(transfer.latitude).toString() : ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Долгота</span>
                <input
                  name="longitude"
                  defaultValue={transfer.longitude ? Number(transfer.longitude).toString() : ""}
                  className={adminInputClass}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="Фото и контакты">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Фотографии автомобиля</span>
                <textarea
                  name="photoUrls"
                  defaultValue={transfer.photoUrls.join("\n")}
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Имя для связи</span>
                <input
                  name="contactName"
                  defaultValue={transfer.contactName ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Телефон</span>
                <input
                  name="phone"
                  defaultValue={transfer.phone ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Второй телефон</span>
                <input
                  name="phone2"
                  defaultValue={transfer.phone2 ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Сайт</span>
                <input
                  name="websiteUrl"
                  defaultValue={transfer.websiteUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">WhatsApp</span>
                <input
                  name="whatsappUrl"
                  defaultValue={transfer.whatsappUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Telegram</span>
                <input
                  name="telegramUrl"
                  defaultValue={transfer.telegramUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">VK</span>
                <input
                  name="vkUrl"
                  defaultValue={transfer.vkUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">MAX</span>
                <input
                  name="maxUrl"
                  defaultValue={transfer.maxUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Одноклассники</span>
                <input
                  name="okUrl"
                  defaultValue={transfer.okUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
            </div>
          </AdminPanel>
        </div>

        <aside className="space-y-4">
          <AdminPanel>
            <div className="overflow-hidden rounded-2xl bg-cream">
              {firstPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firstPhoto}
                  alt={transfer.title ?? "Трансфер"}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center">
                  <Car className="h-8 w-8 text-olive/35" />
                </div>
              )}
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-olive/45">Владелец</dt>
                <dd className="font-semibold text-olive">
                  {transfer.owner.firstName} {transfer.owner.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-olive/45">Отзывы</dt>
                <dd className="font-semibold text-olive">Без рейтинга</dd>
              </div>
            </dl>
          </AdminPanel>

          <AdminPanel title="Модерация">
            <label className="flex items-start gap-3 rounded-2xl bg-cream/70 p-3 text-sm text-olive/70">
              <input
                type="checkbox"
                name="isPublishedVisible"
                defaultChecked={transfer.isPublishedVisible}
                className="mt-1 h-4 w-4 rounded border-olive/25 text-primary focus:ring-primary/20"
              />
              Показывать на сайте, если статус опубликован
            </label>
            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium text-olive">Комментарий модератора</span>
              <textarea
                name="moderationNotes"
                defaultValue={transfer.moderationNotes ?? ""}
                className={adminTextareaClass}
              />
            </label>
            <button
              type="submit"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              <Save className="h-4 w-4" />
              Сохранить
            </button>
          </AdminPanel>
        </aside>
      </form>
    </div>
  );
}
