import {
  ExcursionOfferType,
  ExcursionStatus,
  PropertyStatus,
  TransferStatus,
  UserRole,
} from "@prisma/client";
import { Car, Clock3, Compass, House, MessageSquareText, Users } from "lucide-react";
import {
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
} from "@/components/admin/admin-ui";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminPlacementRenewals } from "@/lib/admin-placement-renewals";
import { hasAdminPermission } from "@/lib/admin-rbac";
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
  const currentAdmin = await getAdminSession();
  const canManageContent = Boolean(
    currentAdmin && hasAdminPermission(currentAdmin.role, "content:manage"),
  );
  const canManageModeration = Boolean(
    currentAdmin && hasAdminPermission(currentAdmin.role, "moderation:manage"),
  );
  const canManageFinance = Boolean(
    currentAdmin && hasAdminPermission(currentAdmin.role, "finance:manage"),
  );
  const canManageMessages = Boolean(
    currentAdmin && hasAdminPermission(currentAdmin.role, "messages:manage"),
  );
  const canManageApplications = Boolean(
    currentAdmin && hasAdminPermission(currentAdmin.role, "applications:manage"),
  );
  const canManageUsers = Boolean(
    currentAdmin && hasAdminPermission(currentAdmin.role, "users:manage"),
  );
  const canSeeContentQueues = canManageContent || canManageModeration;
  const canSeeSupportQueues = canManageMessages || canManageApplications;
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
        description="Рабочая сводка по очередям, публикациям, черновикам и обращениям."
      />

      {isDatabaseFallback ? (
        <AdminNotice>
          Данные временно недоступны. Сводка может быть неполной, попробуйте обновить страницу
          позже.
        </AdminNotice>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {canManageUsers ? (
          <AdminStatCard
            label="Пользователи"
            value={usersCount}
            icon={Users}
            description="Аккаунты в системе"
          />
        ) : null}
        {canManageContent ? (
          <>
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
          </>
        ) : null}
        {canSeeSupportQueues ? (
          <AdminStatCard
            label="Сообщения"
            value={adminMessagesCount + applicationsCount}
            icon={MessageSquareText}
            description="Обращения и заявки"
          />
        ) : null}
        {canManageFinance ? (
          <AdminStatCard
            label="Продления"
            value={placementRenewalsCount}
            icon={Clock3}
            description="Размещение и подписки к окончанию"
          />
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {canSeeContentQueues ? (
          <AdminPanel title="Требует проверки" description="Очереди, где нужен ручной разбор.">
            <div className="space-y-3">
              {canManageModeration ? (
                <>
                  <StatusRow
                    label="Жильё на модерации"
                    value={pendingCount}
                    tone="bg-amber-100 text-amber-800"
                  />
                  <StatusRow
                    label="Экскурсии и туры на модерации"
                    value={pendingExcursionsCount}
                    tone="bg-sky-100 text-sky-800"
                  />
                </>
              ) : null}
              {canManageContent ? (
                <StatusRow
                  label="Трансферы на модерации"
                  value={pendingTransfersCount}
                  tone="bg-cyan-100 text-cyan-800"
                />
              ) : null}
            </div>
          </AdminPanel>
        ) : null}

        {canManageContent ? (
          <AdminPanel title="Публикации" description="Состояние каталогов без черновиков.">
            <div className="space-y-3">
              <StatusRow
                label="Опубликовано жилья"
                value={publishedCount}
                tone="bg-emerald-100 text-emerald-800"
              />
              <StatusRow
                label="Опубликовано экскурсий и туров"
                value={excursionsCount}
                tone="bg-emerald-100 text-emerald-800"
              />
              <StatusRow
                label="Опубликовано трансферов"
                value={transfersCount}
                tone="bg-emerald-100 text-emerald-800"
              />
              <StatusRow
                label="Отклонено всего"
                value={rejectedCount + rejectedExcursionsCount + rejectedTransfersCount}
                tone="bg-red-100 text-red-700"
              />
            </div>
          </AdminPanel>
        ) : null}

        {canManageContent ? (
          <AdminPanel
            title="Черновики"
            description="Карточки, которые пока не дошли до публикации."
          >
            <div className="space-y-3">
              <StatusRow
                label="Жильё"
                value={propertyDraftsCount}
                tone="bg-slate-100 text-slate-700"
              />
              <StatusRow
                label="Экскурсии"
                value={excursionDraftsCount}
                tone="bg-sky-100 text-sky-800"
              />
              <StatusRow
                label="Туры"
                value={tourDraftsCount}
                tone="bg-indigo-100 text-indigo-800"
              />
              <StatusRow
                label="Трансферы"
                value={transferDraftsCount}
                tone="bg-cyan-100 text-cyan-800"
              />
            </div>
          </AdminPanel>
        ) : null}

        {canSeeSupportQueues || canManageFinance ? (
          <AdminPanel title="Операционные сигналы" description="Обращения, заявки и оплата.">
            <div className="space-y-3">
              {canManageFinance ? (
                <StatusRow
                  label="Заканчивается размещение"
                  value={placementRenewalsCount}
                  tone="bg-lime-100 text-lime-800"
                />
              ) : null}
              {canManageApplications ? (
                <StatusRow
                  label="Новые заявки"
                  value={applicationsCount}
                  tone="bg-emerald-100 text-emerald-800"
                />
              ) : null}
              {canManageMessages ? (
                <StatusRow
                  label="Сообщения владельцев"
                  value={adminMessagesCount}
                  tone="bg-rose-100 text-rose-800"
                />
              ) : null}
            </div>
          </AdminPanel>
        ) : null}
      </section>
    </div>
  );
}
