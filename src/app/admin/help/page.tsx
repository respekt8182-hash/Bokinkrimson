import { KeyRound, MessageSquareText, Search, ShieldCheck, UserRound } from "lucide-react";
import {
  AdminLinkButton,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";

const helpSections = [
  {
    title: "Навигация и поиск",
    description:
      "Используйте верхний поиск по разделам админки. Enter открывает лучший результат, Ctrl+K фокусирует поле поиска.",
    icon: Search,
  },
  {
    title: "Уведомления",
    description:
      "Колокольчик в topbar показывает очереди модерации, сообщения, поддержку, отзывы и оплаты. Данные обновляются polling без перезагрузки страницы.",
    icon: MessageSquareText,
  },
  {
    title: "Роли и права",
    description:
      "SUPER_ADMIN управляет администраторами. Остальные роли видят только доступные им разделы, а API дополнительно проверяет права.",
    icon: ShieldCheck,
  },
  {
    title: "Профиль",
    description:
      "DB-администратор может менять имя, email, аватар и пароль. Env-admin остаётся fallback-входом и управляется через .env.",
    icon: UserRound,
  },
  {
    title: "Доступ",
    description:
      "Не отключайте последний активный SUPER_ADMIN. Env-admin нужен как аварийный вход до полной проверки DB-админов на VPS.",
    icon: KeyRound,
  },
];

export default function AdminHelpPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Помощь"
        description="Короткая памятка по ежедневной работе в админ-панели."
        actions={
          <>
            <AdminLinkButton href="/admin/profile">Профиль</AdminLinkButton>
            <AdminLinkButton href="/admin/admins" variant="primary">
              Администраторы
            </AdminLinkButton>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {helpSections.map((section) => {
          const Icon = section.icon;
          return (
            <AdminPanel key={section.title}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[var(--admin-text)]">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                    {section.description}
                  </p>
                </div>
              </div>
            </AdminPanel>
          );
        })}
      </section>

      <AdminPanel title="Перед выгрузкой на VPS">
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge tone="primary">DATABASE_URL</AdminStatusBadge>
          <AdminStatusBadge tone="primary">ADMIN_LOGIN</AdminStatusBadge>
          <AdminStatusBadge tone="primary">ADMIN_PASSWORD_HASH</AdminStatusBadge>
          <AdminStatusBadge tone="primary">ADMIN_JWT_SECRET</AdminStatusBadge>
          <AdminStatusBadge tone="primary">prisma migrate deploy</AdminStatusBadge>
          <AdminStatusBadge tone="primary">npm run build</AdminStatusBadge>
        </div>
      </AdminPanel>
    </div>
  );
}
