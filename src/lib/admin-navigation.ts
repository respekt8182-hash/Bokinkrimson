import type { AdminPermission } from "@/lib/admin-rbac";

export type AdminIconName =
  | "applications"
  | "attractions"
  | "dashboard"
  | "excursions"
  | "finance"
  | "help"
  | "messages"
  | "moderation"
  | "objects"
  | "passwords"
  | "phone"
  | "profile"
  | "site"
  | "support"
  | "transfers"
  | "users";

export type AdminNavigationItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  permission: AdminPermission;
  keywords: string[];
};

export type AdminNavigationGroup = {
  label: string;
  items: AdminNavigationItem[];
};

export const adminNavigationGroups: AdminNavigationGroup[] = [
  {
    label: "Обзор",
    items: [
      {
        href: "/admin",
        label: "Обзор",
        icon: "dashboard",
        permission: "dashboard:read",
        keywords: ["dashboard", "home", "главная", "сводка"],
      },
    ],
  },
  {
    label: "Контент и модерация",
    items: [
      {
        href: "/admin/moderation",
        label: "Модерация жилья",
        icon: "moderation",
        permission: "moderation:manage",
        keywords: ["moderation", "objects moderation", "проверка", "объекты"],
      },
      {
        href: "/admin/moderation/excursions",
        label: "Модерация экскурсий",
        icon: "moderation",
        permission: "moderation:manage",
        keywords: ["excursion moderation", "туры на модерации", "экскурсии"],
      },
      {
        href: "/admin/objects",
        label: "Жильё",
        icon: "objects",
        permission: "content:manage",
        keywords: ["objects", "properties", "housing", "отели", "гостевые дома"],
      },
      {
        href: "/admin/registry-review",
        label: "Проверка реестра",
        icon: "objects",
        permission: "content:manage",
        keywords: ["registry", "реестр", "КСР", "классификация"],
      },
      {
        href: "/admin/excursions",
        label: "Экскурсии",
        icon: "excursions",
        permission: "content:manage",
        keywords: ["excursions", "tours", "туры", "маршруты"],
      },
      {
        href: "/admin/attractions",
        label: "Достопримечательности",
        icon: "attractions",
        permission: "content:manage",
        keywords: ["attractions", "landmarks", "места", "отчеты"],
      },
      {
        href: "/admin/transfers",
        label: "Трансферы",
        icon: "transfers",
        permission: "content:manage",
        keywords: ["transfers", "taxi", "водители", "транспорт"],
      },
    ],
  },
  {
    label: "Коммуникации",
    items: [
      {
        href: "/admin/reviews",
        label: "Отзывы",
        icon: "messages",
        permission: "reviews:manage",
        keywords: ["reviews", "import", "импорт отзывов", "модерация отзывов"],
      },
      {
        href: "/admin/messages",
        label: "Сообщения",
        icon: "messages",
        permission: "messages:manage",
        keywords: ["messages", "inbox", "обращения", "владельцы"],
      },
      {
        href: "/admin/support-chat",
        label: "Чат поддержки",
        icon: "support",
        permission: "support:manage",
        keywords: ["support", "chat", "поддержка", "диалоги"],
      },
      {
        href: "/admin/applications",
        label: "Заявки",
        icon: "applications",
        permission: "applications:manage",
        keywords: ["applications", "requests", "бронь", "заявки"],
      },
    ],
  },
  {
    label: "Пользователи и финансы",
    items: [
      {
        href: "/admin/users",
        label: "Пользователи",
        icon: "users",
        permission: "users:manage",
        keywords: ["users", "owners", "клиенты", "аккаунты"],
      },
      {
        href: "/admin/phone-verification",
        label: "Подтверждение номеров",
        icon: "phone",
        permission: "phone-verification:manage",
        keywords: ["phone", "verification", "телефон", "верификация"],
      },
      {
        href: "/admin/payments",
        label: "Оплата",
        icon: "finance",
        permission: "finance:manage",
        keywords: ["payments", "billing", "manager payments", "оплаты"],
      },
      {
        href: "/admin/renewals",
        label: "Продление",
        icon: "finance",
        permission: "finance:manage",
        keywords: ["renewals", "продления", "размещение", "сроки"],
      },
    ],
  },
  {
    label: "Администрирование",
    items: [
      {
        href: "/admin/admins",
        label: "Администраторы",
        icon: "profile",
        permission: "admins:manage",
        keywords: ["admins", "roles", "rbac", "права", "роли"],
      },
      {
        href: "/admin/password-resets",
        label: "Сброс паролей",
        icon: "passwords",
        permission: "password-resets:manage",
        keywords: ["password reset", "пароли", "восстановление"],
      },
    ],
  },
];

export type AdminQuickAction = {
  href: string;
  label: string;
  icon: AdminIconName;
  permission: AdminPermission;
  keywords: string[];
};

export const adminQuickActions: AdminQuickAction[] = [
  {
    href: "/admin/objects/new",
    label: "Добавить жильё",
    icon: "objects",
    permission: "content:create",
    keywords: ["new property", "создать объект", "жилье"],
  },
  {
    href: "/admin/excursions/new",
    label: "Добавить экскурсию",
    icon: "excursions",
    permission: "content:create",
    keywords: ["new excursion", "создать экскурсию", "тур"],
  },
  {
    href: "/admin/attractions/new",
    label: "Добавить место",
    icon: "attractions",
    permission: "content:create",
    keywords: ["new attraction", "создать место", "достопримечательность"],
  },
  {
    href: "/admin/reviews",
    label: "Открыть отзывы",
    icon: "messages",
    permission: "reviews:manage",
    keywords: ["reviews", "import reviews", "отзывы"],
  },
  {
    href: "/admin/transfers?status=PENDING_MODERATION",
    label: "Проверить трансферы",
    icon: "transfers",
    permission: "moderation:manage",
    keywords: ["pending transfers", "трансферы на модерации"],
  },
  {
    href: "/admin/admins",
    label: "Управлять админами",
    icon: "profile",
    permission: "admins:manage",
    keywords: ["admins", "создать админа", "права"],
  },
];

export function getAdminNavigationItems(): AdminNavigationItem[] {
  return adminNavigationGroups.flatMap((group) => group.items);
}
