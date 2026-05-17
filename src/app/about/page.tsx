import type { Metadata } from "next";
import Link from "next/link";
import { companyConfig } from "@/config/company";
import { PLACEMENT_PROMO_END_LABEL } from "@/lib/placement-promo";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";
import { excursionsHubPath, housingHubPath } from "@/lib/seo/routes";

export const metadata: Metadata = {
  title: "О сервисе",
  description:
    "О сервисе Крым Вокруг: площадка жилья, экскурсий и туров по Крыму с открытой статистикой для партнеров, синхронизацией шахматки, честной выдачей и прямой связью без комиссии.",
  alternates: {
    canonical: buildCanonicalPath("/about"),
  },
  openGraph: {
    type: "website",
    title: "О сервисе",
    description:
      "Площадка жилья, экскурсий и туров по Крыму с открытой статистикой, синхронизацией шахматки, честной выдачей и прямой связью с владельцами.",
    url: "/about",
    images: [defaultSocialImageMetadata],
  },
};

const projectHighlights = [
  "Открытая статистика для партнеров",
  "Синхронизатор шахматки",
  "Честная выдача без платных мест",
  "Отзывы с ИИ-категориями",
  "Без комиссии с бронирований",
];

const partnerBenefits = [
  {
    title: "Без процента с бронирований",
    text: "Большинство площадок забирают 20% и более с каждого бронирования. У нас партнер оплачивает размещение карточки, а не отдает часть каждой сделки, поэтому может держать честную цену для гостя.",
  },
  {
    title: "Открытая статистика",
    text: "Вы видите, сколько людей заходили в карточку, нажимали кнопку «Позвонить», отправляли лид-форму и переходили в мессенджеры. Понятно, что работает и откуда приходят обращения.",
  },
  {
    title: "Честная выдача",
    text: "Мы не продаем платные места в каталоге. Позиции зависят от качества и заполненности карточки, актуальности информации, отзывов и поведения гостей на сайте.",
  },
  {
    title: "Бесплатный старт",
    text: `Сейчас размещение бесплатно до ${PLACEMENT_PROMO_END_LABEL}. После окончания акции новые карточки получают один бесплатный месяц с момента добавления на сайт.`,
  },
];

const analyticsFeatures = [
  {
    title: "Просмотры карточки",
    text: "Показываем, сколько людей открывали страницу вашего объекта, экскурсии, тура или трансфера и как меняется интерес по периодам.",
  },
  {
    title: "Клики по телефону",
    text: "Отдельно считаем нажатия на кнопку «Позвонить», чтобы вы понимали, сколько гостей хотели связаться голосом.",
  },
  {
    title: "Лид-формы",
    text: "Фиксируем отправки заявок: гости могут оставить контакты и детали поездки, а вы видите, сколько таких обращений пришло с карточки.",
  },
  {
    title: "Мессенджеры",
    text: "Считаем переходы в Telegram, WhatsApp, MAX и другие каналы связи, чтобы было видно, какие кнопки чаще приводят к диалогу.",
  },
];

const calendarSyncFeatures = [
  {
    title: "Подключение источников",
    text: "Владелец подключает синхронизацию по каждому номеру: добавляет внешние календари или связывает площадки, где уже идут бронирования.",
  },
  {
    title: "Импорт занятых дат",
    text: "Когда бронь появляется на внешнем сайте с мгновенным бронированием, занятый период подтягивается в шахматку и закрывает номер на эти даты.",
  },
  {
    title: "Экспорт нашей занятости",
    text: "Календарь занятости Крым Вокруг можно отдавать наружу, чтобы другие площадки тоже видели даты, которые уже закрыты здесь.",
  },
  {
    title: "Единая картина броней",
    text: "Статусы синхронизации видны в кабинете: проще контролировать обновления, не переносить брони руками и снижать риск двойных заселений.",
  },
];

const rankingSteps = [
  {
    title: "Платных мест в каталоге нет",
    text: "Первую строку нельзя купить. Мы не закрепляем топовые позиции за теми, кто платит больше, и не превращаем каталог в рекламную витрину.",
  },
  {
    title: "Система оценивает много факторов",
    text: "На выдачу влияет не только количество отзывов. Учитываются заполненность карточки, качество фотографий, актуальность цен и контактов, интерес гостей, релевантность запросу и общая надежность объявления.",
  },
  {
    title: "Новые карточки получают шанс",
    text: "Новый партнер не должен исчезать внизу каталога. Система дает свежим карточкам видимость, чтобы они могли набрать первые просмотры, обращения и отзывы.",
  },
  {
    title: "Честность важнее накрутки",
    text: "Отзывы и активность проходят модерацию. Подозрительные действия не помогают закрепиться в предложке, а качественно заполненная карточка получает больше шансов быть выше.",
  },
];

const reviewSystemFeatures = [
  {
    title: "Нейросеть понимает смысл",
    text: "Система анализирует текст отзыва и определяет, о чем пишет гость: чистота, расположение, сервис, питание, тишина, удобства, цена или другие важные аспекты.",
  },
  {
    title: "Категории вместо общего списка",
    text: "Отзывы распределяются по темам, поэтому человек может быстро открыть именно те впечатления, которые важны для его поездки.",
  },
  {
    title: "Больше пользы для гостя",
    text: "Посетитель видит не просто длинную ленту отзывов, а понятную картину по сильным сторонам недвижимости и деталям, которые чаще всего отмечают гости.",
  },
  {
    title: "Проверка и порядок",
    text: "Мы совмещаем автоматическую обработку с модерацией, чтобы отзывы помогали выбирать объект, а не превращались в хаотичный список случайных сообщений.",
  },
];

const placementSupport = [
  {
    title: "Поможем оформить карточку",
    text: "Если неудобно заполнять самостоятельно, мы поможем с текстом, структурой, описанием преимуществ, контактами и загрузкой фотографий.",
  },
  {
    title: "Перенос под ключ",
    text: "Полностью переносим ваши материалы с других площадок: описания, фотографии, условия, цены, контакты и важные детали. Вам не нужно собирать карточку заново.",
  },
  {
    title: "Фотосъемка объекта",
    text: "При необходимости организуем выезд и профессиональную фотосъемку. Хорошие фото делают карточку понятнее и заметно повышают доверие гостей.",
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
      <section className="rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">О проекте</p>
        <h1 className="mt-3 font-heading text-3xl leading-tight text-olive md:text-5xl md:leading-[1.08]">
          Площадка, где партнер видит результат, а гость выбирает честно
        </h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-olive/75 md:text-lg md:leading-8">
          {companyConfig.brandName} — это региональная площадка жилья у моря, экскурсий и туров по
          Крыму. Мы строим сервис, в котором владелец или организатор получает прямые обращения,
          открытую статистику и понятные правила продвижения, а гость видит карточки без скрытой
          комиссии и может быстро связаться напрямую.
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

      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Для партнеров
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Почему с нами выгодно размещаться
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          Большинство площадок забирают 20% и более с каждого бронирования. В итоге партнер либо
          теряет часть дохода, либо добавляет комиссию в цену — и гость переплачивает. Мы работаем
          иначе: не удерживаем процент с клиента, показываем статистику и помогаем карточке получать
          честную видимость.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {partnerBenefits.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Открытая статистика
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Партнер видит, как работает его карточка
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          Мы не просим верить размещению на слово. По каждой карточке можно смотреть ключевые
          действия гостей: от обычного просмотра до клика по телефону, заявки или перехода в
          мессенджер. Так понятнее, какие объекты получают интерес и какие каналы связи используют
          люди.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {analyticsFeatures.map((item) => (
            <div key={item.title} className="rounded-2xl border border-olive/10 bg-cream/45 p-5">
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Синхронизатор шахматки
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Брони с разных сайтов работают вместе
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          Для объектов с номерным фондом есть синхронизация шахматки с внешними площадками. Партнер
          подключает источники занятости, а сервис сверяет календарь Крым Вокруг с сайтами, где
          включено мгновенное бронирование. Если номер закрыли на другой площадке, эти даты
          отмечаются занятыми здесь; если бронь появилась здесь, занятость можно передать обратно во
          внешние календари.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {calendarSyncFeatures.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Честная выдача
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Как устроена выдача карточек в каталоге
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          Выдача — это не простое закрепление за количеством отзывов и не покупка верхней позиции.
          Система оценивает множество факторов, чтобы в рекомендации попадали карточки, которые
          действительно полезны гостю: хорошо заполнены, актуальны, вызывают интерес и честно
          работают с отзывами.
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
            Чтобы чаще попадать в выдачу и рекомендации, не нужно покупать место. Важно заполнить
            карточку, добавить нормальные фотографии, поддерживать актуальные цены и контакты,
            отвечать на обращения и работать с отзывами. Чем честнее и полезнее карточка для гостя,
            тем больше у нее шансов получить показы.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Система отзывов
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Отзывы помогают выбирать по важным деталям
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          Мы воспринимаем отзывы не как простой список комментариев, а как отдельную систему
          доверия. Нейросети помогают понять, о чем именно написал гость, и распределить отзыв по
          категориям, чтобы другим людям было проще найти нужные аспекты вашей недвижимости.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {reviewSystemFeatures.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-sand/60 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">Поддержка</p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Помогаем с размещением
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          Не у всех есть время разбираться с карточкой. Мы можем взять оформление на себя — от
          переноса материалов и подготовки текста до полной публикации. Сейчас, до{" "}
          {PLACEMENT_PROMO_END_LABEL}, размещение бесплатно; после окончания акции новый партнер
          получает один бесплатный месяц с момента добавления карточки на сайт.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {placementSupport.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
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

      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
          Для гостей
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Почему это удобно тем, кто ищет отдых
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {guestBenefits.map((item) => (
            <div key={item.title} className="rounded-2xl border border-olive/10 bg-cream/40 p-5">
              <h3 className="text-base font-semibold text-olive">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-olive/70">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold text-olive md:text-3xl">
          Начните прямо сейчас
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-olive/65">
          Посмотрите, что уже есть на площадке, или разместите свой объект. Мы поможем перенести
          материалы, оформить карточку и пройти путь до публикации.
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
