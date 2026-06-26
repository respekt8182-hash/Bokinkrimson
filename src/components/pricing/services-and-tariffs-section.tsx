import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import {
  additionalServiceRows,
  publicObjectTariffCards,
  publicServiceTariffRows,
} from "@/lib/site-tariffs";

type ServicesAndTariffsSectionProps = {
  variant?: "page" | "footer";
  className?: string;
  id?: string;
  publishedPropertiesCount?: number | null;
};

const STARTER_PROGRAM_LIMIT = 1000;
const countFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function pluralizeObjects(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return "объектов";
  if (mod10 === 1) return "объект";
  if (mod10 >= 2 && mod10 <= 4) return "объекта";
  return "объектов";
}

function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

export function ServicesAndTariffsSection({
  variant = "page",
  className,
  id = "services-and-tariffs",
  publishedPropertiesCount,
}: ServicesAndTariffsSectionProps) {
  const isPage = variant === "page";
  const used = Math.max(0, publishedPropertiesCount ?? 0);
  const placesLeft = Math.max(STARTER_PROGRAM_LIMIT - used, 0);
  const progressPercent = Math.min(100, (used / STARTER_PROGRAM_LIMIT) * 100);

  return (
    <section
      id={id}
      className={cn(
        "rounded-[32px] ring-1 ring-olive/10",
        isPage
          ? "bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] md:p-8"
          : "bg-white/80 p-5 shadow-[0_14px_38px_-34px_rgba(15,74,64,0.58)]",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
        Услуги и тарифы
      </p>
      {isPage ? (
        <h1 className="mt-3 font-heading text-3xl leading-tight text-olive md:text-5xl md:leading-[1.08]">
          Услуги и тарифы
        </h1>
      ) : (
        <h2 className="mt-3 font-heading text-2xl leading-tight text-olive md:text-3xl">
          Услуги и тарифы
        </h2>
      )}
      <div className="relative mt-6 overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50/70 p-5 shadow-[0_24px_55px_-38px_rgba(5,150,105,0.65)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm">
              <AppIcon icon={Sparkles} className="h-4 w-4 text-[color:var(--icon-stay)]" />
              0 ₽ на 1 год
            </span>
            <h2 className="mt-4 font-heading text-2xl leading-tight text-olive sm:text-3xl">
              Сейчас размещение бесплатно
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-olive/75 md:text-base md:leading-7">
              Добавляйте жильё, экскурсии, туры и трансферы без оплаты. Каждое новое объявление
              получает 12 месяцев бесплатного размещения с даты публикации после модерации, количество объявлений
              не ограничено.
            </p>
            <Link
              href="/dashboard/objects"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"
            >
              Добавить объявление бесплатно
              <AppIcon icon={ArrowRight} className="h-4 w-4 text-[color:var(--icon-stay)]" />
            </Link>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white/85 p-4 shadow-[0_16px_34px_-30px_rgba(15,74,64,0.55)] backdrop-blur-sm">
            <p className="text-sm font-semibold text-olive">Программа первых партнёров</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-olive/60">
              <span>В каталоге:</span>
              <span className="font-semibold text-olive">
                {publishedPropertiesCount === null || publishedPropertiesCount === undefined
                  ? "обновляется"
                  : `${countFormatter.format(used)} ${pluralizeObjects(used)}`}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream ring-1 ring-olive/10">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-olive/65">
              {publishedPropertiesCount === null || publishedPropertiesCount === undefined
                ? "Счётчик обновится после подключения базы"
                : placesLeft > 0
                  ? `Осталось мест в программе: ${countFormatter.format(placesLeft)}`
                  : "Места в программе заполнены"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Тарифы после бесплатного года
        </p>
        <h2 className="mt-2 font-heading text-2xl leading-tight text-olive md:text-3xl">
          Продление размещения жилья
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-olive/68">
          Указанные ниже тарифы понадобятся только через год, если вы решите продлить публикацию
          объявления. Первый год размещения оплачивать не нужно.
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {publicObjectTariffCards.map((card) => (
          <article
            key={card.id}
            className={cn(
              "relative rounded-2xl border bg-white/92 p-5 shadow-[0_16px_34px_-30px_rgba(15,74,64,0.55)]",
              card.recommended ? "border-primary/40 ring-2 ring-primary/10" : "border-olive/10",
            )}
          >
            {card.badgeLabel ? (
              <span className="absolute right-4 top-4 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                {card.badgeLabel}
              </span>
            ) : null}
            <h3 className={cn("text-xl font-semibold text-olive", card.badgeLabel ? "pr-28" : "")}>
              {card.title}
            </h3>
            <p className="mt-3 text-3xl font-bold tabular-nums text-olive">{card.priceLabel}</p>
            {card.priceNote ? (
              <p className="mt-1 text-sm font-semibold text-olive/70">{card.priceNote}</p>
            ) : null}
            <p className="mt-2 min-h-12 text-sm leading-6 text-olive/68">{card.description}</p>
            <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-sm font-medium text-olive/75">
              {card.periodLabel}
            </p>
            <p className="mt-2 text-sm font-semibold text-olive/75">{card.monthlyLabel}</p>
            {card.priceRows ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-olive/10">
                {card.priceRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between border-b border-olive/8 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="text-olive/65">{row.label}</span>
                    <span className="font-semibold text-olive">{formatRub(row.amountRub)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {card.savingsLabel ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                {card.savingsLabel}
              </p>
            ) : null}
            {card.comparisonLabel ? (
              <p className="mt-2 text-xs leading-5 text-olive/60">{card.comparisonLabel}</p>
            ) : null}
            <Link
              href="/dashboard/objects"
              className={cn(
                "mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition",
                card.recommended
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "border border-primary/25 text-primary hover:border-primary/40 hover:bg-primary/6",
              )}
            >
              {card.buttonLabel}
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-olive/10 bg-cream/72">
        <div className="border-b border-olive/10 bg-white/85 px-4 py-3">
          <p className="text-sm font-semibold text-olive">
            Продление экскурсий, туров и трансферов после бесплатного года
          </p>
          <p className="mt-1 text-xs leading-5 text-olive/60">
            Первый год каждого объявления стоит 0 ₽. Цены ниже применяются только при последующем
            продлении; комиссию с заказов мы не берём.
          </p>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-olive/10 bg-white/90 text-left text-xs font-semibold uppercase tracking-[0.18em] text-olive/55">
                <th className="px-4 py-3">Услуга</th>
                <th className="px-4 py-3">Срок</th>
                <th className="px-4 py-3">Стоимость</th>
                <th className="px-4 py-3">Условия</th>
              </tr>
            </thead>
            <tbody>
              {publicServiceTariffRows.map((row) => (
                <tr key={row.id} className="border-b border-olive/8 last:border-b-0">
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-olive">{row.serviceName}</p>
                    <p className="mt-1 text-xs leading-5 text-olive/60">{row.serviceNote}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-olive/75">{row.durationLabel}</td>
                  <td className="px-4 py-4 align-top font-semibold text-olive">
                    {formatRub(row.priceRub)}
                  </td>
                  <td className="px-4 py-4 align-top text-olive/75">
                    {row.conditionsLabel}
                    {row.extraLabel ? <p className="mt-1 text-xs">{row.extraLabel}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {publicServiceTariffRows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-olive/10 bg-white/90 p-4 shadow-[0_12px_26px_-24px_rgba(15,74,64,0.55)]"
            >
              <p className="text-base font-semibold text-olive">{row.serviceName}</p>
              <p className="mt-1 text-sm leading-6 text-olive/65">{row.serviceNote}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Срок</dt>
                  <dd className="text-right text-olive/75">{row.durationLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Стоимость</dt>
                  <dd className="text-right font-semibold text-olive">{formatRub(row.priceRub)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Условия</dt>
                  <dd className="text-right text-olive/75">
                    {row.conditionsLabel}
                    {row.extraLabel ? <p className="mt-1">{row.extraLabel}</p> : null}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-olive/10 bg-white/80 px-4 py-3 text-sm leading-6 text-olive/70">
        <p>
          Бесплатный год начинается отдельно для каждой новой карточки в день ее публикации после модерации.
          Можно добавлять новые объявления позже — каждое из них также получит свои 12 бесплатных
          месяцев.
        </p>
        <p className="mt-1">
          После бесплатного периода действует базовая стоимость выбранного тарифа без комиссии с
          заявок и бронирований.
        </p>
      </div>

      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
        Дополнительные услуги
      </p>
      <p className="mt-4 max-w-4xl text-sm leading-7 text-olive/75 md:text-base">
        Если вам нужна помощь с оформлением карточки или качественные фотографии номеров, мы можем
        сделать это за вас.
      </p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-olive/10 bg-cream/72">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-olive/10 bg-white/90 text-left text-xs font-semibold uppercase tracking-[0.18em] text-olive/55">
                <th className="px-4 py-3">Услуга</th>
                <th className="px-4 py-3">Стоимость</th>
                <th className="px-4 py-3">Условия</th>
              </tr>
            </thead>
            <tbody>
              {additionalServiceRows.map((row) => (
                <tr key={row.id} className="border-b border-olive/8 last:border-b-0">
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-olive">{row.serviceName}</p>
                    <p className="mt-1 text-xs leading-5 text-olive/60">{row.serviceNote}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top font-semibold text-olive">
                    {row.priceLabel}
                  </td>
                  <td className="px-4 py-4 align-top text-olive/75">{row.conditionsLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {additionalServiceRows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-olive/10 bg-white/90 p-4 shadow-[0_12px_26px_-24px_rgba(15,74,64,0.55)]"
            >
              <p className="text-base font-semibold text-olive">{row.serviceName}</p>
              <p className="mt-1 text-sm leading-6 text-olive/65">{row.serviceNote}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Стоимость</dt>
                  <dd className="text-right font-semibold text-olive">{row.priceLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Условия</dt>
                  <dd className="text-right text-olive/75">{row.conditionsLabel}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
