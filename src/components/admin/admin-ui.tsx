import Link from "next/link";
import {
  CircleAlert,
  Loader2,
  Search,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const adminInputClass =
  "w-full min-h-11 rounded-xl border border-[var(--admin-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--admin-text)] shadow-[var(--admin-shadow-xs)] outline-none transition placeholder:text-[var(--admin-faint)] focus:border-[var(--admin-primary-border)] focus:ring-4 focus:ring-[var(--admin-ring)]";

export const adminTextareaClass = cn(adminInputClass, "min-h-[120px] resize-y leading-6");

type AdminButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost";

function getButtonClass(variant: AdminButtonVariant) {
  if (variant === "primary") {
    return "border border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white shadow-[0_10px_24px_rgba(0,127,115,0.18)] hover:bg-[var(--admin-primary-hover)]";
  }

  if (variant === "soft") {
    return "border border-[var(--admin-primary-border)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)] hover:bg-[#dff2ef]";
  }

  if (variant === "danger") {
    return "border border-[var(--admin-danger-border)] bg-[var(--admin-danger-soft)] text-[var(--admin-danger)] hover:bg-red-100";
  }

  if (variant === "ghost") {
    return "border border-transparent bg-transparent text-[var(--admin-muted)] hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]";
  }

  return "border border-[var(--admin-border)] bg-white text-[var(--admin-text)] shadow-[var(--admin-shadow-xs)] hover:border-[var(--admin-primary-border)] hover:text-[var(--admin-primary)]";
}

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string | null;
  actions?: React.ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 rounded-[20px] border border-[var(--admin-border)] bg-white p-5 shadow-[var(--admin-shadow-sm)] sm:p-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-[28px] font-semibold leading-tight tracking-normal text-[var(--admin-text)] sm:text-[32px]",
            eyebrow ? "mt-2" : "",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)] sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

type AdminLinkButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: AdminButtonVariant;
  className?: string;
};

type AdminButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
};

export function AdminButton({
  children,
  variant = "secondary",
  className,
  type = "button",
  ...props
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--admin-ring)] disabled:cursor-not-allowed disabled:opacity-70",
        getButtonClass(variant),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminLinkButton({
  href,
  children,
  variant = "secondary",
  className,
}: AdminLinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--admin-ring)]",
        getButtonClass(variant),
        className,
      )}
    >
      {children}
    </Link>
  );
}

type AdminIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
  variant?: AdminButtonVariant;
};

export function AdminIconButton({
  label,
  icon: Icon,
  variant = "secondary",
  className,
  type = "button",
  ...props
}: AdminIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--admin-ring)] disabled:cursor-not-allowed disabled:opacity-70",
        getButtonClass(variant),
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

type AdminPanelProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: AdminPanelProps) {
  return (
    <section
      className={cn(
        "rounded-[20px] border border-[var(--admin-border)] bg-white p-5 shadow-[var(--admin-shadow-sm)] sm:p-6",
        className,
      )}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            {title ? (
              <h2 className="text-[17px] font-semibold leading-6 text-[var(--admin-text)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>
      ) : null}

      <div className={cn(title || description || actions ? "mt-4" : "", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function AdminSectionHeader({
  title,
  description,
  actions,
  className,
}: AdminSectionHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="max-w-3xl">
        <h2 className="text-[18px] font-semibold leading-6 text-[var(--admin-text)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

type AdminNoticeProps = {
  children: React.ReactNode;
  tone?: "warning" | "info" | "success" | "danger";
  className?: string;
};

export function AdminNotice({ children, tone = "warning", className }: AdminNoticeProps) {
  const toneClass =
    tone === "info"
      ? "border-[var(--admin-info-border)] bg-[var(--admin-info-soft)] text-[var(--admin-info)]"
      : tone === "success"
        ? "border-[var(--admin-success-border)] bg-[var(--admin-success-soft)] text-[var(--admin-success)]"
        : tone === "danger"
          ? "border-[var(--admin-danger-border)] bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]"
          : "border-[var(--admin-warning-border)] bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]";

  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm leading-6", toneClass, className)}>
      {children}
    </div>
  );
}

type AdminLoadingStateProps = {
  label?: string;
  className?: string;
};

export function AdminLoadingState({ label = "Загрузка...", className }: AdminLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-32 items-center justify-center gap-2 rounded-[20px] border border-[var(--admin-border)] bg-white p-6 text-sm font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-xs)]",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

type AdminErrorStateProps = {
  title?: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function AdminErrorState({
  title = "Не удалось загрузить данные",
  description,
  action,
  className,
}: AdminErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--admin-danger-border)] bg-[var(--admin-danger-soft)] px-5 py-6 text-[var(--admin-danger)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6">{description}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

type AdminEmptyStateProps = {
  title?: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function AdminEmptyState({
  title = "Ничего не найдено",
  description,
  action,
  className,
}: AdminEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-dashed border-[var(--admin-border-strong)] bg-white px-5 py-8 text-center shadow-[var(--admin-shadow-xs)]",
        className,
      )}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--admin-muted-surface)] text-[var(--admin-muted)]">
        <Search className="h-5 w-5" />
      </div>
      <p className="mt-3 text-base font-semibold text-[var(--admin-text)]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--admin-muted)]">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

type AdminAvatarProps = {
  src?: string | null;
  name: string;
  className?: string;
};

export function AdminAvatar({ src, name, className }: AdminAvatarProps) {
  const initials =
    name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "AD";

  return (
    <span
      className={cn(
        "inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--admin-primary-soft)] text-sm font-bold text-[var(--admin-primary)] ring-1 ring-[var(--admin-primary-border)]",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          {initials ? initials : <UserRound className="h-4 w-4" />}
        </span>
      )}
    </span>
  );
}

type AdminUnavailableStateProps = {
  backHref: string;
  backLabel: string;
  title?: string;
  description?: string;
};

export function AdminUnavailableState({
  backHref,
  backLabel,
  title = "Раздел временно недоступен",
  description = "Попробуйте обновить страницу чуть позже.",
}: AdminUnavailableStateProps) {
  return (
    <div className="space-y-4">
      <AdminLinkButton href={backHref}>{backLabel}</AdminLinkButton>
      <AdminNotice tone="info">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm">{description}</p>
      </AdminNotice>
    </div>
  );
}

type AdminStatCardProps = {
  label: string;
  value: number | string;
  description?: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "info" | "success" | "danger";
};

export function AdminStatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "default",
}: AdminStatCardProps) {
  const toneClass =
    tone === "warning"
      ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)] border-[var(--admin-warning-border)]"
      : tone === "info"
        ? "bg-[var(--admin-info-soft)] text-[var(--admin-info)] border-[var(--admin-info-border)]"
        : tone === "success"
          ? "bg-[var(--admin-success-soft)] text-[var(--admin-success)] border-[var(--admin-success-border)]"
          : tone === "danger"
            ? "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)] border-[var(--admin-danger-border)]"
            : "bg-white text-[var(--admin-text)] border-[var(--admin-border)]";

  return (
    <article
      className={cn(
        "min-h-[156px] rounded-[20px] border p-5 shadow-[var(--admin-shadow-sm)]",
        toneClass,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-70">
            {label}
          </p>
          <p className="mt-3 text-[32px] font-semibold leading-none tracking-normal">{value}</p>
          {description ? <p className="mt-2 text-sm leading-6 opacity-72">{description}</p> : null}
        </div>

        {Icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--admin-primary)] shadow-[var(--admin-shadow-xs)] ring-1 ring-[var(--admin-border)]">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </article>
  );
}

type AdminPillLinkProps = {
  href: string;
  active: boolean;
  children: React.ReactNode;
};

export function AdminPillLink({ href, active, children }: AdminPillLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--admin-ring)]",
        active
          ? "border-[var(--admin-primary-border)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
          : "border-[var(--admin-border)] bg-white text-[var(--admin-muted)] hover:border-[var(--admin-primary-border)] hover:text-[var(--admin-primary)]",
      )}
    >
      {children}
    </Link>
  );
}

type AdminStatusBadgeProps = {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "primary";
  className?: string;
};

export function AdminStatusBadge({ children, tone = "neutral", className }: AdminStatusBadgeProps) {
  const toneClass =
    tone === "success"
      ? "border-[var(--admin-success-border)] bg-[var(--admin-success-soft)] text-[var(--admin-success)]"
      : tone === "warning"
        ? "border-[var(--admin-warning-border)] bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
        : tone === "danger"
          ? "border-[var(--admin-danger-border)] bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]"
          : tone === "info"
            ? "border-[var(--admin-info-border)] bg-[var(--admin-info-soft)] text-[var(--admin-info)]"
            : tone === "primary"
              ? "border-[var(--admin-primary-border)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
              : "border-[var(--admin-border)] bg-[var(--admin-muted-surface)] text-[var(--admin-muted)]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export const AdminBadge = AdminStatusBadge;

type AdminFilterBarProps = {
  children: React.ReactNode;
  className?: string;
};

export function AdminFilterBar({ children, className }: AdminFilterBarProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--admin-border)] bg-white p-4 shadow-[var(--admin-shadow-sm)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
        <SlidersHorizontal className="h-4 w-4 text-[var(--admin-primary)]" />
        Фильтры
      </div>
      {children}
    </div>
  );
}
