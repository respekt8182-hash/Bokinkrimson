// Reusable UI helper/component for field adornment icon.
import type { LucideIcon } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type FieldAdornmentIconProps = {
  icon: LucideIcon;
  shellClassName?: string;
  iconClassName?: string;
};

export function FieldAdornmentIcon({
  icon,
  shellClassName,
  iconClassName,
}: FieldAdornmentIconProps) {
  return (
    <span
      className={cn(
        "field-adornment-icon pointer-events-none right-3.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[14px]",
        shellClassName,
      )}
    >
      <AppIcon icon={icon} className={cn("h-4 w-4", iconClassName)} />
    </span>
  );
}
