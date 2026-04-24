"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

export type DetailedGuestsValue = {
  adults: number;
  childrenAges: number[];
};

type DetailedGuestsEditorProps = {
  mode: "detailed";
  value: DetailedGuestsValue;
  onChange: (nextValue: DetailedGuestsValue) => void;
  maxAdults?: number;
  maxChildren?: number;
  maxGuests?: number;
  adultsLabel?: string;
  adultsDescription?: string;
  childrenLabel?: string;
  childrenDescription?: string;
};

type SimpleGuestsEditorProps = {
  mode: "simple";
  value: number;
  onChange: (nextValue: number) => void;
  min?: number;
  max?: number;
  label?: string;
  description?: string;
};

export type UnifiedGuestsEditorProps =
  | DetailedGuestsEditorProps
  | SimpleGuestsEditorProps;

const defaultMinAdultsCount = 1;
const defaultMaxAdultsCount = 12;
const defaultMaxChildrenCount = 8;
const defaultMaxGuestsCount = defaultMaxAdultsCount + defaultMaxChildrenCount;

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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function formatChildAgeOption(age: number): string {
  if (age === 0) {
    return "до 1 года";
  }

  return `${age} ${pluralize(age, ["год", "года", "лет"])}`;
}

export function formatGuestsSummaryLabel(adults: number, childrenCount = 0): string {
  const total = adults + childrenCount;
  return `${total} ${pluralize(total, ["гость", "гостя", "гостей"])}`;
}

export function parseDetailedGuestsValue(input: {
  guests?: string;
  adults?: string;
  children?: string;
}): DetailedGuestsValue {
  const guests = Number.parseInt(input.guests ?? "", 10);
  let adults = Number.parseInt(input.adults ?? "", 10);
  let children = Number.parseInt(input.children ?? "", 10);

  if (!Number.isFinite(adults)) {
    adults = Number.isFinite(guests) ? guests : 2;
  }

  if (!Number.isFinite(children)) {
    children = Number.isFinite(guests) ? Math.max(0, guests - adults) : 0;
  }

  const normalizedAdults = clamp(adults, defaultMinAdultsCount, defaultMaxAdultsCount);
  const allowedChildren = Math.min(
    defaultMaxChildrenCount,
    Math.max(0, defaultMaxGuestsCount - normalizedAdults),
  );
  const normalizedChildren = clamp(children, 0, allowedChildren);

  return {
    adults: normalizedAdults,
    childrenAges: Array.from({ length: normalizedChildren }, () => 0),
  };
}

export function UnifiedGuestsEditor(props: UnifiedGuestsEditorProps) {
  const [pendingChildAgeValue, setPendingChildAgeValue] = useState("");
  const [isChildAgeSelectExpanded, setIsChildAgeSelectExpanded] = useState(false);
  const [openedChildAgeDropdownKey, setOpenedChildAgeDropdownKey] = useState<string | null>(null);

  const pendingChildAgeLabel = useMemo(() => {
    if (!pendingChildAgeValue) {
      return "Выберите возраст";
    }

    return formatChildAgeOption(Number.parseInt(pendingChildAgeValue, 10));
  }, [pendingChildAgeValue]);

  const closeNestedDropdowns = useCallback(() => {
    setIsChildAgeSelectExpanded(false);
    setOpenedChildAgeDropdownKey(null);
  }, []);

  if (props.mode === "simple") {
    const minValue = props.min ?? 1;
    const maxValue = props.max ?? 40;

    return (
      <div className="flex items-center justify-between rounded-[24px] border border-olive/10 bg-white px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold text-olive">{props.label ?? "Гости"}</p>
          <p className="text-xs text-olive/55">{props.description ?? "От 1 до 40 человек"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => props.onChange(clamp(props.value - 1, minValue, maxValue))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-olive/16 bg-white text-lg text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
            disabled={props.value <= minValue}
            aria-label="Уменьшить количество гостей"
          >
            -
          </button>
          <span className="w-14 text-center text-base font-semibold text-olive">{props.value}</span>
          <button
            type="button"
            onClick={() => props.onChange(clamp(props.value + 1, minValue, maxValue))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-olive/16 bg-white text-lg text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
            disabled={props.value >= maxValue}
            aria-label="Увеличить количество гостей"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  const maxAdults = props.maxAdults ?? defaultMaxAdultsCount;
  const maxChildren = props.maxChildren ?? defaultMaxChildrenCount;
  const maxGuests = props.maxGuests ?? defaultMaxGuestsCount;
  const adults = clamp(props.value.adults, defaultMinAdultsCount, maxAdults);
  const childrenAges = props.value.childrenAges.slice(0, Math.max(0, maxGuests - adults));
  const totalGuests = adults + childrenAges.length;

  const updateAdults = (nextAdultsValue: number) => {
    const nextAdults = clamp(nextAdultsValue, defaultMinAdultsCount, maxAdults);
    const allowedChildren = Math.min(maxChildren, Math.max(0, maxGuests - nextAdults));

    props.onChange({
      adults: nextAdults,
      childrenAges: childrenAges.slice(0, allowedChildren),
    });
  };

  const addChild = () => {
    const age = Number.parseInt(pendingChildAgeValue, 10);
    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }

    if (childrenAges.length >= maxChildren || totalGuests >= maxGuests) {
      return;
    }

    props.onChange({
      adults,
      childrenAges: [...childrenAges, age],
    });
    setPendingChildAgeValue("");
    setIsChildAgeSelectExpanded(false);
  };

  const updateChildAge = (index: number, nextAgeValue: string) => {
    const age = Number.parseInt(nextAgeValue, 10);
    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }

    props.onChange({
      adults,
      childrenAges: childrenAges.map((item, itemIndex) => (itemIndex === index ? age : item)),
    });
  };

  const removeChild = (index: number) => {
    props.onChange({
      adults,
      childrenAges: childrenAges.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-sand bg-cream p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-olive">
              {props.adultsLabel ?? "Взрослые"}
            </p>
            <p className="text-xs text-olive">
              {props.adultsDescription ?? "от 18 лет"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateAdults(adults - 1)}
              disabled={adults <= defaultMinAdultsCount}
              aria-label="Уменьшить количество взрослых"
              className="h-8 w-8 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
            >
              -
            </button>
            <span className="w-8 text-center text-sm font-semibold text-olive">{adults}</span>
            <button
              type="button"
              onClick={() => updateAdults(adults + 1)}
              disabled={totalGuests >= maxGuests}
              aria-label="Увеличить количество взрослых"
              className="h-8 w-8 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-sand bg-cream p-3">
        <p className="text-sm font-semibold text-olive">{props.childrenLabel ?? "Дети"}</p>
        <p className="mt-0.5 text-xs text-olive">
          {props.childrenDescription ?? "Возраст на момент выезда из отеля"}
        </p>

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isChildAgeSelectExpanded}
              onClick={() => {
                setOpenedChildAgeDropdownKey(null);
                setIsChildAgeSelectExpanded((current) => !current);
              }}
              className="flex h-10 w-full items-center justify-between rounded-xl border border-sand bg-white px-3 text-sm text-olive transition hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span className="truncate">{pendingChildAgeLabel}</span>
              <AppIcon
                icon={ChevronDown}
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isChildAgeSelectExpanded ? "rotate-180" : "",
                )}
              />
            </button>

            <div
              role="listbox"
              className={cn(
                "animated-popover custom-scrollbar absolute left-0 top-[calc(100%+4px)] z-40 h-[160px] w-full overflow-y-auto rounded-xl border border-sand bg-white p-1.5 shadow-lg transition-all duration-300 ease-out",
                isChildAgeSelectExpanded
                  ? "visible translate-y-0 opacity-100 pointer-events-auto"
                  : "invisible -translate-y-[10px] opacity-0 pointer-events-none",
              )}
            >
              <div className="flex flex-col gap-0.5">
                {Array.from({ length: 18 }, (_, age) => {
                  const optionValue = String(age);
                  const isSelected = optionValue === pendingChildAgeValue;

                  return (
                    <button
                      key={`guest-child-age-${age}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setPendingChildAgeValue(optionValue);
                        setIsChildAgeSelectExpanded(false);
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-olive transition active:bg-sand/30",
                        isSelected ? "bg-cream" : "hover:bg-cream",
                      )}
                    >
                      {formatChildAgeOption(age)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={addChild}
            disabled={!pendingChildAgeValue || totalGuests >= maxGuests || childrenAges.length >= maxChildren}
            className="h-10 rounded-xl border border-sand bg-white px-3 text-sm font-semibold text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
          >
            Добавить
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {childrenAges.length === 0 ? (
            <p className="text-xs text-olive">Дети не добавлены</p>
          ) : (
            childrenAges.map((age, index) => {
              const ageKey = `guest-child-${index}`;
              const isAgeDropdownOpen = openedChildAgeDropdownKey === ageKey;

              return (
                <div
                  key={`${ageKey}-${age}`}
                  className="grid grid-cols-[1fr_minmax(0,120px)_auto] items-center gap-2 rounded-lg bg-white px-2 py-1.5"
                >
                  <span className="text-xs font-medium text-olive">Ребенок {index + 1}</span>

                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isAgeDropdownOpen}
                      onClick={() => {
                        setIsChildAgeSelectExpanded(false);
                        setOpenedChildAgeDropdownKey((current) =>
                          current === ageKey ? null : ageKey,
                        );
                      }}
                      className="flex h-8 w-full items-center justify-between rounded-lg border border-sand bg-white px-2 text-xs text-olive outline-none transition hover:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <span className="truncate">{formatChildAgeOption(age)}</span>
                      <AppIcon
                        icon={ChevronDown}
                        className={cn(
                          "ml-1 h-4 w-4 shrink-0 transition-transform duration-200",
                          isAgeDropdownOpen ? "rotate-180" : "",
                        )}
                      />
                    </button>

                    <div
                      role="listbox"
                      className={cn(
                        "animated-popover custom-scrollbar absolute left-0 top-[calc(100%+4px)] z-40 h-[160px] w-full overflow-y-auto rounded-xl border border-sand bg-white p-1.5 shadow-lg transition-all duration-300 ease-out",
                        isAgeDropdownOpen
                          ? "visible translate-y-0 opacity-100 pointer-events-auto"
                          : "invisible -translate-y-[10px] opacity-0 pointer-events-none",
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        {Array.from({ length: 18 }, (_, ageOption) => {
                          const optionValue = String(ageOption);
                          const isSelected = ageOption === age;

                          return (
                            <button
                              key={`${ageKey}-option-${ageOption}`}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                updateChildAge(index, optionValue);
                                setOpenedChildAgeDropdownKey(null);
                              }}
                              className={cn(
                                "cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-olive transition active:bg-sand/30",
                                isSelected ? "bg-cream" : "hover:bg-cream",
                              )}
                            >
                              {formatChildAgeOption(ageOption)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      closeNestedDropdowns();
                      removeChild(index);
                    }}
                    aria-label={`Удалить ребенка ${index + 1}`}
                    className="h-8 rounded-lg border border-terra bg-white px-2 text-xs font-semibold text-terra transition hover:bg-foam"
                  >
                    Удалить
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
