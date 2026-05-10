import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { HIDDEN_STATS_PIN } from "@/lib/admin-hidden-statistics";
import {
  ADMIN_ACTION_BOOST_DAILY_LIMIT,
  ADMIN_VIEW_BOOST_DAILY_LIMIT,
  applyAdminActionBoost,
  applyAdminViewBoost,
  getAdminStatisticsSummary,
  isAdminActionStatsUnavailableError,
  isAdminBoostNoTargetsError,
  isAdminViewBoostLimitError,
  normalizeActionBoostAmount,
  normalizeActionBoostType,
  normalizeViewBoostAmount,
} from "@/lib/admin-statistics";
import { LISTING_ACTION_LABELS } from "@/lib/listing-analytics";

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const summary = await getAdminStatisticsSummary();
  return NextResponse.json({ summary });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    metricType?: unknown;
    actionType?: unknown;
    pin?: unknown;
  } | null;

  const metricType = body?.metricType === "actions" ? "actions" : "views";
  const amount =
    metricType === "actions"
      ? normalizeActionBoostAmount(body?.amount)
      : normalizeViewBoostAmount(body?.amount);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (amount === null) {
    const limit =
      metricType === "actions" ? ADMIN_ACTION_BOOST_DAILY_LIMIT : ADMIN_VIEW_BOOST_DAILY_LIMIT;
    const label = metricType === "actions" ? "целевых действий" : "просмотров";

    return NextResponse.json(
      { error: `Можно начислить от 1 до ${limit} ${label} за раз.` },
      { status: 400 },
    );
  }

  const actionType = metricType === "actions" ? normalizeActionBoostType(body?.actionType) : null;

  if (metricType === "actions" && !actionType) {
    return NextResponse.json({ error: "Выберите тип целевого действия." }, { status: 400 });
  }

  if (pin !== HIDDEN_STATS_PIN) {
    return NextResponse.json({ error: "Неверный PIN-код" }, { status: 401 });
  }

  try {
    const result =
      metricType === "actions" && actionType
        ? await applyAdminActionBoost(amount, actionType, admin.login)
        : await applyAdminViewBoost(amount, admin.login);
    return NextResponse.json(result);
  } catch (error) {
    if (isAdminActionStatsUnavailableError(error)) {
      return NextResponse.json(
        {
          error:
            "Таблица целевых действий ещё не создана. Примените миграцию Prisma и повторите попытку.",
          summary: await getAdminStatisticsSummary(),
        },
        { status: 503 },
      );
    }

    if (isAdminBoostNoTargetsError(error)) {
      return NextResponse.json(
        {
          error: "Нет опубликованных карточек для начисления статистики",
          summary: await getAdminStatisticsSummary(),
        },
        { status: 409 },
      );
    }

    if (isAdminViewBoostLimitError(error)) {
      const summary = await getAdminStatisticsSummary();
      const limit =
        metricType === "actions" ? ADMIN_ACTION_BOOST_DAILY_LIMIT : ADMIN_VIEW_BOOST_DAILY_LIMIT;
      const metricLabel =
        metricType === "actions"
          ? `целевых действий (${LISTING_ACTION_LABELS[actionType!]})`
          : "просмотров";
      return NextResponse.json(
        {
          error: `Лимит на сегодня уже исчерпан: максимум ${limit} ${metricLabel} в сутки.`,
          summary,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Не удалось сохранить изменения. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
