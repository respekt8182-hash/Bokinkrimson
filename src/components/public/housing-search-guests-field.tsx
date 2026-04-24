"use client";

import { Users } from "lucide-react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  CatalogFilterPanelActions,
  ResponsiveFilterPanel,
} from "@/components/public/catalog-filter-shell";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import {
  UnifiedGuestsEditor,
  formatGuestsSummaryLabel,
  parseDetailedGuestsValue,
  type DetailedGuestsValue,
} from "@/components/ui/unified-guests-editor";
import { cn } from "@/lib/cn";

type HousingSearchGuestsFieldProps = {
  initialGuests: string;
  initialAdults?: string;
  initialChildren?: string;
  autoSubmitOnComplete?: boolean;
  showHiddenInputs?: boolean;
  buttonClassName?: string;
  fieldLabel?: string;
  panelTitle?: string;
  applyLabel?: string;
  onGuestsChange?: (value: { guests: string; adults: string; children: string }) => void;
};

export function HousingSearchGuestsField({
  initialGuests,
  initialAdults,
  initialChildren,
  autoSubmitOnComplete = true,
  showHiddenInputs = true,
  buttonClassName,
  fieldLabel = "Размещение",
  panelTitle = "Гости",
  applyLabel = "Готово",
  onGuestsChange,
}: HousingSearchGuestsFieldProps) {
  const normalizedInitialGuests = useMemo(
    () =>
      parseDetailedGuestsValue({
        guests: initialGuests,
        adults: initialAdults,
        children: initialChildren,
      }),
    [initialAdults, initialChildren, initialGuests],
  );
  const [guests, setGuests] = useState<DetailedGuestsValue>(normalizedInitialGuests);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const totalGuests = guests.adults + guests.childrenAges.length;
  const guestsFieldValue = useMemo(
    () => formatGuestsSummaryLabel(guests.adults, guests.childrenAges.length),
    [guests.adults, guests.childrenAges.length],
  );
  const emitGuestsChange = useEffectEvent((nextGuests: DetailedGuestsValue) => {
    onGuestsChange?.({
      guests: String(nextGuests.adults + nextGuests.childrenAges.length),
      adults: String(nextGuests.adults),
      children: String(nextGuests.childrenAges.length),
    });
  });

  useEffect(() => {
    setGuests(normalizedInitialGuests);
  }, [normalizedInitialGuests]);

  useEffect(() => {
    emitGuestsChange(guests);
  }, [guests]);

  const submitSearchForm = useCallback(() => {
    const form = rootRef.current?.closest("form");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, []);

  return (
    <div ref={rootRef}>
      {showHiddenInputs ? <input type="hidden" name="guests" value={String(totalGuests)} /> : null}
      {showHiddenInputs ? (
        <input type="hidden" name="guestsAdults" value={String(guests.adults)} />
      ) : null}
      {showHiddenInputs ? (
        <input type="hidden" name="guestsChildren" value={String(guests.childrenAges.length)} />
      ) : null}

      <ResponsiveFilterPanel
        open={isOpen}
        title={panelTitle}
        onClose={() => setIsOpen(false)}
        width={412}
        trigger={
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className={cn(
              "relative h-12 w-full rounded-xl border border-olive/18 bg-white/95 px-3.5 text-left text-olive transition-all duration-200 hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/32",
              buttonClassName,
            )}
          >
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-olive/60">
              {fieldLabel}
            </span>
            <span className="block truncate pr-12 text-sm font-semibold">{guestsFieldValue}</span>
            <FieldAdornmentIcon icon={Users} shellClassName="right-3.5" />
          </button>
        }
        footer={
          <CatalogFilterPanelActions
            onApply={() => {
              setIsOpen(false);
              if (autoSubmitOnComplete) {
                submitSearchForm();
              }
            }}
            applyLabel={applyLabel}
          />
        }
      >
        <UnifiedGuestsEditor mode="detailed" value={guests} onChange={setGuests} />
      </ResponsiveFilterPanel>
    </div>
  );
}
