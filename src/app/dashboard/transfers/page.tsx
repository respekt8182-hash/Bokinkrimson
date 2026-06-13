import { TransferStatus } from "@prisma/client";
import { ArrowRight, Car, CircleCheckBig, CreditCard, Eye, PenLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DashboardListingActions,
  dashboardActionIconClass,
  dashboardDangerActionClass,
  dashboardMainActionClass,
  dashboardSecondaryActionClass,
  dashboardStatsActionClass,
} from "@/components/dashboard/listing-actions";
import {
  DashboardSoftStat,
  DashboardVisualHero,
  DashboardVisualPanel,
} from "@/components/dashboard/dashboard-visual";
import { CreateTransferButton } from "@/components/transfers/create-transfer-button";
import { DeleteTransferButton } from "@/components/transfers/delete-transfer-button";
import { TransferStatsButton } from "@/components/transfers/transfer-stats-button";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { buildPublicTransferPath, createTransferDraft } from "@/lib/public-marketplace";
import { deriveTransferSummaryFromFleet, getTransferFleet } from "@/lib/transfers";

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
  description: string | null;
  transferType: string | null;
  vehicleModel: string | null;
  photoUrls: string[];
  locationName: string | null;
  priceFrom: unknown;
  phone: string | null;
  contactName: string | null;
}): number {
  const stages = [
    Boolean(item.title?.trim()) && Boolean(item.description?.trim()),
    Boolean(item.transferType?.trim()) && Boolean(item.vehicleModel?.trim()),
    item.photoUrls.length > 0,
    Boolean(item.locationName?.trim()),
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
      contactName: currentSession.firstName.trim(),
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
      <DashboardVisualHero
        eyebrow="Услуги в дороге"
        title="Трансферы"
        description="Здесь собраны карточки водителей и автомобилей: черновики, публикация, оплата, рейтинг и статистика. Создайте карточку и заполните ее по шагам."
        image="/dashboard-prof/transfers.png"
        imagePosition="right center"
        action={<CreateTransferButton action={createTransfer} />}
      />

      {transfers.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-primary/30 bg-white/92 p-6 text-olive shadow-[0_22px_70px_rgba(58,43,35,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AppIcon icon={Car} className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Пока нет карточек трансфера</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-olive/65">
                  Создайте первую карточку, добавьте автомобиль, цену, город, фото и контакты
                  водителя.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/transfers?create=1"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Начать создание
              <AppIcon icon={ArrowRight} className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <DashboardVisualPanel className="p-5 sm:p-7">
          <div className="grid gap-4">
            {transfers.map((item, index) => {
              const title = getTransferTitle(item.title);
              const summary = deriveTransferSummaryFromFleet(item);
              const firstPhoto = summary.primaryVehicle?.photoUrl ?? getFirstPhoto(item.photoUrls);
              const completedStages = getCompletedStages(item);
              const fleet = getTransferFleet(item);
              const publicPath =
                item.status === TransferStatus.PUBLISHED
                  ? buildPublicTransferPath({ id: item.id, title: item.title })
                  : null;

              return (
                <article
                  key={item.id}
                  className="rounded-[22px] border border-olive/10 bg-white/96 p-4 shadow-[0_16px_48px_rgba(58,43,35,0.06)] sm:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <Link
                      href={`/dashboard/transfers/${item.id}`}
                      className="flex min-w-0 flex-1 items-start gap-4 rounded-xl transition hover:bg-cream/45 sm:items-center"
                    >
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-cream ring-1 ring-olive/10 sm:h-32 sm:w-48">
                        {firstPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={firstPhoto}
                            alt={title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <AppIcon icon={Car} className="h-5 w-5 text-olive/35" />
                          </div>
                        )}
                        <span className="absolute bottom-3 left-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary shadow-[0_10px_24px_rgba(15,118,110,0.16)]">
                          <AppIcon icon={Car} className="h-5 w-5" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-heading text-2xl font-semibold leading-tight text-olive sm:text-3xl">
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
                        <p className="mt-2 text-sm leading-snug text-olive/60">
                          {item.location?.name ?? item.locationName ?? "Город не указан"} •{" "}
                          {item.vehicleModel ?? item.vehicleClass ?? "Автомобиль не указан"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-olive/65">
                          {item.transferType ? (
                            <span className="rounded-full bg-sage/25 px-2.5 py-1 font-semibold text-olive">
                              {item.transferType}
                            </span>
                          ) : null}
                          {fleet.length > 1 ? (
                            <span className="rounded-full bg-cream px-2.5 py-1 font-semibold text-olive">
                              Автопарк: {fleet.length}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-olive/12 px-2.5 py-1 font-semibold">
                            {(item.priceFrom ?? summary.priceFrom)
                              ? `от ${Number(item.priceFrom ?? summary.priceFrom).toLocaleString("ru-RU")} ₽`
                              : "Цена не указана"}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <div className="flex w-full shrink-0 items-center justify-between gap-2 rounded-2xl border border-olive/10 bg-cream/45 px-3 py-2 lg:w-auto lg:flex-col lg:items-end lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                      <span className="rounded-xl border border-dashed border-olive/18 px-2.5 py-1.5 text-xs font-semibold text-olive/45">
                        {item.reviewsCount > 0 && Number(item.avgRating) > 0
                          ? `${Number(item.avgRating).toFixed(1)} • ${item.reviewsCount} отзывов`
                          : "Пока без рейтинга"}
                      </span>
                      <span className="rounded-full border border-olive/15 px-3 py-1 text-xs font-semibold text-olive/75">
                        #{index + 1}
                      </span>
                      {item.publicId ? (
                        <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                          ID {item.publicId}
                        </span>
                      ) : null}
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

                  <DashboardListingActions
                    updatedAt={new Date(item.updatedAt).toLocaleString("ru-RU")}
                    primaryActions={
                      publicPath ? (
                        <>
                          <Link href={publicPath} className={dashboardMainActionClass}>
                            <AppIcon icon={Eye} className={dashboardActionIconClass} />
                            Публичная страница
                          </Link>
                          <TransferStatsButton
                            transferId={item.id}
                            transferTitle={title}
                            className={dashboardStatsActionClass}
                          />
                        </>
                      ) : null
                    }
                    secondaryActions={
                      <>
                        <Link
                          href={`/dashboard/transfers/${item.id}`}
                          className={dashboardSecondaryActionClass}
                        >
                          <AppIcon icon={PenLine} className={dashboardActionIconClass} />
                          Редактирование
                        </Link>
                        <Link
                          href={`/dashboard/transfers/${item.id}?step=publish`}
                          className={dashboardSecondaryActionClass}
                        >
                          <AppIcon icon={CreditCard} className={dashboardActionIconClass} />
                          Оплата
                        </Link>
                        <DeleteTransferButton
                          transferId={item.id}
                          transferTitle={title}
                          transferStatus={item.status}
                          buttonClassName={dashboardDangerActionClass}
                          label="Удалить"
                        />
                      </>
                    }
                  />
                </article>
              );
            })}
          </div>
        </DashboardVisualPanel>
      )}

      {publishedCount > 0 ? (
        <DashboardSoftStat icon={<AppIcon icon={Car} className="h-5 w-5" />}>
          Опубликовано трансферов: {publishedCount}
        </DashboardSoftStat>
      ) : null}
    </div>
  );
}
