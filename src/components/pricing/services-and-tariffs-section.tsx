import Link from "next/link";

import { PlacementPromoNotice } from "@/components/pricing/placement-promo";
import { cn } from "@/lib/cn";
import {
  additionalServiceRows,
  annualTariffBenefitText,
  publicObjectTariffCards,
  publicServiceTariffRows,
} from "@/lib/site-tariffs";

type ServicesAndTariffsSectionProps = {
  variant?: "page" | "footer";
  className?: string;
  id?: string;
};

function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

export function ServicesAndTariffsSection({
  variant = "page",
  className,
  id = "services-and-tariffs",
}: ServicesAndTariffsSectionProps) {
  const isPage = variant === "page";

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
      <p className="mt-4 max-w-4xl text-sm leading-7 text-olive/75 md:text-base">
        Сейчас размещение на сайте бесплатно до 20 июня 2026 включительно. После бесплатного
        периода персональная цена отображается в личном кабинете после входа или регистрации.
      </p>
      <PlacementPromoNotice className="mt-5" />
      <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-semibold leading-6 text-olive">
        {annualTariffBenefitText}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
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
            <h3 className="pr-28 text-xl font-semibold text-olive">{card.title}</h3>
            <p className="mt-3 text-3xl font-bold tabular-nums text-olive">{card.priceLabel}</p>
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
          <p className="text-sm font-semibold text-olive">Экскурсии, туры и трансферы</p>
          <p className="mt-1 text-xs leading-5 text-olive/60">
            Размещайте свои услуги на сайте и получайте обращения от туристов напрямую. Комиссию с
            заказов мы не берём.
          </p>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-olive/10 bg-white/90 text-left text-xs font-semibold uppercase tracking-[0.18em] text-olive/55">
                <th className="px-4 py-3">Услуга</th>
                <th className="px-4 py-3">Сезон до 31 октября</th>
                <th className="px-4 py-3">Год</th>
                <th className="px-4 py-3">Первое годовое</th>
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
                  <td className="px-4 py-4 align-top text-olive/75">
                    {row.seasonPriceRub ? formatRub(row.seasonPriceRub) : "-"}
                  </td>
                  <td className="px-4 py-4 align-top font-semibold text-olive">
                    {formatRub(row.priceRub)}
                  </td>
                  <td className="px-4 py-4 align-top font-semibold text-emerald-700">
                    {row.firstYearPriceRub ? `от ${formatRub(row.firstYearPriceRub)}` : "-"}
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
                  <dt className="text-olive/55">Сезон</dt>
                  <dd className="text-right text-olive/75">
                    {row.seasonPriceRub ? formatRub(row.seasonPriceRub) : "-"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Год</dt>
                  <dd className="text-right font-semibold text-olive">{formatRub(row.priceRub)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Первое годовое</dt>
                  <dd className="text-right font-semibold text-emerald-700">
                    {row.firstYearPriceRub ? `от ${formatRub(row.firstYearPriceRub)}` : "-"}
                  </dd>
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
          Стартовая цена доступна при первом годовом размещении в выбранной категории.
          Персональная цена отображается в личном кабинете после входа или регистрации.
        </p>
        <p className="mt-1">
          Скидка действует отдельно для каждой категории: объект, экскурсия, тур и трансфер.
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
