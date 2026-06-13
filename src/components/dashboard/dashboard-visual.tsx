import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

type DashboardVisualHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imagePosition?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DashboardVisualHero({
  eyebrow,
  title,
  description,
  image,
  imagePosition = "center",
  action,
  children,
  className,
}: DashboardVisualHeroProps) {
  const style = {
    "--dashboard-hero-image": `url(${image})`,
    "--dashboard-hero-position": imagePosition,
  } as CSSProperties;

  return (
    <section className={cn("dashboard-visual-hero", className)} style={style}>
      <div className="relative z-10 flex min-h-[238px] flex-col justify-between gap-8 p-5 sm:p-8 lg:min-h-[290px] lg:p-11">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary sm:text-sm">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-heading text-[2.45rem] font-semibold leading-[0.98] text-olive sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-olive/68 sm:text-base">
              {description}
            </p>
          </div>
          {action ? <div className="shrink-0 lg:pt-12">{action}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

type DashboardVisualPanelProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardVisualPanel({ children, className }: DashboardVisualPanelProps) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-white/75 bg-white/92 p-4 shadow-[0_22px_70px_rgba(58,43,35,0.08)] ring-1 ring-olive/10 backdrop-blur sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

type DashboardSoftStatProps = {
  icon: ReactNode;
  children: ReactNode;
};

export function DashboardSoftStat({ icon, children }: DashboardSoftStatProps) {
  return (
    <div className="flex items-center gap-3 text-sm font-medium text-olive/72">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-white/90 text-primary shadow-[0_12px_28px_rgba(15,118,110,0.08)]">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}
