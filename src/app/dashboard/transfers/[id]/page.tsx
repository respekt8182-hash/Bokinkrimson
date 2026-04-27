import { Prisma, TransferStatus } from "@prisma/client";
import { Car, CircleCheckBig, ImageIcon, MapPin, Send } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPublicTransferPath, buildTransferSlug } from "@/lib/public-marketplace";

type DashboardTransferPageProps = {
  params: Promise<{ id: string }>;
};

const inputClass =
  "w-full rounded-2xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

const textareaClass = `${inputClass} min-h-[120px] resize-y`;

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

function getFirstPhoto(photoUrls: string[]): string | null {
  return photoUrls.map((url) => url.trim()).find(Boolean) ?? null;
}

function isReadyForModeration(transfer: {
  title: string | null;
  shortDescription: string | null;
  transferType: string | null;
  vehicleModel: string | null;
  locationName: string | null;
  serviceArea: string | null;
  priceFrom: unknown;
  contactName: string | null;
  phone: string | null;
  photoUrls: string[];
}): boolean {
  return (
    Boolean(transfer.title?.trim()) &&
    Boolean(transfer.shortDescription?.trim()) &&
    Boolean(transfer.transferType?.trim()) &&
    Boolean(transfer.vehicleModel?.trim()) &&
    (Boolean(transfer.locationName?.trim()) || Boolean(transfer.serviceArea?.trim())) &&
    Boolean(transfer.priceFrom) &&
    Boolean(transfer.contactName?.trim()) &&
    Boolean(transfer.phone?.trim()) &&
    transfer.photoUrls.length > 0
  );
}

export default async function DashboardTransferEditPage({ params }: DashboardTransferPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/transfers");
  }

  const { id } = await params;
  const [transfer, locations] = await Promise.all([
    db.transfer.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
      },
    }),
    db.excursionLocation.findMany({
      orderBy: [{ isMajor: "desc" }, { name: "asc" }],
      select: { id: true, name: true, districtId: true },
    }),
  ]);

  if (!transfer || transfer.ownerId !== session.id) {
    notFound();
  }

  async function saveTransfer(formData: FormData) {
    "use server";

    const currentSession = await getSession();
    if (!currentSession) {
      redirect("/auth/login?next=/dashboard/transfers");
    }

    const current = await db.transfer.findUnique({
      where: { id },
      select: { ownerId: true, status: true },
    });

    if (!current || current.ownerId !== currentSession.id) {
      notFound();
    }

    const locationId = formString(formData, "locationId");
    const selectedLocation = locationId
      ? await db.excursionLocation.findUnique({
          where: { id: locationId },
          select: { name: true, districtId: true },
        })
      : null;
    const title = formString(formData, "title") ?? "Новый трансфер";
    const photoUrls = parsePhotoUrls(formString(formData, "photoUrls"));
    const intent = formString(formData, "intent");
    const nextStatus = intent === "submit" ? TransferStatus.PENDING_MODERATION : current.status;

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
        photoUrls,
        contactName: formString(formData, "contactName"),
        phone: formString(formData, "phone"),
        phone2: formString(formData, "phone2"),
        websiteUrl: formString(formData, "websiteUrl"),
        whatsappUrl: formString(formData, "whatsappUrl"),
        telegramUrl: formString(formData, "telegramUrl"),
        vkUrl: formString(formData, "vkUrl"),
        maxUrl: formString(formData, "maxUrl"),
        okUrl: formString(formData, "okUrl"),
        status: nextStatus,
        moderationNotes: intent === "submit" ? null : undefined,
      },
    });

    redirect(`/dashboard/transfers/${id}?saved=1`);
  }

  const title = transfer.title?.trim() || "Новый трансфер";
  const firstPhoto = getFirstPhoto(transfer.photoUrls);
  const publicPath =
    transfer.status === TransferStatus.PUBLISHED
      ? buildPublicTransferPath({ id: transfer.id, title: transfer.title })
      : null;
  const ready = isReadyForModeration(transfer);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/transfers"
            className="text-sm font-semibold text-terra hover:underline"
          >
            Все трансферы
          </Link>
          <h1 className="mt-2 text-3xl text-olive">{title}</h1>
          <p className="mt-1 text-sm text-olive/64">Статус: {STATUS_LABELS[transfer.status]}</p>
        </div>
        {publicPath ? (
          <Link
            href={publicPath}
            className="inline-flex items-center justify-center rounded-xl border border-primary/28 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/7"
          >
            Публичная страница
          </Link>
        ) : null}
      </div>

      {transfer.moderationNotes ? (
        <div className="rounded-2xl bg-terra/10 px-4 py-3 text-sm leading-6 text-olive/85">
          Комментарий модератора: {transfer.moderationNotes}
        </div>
      ) : null}

      <form action={saveTransfer} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <section className="rounded-[26px] border border-olive/10 bg-white p-5">
            <div className="flex items-center gap-2">
              <AppIcon icon={Car} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">Автомобиль и услуга</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Название карточки</span>
                <input name="title" defaultValue={transfer.title ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Вид трансфера</span>
                <input
                  name="transferType"
                  defaultValue={transfer.transferType ?? ""}
                  placeholder="Аэропорт, междугородний, VIP"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Класс автомобиля</span>
                <input
                  name="vehicleClass"
                  defaultValue={transfer.vehicleClass ?? ""}
                  placeholder="Комфорт, минивэн, бизнес"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Автомобиль</span>
                <input
                  name="vehicleModel"
                  defaultValue={transfer.vehicleModel ?? ""}
                  placeholder="Hyundai Solaris, Mercedes Vito"
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Мест</span>
                  <input
                    name="seats"
                    defaultValue={transfer.seats ?? ""}
                    inputMode="numeric"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Багаж</span>
                  <input
                    name="luggage"
                    defaultValue={transfer.luggage ?? ""}
                    inputMode="numeric"
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Короткое описание</span>
                <textarea
                  name="shortDescription"
                  defaultValue={transfer.shortDescription ?? ""}
                  placeholder="1-2 предложения, которые будут видны в каталоге"
                  className={textareaClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Описание</span>
                <textarea
                  name="description"
                  defaultValue={transfer.description ?? ""}
                  placeholder="Опыт, условия поездки, детское кресло, ожидание, встреча с табличкой"
                  className={textareaClass}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[26px] border border-olive/10 bg-white p-5">
            <div className="flex items-center gap-2">
              <AppIcon icon={MapPin} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">География и цена</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Город из справочника</span>
                <select
                  name="locationId"
                  defaultValue={transfer.locationId ?? ""}
                  className={inputClass}
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
                  placeholder="Если города нет в справочнике"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Зона работы</span>
                <input
                  name="serviceArea"
                  defaultValue={transfer.serviceArea ?? ""}
                  placeholder="Симферополь, Ялта, Алушта, весь Крым"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Примеры маршрутов</span>
                <textarea
                  name="routeExamples"
                  defaultValue={transfer.routeExamples ?? ""}
                  placeholder="Аэропорт Симферополь - Ялта, Севастополь - Форос"
                  className={textareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Цена от, ₽</span>
                <input
                  name="priceFrom"
                  defaultValue={transfer.priceFrom ? Number(transfer.priceFrom).toString() : ""}
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Единица цены</span>
                <input
                  name="priceUnitLabel"
                  defaultValue={transfer.priceUnitLabel ?? "/ поездка"}
                  placeholder="/ поездка, / км, / час"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Широта метки</span>
                <input
                  name="latitude"
                  defaultValue={transfer.latitude ? Number(transfer.latitude).toString() : ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Долгота метки</span>
                <input
                  name="longitude"
                  defaultValue={transfer.longitude ? Number(transfer.longitude).toString() : ""}
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[26px] border border-olive/10 bg-white p-5">
            <div className="flex items-center gap-2">
              <AppIcon icon={ImageIcon} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">Фото и контакты</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Фото автомобиля</span>
                <textarea
                  name="photoUrls"
                  defaultValue={transfer.photoUrls.join("\n")}
                  placeholder="Ссылки на фото, каждая с новой строки"
                  className={textareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Имя для связи</span>
                <input
                  name="contactName"
                  defaultValue={
                    transfer.contactName ?? `${session.firstName} ${session.lastName}`.trim()
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Телефон</span>
                <input
                  name="phone"
                  defaultValue={transfer.phone ?? session.phone}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Второй телефон</span>
                <input name="phone2" defaultValue={transfer.phone2 ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Сайт</span>
                <input
                  name="websiteUrl"
                  defaultValue={transfer.websiteUrl ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">WhatsApp</span>
                <input
                  name="whatsappUrl"
                  defaultValue={transfer.whatsappUrl ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Telegram</span>
                <input
                  name="telegramUrl"
                  defaultValue={transfer.telegramUrl ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">VK</span>
                <input name="vkUrl" defaultValue={transfer.vkUrl ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">MAX</span>
                <input name="maxUrl" defaultValue={transfer.maxUrl ?? ""} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Одноклассники</span>
                <input name="okUrl" defaultValue={transfer.okUrl ?? ""} className={inputClass} />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-[26px] border border-olive/10 bg-white">
            <div className="aspect-[16/10] bg-cream">
              {firstPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstPhoto} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-olive/45">
                  Фото автомобиля
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-olive">{title}</p>
              <p className="mt-1 text-xs leading-5 text-olive/58">
                Так карточка будет собираться в каталоге: фото, короткое описание, цена и быстрый
                звонок.
              </p>
            </div>
          </section>

          <section className="rounded-[26px] border border-olive/10 bg-white p-5">
            <div className="flex items-center gap-2">
              <AppIcon icon={ready ? CircleCheckBig : Send} className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-olive">Публикация</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-olive/62">
              После отправки администратор проверит карточку. Цена размещения трансфера на сайте:
              2000 ₽.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="submit"
                name="intent"
                value="save"
                className="rounded-xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/22 hover:text-primary"
              >
                Сохранить
              </button>
              <button
                type="submit"
                name="intent"
                value="submit"
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                Отправить на модерацию
              </button>
            </div>
          </section>
        </aside>
      </form>
    </div>
  );
}
