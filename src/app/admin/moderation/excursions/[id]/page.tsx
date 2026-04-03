// Next.js page for route /admin/moderation/excursions/[id].
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcursionModerationActions } from "@/components/admin/excursion-moderation-actions";
import { ReviewModerationList } from "@/components/admin/review-moderation-list";
import { db } from "@/lib/db";
import { getExcursionStatusLabel } from "@/lib/excursions";
import { buildPublicExcursionPath } from "@/lib/public-excursions";
import { serializeReview } from "@/lib/reviews";

type AdminModerationExcursionPageProps = {
  params: Promise<{ id: string }>;
};

function formatMoney(value: number | null, currency: string): string {
  if (value === null) {
    return "По запросу";
  }

  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) {
    return "Не указана";
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours === 0) {
    return `${restMinutes} мин`;
  }
  if (restMinutes === 0) {
    return `${hours} ч`;
  }
  return `${hours} ч ${restMinutes} мин`;
}

export default async function AdminModerationExcursionPage({
  params,
}: AdminModerationExcursionPageProps) {
  const { id } = await params;

  const excursion = await db.excursion.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
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
    },
  });

  if (!excursion) {
    notFound();
  }

  const reviews = excursion.reviews.map(serializeReview);
  const publicPath = buildPublicExcursionPath({
    id: excursion.id,
    locationId: excursion.locationId,
    title: excursion.title,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl text-olive">{excursion.title ?? "Экскурсия без названия"}</h1>
          <p className="text-xs text-olive/60">ID: {excursion.id}</p>
          <p className="mt-1 text-sm text-olive/75">
            Статус:{" "}
            <span className="font-semibold text-olive">{getExcursionStatusLabel(excursion.status)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/moderation/excursions"
            className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Назад к очереди
          </Link>
          <Link
            href={`/admin/excursions/${excursion.id}`}
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
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Организатор</dt>
            <dd className="font-medium text-olive">
              {excursion.owner.firstName} {excursion.owner.lastName}
            </dd>
            <dd className="text-olive/75">{excursion.owner.email}</dd>
          </div>
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Локация</dt>
            <dd className="font-medium text-olive">{excursion.locationName ?? "Не указана"}</dd>
          </div>
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Стартовая точка</dt>
            <dd className="font-medium text-olive">{excursion.startPoint ?? "Не указана"}</dd>
            <dd className="text-olive/75">{excursion.address ?? "Адрес не указан"}</dd>
          </div>
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Цена и длительность</dt>
            <dd className="font-medium text-olive">
              {formatMoney(excursion.priceFrom === null ? null : Number(excursion.priceFrom), excursion.currency)}
            </dd>
            <dd className="text-olive/75">{formatDuration(excursion.durationMinutes)}</dd>
          </div>
        </dl>

        <div className="mt-3 rounded-xl bg-cream/70 p-3 text-sm text-olive/85">
          <p className="font-semibold text-olive">Контакты организатора в карточке экскурсии</p>
          <p className="mt-1">
            Имя: {excursion.contactFirstName ?? excursion.owner.firstName}{" "}
            {excursion.contactLastName ?? excursion.owner.lastName}
          </p>
          <p>Телефон: {excursion.contactPhone ?? "Не указан"}</p>
          <p>Email: {excursion.contactEmail ?? excursion.owner.email}</p>
          <p>Сайт: {excursion.websiteUrl ?? "Не указан"}</p>
          <p>
            Telegram: {excursion.telegramUrl ?? "Не указан"} • Max: {excursion.maxUrl ?? "Не указан"} •
            OK: {excursion.okUrl ?? "Не указан"}
          </p>
        </div>

        {excursion.description ? (
          <p className="mt-3 whitespace-pre-line rounded-xl bg-cream/70 p-3 text-sm text-olive/85">
            {excursion.description}
          </p>
        ) : null}

        {excursion.routeDescription ? (
          <p className="mt-3 whitespace-pre-line rounded-xl bg-cream/70 p-3 text-sm text-olive/85">
            Маршрут: {excursion.routeDescription}
          </p>
        ) : null}

        {excursion.scheduleText ? (
          <p className="mt-3 whitespace-pre-line rounded-xl bg-cream/70 p-3 text-sm text-olive/85">
            Расписание: {excursion.scheduleText}
          </p>
        ) : null}

        {excursion.moderationNotes ? (
          <p className="mt-3 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
            Последний комментарий модератора: {excursion.moderationNotes}
          </p>
        ) : null}
      </section>

      {excursion.photoUrls.length > 0 ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h2 className="text-xl text-olive">Фото</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {excursion.photoUrls.map((url) => (
              <div key={url} className="overflow-hidden rounded-xl bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={excursion.title ?? "Фото экскурсии"} className="h-44 w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {excursion.videoUrls.length > 0 ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h2 className="text-xl text-olive">Видео</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {excursion.videoUrls.map((url) => (
              <video key={url} src={url} controls className="h-56 w-full rounded-xl bg-black/80 object-cover" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">Статистика</h2>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Рейтинг</dt>
            <dd className="font-medium text-olive">
              {Number(excursion.avgRating).toFixed(1)} ({excursion.reviewsCount} отзывов)
            </dd>
          </div>
          <div className="rounded-xl bg-cream px-3 py-2">
            <dt className="text-olive/60">Обновлено</dt>
            <dd className="font-medium text-olive">
              {new Date(excursion.updatedAt).toLocaleString("ru-RU")}
            </dd>
          </div>
        </dl>
      </section>

      <ReviewModerationList
        initialReviews={reviews}
        initialAvgRating={Number(excursion.avgRating)}
        initialReviewsCount={excursion.reviewsCount}
      />

      <ExcursionModerationActions
        excursionId={excursion.id}
        currentStatus={getExcursionStatusLabel(excursion.status)}
        initialComment={excursion.moderationNotes ?? ""}
      />
    </div>
  );
}
