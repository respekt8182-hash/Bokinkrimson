import type { Metadata } from "next";
import Link from "next/link";
import { companyConfig } from "@/config/company";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Сотрудничество",
  description:
    "Размещение жилья и экскурсий на Крым Вокруг: оплата только за публикацию объявления, без комиссии с каждого клиента или бронирования.",
  alternates: {
    canonical: buildCanonicalPath("/cooperation"),
  },
  openGraph: {
    type: "website",
    title: "Сотрудничество",
    description:
      "Размещение жилья и экскурсий на Крым Вокруг без комиссии с каждого клиента или бронирования.",
    url: "/cooperation",
  },
};

const cooperationFacts = [
  "Сервис специализируется на Крыме и собирает в одном каталоге жильё у моря и экскурсии по региону.",
  "Модель проекта проста: оплата только за размещение объявления на платформе, без процента с каждого клиента или бронирования.",
  "Карточки проходят модерацию, а на публичных страницах работают отзывы и прямые контакты владельцев и организаторов.",
];

const cooperationHighlights = [
  "Без комиссии с бронирования",
  "Прямые контакты в карточках",
  "Тарифы опубликованы открыто",
];

const cooperationSteps = [
  "Создайте аккаунт и заполните карточку жилья или экскурсии.",
  "Добавьте описание, фотографии, контакты и ключевые детали для гостей.",
  "После оплаты размещения и модерации карточка публикуется в каталоге.",
  "Гости связываются с владельцем или организатором напрямую через контакты в карточке.",
];

export default function CooperationPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <section className="rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Для владельцев и организаторов
        </p>
        <h1 className="mt-3 font-heading text-3xl leading-tight text-olive md:text-5xl md:leading-[1.08]">
          Сотрудничество с Крым Вокруг
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-olive/75 md:text-base">
          Платформа подходит владельцам жилья у моря, мини-отелям, гостевым домам, апартаментам,
          а также организаторам экскурсий и туров по Крыму. Основная идея сервиса — прозрачная
          модель размещения без комиссии с каждого клиента или бронирования.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10">
            <h2 className="text-xl font-semibold text-olive">Почему эта модель выгодна</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-olive/75">
              <li>
                Сервис берет оплату только за размещение карточки, а не удерживает процент с каждой
                заявки или бронирования.
              </li>
              <li>
                За счет этого владельцы жилья и организаторы экскурсий могут выставлять более
                честные цены, без скрытого запаса на комиссию площадки.
              </li>
              <li>
                Гость общается напрямую с владельцем или организатором через контакты в карточке, а
                не через анонимный посреднический интерфейс.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl bg-sand/70 p-5 ring-1 ring-olive/10">
            <h2 className="text-xl font-semibold text-olive">Открытые условия размещения</h2>
            <p className="mt-4 text-sm leading-7 text-olive/75">
              {companyConfig.shortDescription}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-olive/60">
              {cooperationHighlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white px-3 py-1 ring-1 ring-olive/10"
                >
                  {item}
                </span>
              ))}
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-olive/75">
              {cooperationFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/uslugi-i-tarify"
                className="inline-flex rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
              >
                Открыть тарифы
              </Link>
              <Link
                href="/oferta"
                className="inline-flex rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
              >
                Договор оферты
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-olive/10">
          <h2 className="text-xl font-semibold text-olive">Как работает публикация</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {cooperationSteps.map((step, index) => (
              <li
                key={step}
                className="rounded-2xl border border-olive/10 bg-cream/55 px-4 py-3 text-sm leading-7 text-olive/75"
              >
                <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/auth/login?tab=register"
            className="inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Создать аккаунт
          </Link>
          <Link
            href="/about"
            className="inline-flex rounded-2xl border border-olive/16 px-5 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
          >
            О сервисе
          </Link>
        </div>
      </section>
    </div>
  );
}
