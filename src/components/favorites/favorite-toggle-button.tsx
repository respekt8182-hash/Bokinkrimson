// UI component for favorite toggle button in the favorites module.
"use client";

import { Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

/* ---------- mini-heart particle ---------- */
type Particle = { id: number; angle: number; distance: number; scale: number; delay: number };

let particleIdCounter = 0;

function HeartParticles({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    const count = 6;
    const batch: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: ++particleIdCounter,
      angle: (360 / count) * i + (Math.random() * 30 - 15),
      distance: 18 + Math.random() * 14,
      scale: 0.45 + Math.random() * 0.35,
      delay: Math.random() * 80,
    }));
    setParticles(batch);
    const t = setTimeout(() => setParticles([]), 700);
    return () => clearTimeout(t);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.cos(rad) * p.distance;
        const y = Math.sin(rad) * p.distance;
        return (
          <span
            key={p.id}
            className="heart-particle"
            style={
              {
                "--px": `${x}px`,
                "--py": `${y}px`,
                "--ps": `${p.scale}`,
                animationDelay: `${p.delay}ms`,
              } as React.CSSProperties
            }
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
        );
      })}
    </span>
  );
}

export function FavoriteToggleButton({
  propertyId,
  initialIsFavorite,
  className,
  variant = "default",
  onToggle,
}: FavoriteToggleButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const seededFromInitialRef = useRef(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (animationTimerRef.current !== null) clearTimeout(animationTimerRef.current);
      if (particleTimerRef.current !== null) clearTimeout(particleTimerRef.current);
    };
  }, []);

  const toggleFavorite = useCallback(async () => {
    if (isPending) return;

    setIsPending(true);
    setError("");

    try {
      const next = toggleLocalFavoriteProperty(propertyId);
      setIsFavorite(next);
      setIsAnimating(true);
      onToggle?.(next);

      // Show heart particles only when adding to favorites
      if (next) {
        setShowParticles(true);
        if (particleTimerRef.current !== null) clearTimeout(particleTimerRef.current);
        particleTimerRef.current = setTimeout(() => setShowParticles(false), 750);
      }

      if (animationTimerRef.current !== null) clearTimeout(animationTimerRef.current);
      animationTimerRef.current = setTimeout(() => setIsAnimating(false), 500);
    } catch {
      setError("Не удалось обновить избранное");
    } finally {
      setIsPending(false);
    }
  }, [isPending, propertyId, onToggle]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void toggleFavorite()}
        disabled={isPending}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
        className={cn(
          "wishlist-btn relative inline-flex items-center rounded-xl border text-xs font-semibold transition",
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
        <HeartParticles active={showParticles} />
      </button>
      {error && !isIcon ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
