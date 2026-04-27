import { AttractionStatus, Prisma } from "@prisma/client";
import { ArrowUpRight, Camera, MapPin, Save } from "lucide-react";
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
import { buildAttractionSlug, buildPublicAttractionPath } from "@/lib/public-marketplace";

type AdminAttractionEditPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<AttractionStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  HIDDEN: "Скрыто",
};

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
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

function parseStatus(value: string | null): AttractionStatus {
  if (value === AttractionStatus.PUBLISHED || value === AttractionStatus.HIDDEN) {
    return value;
  }

  return AttractionStatus.DRAFT;
}

export default async function AdminAttractionEditPage({ params }: AdminAttractionEditPageProps) {
  const { id } = await params;
  const [attraction, locations] = await Promise.all([
    db.attraction.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
        district: { select: { name: true } },
      },
    }),
    db.excursionLocation.findMany({
      orderBy: [{ isMajor: "desc" }, { name: "asc" }],
      select: { id: true, name: true, districtId: true },
    }),
  ]);

  if (!attraction) {
    notFound();
  }

  async function saveAttraction(formData: FormData) {
    "use server";

    const admin = await verifyAdminSession();
    if (!admin) {
      redirect("/admin/login");
    }

    const current = await db.attraction.findUnique({
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
    const title = formString(formData, "title") ?? "Достопримечательность";
    const status = parseStatus(formString(formData, "status"));

    await db.attraction.update({
      where: { id },
      data: {
        title,
        slug: buildAttractionSlug(title, id),
        category: formString(formData, "category"),
        locationId,
        locationName: selectedLocation?.name ?? formString(formData, "locationName"),
        districtId: selectedLocation?.districtId ?? null,
        address: formString(formData, "address"),
        latitude: formCoordinate(formData, "latitude"),
        longitude: formCoordinate(formData, "longitude"),
        shortDescription: formString(formData, "shortDescription"),
        description: formString(formData, "description"),
        photoUrls: parsePhotoUrls(formString(formData, "photoUrls")),
        websiteUrl: formString(formData, "websiteUrl"),
        status,
        isPublishedVisible: formData.get("isPublishedVisible") === "on",
        publishedAt:
          status === AttractionStatus.PUBLISHED ? (current.publishedAt ?? new Date()) : null,
        createdByLogin: admin.login,
      },
    });

    redirect(`/admin/attractions/${id}?saved=1`);
  }

  const publicPath =
    attraction.status === AttractionStatus.PUBLISHED && attraction.isPublishedVisible
      ? buildPublicAttractionPath({ id: attraction.id, title: attraction.title })
      : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Достопримечательности"
        title={attraction.title || "Достопримечательность без названия"}
        description={`Статус: ${STATUS_LABELS[attraction.status]}. Заполняется вручную администратором и показывается в публичном каталоге после публикации.`}
        actions={
          <>
            <Link
              href="/admin/attractions"
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              К каталогу
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

      <form action={saveAttraction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <AdminPanel title="Карточка места">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Название</span>
                <input name="title" defaultValue={attraction.title} className={adminInputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Категория</span>
                <input
                  name="category"
                  defaultValue={attraction.category ?? ""}
                  placeholder="Природа, дворцы, парки, общественные места"
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Статус</span>
                <select name="status" defaultValue={attraction.status} className={adminInputClass}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Короткое описание</span>
                <textarea
                  name="shortDescription"
                  defaultValue={attraction.shortDescription ?? ""}
                  placeholder="Короткий текст для карточки в каталоге"
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Полное описание</span>
                <textarea
                  name="description"
                  defaultValue={attraction.description ?? ""}
                  placeholder="Описание места, особенности, что посмотреть рядом"
                  className={adminTextareaClass}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="Локация">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Город из справочника</span>
                <select
                  name="locationId"
                  defaultValue={attraction.locationId ?? ""}
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
                  defaultValue={attraction.locationName ?? attraction.location?.name ?? ""}
                  placeholder="Если места нет в справочнике"
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Адрес или ориентир</span>
                <input
                  name="address"
                  defaultValue={attraction.address ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Широта</span>
                <input
                  name="latitude"
                  defaultValue={attraction.latitude ? Number(attraction.latitude).toString() : ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Долгота</span>
                <input
                  name="longitude"
                  defaultValue={attraction.longitude ? Number(attraction.longitude).toString() : ""}
                  className={adminInputClass}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="Медиа и ссылки">
            <div className="grid gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Фотографии</span>
                <textarea
                  name="photoUrls"
                  defaultValue={attraction.photoUrls.join("\n")}
                  placeholder="Ссылки на фото, каждая с новой строки"
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Сайт</span>
                <input
                  name="websiteUrl"
                  defaultValue={attraction.websiteUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
            </div>
          </AdminPanel>
        </div>

        <aside className="space-y-4">
          <AdminPanel>
            <div className="overflow-hidden rounded-2xl bg-cream">
              {attraction.photoUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attraction.photoUrls[0]}
                  alt={attraction.title}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center">
                  <Camera className="h-8 w-8 text-olive/35" />
                </div>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm text-olive/62">
              <p>
                Карточка в публичном каталоге будет выглядеть как экскурсионная: крупное фото,
                категория, город, короткое описание и переход на подробную страницу.
              </p>
              <p className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-olive/65">
                <MapPin className="h-4 w-4" />
                {attraction.location?.name ?? attraction.locationName ?? "Локация не указана"}
              </p>
            </div>
          </AdminPanel>

          <AdminPanel title="Публикация">
            <label className="flex items-start gap-3 rounded-2xl bg-cream/70 p-3 text-sm text-olive/70">
              <input
                type="checkbox"
                name="isPublishedVisible"
                defaultChecked={attraction.isPublishedVisible}
                className="mt-1 h-4 w-4 rounded border-olive/25 text-primary focus:ring-primary/20"
              />
              Показывать на сайте, если статус опубликован
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
