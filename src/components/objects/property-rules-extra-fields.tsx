"use client";

// Client component for property rules extra fields in the objects module.
import { cn } from "@/lib/cn";
import {
  buildMealOptionsValue,
  buildParkingInfoValue,
  buildPrepaymentPolicyValue,
  clampPrepaymentPercent,
  mealPresetOptions,
  parkingPresetOptions,
  parseMealOptionsValue,
  parseParkingInfoValue,
  parsePrepaymentPolicyValue,
  type MealPresetId,
  type ParkingPresetId,
} from "@/lib/property-rules";

type PropertyRulesExtraFieldsProps = {
  parkingInfo: string;
  onParkingInfoChange: (value: string) => void;
  mealOptions: string;
  onMealOptionsChange: (value: string) => void;
  prepaymentPolicy: string;
  onPrepaymentPolicyChange: (value: string) => void;
  className?: string;
};

function SelectionChip({
  label,
  selected,
  onClick,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium leading-5 shadow-sm transition",
        selected
          ? "border-primary/20 bg-primary text-white"
          : "border-olive/12 bg-white text-olive/72 hover:border-primary/18 hover:bg-primary/6",
        disabled && "cursor-not-allowed opacity-45 hover:border-olive/12 hover:bg-white",
      )}
    >
      {label}
    </button>
  );
}

function LegacyValueNotice({ value, onClear }: { value: string; onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-terra/16 bg-terra/8 px-3.5 py-3 text-sm text-olive/78">
      <p className="font-medium text-olive">Сейчас сохранено старое свободное значение</p>
      <p className="mt-1 leading-6 text-olive/68">{value}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-terra transition hover:text-terra-ink"
      >
        Очистить и выбрать из списка
      </button>
    </div>
  );
}

function togglePresetId<T extends string>(selectedIds: readonly T[], id: T): T[] {
  return selectedIds.includes(id)
    ? selectedIds.filter((selectedId) => selectedId !== id)
    : [...selectedIds, id];
}

export function PropertyRulesExtraFields({
  parkingInfo,
  onParkingInfoChange,
  mealOptions,
  onMealOptionsChange,
  prepaymentPolicy,
  onPrepaymentPolicyChange,
  className,
}: PropertyRulesExtraFieldsProps) {
  const parsedParking = parseParkingInfoValue(parkingInfo);
  const parsedMeals = parseMealOptionsValue(mealOptions);
  const parsedPrepayment = parsePrepaymentPolicyValue(prepaymentPolicy);

  function handleParkingToggle(id: ParkingPresetId) {
    const nextIds = togglePresetId(parsedParking.selectedIds, id);
    onParkingInfoChange(buildParkingInfoValue(nextIds) ?? "");
  }

  function handleMealToggle(id: MealPresetId) {
    const nextIds = togglePresetId(parsedMeals.selectedIds, id);
    onMealOptionsChange(buildMealOptionsValue(nextIds) ?? "");
  }

  function handlePrepaymentPercentChange(rawValue: string) {
    const numericValue = clampPrepaymentPercent(Number(rawValue));
    onPrepaymentPolicyChange(
      buildPrepaymentPolicyValue("booking", numericValue, parsedPrepayment.basisId) ?? "",
    );
  }

  function handlePrepaymentReset() {
    onPrepaymentPolicyChange("");
  }

  const hasStructuredPrepayment = parsedPrepayment.timingId !== null;
  const hasLegacyPrepayment = Boolean(parsedPrepayment.legacyText);
  const isPrepaymentEnabled = hasStructuredPrepayment || hasLegacyPrepayment;

  const prepaymentBasisDescription =
    parsedPrepayment.basisId === "first_night"
      ? "Процент от стоимости первой ночи"
      : "Процент от общей стоимости бронирования";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-[24px] border border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,248,245,0.92)_100%)] p-4 shadow-[0_12px_28px_rgba(58,43,35,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-olive">Парковка</p>
            <p className="mt-0.5 text-xs text-olive/50">Выберите доступные варианты парковки</p>
          </div>
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/52">
            Необязательно
          </span>
        </div>
        {parsedParking.legacyText ? (
          <div className="mt-3">
            <LegacyValueNotice
              value={parsedParking.legacyText}
              onClear={() => onParkingInfoChange("")}
            />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {parkingPresetOptions.map((option) => (
            <SelectionChip
              key={option.id}
              label={option.label}
              selected={parsedParking.selectedIds.includes(option.id)}
              onClick={() => handleParkingToggle(option.id)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,248,245,0.92)_100%)] p-4 shadow-[0_12px_28px_rgba(58,43,35,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-olive">Питание</p>
            <p className="mt-0.5 text-xs text-olive/50">Какие варианты питания вы предоставляете</p>
          </div>
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/52">
            Необязательно
          </span>
        </div>
        {parsedMeals.legacyText ? (
          <div className="mt-3">
            <LegacyValueNotice
              value={parsedMeals.legacyText}
              onClear={() => onMealOptionsChange("")}
            />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {mealPresetOptions.map((option) => (
            <SelectionChip
              key={option.id}
              label={option.label}
              selected={parsedMeals.selectedIds.includes(option.id)}
              onClick={() => handleMealToggle(option.id)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,248,245,0.92)_100%)] p-4 shadow-[0_12px_28px_rgba(58,43,35,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-olive">Предоплата при бронировании</p>
            <p className="mt-0.5 text-xs text-olive/50">Сколько процентов гость платит при бронировании</p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
              hasStructuredPrepayment
                ? "bg-primary/8 text-primary"
                : "bg-cream text-olive/52",
            )}
          >
            {hasStructuredPrepayment
              ? `${parsedPrepayment.percent}%`
              : hasLegacyPrepayment
                ? "Указано"
                : "Необязательно"}
          </span>
        </div>
        {parsedPrepayment.legacyText ? (
          <div className="mt-3">
            <LegacyValueNotice
              value={parsedPrepayment.legacyText}
              onClear={() => onPrepaymentPolicyChange("")}
            />
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-olive/10 bg-white/80 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-olive/58">
            <span>
              {hasStructuredPrepayment
                ? prepaymentBasisDescription
                : hasLegacyPrepayment
                  ? "Можно обновить значение ползунком"
                  : "Сдвиньте ползунок, чтобы включить предоплату при бронировании"}
            </span>
            {hasStructuredPrepayment ? (
              <span className="rounded-full bg-cream px-2.5 py-1 text-olive">
                {parsedPrepayment.percent}%
              </span>
            ) : null}
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={parsedPrepayment.percent}
            onChange={(event) => handlePrepaymentPercentChange(event.target.value)}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(90deg,rgba(15,118,110,0.18)_0%,rgba(167,101,73,0.16)_100%)] accent-primary"
          />
          <div className="mt-2 flex justify-between text-[11px] text-olive/42">
            <span>10%</span>
            <span>55%</span>
            <span>100%</span>
          </div>
          {hasStructuredPrepayment ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handlePrepaymentReset}
                className="text-xs font-semibold uppercase tracking-[0.16em] text-olive/46 transition hover:text-olive"
              >
                Убрать предоплату при бронировании
              </button>
            </div>
          ) : !isPrepaymentEnabled ? (
            <p className="mt-3 text-xs leading-5 text-olive/46">
              Предоплата при бронировании останется выключенной, пока вы не измените ползунок.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
