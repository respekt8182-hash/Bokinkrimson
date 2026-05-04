import type { Metadata } from "next";
import Link from "next/link";
import { companyConfig } from "@/config/company";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";
import { excursionsHubPath, housingHubPath } from "@/lib/seo/routes";

export const metadata: Metadata = {
  title: "О сервисе",
  description:
    "О сервисе Крым Вокруг: площадка жилья, экскурсий и туров по Крыму с разовой оплатой за размещение, честной выдачей и прямой связью с владельцами без комиссии.",
  alternates: {
    canonical: buildCanonicalPath("/about"),
  },
  openGraph: {
    type: "website",
    title: "О сервисе",
    description:
      "Площадка жилья, экскурсий и туров по Крыму с разовой оплатой за размещение и прямой связью с владельцами.",
    url: "/about",
    images: [defaultSocialImageMetadata],
  },
};

const projectHighlights = [
  "Разовая оплата за размещение",
  "Честная ротация в выдаче",
  "Прямое общение в мессенджерах",
  "Без комиссии с бронирований",
];

const partnerBenefits = [
  {
    title: "Одна оплата — постоянное присутствие",
    text: "Вы платите один раз за размещение карточки. После публикации она остается на площадке и продолжает приводить обращения — без ежемесячных платежей и скрытых списаний.",
  },
  {
    title: "Трафик приходит от нас",
    text: "Мы вкладываемся в продвижение через Яндекс Директ и SEO. На сайт приходят люди, которые уже решили ехать в Крым и ищут жилье, экскурсии или туры — вам не нужно тратиться на рекламу отдельно.",
  },
  {
    title: "Ноль комиссии с каждого гостя",
    text: "Мы не берем процент с заявок, бронирований или гостей. Вы не закладываете нашу комиссию в цену, а значит — ваше предложение выглядит выгоднее для гостей по сравнению с площадками, которые берут 10-20% с каждой сделки.",
  },
];

const rankingSteps = [
  {
    title: "Еженедельная пересборка",
    text: "Каждую неделю позиции карточек в каталоге пересчитываются заново. Никто не может купить или занять первое место навсегда — система сама перемешивает выдачу, чтобы каждый объект получал свою долю внимания.",
  },
  {
    title: "Новые карточки не теряются",
    text: "Только что опубликованная карточка не уходит в конец списка. Система дает новым объявлениям дополнительный приоритет в первые дни, чтобы они набрали просмотры и отзывы наравне с теми, кто размещен давно.",
  },
  {
    title: "Качество, а не бюджет",
    text: "На позицию в выдаче влияют понятные вещи: заполненность карточки, качество фотографий, актуальность информации и отзывы гостей. Чем лучше оформлена карточка — тем чаще она оказывается выше.",
  },
  {
    title: "Защита от накрутки",
    text: "Мы следим за отзывами и поведением через модерацию. Накрученные отзывы удаляются, а объявления с подозрительной активностью теряют позиции. Это значит, что честный партнер не проиграет тому, кто пытается обмануть систему.",
  },
];

const placementSupport = [
  {
    title: "Поможем оформить карточку",
    text: "Если неудобно заполнять самостоятельно — мы поможем с текстом, структурой и загрузкой фотографий. Просто пришлите материалы, остальное сделаем за вас.",
  },
  {
    title: "Фотосъемка объекта",
    text: "При необходимости организуем выезд и профессиональную фотосъемку. Хорошие фото — это не только красивая карточка, но и заметно больше обращений от гостей.",
  },
  {
    title: "Прозрачные цены на услуги",
    text: "Стоимость дополнительных услуг опубликована на странице тарифов. Никаких скрытых доплат — вы заранее знаете, сколько стоит каждая услуга.",
  },
];

const guestBenefits = [
  {
    title: "Честные цены без наценки",
    text: "Владельцы и организаторы не платят нам процент с каждого бронирования, поэтому цены на сайте не раздуты комиссией площадки.",
  },
  {
    title: "Быстрая связь через мессенджеры",
    text: "Заполните короткую форму запроса — и сразу отправьте ее владельцу в Telegram, WhatsApp, MAX или другой удобный мессенджер. Не нужно ждать ответ внутри сайта.",
  },
  {
    title: "Прямой диалог без посредников",
    text: "Общение идет напрямую с владельцем жилья или организатором экскурсии. Вы договариваетесь о деталях лично, без анонимного интерфейса и переписки через платформу.",
  },
  {
    title: "Все для отдыха в одном месте",
    text: "Жилье у моря, экскурсии, туры и активности по Крыму собраны на одной площадке. Удобно планировать всю поездку, а не искать по десяти разным сайтам.",
  },
];

export default function AboutPage() {
  const propertyCount = "подборка жилья по Крыму";
  const excursionCount = "экскурсии по Крыму";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-14">
      {/* Hero */}
      <section className="rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          О проекте
        </p>
        <h1 className="mt-3 font-heading text-3xl leading-tight text-olive md:text-5xl md:leading-[1.08]">
          Площадка, где выгодно и тем, кто сдает, и тем, кто отдыхает
        </h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-olive/75 md:text-lg md:leading-8">
          {companyConfig.brandName} — это региональная площадка жилья у моря, экскурсий и туров по
          Крыму. Мы построили модель, в которой владельцы и организаторы платят только за размещение
          карточки — без ежемесячных подписок, без комиссии с каждого гостя и без скрытых платежей.
          А гости получают прямой контакт с владельцем и цены без наценки за посредничество.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {projectHighlights.map((item) => (
            <span
              key={item}
              className="rounded-full bg-cream/80 px-4 py-1.5 text-xs font-medium text-olive/70 ring-1 ring-olive/10"
            >
              {item}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium text-olive/50">
          Сейчас на площадке: {propertyCount} и {excursionCount}
        </p>
      </section>

      {/* Partner benefits */}
      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Для партнеров
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Почему с нами выгодно размещаться
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-olive/65">
          Большинство площадок забирают 10-20% с каждого бронирования. Это значит, что владелец
          либо отдает часть дохода, либо закладывает комиссию в цену — и гость переплачивает.
          У нас по-другому.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {partnerBenefits.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white p-5 ring-1 ring-olive/10"
            >
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ranking — the detailed explanation */}
      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Честная выдача
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Как устроена выдача карточек в каталоге
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          На многих площадках верхние строчки каталога занимают одни и те же объявления — те, кто
          пришел первым или заплатил больше. Новые партнеры оказываются где-то внизу, их почти никто
          не видит, и они не получают обращений. Мы решили, что это нечестно, и сделали выдачу
          по-другому.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rankingSteps.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-olive/10 bg-cream/50 p-5"
            >
              <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="text-base font-semibold text-olive">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-sand/50 p-5 ring-1 ring-olive/10">
          <p className="text-sm font-semibold text-olive">Что это значит на практике?</p>
          <p className="mt-2 text-sm leading-7 text-olive/70">
            Даже если вы разместились вчера, ваша карточка уже на этой неделе будет показана
            на хороших позициях в вашем городе. А через неделю позиции пересчитаются снова — и
            каждый объект получит свою долю видимости. Нет никакого &laquo;вечного топа&raquo;,
            который нельзя подвинуть. Выдача живая, и все участники получают показы.
          </p>
        </div>
      </section>

      {/* Placement support */}
      <section className="mt-6 rounded-[32px] bg-sand/60 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Поддержка
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Помогаем с размещением
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-olive/65">
          Не у всех есть время разбираться с карточкой. Мы можем взять оформление на себя — от
          текста и фотографий до полной публикации.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {placementSupport.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white p-5 ring-1 ring-olive/10"
            >
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/uslugi-i-tarify"
            className="inline-flex rounded-2xl border border-olive/12 bg-white px-5 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
          >
            Услуги и тарифы
          </Link>
        </div>
      </section>

      {/* Guest benefits */}
      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Для гостей
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Почему это удобно тем, кто ищет отдых
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {guestBenefits.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-olive/10 bg-cream/40 p-5"
            >
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold text-olive md:text-3xl">
          Начните прямо сейчас
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-olive/65">
          Посмотрите, что уже есть на площадке, или разместите свой объект — регистрация занимает
          пару минут.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={housingHubPath}
            className="inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Смотреть жилье
          </Link>
          <Link
            href={excursionsHubPath}
            className="inline-flex rounded-2xl border border-olive/16 bg-white px-5 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
          >
            Смотреть экскурсии
          </Link>
          <Link
            href="/uslugi-i-tarify"
            className="inline-flex rounded-2xl border border-olive/16 bg-white px-5 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
          >
            Тарифы и услуги
          </Link>
          <Link
            href="/auth/login?tab=register"
            className="inline-flex rounded-2xl border border-olive/16 bg-white px-5 py-3 text-sm font-semibold text-olive transition hover:bg-cream"
          >
            Создать аккаунт
          </Link>
        </div>
      </section>
    </div>
  );
}
