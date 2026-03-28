"use client";

import { cn } from "@/lib/cn";
import {
  forwardRef,
  useCallback,
  useState,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import {
  RU,
  BY,
  KZ,
  UZ,
  KG,
  TJ,
  TM,
  AM,
  GE,
  AZ,
  MD,
  TR,
  DE,
  IL,
  US,
  GB,
  FR,
  IT,
  ES,
  CN,
  AE,
  TH,
} from "country-flag-icons/react/3x2";

type FlagComponent = (props: HTMLAttributes<HTMLElement & SVGElement>) => React.JSX.Element;

type CountryEntry = {
  code: string;
  iso: string;
  Flag: FlagComponent;
  label: string;
};

// Country codes — popular CIS and international destinations
const COUNTRY_CODES: CountryEntry[] = [
  { code: "+7", iso: "RU", Flag: RU, label: "Россия" },
  { code: "+375", iso: "BY", Flag: BY, label: "Беларусь" },
  { code: "+7", iso: "KZ", Flag: KZ, label: "Казахстан" },
  { code: "+998", iso: "UZ", Flag: UZ, label: "Узбекистан" },
  { code: "+996", iso: "KG", Flag: KG, label: "Кыргызстан" },
  { code: "+992", iso: "TJ", Flag: TJ, label: "Таджикистан" },
  { code: "+993", iso: "TM", Flag: TM, label: "Туркменистан" },
  { code: "+374", iso: "AM", Flag: AM, label: "Армения" },
  { code: "+995", iso: "GE", Flag: GE, label: "Грузия" },
  { code: "+994", iso: "AZ", Flag: AZ, label: "Азербайджан" },
  { code: "+373", iso: "MD", Flag: MD, label: "Молдова" },
  { code: "+90", iso: "TR", Flag: TR, label: "Турция" },
  { code: "+49", iso: "DE", Flag: DE, label: "Германия" },
  { code: "+972", iso: "IL", Flag: IL, label: "Израиль" },
  { code: "+1", iso: "US", Flag: US, label: "США" },
  { code: "+44", iso: "GB", Flag: GB, label: "Великобритания" },
  { code: "+33", iso: "FR", Flag: FR, label: "Франция" },
  { code: "+39", iso: "IT", Flag: IT, label: "Италия" },
  { code: "+34", iso: "ES", Flag: ES, label: "Испания" },
  { code: "+86", iso: "CN", Flag: CN, label: "Китай" },
  { code: "+971", iso: "AE", Flag: AE, label: "ОАЭ" },
  { code: "+66", iso: "TH", Flag: TH, label: "Таиланд" },
];

/**
 * Format a raw digit string (without country code) into a readable phone mask.
 * For +7:  978 123-45-67  (10 digits)
 * For others: raw digits with spaces every 3.
 */
function formatPhoneDigits(digits: string, countryCode: string): string {
  if (countryCode === "+7") {
    // Format: XXX XXX-XX-XX
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length > 3) parts.push(" " + digits.slice(3, 6));
    if (digits.length > 6) parts.push("-" + digits.slice(6, 8));
    if (digits.length > 8) parts.push("-" + digits.slice(8, 10));
    return parts.join("");
  }
  // Fallback: space every 3 digits
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ");
}

function getMaxDigits(countryCode: string): number {
  if (countryCode === "+7") return 10;
  if (countryCode === "+375") return 10;
  if (countryCode === "+1") return 10;
  if (countryCode === "+86") return 11;
  return 12;
}

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export type PhoneInputValue = {
  countryCode: string;
  countryIso?: string; // disambiguates countries sharing the same code (e.g. +7)
  phone: string; // raw digits only, no formatting
};

type PhoneInputProps = {
  value: PhoneInputValue;
  onChange: (value: PhoneInputValue) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, id, name, disabled, className, hasError },
  ref,
) {
  const [isCountryOpen, setIsCountryOpen] = useState(false);

  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === value.countryCode && c.iso === value.countryIso) ??
    COUNTRY_CODES.find((c) => c.code === value.countryCode) ??
    COUNTRY_CODES[0];

  const SelectedFlag = selectedCountry.Flag;
  const formatted = formatPhoneDigits(value.phone, value.countryCode);
  const maxDigits = getMaxDigits(value.countryCode);

  const handlePhoneChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = stripNonDigits(e.target.value).slice(0, maxDigits);
      onChange({ countryCode: value.countryCode, countryIso: value.countryIso, phone: raw });
    },
    [onChange, value.countryCode, value.countryIso, maxDigits],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && value.phone.length > 0) {
        e.preventDefault();
        onChange({
          countryCode: value.countryCode,
          countryIso: value.countryIso,
          phone: value.phone.slice(0, -1),
        });
      }
    },
    [onChange, value],
  );

  const selectCountry = useCallback(
    (entry: CountryEntry) => {
      setIsCountryOpen(false);
      onChange({ countryCode: entry.code, countryIso: entry.iso, phone: "" });
    },
    [onChange],
  );

  const placeholder = "Номер телефона";

  return (
    <div className={cn("relative flex", className)}>
      {/* Country code selector */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsCountryOpen((o) => !o)}
          className={cn(
            "flex h-full items-center gap-1.5 rounded-l-xl border border-r-0 bg-cream/80 px-3 text-sm font-medium text-olive transition hover:bg-cream",
            hasError ? "border-red-400" : "border-olive/18",
            disabled && "cursor-not-allowed opacity-55",
          )}
        >
          <SelectedFlag className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-sm" />
          <span>{selectedCountry.code}</span>
          <svg
            className="h-3.5 w-3.5 text-olive/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isCountryOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[220px] overflow-y-auto rounded-xl border border-olive/14 bg-white py-1 shadow-lg">
            {COUNTRY_CODES.map((c) => {
              const ItemFlag = c.Flag;
              const isSelected =
                c.code === selectedCountry.code && c.iso === selectedCountry.iso;

              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-olive transition hover:bg-cream/80",
                    isSelected && "bg-cream font-semibold",
                  )}
                >
                  <ItemFlag className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-sm" />
                  <span>{c.label}</span>
                  <span className="ml-auto text-olive/60">{c.code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        ref={ref}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={formatted}
        onChange={handlePhoneChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-r-xl border bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/22",
          hasError ? "border-red-400" : "border-olive/18",
          disabled && "cursor-not-allowed opacity-55",
        )}
      />
    </div>
  );
});
