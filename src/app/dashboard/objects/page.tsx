// Next.js page for route /dashboard/objects.
import { PaymentStatus, ReviewStatus } from "@prisma/client";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleCheckBig,
  CreditCard,
  Eye,
  MessageCircle,
  PenLine,
  Star,
} from "lucide-react";
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
import { CreatePropertyButton } from "@/components/objects/create-property-button";
import { DeletePropertyButton } from "@/components/objects/delete-property-button";
import { StatsButton } from "@/components/objects/stats-button";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { loadDashboardPageData } from "@/lib/dashboard-page-db";
import { getObjectPaymentDisplay } from "@/lib/object-placement-status";
import {
  getPropertyWorkflowStatus,
  type PropertyProgress,
  serializeProperty,
} from "@/lib/properties";
import { buildPublicPropertyPath } from "@/lib/public-properties";

function getCompletedDashboardStages(progress: PropertyProgress): number {
  const stages = [
    progress.step1 && progress.step3,
    progress.step4 && progress.step5,
    progress.step6 && progress.step7,
    progress.step8 && progress.step9,
    progress.step10,
  ];

  let completed = 0;
  for (const stage of stages) {
    if (!stage) break;
    completed += 1;
  }

  return completed;
}

function getUtcDayStart(input: Date): number {
  return Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
}

export default async function DashboardObjectsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/objects");
  }

  const { properties, reviewStats } = await loadDashboardPageData(
    {
      contextId: "dashboard-objects",
      pageLabel: "Objects dashboard",
      fallbackDescription: "Showing empty state.",
    },
    async () => {
      const properties = await db.property.findMany({
        where: { ownerId: session.id, ownerDeletedAt: null },
        orderBy: [{ updatedAt: "desc" }],
        include: {
          media: {
            where: { roomId: null },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          rooms: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              prices: {
                orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  dateFrom: true,
                  dateTo: true,
                  price: true,
                  currency: true,
                },
              },
            },
          },
          amenities: {
            include: {
              amenity: true,
            },
          },
          customAmenities: true,
          payments: {
            where: {
              ownerId: session.id,
              status: PaymentStatus.SUCCEEDED,
            },
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              amount: true,
              tariffCode: true,
              tariffType: true,
              paidFrom: true,
              paidAt: true,
              createdAt: true,
              placementValidUntil: true,
              providerPayload: true,
            },
          },
        },
      });

      const propertyIds = properties.map((property) => property.id);
      const reviewStats =
        propertyIds.length > 0
          ? await db.review.groupBy({
              by: ["propertyId"],
              where: {
                propertyId: { in: propertyIds },
                status: ReviewStatus.ACTIVE,
                deletedAt: null,
              },
              _avg: { rating: true },
              _count: { id: true },
            })
          : [];

      return { properties, reviewStats };
    },
    { properties: [], reviewStats: [] },
  );
  const reviewStatsByPropertyId = new Map(
    reviewStats.map((s) => [s.propertyId!, { avg: s._avg.rating, count: s._count.id }]),
  );

  const items = properties.map((item) => serializeProperty(item));
  const todayUtcMs = getUtcDayStart(new Date());
  const paymentDisplayByPropertyId = new Map(
    properties.map((property) => {
      const latestSucceededPayment = property.payments[0] ?? null;
      const paymentDisplay = getObjectPaymentDisplay({
        paymentStatus: property.paymentStatus,
        tariffType: property.tariffType,
        paidFrom: property.paidFrom,
        paidUntil: property.paidUntil,
        paidAmount: property.paidAmount,
        paidAt: property.paidAt,
        latestPayment: latestSucceededPayment,
      });

      return [property.id, paymentDisplay] as const;
    }),
  );
  const workflowStatusByPropertyId = new Map(
    items.map((item) => [item.id, getPropertyWorkflowStatus(item.status, item.pendingEditStatus)]),
  );
  const publishedCount = items.filter(
    (item) => workflowStatusByPropertyId.get(item.id) === "PUBLISHED",
  ).length;

  return (
    <div className="space-y-5">
      <DashboardVisualHero
        eyebrow="Размещение объявлений"
        title="Недвижимость"
        description="Здесь собраны ваши объявления о жилье: черновики, опубликованные карточки, оплата и статистика. Откройте объявление, чтобы заполнить данные и отправить его на публикацию."
        image="/dashboard-prof/objects.png"
        imagePosition="right center"
        action={<CreatePropertyButton />}
      />

      {items.length === 0 ? (
        <div
          id="objects-list"
          className="rounded-[24px] border border-dashed border-primary/30 bg-white/92 p-6 text-olive shadow-[0_22px_70px_rgba(58,43,35,0.08)]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AppIcon icon={Building2} className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Пока нет объявлений о недвижимости</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-olive/65">
                  Создайте первое объявление. После этого откроется редактор с шагами: основные
                  данные, локация, контакты, фото, номера и оплата публикации.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/objects?create=1"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Начать размещение
              <AppIcon icon={ArrowRight} className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <DashboardVisualPanel className="p-5 sm:p-7">
          <div id="objects-list" className="grid gap-4">
            {items.map((item) => {
              const firstImage = item.media.find((mediaItem) => mediaItem.type === "IMAGE") ?? null;
              const completedStages = getCompletedDashboardStages(item.progress);
              const isDone = completedStages >= 5;
              const paymentDisplay = paymentDisplayByPropertyId.get(item.id) ?? null;
              const publicationUntilDate = paymentDisplay?.paidUntil ?? null;
              const publicationUntilLabel =
                paymentDisplay?.status === "demo"
                  ? (publicationUntilDate?.toLocaleDateString("ru-RU") ?? null)
                  : (publicationUntilDate?.toLocaleDateString("ru-RU") ?? null);
              const publicationCaption =
                paymentDisplay?.status === "expired" && publicationUntilDate
                  ? "Требует оплаты с"
                  : paymentDisplay?.status === "unpaid" && publicationUntilDate
                    ? "Не оплачено с"
                    : paymentDisplay?.status === "demo"
                      ? "Тестовый период до"
                      : "Размещается до";
              const daysLeft = publicationUntilDate
                ? Math.ceil((publicationUntilDate.getTime() - todayUtcMs) / 86400000)
                : null;
              const publicationExpired = daysLeft !== null && daysLeft < 0;
              const publicationSoon = daysLeft !== null && !publicationExpired && daysLeft <= 30;
              const publicPath = buildPublicPropertyPath({
                id: item.id,
                locationId: item.locationId,
                name: item.name,
              });
              const stats = reviewStatsByPropertyId.get(item.id) ?? null;
              const avgRating = stats ? Number(stats.avg ?? 0) : 0;
              const reviewCount = stats?.count ?? 0;

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[22px] border border-olive/10 bg-white/96 p-4 shadow-[0_16px_48px_rgba(58,43,35,0.06)] sm:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <Link
                      href={`/dashboard/objects/${item.id}/about`}
                      className="flex w-full min-w-0 flex-1 items-start gap-4 rounded-xl transition hover:bg-cream/45 sm:items-center"
                    >
                      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-cream ring-1 ring-olive/10 sm:h-32 sm:w-44">
                        {firstImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={firstImage.url}
                            alt={item.name ?? "Недвижимость"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[11px] text-olive/50">
                            Фото
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-1">
                        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive sm:text-3xl">
                          {item.name ?? "Новое объявление"}
                        </h2>
                        <p className="mt-2 text-sm leading-snug text-olive/60">
                          {item.locationName ?? "Локация не выбрана"} •{" "}
                          {item.typeLabel ?? "Тип не указан"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="inline-flex rounded-full bg-sage/25 px-2.5 py-1 text-[11px] font-semibold text-olive">
                            {item.statusLabel}
                          </span>
                          {item.publicId ? (
                            <span className="inline-flex rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-olive/65">
                              ID {item.publicId}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-olive/10 bg-cream/45 px-3 py-2 lg:w-auto lg:flex-col lg:items-end lg:justify-start lg:gap-2 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => {
                          const fill = Math.min(1, Math.max(0, avgRating - (i - 1)));
                          const pct = Math.round(fill * 100);
                          return (
                            <svg
                              key={i}
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            >
                              <defs>
                                <clipPath id={`star-fill-${item.id}-${i}`}>
                                  <rect x="0" y="0" width={`${pct}%`} height="24" />
                                </clipPath>
                              </defs>
                              <path
                                d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
                                fill="none"
                                stroke={
                                  reviewCount > 0 ? "var(--color-sage)" : "var(--color-olive)"
                                }
                                strokeWidth="1.65"
                                strokeOpacity={reviewCount > 0 ? 0.5 : 0.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {pct > 0 && (
                                <path
                                  d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
                                  fill="var(--color-sage)"
                                  stroke="none"
                                  clipPath={`url(#star-fill-${item.id}-${i})`}
                                />
                              )}
                            </svg>
                          );
                        })}
                      </div>
                      {reviewCount > 0 ? (
                        <>
                          <div className="flex items-center gap-1 rounded-xl bg-sage/20 px-2.5 py-1.5">
                            <AppIcon icon={Star} className="h-3.5 w-3.5 fill-sage text-sage" />
                            <span className="text-sm font-bold leading-none text-olive">
                              {avgRating.toFixed(1)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-olive/50">
                            <AppIcon icon={MessageCircle} className="h-3.5 w-3.5" />
                            <span className="text-xs leading-none">{reviewCount}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 rounded-xl border border-dashed border-olive/20 px-2.5 py-1.5">
                          <AppIcon icon={Star} className="h-3.5 w-3.5 text-olive/30" />
                          <span className="text-xs text-olive/35">Нет отзывов</span>
                        </div>
                      )}
                    </div>
                    {publicationUntilDate && publicationUntilLabel ? (
                      <div
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl border px-3 py-1.5 sm:w-auto",
                          publicationExpired
                            ? "border-red-200 bg-red-50"
                            : publicationSoon
                              ? "border-amber-200 bg-amber-50"
                              : "border-emerald-200 bg-emerald-50",
                        )}
                      >
                        <AppIcon
                          icon={CalendarDays}
                          className={cn(
                            "h-4 w-4 shrink-0",
                            publicationExpired
                              ? "text-red-500"
                              : publicationSoon
                                ? "text-amber-500"
                                : "text-emerald-600",
                          )}
                        />
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-[10px] leading-none",
                              publicationExpired
                                ? "text-red-400"
                                : publicationSoon
                                  ? "text-amber-500"
                                  : "text-emerald-500",
                            )}
                          >
                            {publicationCaption}
                          </p>
                          <p
                            className={cn(
                              "text-xs font-bold leading-snug",
                              publicationExpired
                                ? "text-red-600"
                                : publicationSoon
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                            )}
                          >
                            {publicationUntilLabel}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!publicationUntilDate && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-olive/65">
                        <span>Готовность</span>
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                            <AppIcon icon={CircleCheckBig} className="h-4 w-4" />
                            5/5
                          </span>
                        ) : (
                          <span>{completedStages}/5</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-2 flex-1 rounded-full transition-all duration-300",
                              i < completedStages
                                ? isDone
                                  ? "bg-sky-500"
                                  : "bg-primary"
                                : "bg-cream ring-1 ring-inset ring-olive/20",
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {item.moderationNotes ? (
                    <p className="mt-3 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                      {item.moderationNotes}
                    </p>
                  ) : null}

                  <DashboardListingActions
                    updatedAt={new Date(item.updatedAt).toLocaleString("ru-RU")}
                    primaryActions={
                      item.status === "PUBLISHED" ? (
                        <>
                          <Link href={publicPath} className={dashboardMainActionClass}>
                            <AppIcon icon={Eye} className={dashboardActionIconClass} />
                            Публичная страница
                          </Link>
                          <StatsButton
                            propertyId={item.id}
                            propertyName={item.name ?? "Недвижимость"}
                            className={dashboardStatsActionClass}
                          />
                        </>
                      ) : null
                    }
                    secondaryActions={
                      <>
                        <Link
                          href={`/dashboard/objects/${item.id}/about`}
                          className={dashboardSecondaryActionClass}
                        >
                          <AppIcon icon={PenLine} className={dashboardActionIconClass} />
                          Редактировать
                        </Link>
                        <Link
                          href={`/dashboard/objects/${item.id}/payment`}
                          className={dashboardSecondaryActionClass}
                        >
                          <AppIcon icon={CreditCard} className={dashboardActionIconClass} />
                          Оплата
                        </Link>
                        <DeletePropertyButton
                          propertyId={item.id}
                          propertyName={item.name ?? "Новое объявление"}
                          propertyStatus={item.status}
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
        <DashboardSoftStat icon={<AppIcon icon={Building2} className="h-5 w-5" />}>
          Опубликовано объявлений: {publishedCount}
        </DashboardSoftStat>
      ) : null}
    </div>
  );
}
