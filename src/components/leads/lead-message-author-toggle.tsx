"use client";

import { AppIcon } from "@/components/ui/app-icon";
import { GenderFemale, GenderMale, type LucideIcon } from "@/components/ui/lucide-react";
import { cn } from "@/lib/cn";
import type { LeadMessageAuthorGender } from "@/lib/lead-message-author";

type LeadMessageAuthorToggleProps = {
  value: LeadMessageAuthorGender;
  onChange: (value: LeadMessageAuthorGender) => void;
  className?: string;
};

const options: Array<{
  value: LeadMessageAuthorGender;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "male", label: "Мужчина", icon: GenderMale },
  { value: "female", label: "Женщина", icon: GenderFemale },
];

export function LeadMessageAuthorToggle({
  value,
  onChange,
  className,
}: LeadMessageAuthorToggleProps) {
  return (
    <div className={cn("rounded-[22px] border border-olive/10 bg-white/92 p-3.5", className)}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/45">
          От чьего лица писать
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-[13px] font-semibold transition",
                isActive
                  ? "border-primary/18 bg-[linear-gradient(145deg,rgba(14,116,144,0.10),rgba(15,118,110,0.08))] text-primary shadow-sm"
                  : "border-olive/10 bg-white text-olive/62 hover:border-olive/18 hover:bg-cream/60",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition",
                  isActive
                    ? "border-primary/12 bg-white/90 text-primary"
                    : "border-olive/10 bg-cream text-olive/45",
                )}
              >
                <AppIcon icon={option.icon} className="h-4 w-4" />
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
