// UI component for favorite toggle button in the favorites module.
"use client";

import { Heart } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { getFavoriteEntityActionLabel, type FavoriteEntityType } from "@/lib/favorite-entities";
import {
  isLocalFavorite,
  setLocalFavorite,
  subscribeLocalFavoritesChange,
  toggleLocalFavorite,
} from "@/lib/local-favorites";

type FavoriteToggleButtonProps = {
  itemId: string;
  entityType?: FavoriteEntityType;
  initialIsFavorite: boolean;
  className?: string;
  variant?: "default" | "icon";
  onToggle?: (next: boolean) => void;
};

const PARTICLES = Array.from({ length: 6 }, (_, index) => index);

export function FavoriteToggleButton({
  itemId,
  entityType = "property",
  initialIsFavorite,
  className,
  variant = "default",
  onToggle,
}: FavoriteToggleButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [burstKey, setBurstKey] = useState(0);
  const [isBursting, setIsBursting] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const didApplyInitialFavoriteRef = useRef(false);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIcon = variant === "icon";
  const ariaLabel = getFavoriteEntityActionLabel(entityType, isFavorite);

  useEffect(() => {
    didApplyInitialFavoriteRef.current = false;

    const sync = () => {
      const favoriteItem = { entityType, id: itemId };
      const isStoredFavorite = isLocalFavorite(favoriteItem);

      if (!didApplyInitialFavoriteRef.current) {
        didApplyInitialFavoriteRef.current = true;

        if (!isStoredFavorite && initialIsFavorite) {
          setLocalFavorite(favoriteItem, true);
          setIsFavorite(true);
          return;
        }
      }

      setIsFavorite(isStoredFavorite);
    };

    sync();
    return subscribeLocalFavoritesChange(sync);
  }, [entityType, initialIsFavorite, itemId]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current !== null) {
        clearTimeout(burstTimerRef.current);
      }
    };
  }, []);

  const triggerBurst = useCallback(() => {
    setBurstKey((value) => value + 1);
    setIsBursting(true);

    if (burstTimerRef.current !== null) {
      clearTimeout(burstTimerRef.current);
    }

    burstTimerRef.current = setTimeout(() => {
      setIsBursting(false);
      burstTimerRef.current = null;
    }, 700);
  }, []);

  const toggleFavorite = useCallback(() => {
    if (isPending) {
      return;
    }

    setIsPending(true);
    setError("");

    try {
      const next = toggleLocalFavorite({ entityType, id: itemId });
      setIsFavorite(next);
      onToggle?.(next);

      if (next) {
        triggerBurst();
      }
    } catch {
      setError("Не удалось обновить избранное");
    } finally {
      setIsPending(false);
    }
  }, [entityType, isPending, itemId, onToggle, triggerBurst]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite();
    },
    [toggleFavorite],
  );

  return (
    <div className="space-y-1">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={isFavorite}
        aria-label={ariaLabel}
        data-favorite={isFavorite ? "true" : "false"}
        data-pending={isPending ? "true" : "false"}
        className={cn(
          "wishlist-btn relative isolate inline-flex items-center justify-center overflow-visible border font-semibold outline-none touch-manipulation will-change-transform transition duration-300 ease-out",
          isIcon
            ? [
                "h-10 w-10 rounded-full px-0 text-xs",
                "border-white/80 bg-white/95 text-slate-500 backdrop-blur-md",
                "shadow-[0_14px_35px_rgba(15,23,42,0.16)] transition duration-300",
                "hover:-translate-y-0.5 hover:scale-[1.03] hover:text-rose-500",
                "focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2",
              ]
            : [
                "min-h-11 gap-2.5 rounded-full px-4 py-2.5 text-sm tracking-[0.01em] backdrop-blur-md",
                "shadow-[0_18px_36px_-22px_rgba(15,74,64,0.42),0_10px_24px_-18px_rgba(58,43,35,0.24)]",
                "hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(15,74,64,0.48),0_16px_28px_-22px_rgba(58,43,35,0.28)]",
                "focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2",
              ],
          isFavorite
            ? isIcon
              ? "border-rose-300 text-rose-500"
              : [
                  "border-rose-200/85 bg-white/94 text-rose-600",
                  "shadow-[0_18px_36px_-24px_rgba(244,63,94,0.5),0_10px_24px_-18px_rgba(58,43,35,0.24)]",
                  "hover:border-rose-300 hover:bg-white hover:text-rose-700",
                ]
            : isIcon
              ? ""
              : "border-white/70 bg-white/86 text-olive hover:border-white hover:bg-white hover:text-terra",
          isPending ? "cursor-not-allowed opacity-65" : "",
          className,
        )}
      >
        {isIcon && isBursting ? (
          <>
            <span className="favorite-burst-ring pointer-events-none absolute inset-0 rounded-full border border-rose-400/50" />
            {PARTICLES.map((particle) => (
              <span
                key={`${burstKey}-${particle}`}
                className="favorite-burst-spark pointer-events-none absolute left-1/2 top-1/2"
                style={
                  {
                    "--favorite-angle": `${particle * 60}deg`,
                    "--favorite-delay": `${particle * 0.03}s`,
                  } as CSSProperties
                }
              >
                <AppIcon icon={Heart} className="h-3 w-3 text-rose-500" filled />
              </span>
            ))}
          </>
        ) : null}
        <span className={cn("relative z-[1]", isIcon && isBursting && "favorite-heart-pop")}>
          <AppIcon icon={Heart} className="h-4 w-4" filled={isFavorite} />
        </span>
        {isIcon ? (
          <span className="sr-only">{isFavorite ? "В избранном" : "В избранное"}</span>
        ) : (
          <span className="relative z-[1] whitespace-nowrap">
            {isFavorite ? "В избранном" : "В избранное"}
          </span>
        )}
      </button>
      {error && !isIcon ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
