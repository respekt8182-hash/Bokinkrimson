import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export const adminInputClass =
  "w-full rounded-2xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

export const adminTextareaClass = cn(adminInputClass, "min-h-[120px] resize-y");

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string | null;
  actions?: React.ReactNode;
  className?: string;
};

function getLinkButtonClass(variant: "primary" | "secondary" | "ghost") {
  if (variant === "primary") {
    return "bg-primary text-white hover:bg-primary-hover";
  }

  if (variant === "ghost") {
    return "border border-olive/10 bg-cream/55 text-olive hover:border-primary/18 hover:bg-primary/7 hover:text-primary";
  }

  return "border border-olive/12 bg-white text-olive hover:border-primary/18 hover:text-primary";
}

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
        "flex flex-col gap-4 rounded-[30px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(244,250,248,0.84))] p-5 shadow-[0_20px_60px_rgba(58,43,35,0.08)] backdrop-blur-xl sm:p-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/55">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-2xl font-semibold leading-tight text-olive sm:text-3xl",
            eyebrow ? "mt-3" : "",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-olive/62 sm:text-[15px]">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}

type AdminLinkButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

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
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
        getLinkButtonClass(variant),
        className,
      )}
    >
      {children}
    </Link>
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
        "rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.08)] backdrop-blur-xl sm:p-6",
        className,
      )}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            {title ? <h2 className="text-lg font-semibold text-olive">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-olive/60">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      ) : null}

      <div className={cn(title || description || actions ? "mt-4" : "", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

type AdminNoticeProps = {
  children: React.ReactNode;
  tone?: "warning" | "info";
  className?: string;
};

export function AdminNotice({
  children,
  tone = "warning",
  className,
}: AdminNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-amber-200 bg-amber-50/95 text-amber-900"
          : "border-sky-200 bg-sky-50/95 text-sky-900",
        className,
      )}
    >
      {children}
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
        "rounded-[28px] border border-dashed border-olive/18 bg-white/80 px-5 py-8 text-center shadow-[0_14px_40px_rgba(58,43,35,0.05)]",
        className,
      )}
    >
      <p className="text-base font-semibold text-olive">{title}</p>
      <p className="mt-2 text-sm leading-6 text-olive/62">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
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
      <AdminNotice>
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
  tone?: "default" | "warning" | "info" | "success";
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
      ? "bg-amber-50 text-amber-900 border-amber-200/70"
      : tone === "info"
        ? "bg-sky-50 text-sky-900 border-sky-200/70"
        : tone === "success"
          ? "bg-emerald-50 text-emerald-900 border-emerald-200/70"
          : "bg-white text-olive border-white/70";

  return (
    <article
      className={cn(
        "rounded-[26px] border p-5 shadow-[0_16px_40px_rgba(58,43,35,0.06)]",
        toneClass,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-60">{label}</p>
          <p className="mt-3 text-3xl font-semibold leading-none">{value}</p>
          {description ? (
            <p className="mt-2 text-sm leading-6 opacity-70">{description}</p>
          ) : null}
        </div>

        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-[0_10px_24px_rgba(58,43,35,0.06)]">
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
        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-primary text-white"
          : "bg-cream text-olive hover:bg-sand hover:text-olive",
      )}
    >
      {children}
    </Link>
  );
}
