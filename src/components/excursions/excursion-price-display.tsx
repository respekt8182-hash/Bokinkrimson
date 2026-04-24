"use client";

import { cn } from "@/lib/cn";

type ExcursionPriceDisplayProps = {
  priceLabel: string;
  tone?: "light" | "dark";
  size?: "desktop" | "mobile";
  align?: "left" | "center";
  className?: string;
};

type ParsedPriceLabel = {
  amount: string;
  unit: string;
};

function parsePriceLabel(priceLabel: string): ParsedPriceLabel | null {
  const normalized = priceLabel.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(от)\s+(.+?)\s*\/\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    amount: match[2],
    unit: match[3],
  };
}

export function ExcursionPriceDisplay({
  priceLabel,
  tone = "light",
  size = "desktop",
  align = "left",
  className,
}: ExcursionPriceDisplayProps) {
  const parsed = parsePriceLabel(priceLabel);
  const isDark = tone === "dark";
  const isMobile = size === "mobile";

  if (!parsed) {
    return (
      <p
        className={cn(
          "font-[family-name:var(--font-body)] font-extrabold leading-none tabular-nums",
          isDark ? "text-white" : "text-olive",
          isMobile ? "text-[1.35rem]" : "text-[2.35rem]",
          align === "center" && "text-center",
          className,
        )}
      >
        {priceLabel}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-end gap-x-2 gap-y-1",
          align === "center" && "justify-center",
        )}
      >
        <span
          className={cn(
            "font-[family-name:var(--font-body)] font-extrabold leading-none tracking-[-0.05em] tabular-nums",
            isDark ? "text-white" : "text-olive",
            isMobile ? "text-[1.55rem]" : "text-[2.7rem]",
          )}
        >
          {parsed.amount}
        </span>
        <span
          className={cn(
            "pb-1 font-[family-name:var(--font-body)] font-semibold",
            isDark ? "text-white/86" : "text-olive/68",
            isMobile ? "text-[0.82rem]" : "text-[0.95rem]",
          )}
        >
          / {parsed.unit}
        </span>
      </div>
    </div>
  );
}
