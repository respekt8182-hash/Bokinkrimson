"use client";

import { useEffect, useId, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  HousingSearchSidebarFilters,
  type HousingSearchSidebarFiltersProps,
  type SidebarFilterOutput,
} from "@/components/public/housing-search-sidebar-filters";
import { AppIcon } from "@/components/ui/app-icon";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

type HousingFiltersOverlayProps = Omit<HousingSearchSidebarFiltersProps, "formId" | "onSubmit">;

type HousingFiltersOverlayWithBadgeProps = HousingFiltersOverlayProps & {
  activeFiltersCount?: number;
  /** Client-side apply: merges sidebar output + local location. No page navigation. */
  onApply?: (output: SidebarFilterOutput & { location?: string }) => void;
  locationNames?: string[];
};

export function HousingFiltersOverlay({
  activeFiltersCount = 0,
  onApply,
  locationNames,
  ...props
}: HousingFiltersOverlayWithBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localLocation, setLocalLocation] = useState(props.location ?? "");
  const titleId = useId();
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleSidebarApply(output: SidebarFilterOutput) {
    setIsOpen(false);
    onApply?.({ ...output, location: localLocation });
  }

  const modal = isOpen ? (
    <div className="fixed inset-0 z-[90]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Закрыть фильтры"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-olive/35 backdrop-blur-[1px]"
      />
      {/* Bottom sheet on mobile, centered modal on md+ */}
      <div className="absolute inset-x-0 bottom-0 md:bottom-auto md:inset-x-0 md:top-[10vh] md:mx-auto md:w-full md:max-w-xl md:px-3 md:pb-3">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[90dvh] flex-col rounded-t-3xl border border-olive/14 bg-white shadow-[0_-8px_40px_rgba(15,118,110,0.18)] md:max-h-[84vh] md:rounded-2xl md:shadow-[0_18px_42px_rgba(15,118,110,0.24)]"
        >
          {/* Handle bar (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="h-1 w-10 rounded-full bg-olive/20" />
          </div>

          <div className="flex items-center justify-between border-b border-olive/10 px-4 py-3">
            <h2 id={titleId} className="text-base font-semibold text-olive">
              Фильтры
              {(props as { activeFiltersCount?: number }).activeFiltersCount ? null : null}
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive transition hover:bg-cream/70"
              aria-label="Закрыть"
            >
              <AppIcon icon={X} className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* Location picker — present in mobile overlay so users don't lose access on small screens */}
            <div className="mb-3 rounded-xl border border-olive/14 bg-cream/45 px-3 py-2.5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-olive/60">
                Локация
              </p>
              <input
                value={localLocation}
                onChange={(e) => setLocalLocation(e.target.value)}
                list="mobile-overlay-location-list"
                className="w-full rounded-xl border border-olive/20 bg-white px-3 py-2 text-sm text-olive outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Например: Ялта"
              />
              {locationNames && locationNames.length > 0 ? (
                <datalist id="mobile-overlay-location-list">
                  {locationNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
            </div>

            <HousingSearchSidebarFilters
              {...props}
              formId="catalog-mobile-filters"
              onApply={onApply ? handleSidebarApply : undefined}
              onSubmit={() => setIsOpen(false)}
            />
          </div>
        </section>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Фильтры"
        title="Фильтры"
        onClick={() => {
          setLocalLocation(props.location ?? "");
          setIsOpen(true);
        }}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-olive/18 bg-white px-3.5 text-sm font-semibold text-olive transition hover:bg-cream/70 active:bg-cream/90"
      >
        <AppIcon icon={SlidersHorizontal} className="h-4 w-4 shrink-0" />
        <span>Фильтры</span>
        {activeFiltersCount > 0 ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-white">
            {activeFiltersCount}
          </span>
        ) : null}
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}
