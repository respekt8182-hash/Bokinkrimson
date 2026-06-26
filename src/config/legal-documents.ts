export type LegalDocumentLink = {
  href: string;
  label: string;
  description: string;
};

export type LegalDocumentGroup = {
  title: string;
  description: string;
  links: LegalDocumentLink[];
};

export const legalDocumentGroups: LegalDocumentGroup[] = [
  {
    title: "Правила сервиса",
    description: "Основные условия использования платформы, оферта и тарифы на услуги сайта.",
    links: [
      {
        href: "/documents",
        label: "Все документы",
        description: "Полный каталог юридических и информационных материалов сайта.",
      },
      {
        href: "/legal/terms",
        label: "Пользовательское соглашение",
        description: "Правила работы с сервисом и публичными разделами сайта.",
      },
      {
        href: "/oferta",
        label: "Публичная оферта",
        description: "Условия оказания платных услуг платформы.",
      },
      {
        href: "/uslugi-i-tarify",
        label: "Услуги и тарифы",
        description: "Стоимость и состав услуг для владельцев и партнеров.",
      },
    ],
  },
  {
    title: "Персональные данные",
    description: "Политики, согласия и правила обработки данных пользователей и владельцев.",
    links: [
      {
        href: "/legal/privacy",
        label: "Политика обработки персональных данных",
        description: "Как сайт собирает, хранит и защищает персональные данные.",
      },
      {
        href: "/legal/personal-data-consent",
        label: "Согласие на обработку персональных данных",
        description: "Согласие пользователя на обработку данных при работе с сервисом.",
      },
      {
        href: "/legal/public-data-consent",
        label: "Согласие на обработку персональных данных, разрешённых для распространения",
        description: "Порядок публикации выбранных категорий данных в карточках и отзывах.",
      },
      {
        href: "/legal/marketing-consent",
        label: "Маркетинговое согласие",
        description: "Условия получения информационных и маркетинговых сообщений.",
      },
      {
        href: "/legal/review-publication-consent",
        label: "Согласие на публикацию отзыва",
        description: "Правила размещения отзывов на публичных страницах сайта.",
      },
      {
        href: "/legal/cookies",
        label: "Cookie-политика",
        description: "Использование обязательных, функциональных и аналитических cookies.",
      },
    ],
  },
  {
    title: "Оплата и обращения",
    description: "Реквизиты, возвраты и порядок связи по спорным или правовым вопросам.",
    links: [
      {
        href: "/legal/requisites",
        label: "Реквизиты",
        description: "Публичные реквизиты владельца сайта и контакты для обращений.",
      },
      {
        href: "/legal/refund",
        label: "Порядок возврата",
        description: "Правила рассмотрения заявлений на возврат средств.",
      },
      {
        href: "/legal/copyright-complaint",
        label: "Информация для правообладателей",
        description: "Порядок направления обращений по авторским и смежным правам.",
      },
      {
        href: "/refund-request",
        label: "Заявление на возврат",
        description: "Форма обращения по возврату оплаты за услуги платформы.",
      },
    ],
  },
];

export const legalDocumentLinks = legalDocumentGroups.flatMap((group) => group.links);
