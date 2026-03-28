"use client";

// Client component for housing search guests field in the public module.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import { cn } from "@/lib/cn";

type HousingSearchGuestsFieldProps = {
  initialGuests: string;
  initialAdults?: string;
  initialChildren?: string;
  autoSubmitOnComplete?: boolean;
  onGuestsChange?: (value: { guests: string; adults: string; children: string }) => void;
};

type GuestsState = {
  adults: number;
  childrenAges: number[];
};

const minAdultsCount = 1;
const maxAdultsCount = 12;
const maxChildrenCount = 8;
const maxGuestsCount = maxAdultsCount + maxChildrenCount;

function parseCount(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampAdults(value: number): number {
  if (!Number.isFinite(value)) {
    return minAdultsCount;
  }

  return Math.max(minAdultsCount, Math.min(maxAdultsCount, Math.round(value)));
}

function clampChildren(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(maxChildrenCount, Math.round(value)));
}

function parseInitialGuests(
  initialGuests: string,
  initialAdults?: string,
  initialChildren?: string,
): GuestsState {
  const parsedGuests = parseCount(initialGuests);
  let adults = parseCount(initialAdults);
  let children = parseCount(initialChildren);

  if (adults === null && parsedGuests !== null) {
    adults = children !== null ? parsedGuests - children : parsedGuests;
  }
  if (adults === null) {
    adults = 2;
  }
  adults = clampAdults(adults);

  if (children === null && parsedGuests !== null) {
    children = parsedGuests - adults;
  }
  if (children === null) {
    children = 0;
  }
  children = clampChildren(children);
  const allowedChildren = Math.min(maxChildrenCount, Math.max(0, maxGuestsCount - adults));
  children = Math.min(children, allowedChildren);

  return {
    adults,
    childrenAges: Array.from({ length: children }, () => 0),
  };
}

function pluralize(value: number, variants: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs > 10 && abs < 20) {
    return variants[2];
  }
  if (mod > 1 && mod < 5) {
    return variants[1];
  }
  if (mod === 1) {
    return variants[0];
  }

  return variants[2];
}

function formatChildAgeOption(age: number): string {
  if (age === 0) {
    return "до 1 года";
  }

  return `${age} ${pluralize(age, ["год", "года", "лет"])}`;
}

function getGuestsFieldValue(guests: GuestsState): string {
  const total = guests.adults + guests.childrenAges.length;
  return `${total} ${pluralize(total, ["гость", "гостя", "гостей"])}`;
}

export function HousingSearchGuestsField({
  initialGuests,
  initialAdults,
  initialChildren,
  autoSubmitOnComplete = true,
  onGuestsChange,
}: HousingSearchGuestsFieldProps) {
  const normalizedInitialGuests = useMemo(
    () => parseInitialGuests(initialGuests, initialAdults, initialChildren),
    [initialAdults, initialChildren, initialGuests],
  );
  const [guests, setGuests] = useState<GuestsState>(normalizedInitialGuests);
  const [isOpen, setIsOpen] = useState(false);
  const [newChildAge, setNewChildAge] = useState("");
  const [isChildAgeSelectExpanded, setIsChildAgeSelectExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const guestsFieldValue = useMemo(() => getGuestsFieldValue(guests), [guests]);
  const totalGuests = guests.adults + guests.childrenAges.length;

  useEffect(() => {
    setGuests(normalizedInitialGuests);
  }, [normalizedInitialGuests]);

  useEffect(() => {
    onGuestsChange?.({
      guests: String(totalGuests),
      adults: String(guests.adults),
      children: String(guests.childrenAges.length),
    });
  }, [guests.adults, guests.childrenAges.length, onGuestsChange, totalGuests]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setIsChildAgeSelectExpanded(false);
  }, []);

  const submitSearchForm = useCallback(() => {
    const form = rootRef.current?.closest("form");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, []);

  const updateAdults = useCallback((value: number) => {
    setGuests((prev) => {
      const nextAdults = clampAdults(value);
      const allowedChildren = Math.min(maxChildrenCount, Math.max(0, maxGuestsCount - nextAdults));

      return {
        adults: nextAdults,
        childrenAges: prev.childrenAges.slice(0, allowedChildren),
      };
    });
  }, []);

  const addChild = useCallback(() => {
    const age = Number.parseInt(newChildAge, 10);
    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }

    setGuests((prev) => {
      if (
        prev.childrenAges.length >= maxChildrenCount ||
        prev.adults + prev.childrenAges.length >= maxGuestsCount
      ) {
        return prev;
      }

      return {
        ...prev,
        childrenAges: [...prev.childrenAges, age],
      };
    });
    setNewChildAge("");
    setIsChildAgeSelectExpanded(false);
  }, [newChildAge]);

  const updateChildAge = useCallback((index: number, value: string) => {
    const age = Number.parseInt(value, 10);
    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }

    setGuests((prev) => ({
      ...prev,
      childrenAges: prev.childrenAges.map((item, itemIndex) => (itemIndex === index ? age : item)),
    }));
  }, []);

  const removeChild = useCallback((index: number) => {
    setGuests((prev) => ({
      ...prev,
      childrenAges: prev.childrenAges.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (rootRef.current?.contains(target)) {
        return;
      }

      closePanel();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closePanel();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, isOpen]);

  return (
    <div ref={rootRef} className={cn("relative", isOpen ? "z-[4000]" : "")}>
      <input type="hidden" name="guests" value={String(totalGuests)} />
      <input type="hidden" name="guestsAdults" value={String(guests.adults)} />
      <input type="hidden" name="guestsChildren" value={String(guests.childrenAges.length)} />

      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closePanel();
            return;
          }

          setIsOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="relative h-12 w-full rounded-xl border border-olive/18 bg-white/95 px-3.5 text-left text-olive transition-all duration-200 hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/32"
      >
        <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-olive/60">
          Размещение
        </span>
        <span className="block truncate pr-12 text-sm font-semibold">{guestsFieldValue}</span>
        <FieldAdornmentIcon icon={Users} shellClassName="right-3.5" />
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[3990] bg-primary/30 md:hidden"
            onClick={closePanel}
            aria-label="Закрыть выбор гостей"
          />

          <div className="fixed left-1/2 top-1/2 z-[4000] w-[min(92vw,412px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-olive/14 bg-white p-4 shadow-[0_20px_42px_-24px_rgba(15,74,64,0.62)] md:absolute md:left-0 md:right-auto md:top-[calc(100%+8px)] md:w-[412px] md:translate-x-0 md:translate-y-0">
            <h3 className="text-lg font-semibold text-olive">Гости</h3>

            <div className="mt-3 space-y-3">
              <section className="rounded-xl border border-sand bg-cream p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Взрослые</p>
                    <p className="text-xs text-olive">от 18 лет</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateAdults(guests.adults - 1)}
                      disabled={guests.adults <= 1}
                      aria-label="Уменьшить количество взрослых"
                      className="h-8 w-8 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-olive">
                      {guests.adults}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateAdults(guests.adults + 1)}
                      disabled={totalGuests >= maxGuestsCount}
                      aria-label="Увеличить количество взрослых"
                      className="h-8 w-8 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-sand bg-cream p-3">
                <p className="text-sm font-semibold text-olive">Дети</p>
                <p className="mt-0.5 text-xs text-olive">Возраст на момент выезда из отеля</p>

                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div className="relative">
                    <select
                      size={isChildAgeSelectExpanded ? 6 : 1}
                      value={newChildAge}
                      onFocus={() => setIsChildAgeSelectExpanded(true)}
                      onBlur={() => setIsChildAgeSelectExpanded(false)}
                      onChange={(event) => {
                        setNewChildAge(event.target.value);
                        setIsChildAgeSelectExpanded(false);
                      }}
                      className={cn(
                        "w-full appearance-none rounded-xl border border-sand bg-white px-3 text-sm text-olive outline-none focus:border-primary",
                        isChildAgeSelectExpanded
                          ? "h-auto max-h-[156px] overflow-y-auto py-2 pr-3"
                          : "h-10 pr-9",
                      )}
                    >
                      <option value="">Добавить ребенка</option>
                      {Array.from({ length: 18 }, (_, age) => (
                        <option key={`child-age-${age}`} value={String(age)}>
                          {formatChildAgeOption(age)}
                        </option>
                      ))}
                    </select>

                    <AppIcon
                      icon={ChevronDown}
                      className={cn(
                        "pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2",
                        isChildAgeSelectExpanded ? "hidden" : "",
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addChild}
                    disabled={
                      !newChildAge ||
                      totalGuests >= maxGuestsCount ||
                      guests.childrenAges.length >= maxChildrenCount
                    }
                    className="h-10 rounded-xl border border-sand bg-white px-3 text-sm font-semibold text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Добавить
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {guests.childrenAges.length === 0 ? (
                    <p className="text-xs text-olive">Дети не добавлены</p>
                  ) : (
                    guests.childrenAges.map((age, index) => (
                      <div
                        key={`child-${index}-${age}`}
                        className="grid grid-cols-[1fr_minmax(0,120px)_auto] items-center gap-2 rounded-lg bg-white px-2 py-1.5"
                      >
                        <span className="text-xs font-medium text-olive">Ребенок {index + 1}</span>

                        <select
                          value={String(age)}
                          onChange={(event) => updateChildAge(index, event.target.value)}
                          className="h-8 rounded-lg border border-sand bg-white px-2 text-xs text-olive outline-none focus:border-primary"
                        >
                          {Array.from({ length: 18 }, (_, ageOption) => (
                            <option
                              key={`child-age-option-${index}-${ageOption}`}
                              value={String(ageOption)}
                            >
                              {formatChildAgeOption(ageOption)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeChild(index)}
                          aria-label={`Удалить ребенка ${index + 1}`}
                          className="h-8 rounded-lg border border-terra bg-white px-2 text-xs font-semibold text-terra transition hover:bg-foam"
                        >
                          Удалить
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <button
              type="button"
              onClick={() => {
                closePanel();
                if (autoSubmitOnComplete) {
                  submitSearchForm();
                }
              }}
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Готово
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
