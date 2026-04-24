"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, MapPin, X } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type SuggestionType = "location" | "hotel";

type SuggestionItem = {
  type: SuggestionType;
  id: string;
  name: string;
  subtitle: string;
  locationId: string | null;
  activeListingsCount: number;
};

type SuggestionsPayload = {
  popular: SuggestionItem[];
  matches: SuggestionItem[];
};

type DropdownOption = {
  key: string;
  item: SuggestionItem;
};

type HousingCatalogSearchComboboxProps = {
  initialQuery: string;
  initialLocation: string;
  locationNames: string[];
  label?: string;
};

const suggestionsListboxId = "home-search-suggestions-listbox";
const cacheTtlMs = 8 * 60_000;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function parseSuggestionsPayload(raw: unknown): SuggestionsPayload {
  const fallback: SuggestionsPayload = {
    popular: [],
    matches: [],
  };

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const payload = raw as Partial<SuggestionsPayload>;
  const parseItems = (value: unknown): SuggestionItem[] =>
    Array.isArray(value)
      ? value
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const candidate = item as Partial<SuggestionItem>;
            if (
              (candidate.type !== "location" && candidate.type !== "hotel") ||
              typeof candidate.id !== "string" ||
              typeof candidate.name !== "string"
            ) {
              return null;
            }

            return {
              type: candidate.type,
              id: candidate.id,
              name: candidate.name,
              subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle : "",
              locationId: typeof candidate.locationId === "string" ? candidate.locationId : null,
              activeListingsCount:
                typeof candidate.activeListingsCount === "number" &&
                Number.isFinite(candidate.activeListingsCount)
                  ? candidate.activeListingsCount
                  : 0,
            } satisfies SuggestionItem;
          })
          .filter((item): item is SuggestionItem => Boolean(item))
      : [];

  return {
    popular: parseItems(payload.popular),
    matches: parseItems(payload.matches),
  };
}

function getOptionDomId(optionKey: string): string {
  return `catalog-search-option-${optionKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexp = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regexp);

  if (parts.length <= 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark key={`mark-${index}`} className="bg-transparent font-semibold text-olive">
        {part}
      </mark>
    ) : (
      <span key={`text-${index}`}>{part}</span>
    ),
  );
}

function LocationIcon(props: { className?: string }) {
  return <AppIcon icon={MapPin} className={props.className} />;
}

function HotelIcon(props: { className?: string }) {
  return <AppIcon icon={Building2} className={props.className} />;
}

function ClearIcon(props: { className?: string }) {
  return <AppIcon icon={X} className={props.className} />;
}

function resolveSearchSubmission(input: {
  value: string;
  selectedSuggestion: SuggestionItem | null;
  locationByNormalizedName: Map<string, string>;
}): { query: string; location: string } {
  const trimmed = input.value.trim();
  if (!trimmed) {
    return { query: "", location: "" };
  }

  const normalized = normalizeText(trimmed);
  const normalizedSelected = input.selectedSuggestion
    ? normalizeText(input.selectedSuggestion.name)
    : "";

  if (input.selectedSuggestion && normalizedSelected === normalized) {
    if (input.selectedSuggestion.type === "location") {
      return {
        query: "",
        location: input.selectedSuggestion.name,
      };
    }

    return {
      query: input.selectedSuggestion.name,
      location: "",
    };
  }

  const matchedLocation = input.locationByNormalizedName.get(normalized);
  if (matchedLocation) {
    return { query: "", location: matchedLocation };
  }

  return {
    query: trimmed,
    location: "",
  };
}

export function HousingCatalogSearchCombobox({
  initialQuery,
  initialLocation,
  locationNames,
  label,
}: HousingCatalogSearchComboboxProps) {
  const initialValue = initialLocation.trim() || initialQuery.trim();
  const [searchValue, setSearchValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popularSuggestions, setPopularSuggestions] = useState<SuggestionItem[]>([]);
  const [matchSuggestions, setMatchSuggestions] = useState<SuggestionItem[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(
    initialLocation.trim()
      ? {
          type: "location",
          id: `initial:${normalizeText(initialLocation)}`,
          name: initialLocation,
          subtitle: "",
          locationId: null,
          activeListingsCount: 0,
        }
      : null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsCacheRef = useRef<
    Map<string, { payload: SuggestionsPayload; expiresAt: number }>
  >(new Map());

  const locationByNormalizedName = useMemo(() => {
    const map = new Map<string, string>();
    for (const name of locationNames) {
      const normalized = normalizeText(name);
      if (!normalized || map.has(normalized)) {
        continue;
      }
      map.set(normalized, name);
    }
    return map;
  }, [locationNames]);

  const visibleSuggestions = searchValue.trim().length > 0 ? matchSuggestions : popularSuggestions;
  const locationSuggestions = visibleSuggestions.filter((item) => item.type === "location");
  const hotelSuggestions = visibleSuggestions.filter((item) => item.type === "hotel");
  const dropdownOptions = useMemo<DropdownOption[]>(() => {
    const options: DropdownOption[] = [];

    for (const [index, item] of locationSuggestions.entries()) {
      options.push({
        key: `location:${item.id}:${index}`,
        item,
      });
    }
    for (const [index, item] of hotelSuggestions.entries()) {
      options.push({
        key: `hotel:${item.id}:${index}`,
        item,
      });
    }

    return options;
  }, [hotelSuggestions, locationSuggestions]);

  const activeOption = dropdownOptions[activeSuggestionIndex] ?? null;
  const activeOptionId = activeOption ? getOptionDomId(activeOption.key) : undefined;
  const isDropdownVisible = isOpen && (dropdownOptions.length > 0 || isLoading);

  const submissionValues = useMemo(
    () =>
      resolveSearchSubmission({
        value: searchValue,
        selectedSuggestion,
        locationByNormalizedName,
      }),
    [locationByNormalizedName, searchValue, selectedSuggestion],
  );

  const applySuggestion = useCallback((item: SuggestionItem) => {
    setSearchValue(item.name);
    setSelectedSuggestion(item);
    setActiveSuggestionIndex(-1);
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const query = searchValue.trim().slice(0, 120);
    const cacheKey = `housing|${query.toLowerCase()}`;
    const cached = suggestionsCacheRef.current.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      setPopularSuggestions(cached.payload.popular);
      setMatchSuggestions(cached.payload.matches);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const isEmptyQuery = query.length === 0;
        const params = new URLSearchParams({
          direction: "housing",
          include: isEmptyQuery ? "locations" : "locations,hotels",
          query,
          limit: isEmptyQuery ? "5" : "12",
        });
        const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
          credentials: "omit",
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }

        const payload = parseSuggestionsPayload(await response.json());
        suggestionsCacheRef.current.set(cacheKey, {
          payload,
          expiresAt: Date.now() + cacheTtlMs,
        });
        setPopularSuggestions(payload.popular);
        setMatchSuggestions(payload.matches);
      } catch {
        // Ignore transient autocomplete fetch errors.
      } finally {
        setIsLoading(false);
      }
    }, query.length === 0 ? 0 : 220);

    return () => {
      abortController.abort();
      window.clearTimeout(timer);
    };
  }, [isOpen, searchValue]);

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

      setIsOpen(false);
      setActiveSuggestionIndex(-1);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn("relative", isDropdownVisible ? "z-[1300]" : "")}>
      {submissionValues.query ? <input type="hidden" name="q" value={submissionValues.query} /> : null}
      {submissionValues.location ? (
        <input type="hidden" name="location" value={submissionValues.location} />
      ) : null}

      {label ? (
        <label
          htmlFor="home-search-input"
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-olive/62"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          id="home-search-input"
          ref={inputRef}
          autoComplete="off"
          placeholder="Город или отель"
          aria-label="Город или отель"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isDropdownVisible}
          aria-controls={suggestionsListboxId}
          aria-activedescendant={activeOptionId}
          value={searchValue}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value);
            setIsOpen(true);
            setActiveSuggestionIndex(-1);
            setSelectedSuggestion((prev) => {
              if (!prev) {
                return null;
              }

              return normalizeText(prev.name) === normalizeText(value) ? prev : null;
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                return;
              }
              if (dropdownOptions.length === 0) {
                return;
              }
              setActiveSuggestionIndex((prev) => (prev + 1) % dropdownOptions.length);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (dropdownOptions.length === 0) {
                return;
              }
              setActiveSuggestionIndex((prev) =>
                prev <= 0 ? dropdownOptions.length - 1 : prev - 1,
              );
              return;
            }

            if (event.key === "Enter" && activeSuggestionIndex >= 0) {
              const option = dropdownOptions[activeSuggestionIndex];
              if (!option) {
                return;
              }
              event.preventDefault();
              applySuggestion(option.item);
              return;
            }

            if (event.key === "Escape") {
              setIsOpen(false);
              setActiveSuggestionIndex(-1);
            }
          }}
          className="h-[62px] w-full rounded-2xl border border-sand bg-white px-4 pr-11 text-base text-olive transition placeholder:text-olive/50 hover:border-olive/32 focus:outline-none focus:ring-2 focus:ring-primary/35"
        />

        {searchValue.trim().length > 0 ? (
          <button
            type="button"
            aria-label="Очистить поиск"
            onClick={() => {
              setSearchValue("");
              setSelectedSuggestion(null);
              setActiveSuggestionIndex(-1);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-3 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--icon-nav)] transition hover:bg-cream hover:text-[color:var(--icon-default)]"
          >
            <ClearIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isDropdownVisible ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[1300] w-full overflow-hidden rounded-2xl border border-sand bg-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.6)]">
          <div
            id={suggestionsListboxId}
            role="listbox"
            className="max-h-[380px] overflow-y-auto p-1.5"
          >
            {isLoading && dropdownOptions.length === 0 ? (
              <p className="px-3 py-5 text-sm text-olive/65">Ищем подходящие варианты...</p>
            ) : null}

            {!isLoading && dropdownOptions.length === 0 ? (
              <p className="px-3 py-5 text-sm text-olive/65">Ничего не найдено.</p>
            ) : null}

            {locationSuggestions.length > 0 ? (
              <div className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                  Локации
                </p>
                <div className="space-y-1">
                  {locationSuggestions.map((item, index) => {
                    const option = dropdownOptions.find(
                      (candidate) => candidate.key === `location:${item.id}:${index}`,
                    );
                    if (!option) {
                      return null;
                    }

                    const optionIndex = dropdownOptions.findIndex(
                      (candidate) => candidate.key === option.key,
                    );
                    const isActive = optionIndex === activeSuggestionIndex;

                    return (
                      <button
                        id={getOptionDomId(option.key)}
                        key={option.key}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(option.item)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                          isActive ? "bg-cream" : "hover:bg-cream",
                        )}
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-olive/70">
                          <LocationIcon className="h-4 w-4" />
                        </span>
                        <span className="block min-w-0">
                          <span className="block truncate text-sm font-semibold text-olive">
                            {renderHighlightedText(item.name, searchValue)}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-olive/64">{item.subtitle}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {hotelSuggestions.length > 0 ? (
              <div className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                  Отели
                </p>
                <div className="space-y-1">
                  {hotelSuggestions.map((item, index) => {
                    const option = dropdownOptions.find(
                      (candidate) => candidate.key === `hotel:${item.id}:${index}`,
                    );
                    if (!option) {
                      return null;
                    }

                    const optionIndex = dropdownOptions.findIndex(
                      (candidate) => candidate.key === option.key,
                    );
                    const isActive = optionIndex === activeSuggestionIndex;

                    return (
                      <button
                        id={getOptionDomId(option.key)}
                        key={option.key}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(option.item)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                          isActive ? "bg-cream" : "hover:bg-cream",
                        )}
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-olive/70">
                          <HotelIcon className="h-4 w-4" />
                        </span>
                        <span className="block min-w-0">
                          <span className="block truncate text-sm font-semibold text-olive">
                            {renderHighlightedText(item.name, searchValue)}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-olive/64">{item.subtitle}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
