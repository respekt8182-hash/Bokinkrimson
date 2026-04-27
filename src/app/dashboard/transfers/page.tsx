import { TransferStatus } from "@prisma/client";
import { Car, CircleCheckBig, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { buildPublicTransferPath, createTransferDraft } from "@/lib/public-marketplace";

const STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<TransferStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_MODERATION: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

function getTransferTitle(title: string | null): string {
  return title?.trim() || "Новый трансфер";
}

function getFirstPhoto(photoUrls: string[]): string | null {
  return photoUrls.map((url) => url.trim()).find(Boolean) ?? null;
}

function getCompletedStages(item: {
  title: string | null;
  shortDescription: string | null;
  transferType: string | null;
  vehicleModel: string | null;
  photoUrls: string[];
  locationName: string | null;
  serviceArea: string | null;
  priceFrom: unknown;
  phone: string | null;
  contactName: string | null;
}): number {
  const stages = [
    Boolean(item.title?.trim()) && Boolean(item.shortDescription?.trim()),
    Boolean(item.transferType?.trim()) && Boolean(item.vehicleModel?.trim()),
    item.photoUrls.length > 0,
    Boolean(item.locationName?.trim()) || Boolean(item.serviceArea?.trim()),
    Boolean(item.priceFrom) && Boolean(item.phone?.trim()) && Boolean(item.contactName?.trim()),
  ];

  let completed = 0;
  for (const stage of stages) {
    if (!stage) break;
    completed += 1;
  }
  return completed;
}

export default async function DashboardTransfersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/transfers");
  }

  async function createTransfer(formData: FormData) {
    "use server";

    const currentSession = await getSession();
    if (!currentSession) {
      redirect("/auth/login?next=/dashboard/transfers");
    }

    const created = await createTransferDraft({
      ownerId: currentSession.id,
      title: (formData.get("title") as string | null)?.trim() || null,
      contactName: `${currentSession.firstName} ${currentSession.lastName}`.trim(),
      phone: currentSession.phone,
    });

    redirect(`/dashboard/transfers/${created.id}`);
  }

  const transfers = await db.transfer.findMany({
    where: { ownerId: session.id },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      location: { select: { name: true } },
    },
  });

  const publishedCount = transfers.filter(
    (item) => item.status === TransferStatus.PUBLISHED,
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-olive">Трансферы</h1>
          <p className="mt-1 text-sm text-olive/64">
            Карточки водителей и автомобилей для каталога трансферов.
          </p>
        </div>

        <form action={createTransfer} className="flex flex-col gap-2 sm:flex-row">
          <input
            name="title"
            placeholder="Например: Трансфер из аэропорта"
            className="h-11 rounded-xl border border-olive/15 bg-white px-3 text-sm text-olive outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/10"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <AppIcon icon={Plus} className="h-4 w-4" />
            Создать
          </button>
        </form>
      </div>

      {transfers.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-olive/25 bg-cream/70 p-6 text-sm leading-6 text-olive/70">
          Пока нет карточек трансфера. Создайте первую, добавьте автомобиль, цену, город, фото и
          контакты водителя.
        </section>
      ) : (
        <div className="grid gap-3">
          {transfers.map((item, index) => {
            const title = getTransferTitle(item.title);
            const firstPhoto = getFirstPhoto(item.photoUrls);
            const completedStages = getCompletedStages(item);
            const publicPath =
              item.status === TransferStatus.PUBLISHED
                ? buildPublicTransferPath({ id: item.id, title: item.title })
                : null;

            return (
              <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Link
                    href={`/dashboard/transfers/${item.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-xl transition hover:bg-cream/45"
                  >
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-cream ring-1 ring-olive/10">
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={firstPhoto} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <AppIcon icon={Car} className="h-5 w-5 text-olive/35" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold leading-tight text-olive sm:text-xl">
                          {title}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            STATUS_COLORS[item.status],
                          )}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-snug text-olive/60">
                        {item.location?.name ?? item.locationName ?? "Город не указан"} •{" "}
                        {item.vehicleModel ?? item.vehicleClass ?? "Автомобиль не указан"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-olive/65">
                        {item.transferType ? (
                          <span className="rounded-full bg-sage/25 px-2.5 py-1 font-semibold text-olive">
                            {item.transferType}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-olive/12 px-2.5 py-1 font-semibold">
                          {item.priceFrom
                            ? `от ${Number(item.priceFrom).toLocaleString("ru-RU")} ₽`
                            : "Цена не указана"}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <span className="rounded-xl border border-dashed border-olive/18 px-2.5 py-1.5 text-xs font-semibold text-olive/45">
                      Без рейтинга
                    </span>
                    <span className="rounded-full border border-olive/15 px-3 py-1 text-xs font-semibold text-olive/75">
                      #{index + 1}
                    </span>
                  </div>
                </div>

                {item.status !== TransferStatus.PUBLISHED ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-olive/65">
                      <span>Готовность карточки</span>
                      {completedStages >= 5 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                          <AppIcon icon={CircleCheckBig} className="h-4 w-4" />
                          5/5
                        </span>
                      ) : (
                        <span>{completedStages}/5</span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3, 4].map((stageIndex) => (
                        <div
                          key={stageIndex}
                          className={cn(
                            "h-2 flex-1 rounded-full",
                            stageIndex < completedStages
                              ? "bg-primary"
                              : "bg-cream ring-1 ring-inset ring-olive/20",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.moderationNotes ? (
                  <p className="mt-3 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                    Комментарий модератора: {item.moderationNotes}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-olive/60">
                    Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/transfers/${item.id}`}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                    >
                      Карточка
                    </Link>
                    {publicPath ? (
                      <Link
                        href={publicPath}
                        className="rounded-xl border border-primary/35 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5"
                      >
                        Публичная страница
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {publishedCount > 0 ? (
        <p className="text-xs text-olive/65">Опубликовано трансферов: {publishedCount}</p>
      ) : null}
    </div>
  );
}
