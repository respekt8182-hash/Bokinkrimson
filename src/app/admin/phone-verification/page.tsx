import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CheckCircle2, Phone, ShieldX } from "lucide-react";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
} from "@/components/admin/admin-ui";
import { getAdminSession } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin-rbac";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { formatUserActivityTime, getUserActivityStatus } from "@/lib/user-activity";

export const dynamic = "force-dynamic";

const PHONE_VERIFICATION_COLUMNS = ["phoneVerifiedAt", "phoneVerifiedByAdminId"] as const;

function formatDateTime(date: Date | null | undefined): string {
  return date
    ? date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

async function confirmPhoneNumberAction(formData: FormData) {
  "use server";

  const admin = await getAdminSession();
  if (!admin) {
    throw new Error("Доступ запрещен");
  }
  if (!hasAdminPermission(admin.role, "phone-verification:manage")) {
    throw new Error("Недостаточно прав для подтверждения телефона");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    return;
  }

  const canVerifyPhones = await areDatabaseColumnsAvailable("User", PHONE_VERIFICATION_COLUMNS);
  if (!canVerifyPhones) {
    return;
  }

  const user = await db.user.findFirst({
    where: {
      id: userId,
      role: "USER",
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      phoneVerifiedAt: true,
    },
  });

  if (!user || user.phoneVerifiedAt) {
    return;
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        phoneVerifiedAt: now,
        phoneVerifiedByAdminId: admin.id,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_confirm_phone",
        targetType: "user",
        targetId: user.id,
        details: {
          phone: user.phone,
          confirmedAt: now.toISOString(),
        },
      },
    });
  });

  revalidatePath("/admin/phone-verification");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
}

export default async function AdminPhoneVerificationPage() {
  const now = new Date();
  const canVerifyPhones = await areDatabaseColumnsAvailable("User", PHONE_VERIFICATION_COLUMNS);

  if (!canVerifyPhones) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Подтверждение номеров телефонов"
          description="Ручная проверка владельцев аккаунтов перед показом статуса «Пользователь проверен»."
        />
        <AdminNotice>
          Раздел появится после применения миграции базы данных для подтверждения телефонов.
        </AdminNotice>
      </div>
    );
  }

  const [users, pendingCount, verifiedCount] = await Promise.all([
    db.user.findMany({
      where: {
        role: "USER",
        deletedAt: null,
        phoneVerifiedAt: null,
      },
      orderBy: [{ createdAt: "asc" }],
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            properties: true,
            excursions: true,
            transfers: true,
          },
        },
      },
    }),
    db.user.count({
      where: {
        role: "USER",
        deletedAt: null,
        phoneVerifiedAt: null,
      },
    }),
    db.user.count({
      where: {
        role: "USER",
        deletedAt: null,
        phoneVerifiedAt: { not: null },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Подтверждение номеров телефонов"
        description="Свяжитесь с владельцем, убедитесь что номер настоящий, затем подтвердите его. После подтверждения в профиле и объявлениях появится статус проверенного пользователя."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <AdminStatCard
          label="Ожидают проверки"
          value={pendingCount}
          description="Аккаунты с неподтвержденным номером"
          icon={ShieldX}
          tone={pendingCount > 0 ? "warning" : "success"}
        />
        <AdminStatCard
          label="Подтверждены"
          value={verifiedCount}
          description="Пользователи с ручной проверкой телефона"
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      {users.length === 0 ? (
        <AdminEmptyState
          title="Все номера подтверждены"
          description="Когда зарегистрируется новый пользователь или владелец сменит телефон, он появится здесь."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {users.map((user) => {
            const fullName =
              [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
              "Пользователь без имени";
            const activityStatus = getUserActivityStatus(user.lastSeenAt, now);

            return (
              <AdminPanel key={user.id} className="p-4" contentClassName="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-olive">{fullName}</h2>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${activityStatus.toneClassName}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${activityStatus.dotClassName}`}
                          aria-hidden="true"
                        />
                        {activityStatus.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 font-semibold text-olive">
                        <Phone className="h-4 w-4 text-primary" />
                        {user.phone}
                      </span>
                      {user.email ? <span className="text-olive/62">{user.email}</span> : null}
                    </div>
                  </div>

                  <form action={confirmPhoneNumberAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
                    >
                      Подтвердить номер телефона
                    </button>
                  </form>
                </div>

                <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-cream/80 px-3 py-2">
                    <dt className="text-olive/50">Регистрация</dt>
                    <dd className="mt-0.5 font-semibold text-olive">
                      {formatDateTime(user.createdAt)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream/80 px-3 py-2">
                    <dt className="text-olive/50">Последний визит</dt>
                    <dd className="mt-0.5 font-semibold text-olive">
                      {formatUserActivityTime(user.lastSeenAt, now)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream/80 px-3 py-2">
                    <dt className="text-olive/50">Последний вход</dt>
                    <dd className="mt-0.5 font-semibold text-olive">
                      {formatDateTime(user.lastLoginAt)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream/80 px-3 py-2">
                    <dt className="text-olive/50">Объявления</dt>
                    <dd className="mt-0.5 font-semibold text-olive">
                      {user._count.properties + user._count.excursions + user._count.transfers}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/admin/users/${user.id}`}
                  className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                >
                  Открыть профиль пользователя
                </Link>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
