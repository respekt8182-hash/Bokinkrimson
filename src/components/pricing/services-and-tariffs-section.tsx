import Link from "next/link";

import { cn } from "@/lib/cn";
import { PlacementPromoNotice, PlacementPromoPrice } from "@/components/pricing/placement-promo";
import {
  additionalServiceRows,
  annualTariffBenefitText,
  publicObjectTariffCards,
  publicTariffHighlights,
  publicServiceTariffRows,
} from "@/lib/site-tariffs";

type ServicesAndTariffsSectionProps = {
  variant?: "page" | "footer";
  className?: string;
  id?: string;
};

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
        Сейчас размещение на сайте бесплатно до 20 июня 2026 включительно. Дальше оплачивается не
        количество номеров, а период размещения одного объекта.
      </p>
      <PlacementPromoNotice className="mt-5" />
      <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-semibold leading-6 text-olive">
        {annualTariffBenefitText}
      </div>
      <ul className="mt-5 grid gap-2 text-sm leading-6 text-olive/72 md:grid-cols-2">
        {publicTariffHighlights.map((item) => (
          <li key={item} className="rounded-2xl bg-cream/72 px-4 py-3 ring-1 ring-olive/10">
            {item}
          </li>
        ))}
      </ul>

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
                    <span className="font-semibold text-olive">
                      {row.amountRub.toLocaleString("ru-RU")} ₽
                    </span>
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
          <p className="text-sm font-semibold text-olive">Другие форматы размещения</p>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-olive/10 bg-white/90 text-left text-xs font-semibold uppercase tracking-[0.18em] text-olive/55">
                <th className="px-4 py-3">Услуга</th>
                <th className="px-4 py-3">Стоимость</th>
                <th className="px-4 py-3">Условия</th>
                <th className="px-4 py-3">Срок размещения</th>
              </tr>
            </thead>
            <tbody>
              {publicServiceTariffRows.map((row) => (
                <tr key={row.id} className="border-b border-olive/8 last:border-b-0">
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-olive">{row.serviceName}</p>
                    <p className="mt-1 text-xs leading-5 text-olive/60">{row.serviceNote}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <PlacementPromoPrice originalAmountRub={row.priceRub} />
                  </td>
                  <td className="px-4 py-4 align-top text-olive/75">{row.conditionsLabel}</td>
                  <td className="px-4 py-4 align-top text-olive/75">{row.durationLabel}</td>
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
                  <dt className="text-olive/55">Стоимость</dt>
                  <dd className="text-right">
                    <PlacementPromoPrice originalAmountRub={row.priceRub} align="right" />
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Условия</dt>
                  <dd className="text-right text-olive/75">{row.conditionsLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-olive/55">Срок</dt>
                  <dd className="text-right text-olive/75">{row.durationLabel}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>

      {/* ---------- Дополнительные услуги ---------- */}
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
        Дополнительные услуги
      </p>
      <p className="mt-4 max-w-4xl text-sm leading-7 text-olive/75 md:text-base">
        Если вам нужна помощь с оформлением карточки или качественные фотографии номеров — мы можем
        сделать это за вас. Фотосъёмку организуем через проверенных фотографов в вашем городе.
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
                  <td className="px-4 py-4 align-top font-semibold text-olive whitespace-nowrap">
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
