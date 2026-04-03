// Next.js page for route /dashboard.
import Link from "next/link";
import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import { buildPropertyWorkflowStatusWhere } from "@/lib/properties";

type DashboardStats = {
  objectsTotal: number;
  objectsPendingModeration: number;
  excursionsTotal: number;
  excursionsPendingModeration: number;
};

const fallbackDashboardStats: DashboardStats = {
  objectsTotal: 0,
  objectsPendingModeration: 0,
  excursionsTotal: 0,
  excursionsPendingModeration: 0,
};

async function getDashboardStats(ownerId: string): Promise<DashboardStats> {
  const canUseFallback = process.env.NODE_ENV !== "production";
  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "dashboard-stats",
      "Database is unavailable. Dashboard counters will use zero fallback values.",
    );
    return fallbackDashboardStats;
  }

  try {
    const [objectsTotal, objectsPendingModeration, excursionsTotal, excursionsPendingModeration] =
      await Promise.all([
        db.property.count({
          where: {
            ownerId,
            ownerDeletedAt: null,
          },
        }),
        db.property.count({
          where: {
            ownerId,
            ownerDeletedAt: null,
            ...buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION),
          },
        }),
        db.excursion.count({
          where: {
            ownerId,
          },
        }),
        db.excursion.count({
          where: {
            ownerId,
            status: ExcursionStatus.PENDING_MODERATION,
          },
        }),
      ]);

    return {
      objectsTotal,
      objectsPendingModeration,
      excursionsTotal,
      excursionsPendingModeration,
    };
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "dashboard-stats",
      "Database is unavailable or credentials are invalid. Dashboard counters will use zero fallback values.",
    );
    return fallbackDashboardStats;
  }
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard");
  }

  const {
    objectsTotal,
    objectsPendingModeration,
    excursionsTotal,
    excursionsPendingModeration,
  } = await getDashboardStats(session.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-olive">Главная</h1>
        <p className="mt-1 text-sm text-olive/70">Выберите раздел для работы с карточками размещения.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/objects"
          className="group min-h-[220px] rounded-2xl border border-olive/15 bg-white p-5 transition hover:border-olive/30 hover:bg-cream/40 md:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-olive">Объекты</p>
            </div>
            <span className="rounded-full border border-olive/20 px-3 py-1 text-xs font-semibold text-olive/75">
              Перейти
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-cream px-3 py-2">
              <p className="text-xs text-olive/60">Всего</p>
              <p className="text-lg font-semibold text-olive">{objectsTotal}</p>
            </div>
            <div className="rounded-xl bg-cream px-3 py-2">
              <p className="text-xs text-olive/60">На модерации</p>
              <p className="text-lg font-semibold text-olive">{objectsPendingModeration}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/excursions"
          className="group min-h-[220px] rounded-2xl border border-olive/15 bg-white p-5 transition hover:border-olive/30 hover:bg-cream/40 md:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-olive">Экскурсии</p>
            </div>
            <span className="rounded-full border border-olive/20 px-3 py-1 text-xs font-semibold text-olive/75">
              Перейти
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-cream px-3 py-2">
              <p className="text-xs text-olive/60">Всего</p>
              <p className="text-lg font-semibold text-olive">{excursionsTotal}</p>
            </div>
            <div className="rounded-xl bg-cream px-3 py-2">
              <p className="text-xs text-olive/60">На модерации</p>
              <p className="text-lg font-semibold text-olive">{excursionsPendingModeration}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
