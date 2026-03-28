// Next.js page for route /admin.
import Link from "next/link";
import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import {
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Clock3,
  Compass,
  FileText,
  House,
  KeyRound,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { db } from "@/lib/db";
import { buildPropertyWorkflowStatusWhere } from "@/lib/properties";

// ─── Tiny SVG icon helpers ──────────────────────────────────────────────────
const Icons = {
  users: <AppIcon icon={Users} className="h-4 w-4" />,
  home: <AppIcon icon={House} className="h-4 w-4" />,
  clock: <AppIcon icon={Clock3} className="h-4 w-4" />,
  check: <AppIcon icon={CircleCheckBig} className="h-4 w-4" />,
  x: <AppIcon icon={CircleX} className="h-4 w-4" />,
  file: <AppIcon icon={FileText} className="h-4 w-4" />,
  message: <AppIcon icon={MessageSquareText} className="h-4 w-4" />,
  compass: <AppIcon icon={Compass} className="h-4 w-4" />,
  shield: <AppIcon icon={ShieldCheck} className="h-4 w-4" />,
  key: <AppIcon icon={KeyRound} className="h-4 w-4" />,
  chevron: <AppIcon icon={ChevronRight} className="h-4 w-4" />,
};

type StatVariant = "default" | "warning" | "success" | "danger";

function StatCard({
  label,
  value,
  icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: StatVariant;
}) {
  const styles: Record<StatVariant, { card: string; iconWrap: string; num: string }> = {
    default: {
      card: "bg-cream/92 ring-1 ring-olive/8",
      iconWrap: "icon-surface-muted",
      num: "text-olive",
    },
    warning: {
      card: value > 0 ? "bg-amber-50 ring-1 ring-amber-100" : "bg-cream/92 ring-1 ring-olive/8",
      iconWrap:
        value > 0
          ? "border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,243,214,0.96))] text-amber-700 shadow-[0_10px_24px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]"
          : "icon-surface-muted",
      num: value > 0 ? "text-amber-700" : "text-olive",
    },
    success: {
      card: "bg-emerald-50 ring-1 ring-emerald-100",
      iconWrap:
        "border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.96))] text-emerald-700 shadow-[0_10px_24px_rgba(5,150,105,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]",
      num: "text-emerald-700",
    },
    danger: {
      card: value > 0 ? "bg-red-50 ring-1 ring-red-100" : "bg-cream/92 ring-1 ring-olive/8",
      iconWrap:
        value > 0
          ? "border border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(254,226,226,0.96))] text-red-600 shadow-[0_10px_24px_rgba(220,38,38,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]"
          : "icon-surface-muted",
      num: value > 0 ? "text-red-600" : "text-olive",
    },
  };

  const s = styles[variant];

  return (
    <div className={`flex flex-col gap-3 rounded-xl px-4 py-3.5 ${s.card}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${s.iconWrap}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none tabular-nums ${s.num}`}>{value}</p>
        <p className="mt-1.5 text-xs leading-snug text-olive/55">{label}</p>
      </div>
    </div>
  );
}

// ─── Section Label ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-olive/35">
      {children}
    </h2>
  );
}

// ─── Action Link ─────────────────────────────────────────────────────────────
function ActionLink({
  href,
  icon,
  label,
  description,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-xl bg-primary px-4 py-3.5 transition-opacity hover:opacity-90"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/14 text-white ring-1 ring-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold leading-tight text-white">{label}</p>
          <p className="mt-0.5 text-xs text-white/60">{description}</p>
        </div>
        <span className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5">
          {Icons.chevron}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-olive/12 bg-cream px-4 py-3.5 transition-colors hover:border-olive/20 hover:bg-olive/5"
    >
      <div className="icon-surface-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold leading-tight text-olive">{label}</p>
        <p className="mt-0.5 text-xs text-olive/45">{description}</p>
      </div>
      <span className="shrink-0 text-[color:var(--icon-nav)] transition-transform group-hover:translate-x-0.5">
        {Icons.chevron}
      </span>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function AdminHomePage() {
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
    db.property.count({ where: buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION) }),
    db.property.count({
      where: {
        ownerDeletedAt: null,
        ...buildPropertyWorkflowStatusWhere(PropertyStatus.PUBLISHED),
      },
    }),
    db.property.count({ where: buildPropertyWorkflowStatusWhere(PropertyStatus.REJECTED) }),
    db.application.count(),
    db.adminMessage.count(),
    db.excursion.count(),
    db.excursion.count({ where: { status: ExcursionStatus.PENDING_MODERATION } }),
    db.excursion.count({ where: { status: ExcursionStatus.REJECTED } }),
  ]);

  const totalPending = pendingCount + pendingExcursionsCount;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-olive">Админ-панель</h1>
          <p className="mt-1 text-sm text-olive/55">
            Модерация объявлений и экскурсий, заявки, сообщения пользователей и управление
            аккаунтами.
          </p>
        </div>
        {totalPending > 0 && (
          <div className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {totalPending} на модерации
          </div>
        )}
      </div>

      {/* ── Общая активность ── */}
      <div className="space-y-2.5">
        <SectionLabel>Общая активность</SectionLabel>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
          <StatCard label="Пользователи" value={usersCount} icon={Icons.users} />
          <StatCard label="Заявки" value={applicationsCount} icon={Icons.file} />
          <StatCard label="Сообщения" value={adminMessagesCount} icon={Icons.message} />
        </div>
      </div>

      {/* ── Жильё ── */}
      <div className="space-y-2.5">
        <SectionLabel>Жильё</SectionLabel>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
          <StatCard label="Всего объектов" value={propertiesCount} icon={Icons.home} />
          <StatCard
            label="На модерации"
            value={pendingCount}
            icon={Icons.clock}
            variant="warning"
          />
          <StatCard
            label="Опубликованы"
            value={publishedCount}
            icon={Icons.check}
            variant="success"
          />
          <StatCard label="Отклонены" value={rejectedCount} icon={Icons.x} variant="danger" />
        </div>
      </div>

      {/* ── Экскурсии ── */}
      <div className="space-y-2.5">
        <SectionLabel>Экскурсии</SectionLabel>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
          <StatCard label="Всего экскурсий" value={excursionsCount} icon={Icons.compass} />
          <StatCard
            label="На модерации"
            value={pendingExcursionsCount}
            icon={Icons.clock}
            variant="warning"
          />
          <StatCard
            label="Отклонены"
            value={rejectedExcursionsCount}
            icon={Icons.x}
            variant="danger"
          />
        </div>
      </div>

      {/* ── Быстрые действия ── */}
      <div className="space-y-2.5">
        <SectionLabel>Быстрые действия</SectionLabel>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
          <ActionLink
            href="/admin/moderation"
            icon={Icons.shield}
            label="Модерация жилья"
            description="Проверить новые объявления"
            primary
          />
          <ActionLink
            href="/admin/moderation/excursions"
            icon={Icons.compass}
            label="Модерация экскурсий"
            description="Проверить новые экскурсии"
            primary
          />
          <ActionLink
            href="/admin/objects"
            icon={Icons.home}
            label="Список объектов"
            description="Все объявления о жилье"
          />
          <ActionLink
            href="/admin/users"
            icon={Icons.users}
            label="Пользователи"
            description="Управление аккаунтами"
          />
          <ActionLink
            href="/admin/password-resets"
            icon={Icons.key}
            label="Сбросы паролей"
            description="Запросы на смену пароля"
          />
          <ActionLink
            href="/admin/applications"
            icon={Icons.file}
            label="Все заявки"
            description="Заявки от пользователей"
          />
          <ActionLink
            href="/admin/messages"
            icon={Icons.message}
            label="Сообщения"
            description="Входящие обращения"
          />
        </div>
      </div>
    </div>
  );
}
