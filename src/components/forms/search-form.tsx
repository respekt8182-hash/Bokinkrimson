"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HousingSearchDateRangeField } from "@/components/public/housing-search-date-range-field";
import { cn } from "@/lib/cn";
import { useEffect, useState, type FormEvent } from "react";

type LocationInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
};

// Reusable location input with server-side fuzzy suggestions (Crimea only).
function LocationInput({ value, onChange, onSelect }: LocationInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/public/locations?query=${encodeURIComponent(value)}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { items: Array<{ id: string; name: string }> };
        setSuggestions(body.items.map((item) => item.name));
      } catch {
        // ignore aborted or transient network errors in autocomplete flow
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="relative">
      <label
        htmlFor="location"
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-olive/70"
      >
        Локация
      </label>
      <Input
        id="location"
        placeholder="Ялта, Судак, Евпатория..."
        value={value}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
      />
      {isOpen && suggestions.length > 0 ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-olive/20 bg-white shadow-md">
          {suggestions.map((option) => (
            <button
              key={option}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-olive hover:bg-cream"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option);
                setIsOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-olive/55">
        {isLoading
          ? "Ищем подходящие локации..."
          : "Подсказки доступны от 2 символов, только локации Крыма."}
      </p>
    </div>
  );
}

const directionConfig = {
  housing: "Жильё",
  excursions: "Экскурсии",
} as const;

type Direction = keyof typeof directionConfig;

export function SearchForm() {
  const [direction, setDirection] = useState<Direction>("housing");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Keep search state in query params so links are shareable and SSR-friendly.
    const params = new URLSearchParams({
      direction,
      q: query,
      location,
      guests: String(guests),
      checkIn,
      checkOut,
    });

    window.location.href = `/search?${params.toString()}`;
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-white/96 p-4 ring-1 ring-olive/10 md:p-5">
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-foam p-1">
        {(Object.keys(directionConfig) as Direction[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setDirection(key)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition",
              direction === key
                ? "bg-primary text-white"
                : "text-olive/70 hover:bg-sand hover:opacity-90",
            )}
          >
            {directionConfig[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label
            htmlFor="searchQuery"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-olive/70"
          >
            Поиск
          </label>
          <Input
            id="searchQuery"
            placeholder={
              direction === "housing" ? "Название жилья, адрес..." : "Название экскурсии..."
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <LocationInput
          value={location}
          onChange={setLocation}
          onSelect={(value) => {
            setLocation(value);
          }}
        />
        <div>
          <label
            htmlFor="guests"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-olive/70"
          >
            Гости
          </label>
          <Input
            id="guests"
            type="number"
            min={1}
            max={20}
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value) || 1)}
          />
        </div>
        <div className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-olive/70">
            Даты проживания
          </span>
          <HousingSearchDateRangeField
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
            onRangeChange={(range) => {
              setCheckIn(range.checkIn);
              setCheckOut(range.checkOut);
            }}
            autoSubmitOnComplete={false}
            showHiddenInputs={false}
          />
        </div>
      </div>

      <Button className="mt-4 w-full">Найти</Button>
    </form>
  );
}
