import { BarChart3 } from "lucide-react";
import { AdminStatisticsBoostPanel } from "@/components/admin/admin-statistics-boost-panel";
import { AdminLinkButton, AdminNotice, AdminPageHeader } from "@/components/admin/admin-ui";
import {
  ADMIN_ACTION_BOOST_DAILY_LIMIT,
  ADMIN_VIEW_BOOST_DAILY_LIMIT,
  getAdminStatisticsSummary,
  type AdminStatisticsSummary,
} from "@/lib/admin-statistics";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";

function buildFallbackSummary(): AdminStatisticsSummary {
  const todayKey = new Date().toISOString().split("T")[0];

  return {
    dailyLimit: ADMIN_VIEW_BOOST_DAILY_LIMIT,
    usedToday: ADMIN_VIEW_BOOST_DAILY_LIMIT,
    remainingToday: 0,
    actionDailyLimit: ADMIN_ACTION_BOOST_DAILY_LIMIT,
    actionUsedToday: ADMIN_ACTION_BOOST_DAILY_LIMIT,
    actionRemainingToday: 0,
    todayKey,
    todayLabel: todayKey,
    lastBoostAt: null,
    lastActionBoostAt: null,
    totals: {
      publishedProperties: 0,
      publishedExcursions: 0,
      publishedTours: 0,
      publishedTransfers: 0,
      totalCards: 0,
      totalViews: 0,
      totalActions: 0,
    },
  };
}

export default async function AdminStatisticsPage() {
  const { summary, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-statistics",
      unavailableMessage:
        "Admin statistics page: database is unavailable. Rendering disabled statistics panel.",
      fallbackEligibleMessage:
        "Admin statistics page: database is unavailable or credentials are invalid. Rendering disabled statistics panel.",
    },
    async () => ({
      summary: await getAdminStatisticsSummary(),
      isDatabaseFallback: false,
    }),
    {
      summary: buildFallbackSummary(),
      isDatabaseFallback: true,
    },
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Статистика"
        title="Метрики карточек"
        description="Ручное начисление просмотров и целевых действий для опубликованных карточек сайта: жильё, экскурсии, туры и трансферы."
        actions={
          <AdminLinkButton href="/admin" variant="ghost">
            <BarChart3 className="h-4 w-4" />В обзор
          </AdminLinkButton>
        }
      />

      {isDatabaseFallback ? (
        <AdminNotice>
          База данных временно недоступна. Начисление просмотров отключено до восстановления
          подключения.
        </AdminNotice>
      ) : null}

      <AdminStatisticsBoostPanel initialSummary={summary} />
    </div>
  );
}
