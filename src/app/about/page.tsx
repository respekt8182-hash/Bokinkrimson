import type { Metadata } from "next";
import Link from "next/link";
import { companyConfig } from "@/config/company";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";
import { excursionsHubPath, housingHubPath } from "@/lib/seo/routes";

export const metadata: Metadata = {
  title: "О сервисе",
  description:
    "Крым Вокруг — бесплатный информационно-туристический сервис для самостоятельных путешествий по Крыму: достопримечательности, маршруты, экскурсии, трансферы и жильё.",
  alternates: {
    canonical: buildCanonicalPath("/about"),
  },
  openGraph: {
    type: "website",
    title: "О сервисе",
    description:
      "Бесплатный навигатор по Крыму с достопримечательностями, маршрутами, экскурсиями, трансферами и вариантами размещения.",
    url: "/about",
    images: [defaultSocialImageMetadata],
  },
};

const projectHighlights = [
  "Достопримечательности",
  "Маршруты и идеи для отдыха",
  "Экскурсии и туры",
  "Трансферы",
  "Варианты размещения",
];

const siteFeatures = [
  "достопримечательности, природные объекты, исторические и культурные места",
  "идеи для прогулок, отдыха и досуга",
  "маршруты и подборки интересных локаций",
  "экскурсии и туры по разным направлениям Крыма",
  "варианты трансфера и удобной логистики",
  "объекты размещения для поездок по полуострову",
  "фотографии, описания, карты и полезные советы для путешественников",
];

const projectAudiences = [
  "молодым людям, которые хотят путешествовать по Крыму самостоятельно",
  "студентам и молодым семьям, ищущим доступные варианты отдыха",
  "жителям Крыма, которые хотят лучше узнать свой регион",
  "гостям полуострова, которым нужен простой и понятный навигатор",
  "тем, кто интересуется историей, природой, культурой и локальными маршрутами",
];

const projectGoals = [
  "куда можно поехать",
  "что посмотреть рядом",
  "как спланировать день или выходные",
  "какие места подходят для самостоятельного посещения",
  "какие маршруты, экскурсии, трансферы или варианты размещения могут дополнить поездку",
];

function ProjectList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 rounded-2xl bg-white/80 p-4 text-sm leading-7 text-olive/70 ring-1 ring-olive/10"
        >
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span>{item}.</span>
        </li>
      ))}
    </ul>
  );
}

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
    text: `Сейчас первое размещение бесплатно на 1 год с даты создания объявления. После окончания бесплатного периода карточка остаётся на сайте, а в профиле появится отметка о необходимости оплаты.`,
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
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">О сервисе</p>
        <h1 className="mt-3 font-heading text-3xl leading-tight text-olive md:text-5xl md:leading-[1.08]">
          О сервисе «Крым Вокруг»
        </h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-olive/75 md:text-lg md:leading-8">
          <strong>{companyConfig.brandName}</strong> — это бесплатный информационно-туристический
          сервис для самостоятельного знакомства с Крымом.
        </p>
        <p className="mt-4 max-w-4xl text-base leading-8 text-olive/75">
          Мы создаём удобный навигатор по полуострову, где можно находить достопримечательности,
          интересные места, идеи для досуга, маршруты, экскурсии, туры, трансферы и варианты
          размещения. Сервис помогает жителям и гостям Крыма проще планировать поездки, открывать
          новые локации и лучше понимать культурное, историческое и природное наследие региона.
        </p>
        <p className="mt-4 max-w-4xl text-base leading-8 text-olive/75">
          Главная цель проекта — сделать путешествия по Крыму более понятными, доступными и
          интересными, особенно для молодёжи, студентов, молодых семей и начинающих самостоятельных
          путешественников.
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
        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Что можно найти на сайте
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          На сайте собраны материалы и сервисы, которые помогают спланировать поездку по Крыму:
        </p>
        <ProjectList items={siteFeatures} />
        <p className="mt-5 max-w-4xl text-sm leading-7 text-olive/70">
          Мы стремимся, чтобы пользователь мог не просто найти отдельное место, а собрать целую
          поездку: понять, куда поехать, что посмотреть рядом, как добраться, где остановиться и чем
          дополнить маршрут.
        </p>
      </section>

      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Для кого создан проект
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/65">
          «Крым Вокруг» будет полезен:
        </p>
        <ProjectList items={projectAudiences} />
        <p className="mt-5 max-w-4xl text-sm leading-7 text-olive/70">
          Особое внимание мы уделяем молодёжной аудитории: людям, которым важно быстро находить
          понятную информацию, планировать поездки без лишних сложностей и открывать не только
          популярные, но и менее известные места Крыма.
        </p>
      </section>

      <section className="mt-6 rounded-[32px] bg-sand/60 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Общественная ценность проекта
        </h2>
        <div className="mt-4 max-w-4xl space-y-4 text-sm leading-7 text-olive/70">
          <p>
            Крым — регион с большим туристическим, культурным и природным потенциалом. При этом
            самостоятельному путешественнику не всегда просто быстро собрать понятный маршрут: найти
            интересные места рядом, оценить логистику, подобрать формат отдыха и получить информацию
            в удобном виде.
          </p>
          <p>
            «Крым Вокруг» помогает решить эту задачу. Мы объединяем туристическую информацию в одном
            пространстве и делаем её доступной для широкой аудитории.
          </p>
          <p>
            Проект способствует развитию интереса к внутреннему туризму, локальной истории,
            культуре, природному наследию и осознанным путешествиям по Крыму.
          </p>
          <p>
            Для нас важно не только рассказывать о популярных местах, но и помогать открывать малые
            города, природные маршруты, культурные объекты и локальные точки притяжения, которые
            часто остаются вне внимания массового туриста.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Как устроен сервис
        </h2>
        <div className="mt-4 max-w-4xl space-y-4 text-sm leading-7 text-olive/70">
          <p>
            Основа проекта — бесплатный каталог достопримечательностей, маршрутов и полезных
            материалов о Крыме. Пользователь может изучать объекты, смотреть фотографии, читать
            описания, находить места на карте и планировать самостоятельные поездки.
          </p>
          <p>
            Дополнительные разделы — экскурсии, туры, трансферы, досуг и размещение — помогают
            сделать планирование поездки более удобным. Они дополняют информационную часть сервиса и
            позволяют пользователю собрать путешествие в одном месте: от выбора интересной локации
            до понимания маршрута, логистики и вариантов отдыха.
          </p>
          <p>
            При этом ключевая миссия «Крым Вокруг» — развитие доступной туристической информации о
            Крыме, популяризация самостоятельных путешествий и создание полезного навигатора для
            жителей и гостей полуострова.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-cream/72 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Партнёрские разделы
        </h2>
        <div className="mt-4 max-w-4xl space-y-4 text-sm leading-7 text-olive/70">
          <p>
            На сайте могут быть представлены туристические организации, гиды, средства размещения,
            экскурсионные проекты и другие участники туристической сферы.
          </p>
          <p>
            Эти разделы являются вспомогательными: они помогают пользователям получать больше
            практической информации при планировании поездки и делают сервис более полным.
          </p>
          <p>
            Основной фокус проекта — не продажа отдельных услуг, а создание удобной информационной
            среды, где человек может познакомиться с Крымом, выбрать интересные места, составить
            маршрут и получить полезные ориентиры для путешествия.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-10">
        <h2 className="font-heading text-2xl font-semibold leading-tight text-olive md:text-3xl">
          Наша задача
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/70">
          Мы хотим, чтобы путешествовать по Крыму было проще.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-olive/70">
          Чтобы молодой человек, семья или гость полуострова могли открыть сайт и быстро понять:
        </p>
        <ProjectList items={projectGoals} />
        <p className="mt-5 max-w-4xl text-base font-medium leading-8 text-olive/80">
          «Крым Вокруг» — это сервис о путешествиях по Крыму, созданный для людей, которые хотят
          открывать полуостров осознанно, удобно и с интересом.
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
          переноса материалов и подготовки текста до полной публикации. Сейчас, до 1 год с даты
          создания объявления размещение бесплатно; после окончания бесплатного периода новый
          партнер получает один бесплатный месяц с момента добавления карточки на сайт.
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
