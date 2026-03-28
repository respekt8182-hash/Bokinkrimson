// UI component for favorite toggle button in the favorites module.
"use client";

import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import {
  isLocalFavoriteProperty,
  setLocalFavoriteProperty,
  subscribeLocalFavoritesChange,
  toggleLocalFavoriteProperty,
} from "@/lib/local-favorites";

type FavoriteToggleButtonProps = {
  propertyId: string;
  initialIsFavorite: boolean;
  isAuthenticated?: boolean;
  loginHref?: string;
  className?: string;
  variant?: "default" | "icon";
  onToggle?: (next: boolean) => void;
};

export function FavoriteToggleButton({
  propertyId,
  initialIsFavorite,
  className,
  variant = "default",
  onToggle,
}: FavoriteToggleButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const seededFromInitialRef = useRef(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIcon = variant === "icon";

  useEffect(() => {
    seededFromInitialRef.current = false;

    const sync = () => {
      const isLocalFavorite = isLocalFavoriteProperty(propertyId);
      if (!isLocalFavorite && initialIsFavorite && !seededFromInitialRef.current) {
        setLocalFavoriteProperty(propertyId, true);
        seededFromInitialRef.current = true;
        setIsFavorite(true);
        return;
      }

      setIsFavorite(isLocalFavorite);
    };

    sync();
    return subscribeLocalFavoritesChange(sync);
  }, [initialIsFavorite, propertyId]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  async function toggleFavorite() {
    if (isPending) {
      return;
    }

    setIsPending(true);
    setError("");

    try {
      const next = toggleLocalFavoriteProperty(propertyId);
      setIsFavorite(next);
      setIsAnimating(true);
      onToggle?.(next);
      if (animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
      }
      animationTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 380);
    } catch {
      setError("Не удалось обновить избранное");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void toggleFavorite()}
        disabled={isPending}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
        className={cn(
          "wishlist-btn inline-flex items-center rounded-xl border text-xs font-semibold transition",
          isIcon
            ? "icon-button-soft h-10 w-10 justify-center rounded-[15px] px-0"
            : "gap-2.5 px-3.5 py-2.5",
          isFavorite
            ? isIcon
              ? "border-terra/28 bg-[linear-gradient(180deg,rgba(255,248,245,0.98),rgba(252,237,230,0.96))] text-terra shadow-[0_14px_28px_rgba(167,101,73,0.16),inset_0_1px_0_rgba(255,255,255,0.92)]"
              : "border-terra/40 bg-terra/12 text-terra hover:bg-terra/18"
            : isIcon
              ? "text-primary/90"
              : "border-olive/20 bg-white text-olive hover:bg-cream",
          isAnimating ? "active" : "",
          isPending ? "cursor-not-allowed opacity-65" : "",
          className,
        )}
      >
        <span className={isAnimating ? "animate-heart-pop" : ""}>
          <AppIcon
            icon={Heart}
            className={isIcon ? "h-[18px] w-[18px]" : "h-4 w-4"}
            filled={isFavorite}
          />
        </span>
        {isIcon ? (
          <span className="sr-only">{isFavorite ? "В избранном" : "В избранное"}</span>
        ) : (
          <>{isFavorite ? "В избранном" : "В избранное"}</>
        )}
      </button>
      {error && !isIcon ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
