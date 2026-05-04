import {
  ExcursionOfferType,
  ExcursionStatus,
  PropertyStatus,
  TransferStatus,
  UserRole,
} from "@prisma/client";
import {
  Car,
  Clock3,
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
import { getAdminPlacementRenewals } from "@/lib/admin-placement-renewals";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { buildPropertyWorkflowStatusWhere } from "@/lib/properties";
import { buildTransferWorkflowStatusWhere } from "@/lib/transfers";

function StatusRow({ label, value, tone }: { label: string; value: number; tone: string }) {
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
    transfersCount,
    pendingTransfersCount,
    rejectedTransfersCount,
    propertyDraftsCount,
    excursionDraftsCount,
    tourDraftsCount,
    transferDraftsCount,
    placementRenewalsCount,
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
        transfersCount,
        pendingTransfersCount,
        rejectedTransfersCount,
        propertyDraftsCount,
        excursionDraftsCount,
        tourDraftsCount,
        transferDraftsCount,
        placementRenewalsCount,
      ] = await Promise.all([
        db.user.count({
          where: {
            role: UserRole.USER,
            deletedAt: null,
          },
        }),
        db.property.count({
          where: {
            ownerDeletedAt: null,
            status: PropertyStatus.PUBLISHED,
            isPublishedVisible: true,
            owner: { deletedAt: null },
          },
        }),
        db.property.count({
          where: {
            AND: [
              buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION),
              {
                ownerDeletedAt: null,
                owner: { deletedAt: null },
              },
            ],
          },
        }),
        db.property.count({
          where: {
            ownerDeletedAt: null,
            status: PropertyStatus.PUBLISHED,
            isPublishedVisible: true,
            owner: { deletedAt: null },
          },
        }),
        db.property.count({
          where: {
            AND: [
              buildPropertyWorkflowStatusWhere(PropertyStatus.REJECTED),
              {
                ownerDeletedAt: null,
                owner: { deletedAt: null },
              },
            ],
          },
        }),
        db.application.count({
          where: {
            guestUser: { deletedAt: null },
          },
        }),
        db.adminMessage.count({
          where: {
            senderUser: { deletedAt: null },
          },
        }),
        db.excursion.count({
          where: {
            deletedAt: null,
            status: ExcursionStatus.PUBLISHED,
            isPublishedVisible: true,
            owner: { deletedAt: null },
          },
        }),
        db.excursion.count({
          where: {
            deletedAt: null,
            status: ExcursionStatus.PENDING_MODERATION,
            owner: { deletedAt: null },
          },
        }),
        db.excursion.count({
          where: {
            deletedAt: null,
            status: ExcursionStatus.REJECTED,
            owner: { deletedAt: null },
          },
        }),
        db.transfer.count({
          where: {
            status: TransferStatus.PUBLISHED,
            isPublishedVisible: true,
            owner: { deletedAt: null },
          },
        }),
        db.transfer.count({
          where: {
            AND: [
              buildTransferWorkflowStatusWhere(TransferStatus.PENDING_MODERATION),
              { owner: { deletedAt: null } },
            ],
          },
        }),
        db.transfer.count({
          where: {
            AND: [
              buildTransferWorkflowStatusWhere(TransferStatus.REJECTED),
              { owner: { deletedAt: null } },
            ],
          },
        }),
        db.property.count({
          where: {
            ownerDeletedAt: null,
            status: PropertyStatus.DRAFT,
            owner: { deletedAt: null },
          },
        }),
        db.excursion.count({
          where: {
            deletedAt: null,
            status: ExcursionStatus.DRAFT,
            offerType: ExcursionOfferType.EXCURSION,
            owner: { deletedAt: null },
          },
        }),
        db.excursion.count({
          where: {
            deletedAt: null,
            status: ExcursionStatus.DRAFT,
            offerType: ExcursionOfferType.TOUR,
            owner: { deletedAt: null },
          },
        }),
        db.transfer.count({
          where: {
            status: TransferStatus.DRAFT,
            owner: { deletedAt: null },
          },
        }),
        getAdminPlacementRenewals().then((items) => items.length),
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
        transfersCount,
        pendingTransfersCount,
        rejectedTransfersCount,
        propertyDraftsCount,
        excursionDraftsCount,
        tourDraftsCount,
        transferDraftsCount,
        placementRenewalsCount,
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
      transfersCount: 0,
      pendingTransfersCount: 0,
      rejectedTransfersCount: 0,
      propertyDraftsCount: 0,
      excursionDraftsCount: 0,
      tourDraftsCount: 0,
      transferDraftsCount: 0,
      placementRenewalsCount: 0,
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          description="Опубликованные карточки жилья"
        />
        <AdminStatCard
          label="Каталог экскурсий"
          value={excursionsCount}
          icon={Compass}
          description="Опубликованные экскурсии и туры"
        />
        <AdminStatCard
          label="Трансферы"
          value={transfersCount}
          icon={Car}
          description="Опубликованные карточки трансферов"
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
              href="/admin/transfers?status=PENDING_MODERATION"
              variant="ghost"
              className="justify-start rounded-[22px] px-4 py-4"
            >
              <Car className="h-4 w-4" />
              Трансферы на модерации
            </AdminLinkButton>
            <AdminLinkButton
              href="/admin/renewals"
              variant="ghost"
              className="justify-start rounded-[22px] px-4 py-4"
            >
              <Clock3 className="h-4 w-4" />
              Продление размещения
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
              label="Трансферы на модерации"
              value={pendingTransfersCount}
              tone="bg-cyan-100 text-cyan-800"
            />
            <StatusRow
              label="Заканчивается размещение"
              value={placementRenewalsCount}
              tone="bg-lime-100 text-lime-800"
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
            <StatusRow label="Отклонено" value={rejectedCount} tone="bg-red-100 text-red-700" />
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

        <AdminPanel title="Трансферы">
          <div className="space-y-3">
            <StatusRow
              label="На модерации"
              value={pendingTransfersCount}
              tone="bg-cyan-100 text-cyan-800"
            />
            <StatusRow
              label="Отклонено"
              value={rejectedTransfersCount}
              tone="bg-red-100 text-red-700"
            />
          </div>
        </AdminPanel>
      </section>

      <AdminPanel
        title="Черновики"
        description="Сколько неопубликованных карточек сейчас сохранено на сайте."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusRow label="Жильё" value={propertyDraftsCount} tone="bg-slate-100 text-slate-700" />
          <StatusRow
            label="Экскурсии"
            value={excursionDraftsCount}
            tone="bg-sky-100 text-sky-800"
          />
          <StatusRow label="Туры" value={tourDraftsCount} tone="bg-indigo-100 text-indigo-800" />
          <StatusRow
            label="Трансферы"
            value={transferDraftsCount}
            tone="bg-cyan-100 text-cyan-800"
          />
        </div>
      </AdminPanel>
    </div>
  );
}
