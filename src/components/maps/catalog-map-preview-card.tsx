"use client";

import Image from "next/image";
import { Map as MapIcon } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type CatalogMapPreviewCardProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  ariaLabel: string;
  onOpen: () => void;
  className?: string;
  variant?: "default" | "crimea-preview";
};

export function CatalogMapPreviewCard({
  actionLabel = "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u0443",
  ariaLabel,
  onOpen,
  className,
  variant = "default",
}: CatalogMapPreviewCardProps) {
  if (variant === "crimea-preview") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        className={cn(
          "group relative block overflow-hidden rounded-[26px] border border-olive/14 bg-[#dfe8ee] text-left shadow-[0_24px_38px_-30px_rgba(15,74,64,0.34)] transition-transform duration-300 active:scale-[0.99]",
          className,
        )}
      >
        <Image
          src="/crimea-map-preview-realistic.webp"
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 1024px) 100vw, 440px"
          className="scale-[1.03] object-cover object-center transition-transform duration-500 group-hover:scale-[1.06]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.26),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.06)_38%,_rgba(15,23,42,0.48)_100%)]" />

        <div className="relative flex h-full min-h-[160px] flex-col p-5">
          <div className="flex items-start justify-end">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/84 text-primary shadow-sm ring-1 ring-white/60 backdrop-blur">
              <AppIcon icon={MapIcon} className="h-5 w-5" />
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <span className="inline-flex h-12 items-center gap-2 rounded-full bg-white/94 px-5 text-sm font-semibold text-olive shadow-[0_20px_30px_-24px_rgba(15,74,64,0.5)] ring-1 ring-white/60 backdrop-blur transition duration-300 group-hover:bg-white group-hover:shadow-[0_24px_36px_-24px_rgba(15,74,64,0.62)]">
              <AppIcon icon={MapIcon} className="h-4 w-4 text-primary/80" />
              {actionLabel}
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className={cn(
        "group relative block overflow-hidden rounded-[26px] border border-olive/14 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.22),_transparent_45%),radial-gradient(circle_at_80%_25%,_rgba(194,120,3,0.18),_transparent_25%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(243,247,245,0.92))] text-left shadow-[0_24px_38px_-30px_rgba(15,74,64,0.34)] transition-transform duration-300 active:scale-[0.99]",
        className,
      )}
    >
      <div className="absolute inset-0 opacity-90">
        <span className="absolute left-[12%] top-[22%] h-3.5 w-3.5 rounded-full bg-primary/30 shadow-[0_0_0_6px_rgba(15,118,110,0.08)]" />
        <span className="absolute left-[38%] top-[46%] h-3 w-3 rounded-full bg-sky-400/25 shadow-[0_0_0_6px_rgba(56,189,248,0.08)]" />
        <span className="absolute left-[72%] top-[28%] h-4 w-4 rounded-full bg-amber-400/30 shadow-[0_0_0_7px_rgba(245,158,11,0.08)]" />
        <span className="absolute left-[60%] top-[62%] h-2.5 w-2.5 rounded-full bg-rose-400/25 shadow-[0_0_0_5px_rgba(244,63,94,0.08)]" />
        <span className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-midnight/10 via-midnight/0 to-transparent" />
      </div>

      <div className="relative flex h-full min-h-[160px] flex-col p-5">
        <div className="flex items-start justify-end">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/84 text-primary shadow-sm ring-1 ring-white/60 backdrop-blur">
            <AppIcon icon={MapIcon} className="h-5 w-5" />
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <span className="inline-flex h-12 items-center gap-2 rounded-full bg-white/94 px-5 text-sm font-semibold text-olive shadow-[0_20px_30px_-24px_rgba(15,74,64,0.5)] ring-1 ring-white/60 backdrop-blur transition duration-300 group-hover:bg-white group-hover:shadow-[0_24px_36px_-24px_rgba(15,74,64,0.62)]">
            <AppIcon icon={MapIcon} className="h-4 w-4 text-primary/80" />
            {actionLabel}
          </span>
        </div>
      </div>
    </button>
  );
}
