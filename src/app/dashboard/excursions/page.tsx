import { ExcursionOfferType, ExcursionSessionStatus, ExcursionStatus } from "@prisma/client";
import { CircleCheckBig, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateExcursionButton } from "@/components/excursions/create-excursion-button";
import { DeleteExcursionButton } from "@/components/excursions/delete-excursion-button";
import { ExcursionStatsButton } from "@/components/excursions/excursion-stats-button";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { loadDashboardPageData } from "@/lib/dashboard-page-db";
import {
  buildProgramRouteSummary,
  formatAvailabilitySummary,
  formatProgramDuration,
  formatProgramPrice,
  getOfferTypeLabel,
} from "@/lib/excursion-offers";
import { type SerializedExcursion, serializeExcursion } from "@/lib/excursions";
import { buildPublicExcursionPath } from "@/lib/public-excursions";

type DashboardExcursionsPageProps = {
  searchParams: Promise<{ type?: string; status?: string }>;
};

function getExcursionTitle(item: SerializedExcursion): string {
  if (item.title?.trim()) {
    return item.title;
  }

  return item.offerType === ExcursionOfferType.TOUR ? "Новый тур" : "Новая экскурсия";
}

function hasOrganizerContacts(item: SerializedExcursion): boolean {
  return (
    Boolean(item.contactFirstName?.trim()) &&
    Boolean(item.contactLastName?.trim()) &&
    Boolean(item.contactPhone?.trim())
  );
}

function hasScheduleInfo(item: SerializedExcursion): boolean {
  if (item.availabilityMode === "ON_REQUEST") {
    return Boolean(item.availabilityNote?.trim());
  }

  return Boolean(item.scheduleText?.trim()) || Boolean(item.availabilityNote?.trim());
}

function hasProgramOutline(item: SerializedExcursion): boolean {
  if (item.offerType === ExcursionOfferType.TOUR) {
    return item.itineraryDays.length > 0 || Boolean(item.routeDescription?.trim());
  }

  return item.timeline.length > 0 || Boolean(item.routeDescription?.trim());
}

function hasDuration(item: SerializedExcursion): boolean {
  if (item.offerType === ExcursionOfferType.TOUR) {
    return (
      Number(item.durationDays ?? 0) > 0 ||
      Number(item.durationNights ?? 0) > 0 ||
      Number(item.durationMinutes ?? 0) >= 15
    );
  }

  return Number(item.durationMinutes ?? 0) > 0;
}

function getCompletedDashboardStages(item: SerializedExcursion): number {
  const stages = [
    Boolean(item.title?.trim()) && Boolean(item.shortDescription?.trim()),
    hasDuration(item) && hasProgramOutline(item),
    Boolean(item.locationName?.trim()) && Boolean(item.startPoint?.trim()),
    hasScheduleInfo(item) && Number(item.priceFrom ?? 0) > 0,
    hasOrganizerContacts(item) && item.photoUrls.length >= 3,
  ];

  let completed = 0;
  for (const stage of stages) {
    if (!stage) break;
    completed += 1;
  }

  return completed;
}

function getDashboardReadyState(item: SerializedExcursion): boolean {
  return (
    item.status === ExcursionStatus.PUBLISHED ||
    item.status === ExcursionStatus.PENDING_MODERATION ||
    getCompletedDashboardStages(item) >= 5
  );
}

export default async function DashboardExcursionsPage({
  searchParams,
}: DashboardExcursionsPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/excursions");
  }

  const filters = await searchParams;
  const activeType = filters.type === "tour" || filters.type === "excursion" ? filters.type : "all";
  const activeStatus =
    filters.status === "draft" ||
    filters.status === "pending_moderation" ||
    filters.status === "published" ||
    filters.status === "needs_fix" ||
    filters.status === "rejected"
      ? filters.status
      : "all";

  const excursions = await loadDashboardPageData(
    {
      contextId: "dashboard-excursions",
      pageLabel: "Excursions dashboard",
      fallbackDescription: "Showing empty state.",
    },
    async () =>
      db.excursion.findMany({
        where: { ownerId: session.id },
        include: {
          mainLocation: { select: { name: true } },
          anchorLocation: { select: { name: true, slug: true } },
          district: { select: { name: true } },
          category: { select: { name: true } },
          meetingLocation: { select: { name: true } },
          sessions: {
            where: {
              startAt: { gte: new Date() },
              status: {
                in: [ExcursionSessionStatus.AVAILABLE, ExcursionSessionStatus.SOLD_OUT],
              },
            },
            select: { startAt: true },
            orderBy: { startAt: "asc" },
            take: 1,
          },
          pickupLocations: { select: { locationId: true } },
          routeLocations: {
            select: { locationId: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
    [],
  );

  const items = excursions.map(serializeExcursion);
  const publicPathByExcursionId = new Map(
    excursions.map((item) => [
      item.id,
      buildPublicExcursionPath({
        id: item.id,
        locationId: item.locationId,
        title: item.title,
        anchorLocationSlug: item.anchorLocation?.slug ?? null,
      }),
    ]),
  );

  const filteredItems = items.filter((item) => {
    if (activeType === "excursion" && item.offerType !== ExcursionOfferType.EXCURSION) {
      return false;
    }
    if (activeType === "tour" && item.offerType !== ExcursionOfferType.TOUR) {
      return false;
    }
    if (activeStatus !== "all" && item.status !== activeStatus.toUpperCase()) {
      return false;
    }
    return true;
  });

  const publishedCount = items.filter((item) => item.status === ExcursionStatus.PUBLISHED).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <div>
          <h1 className="text-3xl text-olive">Экскурсии и туры</h1>
        </div>
        <CreateExcursionButton />
      </div>

      {items.length === 0 ? (
        <div
          id="excursions-list"
          className="rounded-2xl border border-dashed border-olive/30 bg-cream p-4 text-sm text-olive/75"
        >
          У вас пока нет программ. Нажмите «Добавить программу», чтобы создать первую карточку.
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          id="excursions-list"
          className="rounded-2xl border border-dashed border-olive/30 bg-cream p-4 text-sm text-olive/75"
        >
          По выбранным фильтрам программы не найдены.
        </div>
      ) : (
        <div id="excursions-list" className="grid gap-3">
          {filteredItems.map((item, index) => {
            const firstPhoto =
              Array.isArray(item.photoUrls) && item.photoUrls.length > 0
                ? (item.photoUrls[0] as string)
                : null;
            const nextItem = filteredItems[index + 1] ?? null;
            const completedStages = getCompletedDashboardStages(item);
            const isReady = getDashboardReadyState(item);
            const routeSummary = buildProgramRouteSummary({
              startPoint: item.startPoint,
              finishPoint: item.finishPoint,
              mainLocationName: item.mainLocationName,
              anchorLocationName: item.anchorLocationName,
              locationName: item.locationName,
            });
            const reviewCount = item.reviewsCount ?? 0;
            const avgRating = Number(item.avgRating ?? 0);
            const publicPath = publicPathByExcursionId.get(item.id) ?? null;

            return (
              <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Link
                    href={`/dashboard/excursions/${item.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-xl transition hover:bg-cream/45 sm:items-center"
                  >
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-cream ring-1 ring-olive/10 sm:h-16 sm:w-24">
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstPhoto}
                          alt={getExcursionTitle(item)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-olive/50">
                          Фото
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <h2 className="text-lg leading-tight text-olive sm:truncate sm:text-xl">
                        {getExcursionTitle(item)}
                      </h2>
                      <p className="mt-1 text-xs leading-snug text-olive/60">
                        {routeSummary} • {getOfferTypeLabel(item.offerType)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-sage/25 px-2.5 py-1 text-[11px] font-semibold text-olive">
                          {item.statusLabel}
                        </span>
                        {item.subtypeLabel ? (
                          <span className="rounded-full border border-olive/10 px-2.5 py-1 text-[11px] font-medium text-olive/70">
                            {item.subtypeLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>

                  <div className="flex w-full items-start justify-between gap-3 rounded-xl border border-olive/10 bg-cream/50 px-3 py-2 sm:w-auto sm:flex-col sm:items-end sm:justify-start sm:gap-1.5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((starIndex) => {
                          const fill = Math.min(1, Math.max(0, avgRating - (starIndex - 1)));
                          const pct = Math.round(fill * 100);

                          return (
                            <svg
                              key={starIndex}
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            >
                              <defs>
                                <clipPath id={`excursion-star-fill-${item.id}-${starIndex}`}>
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
                              {pct > 0 ? (
                                <path
                                  d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
                                  fill="var(--color-sage)"
                                  stroke="none"
                                  clipPath={`url(#excursion-star-fill-${item.id}-${starIndex})`}
                                />
                              ) : null}
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
                    <span className="shrink-0 rounded-full border border-olive/15 px-3 py-1 text-xs font-semibold text-olive/75">
                      #{index + 1}
                    </span>
                    {item.publicId ? (
                      <span className="shrink-0 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                        ID {item.publicId}
                      </span>
                    ) : null}
                  </div>
                </div>

                {!isReady ? (
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
                            "h-2 flex-1 rounded-full transition-all duration-300",
                            stageIndex < completedStages
                              ? "bg-primary"
                              : "bg-cream ring-1 ring-inset ring-olive/20",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <dl className="mt-3 grid gap-2 text-sm min-[360px]:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Длительность</dt>
                    <dd className="font-medium text-olive">{formatProgramDuration(item)}</dd>
                  </div>
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Цена</dt>
                    <dd className="font-medium text-olive">{formatProgramPrice(item)}</dd>
                  </div>
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Даты</dt>
                    <dd className="font-medium text-olive">
                      {formatAvailabilitySummary({
                        availabilityMode: item.availabilityMode,
                        scheduleMode: item.scheduleMode,
                        scheduleText: item.scheduleText,
                        availabilityNote: item.availabilityNote,
                        nextSessionStartAt: item.nextSessionStartAt,
                      })}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream px-3 py-2">
                    <dt className="text-olive/60">Контакты</dt>
                    <dd className="font-medium text-olive">
                      {item.contactPhone?.trim() ? "Добавлены" : "Не заполнены"}
                    </dd>
                  </div>
                </dl>

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
                      href={`/dashboard/excursions/${item.id}`}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                    >
                      Карточка
                    </Link>
                    {item.status === ExcursionStatus.PUBLISHED && publicPath ? (
                      <Link
                        href={publicPath}
                        className="rounded-xl border border-primary/35 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5"
                      >
                        Публичная страница
                      </Link>
                    ) : null}
                    {item.status === ExcursionStatus.PUBLISHED ? (
                      <ExcursionStatsButton
                        excursionId={item.id}
                        excursionTitle={getExcursionTitle(item)}
                      />
                    ) : null}
                    <DeleteExcursionButton
                      excursionId={item.id}
                      excursionTitle={getExcursionTitle(item)}
                      excursionStatus={item.status}
                    />
                  </div>
                </div>

                {nextItem ? (
                  <div className="mt-2 border-t border-olive/10 pt-2 text-right">
                    <Link
                      href={`/dashboard/excursions/${nextItem.id}`}
                      className="text-xs font-semibold text-terra hover:underline"
                    >
                      Следующая программа: {getExcursionTitle(nextItem)} →
                    </Link>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {publishedCount > 0 ? (
        <p className="text-xs text-olive/65">Опубликовано программ: {publishedCount}</p>
      ) : null}
    </div>
  );
}
