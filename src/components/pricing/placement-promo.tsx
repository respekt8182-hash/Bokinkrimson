import { cn } from "@/lib/cn";
import {
  PLACEMENT_PROMO_BADGE_LABEL,
  PLACEMENT_PROMO_NOTICE,
  getPlacementPromoPrice,
  isPlacementPromoActive,
} from "@/lib/placement-promo";

type PlacementPromoNoticeProps = {
  className?: string;
  compact?: boolean;
};

type PlacementPromoPriceProps = {
  originalAmountRub: number;
  finalAmountRub?: number;
  align?: "left" | "right";
  className?: string;
  finalClassName?: string;
};

type PlacementFirstYearPriceProps = {
  originalAmountRub: number;
  renewalAmountRub?: number;
  freePeriodUntil?: string | null;
  className?: string;
  finalClassName?: string;
  compact?: boolean;
};

function formatRub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

export function PlacementPromoNotice({ className, compact = false }: PlacementPromoNoticeProps) {
  if (!isPlacementPromoActive()) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-red-200/70 bg-gradient-to-br from-red-50 via-white to-amber-50 px-4 py-3 text-sm text-olive shadow-[0_18px_42px_-34px_rgba(185,28,28,0.55)]",
        compact ? "rounded-2xl px-3 py-2.5 text-xs" : "md:px-5 md:py-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">
          {PLACEMENT_PROMO_BADGE_LABEL}
        </span>
        <span className={cn("font-semibold text-red-700", compact ? "text-xs" : "text-sm")}>
          Бесплатное размещение
        </span>
      </div>
      <p className={cn("mt-2 leading-6 text-olive/72", compact ? "text-xs leading-5" : "")}>
        {PLACEMENT_PROMO_NOTICE}
      </p>
    </div>
  );
}

export function PlacementPromoPrice({
  originalAmountRub,
  finalAmountRub,
  align = "left",
  className,
  finalClassName,
}: PlacementPromoPriceProps) {
  const promoPrice = getPlacementPromoPrice(originalAmountRub);
  const finalAmount = finalAmountRub ?? promoPrice.finalAmountRub;
  const isDiscounted = finalAmount < originalAmountRub;

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        align === "right" ? "items-end text-right" : "items-start text-left",
        className,
      )}
    >
      {isDiscounted ? (
        <span className="text-xs font-semibold tabular-nums text-olive/38 line-through decoration-olive/38 decoration-2">
          {formatRub(originalAmountRub)}
        </span>
      ) : null}
      <span
        className={cn(
          "font-bold tabular-nums",
          isDiscounted ? "text-red-600" : "text-olive",
          finalClassName,
        )}
      >
        {formatRub(finalAmount)}
      </span>
    </div>
  );
}

export function PlacementFirstYearPrice({
  originalAmountRub,
  renewalAmountRub = originalAmountRub,
  freePeriodUntil,
  className,
  finalClassName,
  compact = false,
}: PlacementFirstYearPriceProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50/60 p-3",
        compact ? "p-2.5" : "sm:p-4",
        className,
      )}
    >
      <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
        Первый год размещения бесплатно
      </span>
      <div className={cn("mt-2 flex items-end justify-between gap-3", compact ? "mt-1.5" : "")}>
        <div>
          <p className="text-[11px] font-medium text-olive/55">Итого к оплате сейчас</p>
          <PlacementPromoPrice
            originalAmountRub={originalAmountRub}
            finalAmountRub={0}
            className="mt-0.5"
            finalClassName={cn(compact ? "text-xl" : "text-3xl", finalClassName)}
          />
        </div>
        <p className="max-w-[190px] text-right text-[11px] leading-4 text-olive/58">
          {freePeriodUntil ?? "12 месяцев с даты публикации после модерации"}
        </p>
      </div>
      <div className="mt-2 border-t border-emerald-900/10 pt-2 text-[11px] leading-4 text-olive/65">
        Продление через год: <strong className="text-olive">{formatRub(renewalAmountRub)}</strong>.
        Оплата только при продлении.
      </div>
    </div>
  );
}
