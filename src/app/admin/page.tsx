import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import {
  Compass,
  FileText,
  House,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  AdminLinkButton,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
} from "@/components/admin/admin-ui";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { buildPropertyWorkflowStatusWhere } from "@/lib/properties";

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/72 px-4 py-3">
      <span className="text-sm text-olive/70">{label}</span>
      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

export default async function AdminHomePage() {
  const {
    usersCount,
    propertiesCount,
    pendingCount,
    publishedCount,
    rejectedCount,
    applicationsCount,
    adminMessagesCount,
    excursionsCount,
    pendingExcursionsCount,
    rejectedExcursionsCount,
    isDatabaseFallback,
  } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-home",
      unavailableMessage:
        "Admin home page: database is unavailable. Rendering zeroed dashboard counters.",
      fallbackEligibleMessage:
        "Admin home page: database is unavailable or credentials are invalid. Rendering zeroed dashboard counters.",
    },
    async () => {
      const [
        usersCount,
        propertiesCount,
        pendingCount,
        publishedCount,
        rejectedCount,
        applicationsCount,
        adminMessagesCount,
        excursionsCount,
        pendingExcursionsCount,
        rejectedExcursionsCount,
      ] = await Promise.all([
        db.user.count(),
        db.property.count(),
        db.property.count({
          where: buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION),
        }),
        db.property.count({
          where: {
            ownerDeletedAt: null,
            status: PropertyStatus.PUBLISHED,
          },
        }),
        db.property.count({ where: buildPropertyWorkflowStatusWhere(PropertyStatus.REJECTED) }),
        db.application.count(),
        db.adminMessage.count(),
        db.excursion.count(),
        db.excursion.count({ where: { status: ExcursionStatus.PENDING_MODERATION } }),
        db.excursion.count({ where: { status: ExcursionStatus.REJECTED } }),
      ]);

      return {
        usersCount,
        propertiesCount,
        pendingCount,
        publishedCount,
        rejectedCount,
        applicationsCount,
        adminMessagesCount,
        excursionsCount,
        pendingExcursionsCount,
        rejectedExcursionsCount,
        isDatabaseFallback: false,
      };
    },
    {
      usersCount: 0,
      propertiesCount: 0,
      pendingCount: 0,
      publishedCount: 0,
      rejectedCount: 0,
      applicationsCount: 0,
      adminMessagesCount: 0,
      excursionsCount: 0,
      pendingExcursionsCount: 0,
      rejectedExcursionsCount: 0,
      isDatabaseFallback: true,
    },
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Обзор"
        description="Главные очереди и быстрый вход в рабочие разделы."
        actions={
          <>
            <AdminLinkButton href="/admin/objects/new" variant="primary">
              <Plus className="h-4 w-4" />
              Новое жильё
            </AdminLinkButton>
            <AdminLinkButton href="/admin/excursions/new">
              <Plus className="h-4 w-4" />
              Новая экскурсия
            </AdminLinkButton>
          </>
        }
      />

      {isDatabaseFallback ? (
        <AdminNotice>
          Данные временно недоступны. Сводка может быть неполной, попробуйте обновить страницу
          позже.
        </AdminNotice>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <AdminStatCard
          label="Пользователи"
          value={usersCount}
          icon={Users}
          description="Аккаунты в системе"
        />
        <AdminStatCard
          label="Жильё и размещение"
          value={propertiesCount}
          icon={House}
          description="Все карточки жилья"
        />
        <AdminStatCard
          label="Каталог экскурсий"
          value={excursionsCount}
          icon={Compass}
          description="Все экскурсии и туры"
        />
        <AdminStatCard
          label="Сообщения"
          value={adminMessagesCount + applicationsCount}
          icon={MessageSquareText}
          description="Обращения и заявки"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <AdminPanel
          title="Быстрые действия"
          description="Только самые частые задачи для ежедневной работы."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <AdminLinkButton
              href="/admin/moderation"
              variant="ghost"
              className="justify-start rounded-[22px] px-4 py-4"
            >
              <ShieldCheck className="h-4 w-4" />
              Модерация жилья
            </AdminLinkButton>
            <AdminLinkButton
              href="/admin/moderation/excursions"
              variant="ghost"
              className="justify-start rounded-[22px] px-4 py-4"
            >
              <Compass className="h-4 w-4" />
              Модерация экскурсий
            </AdminLinkButton>
            <AdminLinkButton
              href="/admin/messages"
              variant="ghost"
              className="justify-start rounded-[22px] px-4 py-4"
            >
              <MessageSquareText className="h-4 w-4" />
              Сообщения
            </AdminLinkButton>
            <AdminLinkButton
              href="/admin/applications"
              variant="ghost"
              className="justify-start rounded-[22px] px-4 py-4"
            >
              <FileText className="h-4 w-4" />
              Заявки
            </AdminLinkButton>
          </div>
        </AdminPanel>

        <AdminPanel title="Рабочие очереди" description="То, что требует внимания прямо сейчас.">
          <div className="space-y-3">
            <StatusRow
              label="Жильё на модерации"
              value={pendingCount}
              tone="bg-amber-100 text-amber-800"
            />
            <StatusRow
              label="Экскурсии на модерации"
              value={pendingExcursionsCount}
              tone="bg-sky-100 text-sky-800"
            />
            <StatusRow
              label="Новые заявки"
              value={applicationsCount}
              tone="bg-emerald-100 text-emerald-800"
            />
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Жильё и размещение">
          <div className="space-y-3">
            <StatusRow
              label="На модерации"
              value={pendingCount}
              tone="bg-amber-100 text-amber-800"
            />
            <StatusRow
              label="Опубликовано"
              value={publishedCount}
              tone="bg-emerald-100 text-emerald-800"
            />
            <StatusRow
              label="Отклонено"
              value={rejectedCount}
              tone="bg-red-100 text-red-700"
            />
          </div>
        </AdminPanel>

        <AdminPanel title="Каталог экскурсий">
          <div className="space-y-3">
            <StatusRow
              label="На модерации"
              value={pendingExcursionsCount}
              tone="bg-sky-100 text-sky-800"
            />
            <StatusRow
              label="Отклонено"
              value={rejectedExcursionsCount}
              tone="bg-red-100 text-red-700"
            />
            <StatusRow
              label="Сообщения"
              value={adminMessagesCount}
              tone="bg-rose-100 text-rose-800"
            />
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}
