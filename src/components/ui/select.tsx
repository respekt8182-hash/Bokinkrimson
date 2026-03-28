"use client";

// Reusable UI helper/component for select.
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
};

export function Select({ value, onChange, options, placeholder, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative w-full min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-base outline-none transition",
          open
            ? "border-primary ring-2 ring-primary/20 text-olive"
            : "border-olive/20 text-olive hover:border-olive/40",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected ? "text-olive/40" : "text-olive")}>
          {selected?.label ?? placeholder ?? "Выберите..."}
        </span>
        <AppIcon
          icon={ChevronDown}
          className={cn(
            "h-4 w-4 shrink-0 text-olive/40 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-olive/15 bg-white shadow-xl shadow-olive/8 transition-all duration-150",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none",
        )}
      >
        <div className="max-h-56 overflow-y-auto py-1.5">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-primary/8 text-primary font-semibold"
                    : "text-olive hover:bg-cream/80",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                    isSelected ? "bg-primary" : "border border-olive/25",
                  )}
                >
                  {isSelected && (
                    <AppIcon icon={Check} className="h-2.5 w-2.5 text-white" />
                  )}
                </span>
                <span className="min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
