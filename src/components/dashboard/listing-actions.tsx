import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DashboardListingActionsProps = {
  updatedAt: string;
  primaryActions?: ReactNode;
  secondaryActions: ReactNode;
  secondaryLayout?: "two" | "three";
};

export const dashboardActionIconClass = "h-3.5 w-3.5 shrink-0";

export const dashboardMainActionClass =
  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-18px_rgba(15,118,110,0.9)] transition hover:brightness-95 min-[560px]:w-auto";

export const dashboardStatsActionClass =
  "min-h-10 w-full justify-center border-primary/45 bg-primary/8 text-primary hover:bg-primary/12 min-[560px]:w-auto";

export const dashboardSecondaryActionClass =
  "inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-olive/15 bg-white/75 px-3 py-2 text-xs font-semibold text-olive/70 transition hover:border-olive/25 hover:bg-cream hover:text-olive min-[560px]:w-auto";

export const dashboardDangerActionClass =
  "min-h-9 w-full gap-1.5 border border-terra/25 bg-white/75 px-3 py-2 text-xs text-terra/75 ring-0 hover:border-terra/35 hover:bg-terra/8 hover:text-terra min-[560px]:w-auto";

export function DashboardListingActions({
  updatedAt,
  primaryActions,
  secondaryActions,
  secondaryLayout = "three",
}: DashboardListingActionsProps) {
  return (
    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-xs text-olive/60">Обновлено: {updatedAt}</p>
      <div className="flex w-full flex-col gap-2 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-end lg:w-auto">
        {primaryActions ? (
          <div className="grid w-full grid-cols-2 gap-2 min-[560px]:flex min-[560px]:w-auto min-[560px]:items-center">
            {primaryActions}
          </div>
        ) : null}
        <div
          className={cn(
            "grid w-full grid-cols-2 gap-2 min-[560px]:flex min-[560px]:w-auto min-[560px]:items-center min-[560px]:justify-end",
            secondaryLayout === "three" ? "min-[420px]:grid-cols-3" : "grid-cols-2",
          )}
        >
          {secondaryActions}
        </div>
      </div>
    </div>
  );
}
