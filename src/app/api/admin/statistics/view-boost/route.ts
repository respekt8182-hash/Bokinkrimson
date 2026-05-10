import { NextResponse } from "next/server";
import { validateAdminCredentials } from "@/lib/admin-password-auth";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_ACTION_BOOST_DAILY_LIMIT,
  ADMIN_VIEW_BOOST_DAILY_LIMIT,
  applyAdminActionBoost,
  applyAdminViewBoost,
  getAdminStatisticsSummary,
  isAdminActionStatsUnavailableError,
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
    password?: unknown;
  } | null;

  const metricType = body?.metricType === "actions" ? "actions" : "views";
  const amount =
    metricType === "actions"
      ? normalizeActionBoostAmount(body?.amount)
      : normalizeViewBoostAmount(body?.amount);
  const password = typeof body?.password === "string" ? body.password : "";

  if (amount === null) {
    const limit =
      metricType === "actions" ? ADMIN_ACTION_BOOST_DAILY_LIMIT : ADMIN_VIEW_BOOST_DAILY_LIMIT;
    const label = metricType === "actions" ? "целевых действий" : "просмотров";

    return NextResponse.json(
      { error: `Можно начислить от 1 до ${limit} ${label} за раз.` },
      { status: 400 },
    );
  }

  const actionType =
    metricType === "actions" ? normalizeActionBoostType(body?.actionType) : null;

  if (metricType === "actions" && !actionType) {
    return NextResponse.json({ error: "Выберите тип целевого действия." }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Введите пароль администратора." }, { status: 400 });
  }

  if (!(await validateAdminCredentials(admin.login, password))) {
    return NextResponse.json({ error: "Пароль администратора не подошёл." }, { status: 401 });
  }

  try {
    const result =
      metricType === "actions" && actionType
        ? await applyAdminActionBoost(amount, actionType)
        : await applyAdminViewBoost(amount);
    return NextResponse.json(result);
  } catch (error) {
    if (isAdminActionStatsUnavailableError(error)) {
      return NextResponse.json(
        {
          error: "Таблица целевых действий ещё не создана. Примените миграцию Prisma и повторите попытку.",
          summary: await getAdminStatisticsSummary(),
        },
        { status: 503 },
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
      { error: "Не удалось начислить метрику. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
