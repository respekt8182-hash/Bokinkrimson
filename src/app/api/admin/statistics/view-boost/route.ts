import { NextResponse } from "next/server";
import { validateAdminCredentials } from "@/lib/admin-password-auth";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_VIEW_BOOST_DAILY_LIMIT,
  applyAdminViewBoost,
  getAdminStatisticsSummary,
  isAdminViewBoostLimitError,
  normalizeViewBoostAmount,
} from "@/lib/admin-statistics";

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
    password?: unknown;
  } | null;

  const amount = normalizeViewBoostAmount(body?.amount);
  const password = typeof body?.password === "string" ? body.password : "";

  if (amount === null) {
    return NextResponse.json(
      { error: `Можно начислить от 1 до ${ADMIN_VIEW_BOOST_DAILY_LIMIT} просмотров за раз.` },
      { status: 400 },
    );
  }

  if (!password) {
    return NextResponse.json({ error: "Введите пароль администратора." }, { status: 400 });
  }

  if (!(await validateAdminCredentials(admin.login, password))) {
    return NextResponse.json({ error: "Пароль администратора не подошёл." }, { status: 401 });
  }

  try {
    const result = await applyAdminViewBoost(amount);
    return NextResponse.json(result);
  } catch (error) {
    if (isAdminViewBoostLimitError(error)) {
      const summary = await getAdminStatisticsSummary();
      return NextResponse.json(
        {
          error: `Лимит на сегодня уже исчерпан: максимум ${ADMIN_VIEW_BOOST_DAILY_LIMIT} просмотров в сутки.`,
          summary,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Не удалось начислить просмотры. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
