// UI component for room occupancy chessboard in the rooms module.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedRoom } from "@/lib/rooms";
import type { SerializedRoomOccupancy } from "@/lib/occupancy";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/pricing";

type RoomOccupancyChessboardProps = {
  propertyId: string;
  room: SerializedRoom;
  workspaceMode?: boolean;
  onChanged?: () => Promise<void>;
};

type CalendarMode = "dates" | "params";

const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const monthLabels = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function addUtcMonths(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeRange(fromIso: string, toIso: string): { from: string; to: string } {
  return compareIsoDates(fromIso, toIso) <= 0
    ? { from: fromIso, to: toIso }
    : { from: toIso, to: fromIso };
}

function formatIsoDate(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString("ru-RU");
}

function formatSelectedRange(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) {
    return "Период не выбран";
  }
  if (fromIso === toIso) {
    return formatIsoDate(fromIso);
  }
  return `${formatIsoDate(fromIso)} - ${formatIsoDate(toIso)}`;
}

function buildMonthGrid(month: Date): Array<{ iso: string; dayNumber: number; inCurrentMonth: boolean }> {
  const monthStart = startOfUtcMonth(month);
  const monthEnd = endOfUtcMonth(month);
  const weekDayOffset = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = addDays(monthStart, -weekDayOffset);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = addDays(gridStart, index);
    const iso = toIsoDate(date);
    return {
      iso,
      dayNumber: date.getUTCDate(),
      inCurrentMonth: date >= monthStart && date <= monthEnd,
    };
  });
}

function periodContainsDate(dateFrom: string, dateTo: string, dayIso: string): boolean {
  return compareIsoDates(dateFrom, dayIso) <= 0 && compareIsoDates(dayIso, dateTo) <= 0;
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatOccupancyPeriod(item: SerializedRoomOccupancy): string {
  const dateLabel =
    item.dateFrom === item.dateTo
      ? formatIsoDate(item.dateFrom)
      : `${formatIsoDate(item.dateFrom)} - ${formatIsoDate(item.dateTo)}`;
  const timeLabel =
    item.timeFrom || item.timeTo
      ? `${item.timeFrom ?? "--:--"} - ${item.timeTo ?? "--:--"}`
      : "Весь день";
  return `${dateLabel}, ${timeLabel}`;
}

export function RoomOccupancyChessboard({
  propertyId,
  room,
  workspaceMode = false,
  onChanged,
}: RoomOccupancyChessboardProps) {
  const minMonth = useMemo(() => startOfUtcMonth(new Date()), []);
  const availableMonths = useMemo(
    () => Array.from({ length: 36 }).map((_, index) => addUtcMonths(minMonth, index)),
    [minMonth],
  );
  const minDateIso = toIsoDate(minMonth);
  const maxDateIso = toIsoDate(endOfUtcMonth(availableMonths[availableMonths.length - 1]));

  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const currentMonth = availableMonths[currentMonthIndex];
  const currentYear = currentMonth.getUTCFullYear();

  const yearOptions = useMemo(
    () => Array.from(new Set(availableMonths.map((month) => month.getUTCFullYear()))),
    [availableMonths],
  );

  const monthOptionsForYear = useMemo(() => {
    return availableMonths
      .map((month, index) => ({ month, index }))
      .filter((item) => item.month.getUTCFullYear() === currentYear);
  }, [availableMonths, currentYear]);

  const grid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const [mode, setMode] = useState<CalendarMode>("dates");

  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [tapAnchor, setTapAnchor] = useState<string | null>(null);

  const [occupancies, setOccupancies] = useState<SerializedRoomOccupancy[]>([]);
  const [isLoadingOccupancies, setIsLoadingOccupancies] = useState(false);
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [isSavingParams, setIsSavingParams] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingOccupancyId, setEditingOccupancyId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestContacts, setGuestContacts] = useState("");
  const [description, setDescription] = useState("");

  const [priceInput, setPriceInput] = useState("");
  const [minGuestsInput, setMinGuestsInput] = useState("");
  const [currency, setCurrency] = useState("RUB");

  const isDraggingRef = useRef(false);
  const dragAnchorRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);

  async function notifyChanged() {
    if (onChanged) {
      await onChanged();
    }
  }

  const refreshOccupancies = useCallback(async () => {
    setIsLoadingOccupancies(true);
    try {
      const url = `/api/properties/${propertyId}/rooms/${room.id}/occupancy?from=${encodeURIComponent(minDateIso)}&to=${encodeURIComponent(maxDateIso)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { items: SerializedRoomOccupancy[] };
      setOccupancies(body.items);
    } finally {
      setIsLoadingOccupancies(false);
    }
  }, [maxDateIso, minDateIso, propertyId, room.id]);

  useEffect(() => {
    void refreshOccupancies();
  }, [refreshOccupancies]);

  useEffect(() => {
    function handleMouseUp() {
      isDraggingRef.current = false;
      dragAnchorRef.current = null;
    }

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function applySelectedRange(fromIso: string, toIso: string) {
    const normalized = normalizeRange(fromIso, toIso);
    setSelectedFrom(normalized.from);
    setSelectedTo(normalized.to);
  }

  function resetDateForm() {
    setEditingOccupancyId(null);
    setTimeFrom("");
    setTimeTo("");
    setGuestName("");
    setGuestPhone("");
    setGuestContacts("");
    setDescription("");
  }

  function resetParamsForm() {
    setEditingPriceId(null);
    setPriceInput("");
    setMinGuestsInput("");
    setCurrency("RUB");
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function handleDayMouseDown(dayIso: string) {
    if (compareIsoDates(dayIso, minDateIso) < 0 || compareIsoDates(dayIso, maxDateIso) > 0) {
      return;
    }
    dragAnchorRef.current = dayIso;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    applySelectedRange(dayIso, dayIso);
    clearMessages();
  }

  function handleDayMouseEnter(dayIso: string) {
    if (!isDraggingRef.current || !dragAnchorRef.current) {
      return;
    }
    dragMovedRef.current = true;
    applySelectedRange(dragAnchorRef.current, dayIso);
  }

  function handleDayClick(dayIso: string) {
    if (compareIsoDates(dayIso, minDateIso) < 0 || compareIsoDates(dayIso, maxDateIso) > 0) {
      return;
    }

    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      setTapAnchor(null);
      return;
    }

    clearMessages();
    setEditingOccupancyId(null);
    setEditingPriceId(null);

    if (!tapAnchor) {
      setTapAnchor(dayIso);
      applySelectedRange(dayIso, dayIso);
      return;
    }

    applySelectedRange(tapAnchor, dayIso);
    setTapAnchor(null);
  }

  function startEditOccupancy(item: SerializedRoomOccupancy) {
    setMode("dates");
    clearMessages();
    applySelectedRange(item.dateFrom, item.dateTo);
    setTapAnchor(null);
    setEditingOccupancyId(item.id);
    setTimeFrom(item.timeFrom ?? "");
    setTimeTo(item.timeTo ?? "");
    setGuestName(item.guestName ?? "");
    setGuestPhone(item.guestPhone ?? "");
    setGuestContacts(item.guestContacts ?? "");
    setDescription(item.description ?? "");
  }

  function startEditPrice(item: {
    id: string;
    dateFrom: string;
    dateTo: string;
    price: number;
    minGuests: number | null;
    currency: string;
  }) {
    setMode("params");
    clearMessages();
    applySelectedRange(item.dateFrom, item.dateTo);
    setTapAnchor(null);
    setEditingPriceId(item.id);
    setPriceInput(String(item.price));
    setMinGuestsInput(item.minGuests === null ? "" : String(item.minGuests));
    setCurrency(item.currency);
  }

  async function saveDatesPeriod() {
    clearMessages();

    if (!selectedFrom || !selectedTo) {
      setError("Выберите период в шахматке");
      return;
    }

    setIsSavingDates(true);

    try {
      const url = editingOccupancyId
        ? `/api/properties/${propertyId}/rooms/${room.id}/occupancy/${editingOccupancyId}`
        : `/api/properties/${propertyId}/rooms/${room.id}/occupancy`;
      const method = editingOccupancyId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: selectedFrom,
          dateTo: selectedTo,
          timeFrom: normalizeOptionalText(timeFrom),
          timeTo: normalizeOptionalText(timeTo),
          guestName: normalizeOptionalText(guestName),
          guestPhone: normalizeOptionalText(guestPhone),
          guestContacts: normalizeOptionalText(guestContacts),
          description: normalizeOptionalText(description),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось сохранить период занятости");
        return;
      }

      setSuccess(editingOccupancyId ? "Период занятости обновлен" : "Период занятости добавлен");
      resetDateForm();
      await refreshOccupancies();
      await notifyChanged();
    } finally {
      setIsSavingDates(false);
    }
  }

  async function deleteOccupancy(id: string) {
    clearMessages();

    const response = await fetch(`/api/properties/${propertyId}/rooms/${room.id}/occupancy/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Не удалось удалить период занятости");
      return;
    }

    if (editingOccupancyId === id) {
      resetDateForm();
    }
    setSuccess("Период занятости удален");
    await refreshOccupancies();
    await notifyChanged();
  }

  async function saveParamsPeriod() {
    clearMessages();

    if (!selectedFrom || !selectedTo) {
      setError("Выберите период в шахматке");
      return;
    }

    const normalizedPrice = Number(priceInput.replace(",", "."));
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setError("Укажите корректную цену за ночь");
      return;
    }

    const normalizedMinGuestsValue = minGuestsInput.trim();
    let normalizedMinGuests: number | null = null;
    if (normalizedMinGuestsValue.length > 0) {
      const parsedMinGuests = Number.parseInt(normalizedMinGuestsValue, 10);
      if (!Number.isFinite(parsedMinGuests) || parsedMinGuests < 1) {
        setError("Минимум гостей должен быть целым числом от 1");
        return;
      }
      const maxCapacity = room.beds + room.extraBeds;
      if (parsedMinGuests > maxCapacity) {
        setError(`Минимум гостей не может превышать вместимость номера (${maxCapacity})`);
        return;
      }
      normalizedMinGuests = parsedMinGuests;
    }

    setIsSavingParams(true);

    try {
      const url = editingPriceId
        ? `/api/properties/${propertyId}/rooms/${room.id}/prices/${editingPriceId}`
        : `/api/properties/${propertyId}/rooms/${room.id}/prices`;
      const method = editingPriceId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: selectedFrom,
          dateTo: selectedTo,
          price: normalizedPrice,
          minGuests: normalizedMinGuests,
          currency,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось сохранить параметры периода");
        return;
      }

      setSuccess(editingPriceId ? "Параметры периода обновлены" : "Параметры периода добавлены");
      resetParamsForm();
      await notifyChanged();
    } finally {
      setIsSavingParams(false);
    }
  }

  async function deletePrice(priceId: string) {
    clearMessages();

    const response = await fetch(`/api/properties/${propertyId}/rooms/${room.id}/prices/${priceId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Не удалось удалить параметры периода");
      return;
    }

    if (editingPriceId === priceId) {
      resetParamsForm();
    }
    setSuccess("Период цены удален");
    await notifyChanged();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-cream/70 p-3 text-xs text-olive/80">
        Шахматка работает в диапазоне {formatIsoDate(minDateIso)} - {formatIsoDate(maxDateIso)}.
      </div>

      <div
        className={
          workspaceMode
            ? "grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)] xl:items-start"
            : "space-y-4"
        }
      >
        <section className="rounded-xl border border-olive/15 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setCurrentMonthIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentMonthIndex === 0}
              >
                Назад
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setCurrentMonthIndex((prev) => Math.min(availableMonths.length - 1, prev + 1))
                }
                disabled={currentMonthIndex === availableMonths.length - 1}
              >
                Далее
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-olive/20 bg-white px-3 py-2 text-sm text-olive"
                value={currentYear}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  const sameMonth = availableMonths.findIndex(
                    (month) =>
                      month.getUTCFullYear() === year &&
                      month.getUTCMonth() === availableMonths[currentMonthIndex].getUTCMonth(),
                  );
                  if (sameMonth >= 0) {
                    setCurrentMonthIndex(sameMonth);
                    return;
                  }
                  const firstInYear = availableMonths.findIndex(
                    (month) => month.getUTCFullYear() === year,
                  );
                  if (firstInYear >= 0) {
                    setCurrentMonthIndex(firstInYear);
                  }
                }}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl border border-olive/20 bg-white px-3 py-2 text-sm text-olive"
                value={currentMonthIndex}
                onChange={(event) => setCurrentMonthIndex(Number(event.target.value))}
              >
                {monthOptionsForYear.map((item) => (
                  <option key={item.index} value={item.index}>
                    {monthLabels[item.month.getUTCMonth()]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-2 text-sm font-semibold text-olive">
            {monthLabels[currentMonth.getUTCMonth()]} {currentMonth.getUTCFullYear()}
          </p>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {dayLabels.map((label) => (
              <div
                key={label}
                className="rounded-md bg-cream/80 px-1 py-1 text-center text-[11px] font-semibold text-olive/70"
              >
                {label}
              </div>
            ))}

            {grid.map((day) => {
              const inRange =
                compareIsoDates(day.iso, minDateIso) >= 0 &&
                compareIsoDates(day.iso, maxDateIso) <= 0;
              const isSelected =
                selectedFrom &&
                selectedTo &&
                compareIsoDates(selectedFrom, day.iso) <= 0 &&
                compareIsoDates(day.iso, selectedTo) <= 0;
              const hasOccupancy = occupancies.some((item) =>
                periodContainsDate(item.dateFrom, item.dateTo, day.iso),
              );
              const hasPrice = room.prices.some((item) =>
                periodContainsDate(item.dateFrom, item.dateTo, day.iso),
              );

              return (
                <button
                  key={day.iso}
                  type="button"
                  onMouseDown={() => handleDayMouseDown(day.iso)}
                  onMouseEnter={() => handleDayMouseEnter(day.iso)}
                  onClick={() => handleDayClick(day.iso)}
                  disabled={!inRange}
                  className={[
                    "relative h-11 rounded-lg border text-xs transition",
                    day.inCurrentMonth
                      ? "border-olive/15 bg-white text-olive"
                      : "border-olive/10 bg-cream/40 text-olive/45",
                    isSelected ? "border-terra bg-terra/15 text-olive" : "",
                    !inRange ? "cursor-not-allowed opacity-45" : "hover:border-terra/50",
                  ].join(" ")}
                >
                  <span>{day.dayNumber}</span>
                  <span className="pointer-events-none absolute bottom-1 left-1 right-1 flex justify-center gap-1">
                    {hasOccupancy ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
                    {hasPrice ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-olive/75">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> занятость
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> цена/параметры
            </span>
            <span className="font-medium">
              Выбрано: {formatSelectedRange(selectedFrom, selectedTo)}
            </span>
          </div>
        </section>

        <section
          className={[
            "rounded-xl border border-olive/15 bg-white p-3",
            workspaceMode ? "xl:sticky xl:top-4" : "",
          ].join(" ")}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "dates" ? "primary" : "ghost"} onClick={() => setMode("dates")}>
              Даты (по умолчанию)
            </Button>
            <Button variant={mode === "params" ? "primary" : "ghost"} onClick={() => setMode("params")}>
              Параметры периода
            </Button>
          </div>

          {mode === "dates" ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-olive/70">
                    Время с
                  </span>
                  <Input
                    type="time"
                    value={timeFrom}
                    onChange={(event) => setTimeFrom(event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-olive/70">
                    Время по
                  </span>
                  <Input
                    type="time"
                    value={timeTo}
                    onChange={(event) => setTimeTo(event.target.value)}
                  />
                </label>
              </div>

              <Input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Клиент / ФИО (необязательно)"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  placeholder="Телефон (необязательно)"
                />
                <Input
                  value={guestContacts}
                  onChange={(event) => setGuestContacts(event.target.value)}
                  placeholder="Email / мессенджеры (необязательно)"
                />
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-olive/70">
                  Описание (до 250 символов)
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={250}
                  rows={3}
                  placeholder="Комментарий к брони (необязательно)"
                  className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveDatesPeriod()} disabled={isSavingDates}>
                  {isSavingDates
                    ? "Сохранение..."
                    : editingOccupancyId
                      ? "Сохранить период занятости"
                      : "Отметить занятость"}
                </Button>
                {editingOccupancyId ? (
                  <Button variant="ghost" onClick={resetDateForm}>
                    Отменить редактирование
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="rounded-xl bg-cream/70 p-2 text-xs text-olive/75">
                Вместимость этого номера: {room.beds + room.extraBeds} гостей.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder="Цена за ночь"
                />
                <Input
                  type="number"
                  min={1}
                  max={40}
                  value={minGuestsInput}
                  onChange={(event) => setMinGuestsInput(event.target.value)}
                  placeholder="Мин. гостей (необязательно)"
                />
                <Input
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  placeholder="RUB"
                  maxLength={3}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveParamsPeriod()} disabled={isSavingParams}>
                  {isSavingParams
                    ? "Сохранение..."
                    : editingPriceId
                      ? "Сохранить параметры"
                      : "Сохранить параметры периода"}
                </Button>
                {editingPriceId ? (
                  <Button variant="ghost" onClick={resetParamsForm}>
                    Отменить редактирование
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}
        </section>
      </div>

      <section className="rounded-xl border border-olive/15 bg-white p-3">
        <h5 className="text-sm font-semibold text-olive">Периоды занятости</h5>
        {isLoadingOccupancies ? (
          <p className="mt-2 text-sm text-olive/70">Загрузка...</p>
        ) : occupancies.length === 0 ? (
          <p className="mt-2 text-sm text-olive/70">Периоды занятости пока не добавлены.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-olive/65">
                  <th className="py-1 pr-4">Период</th>
                  <th className="py-1 pr-4">Гость</th>
                  <th className="py-1 pr-4">Контакты</th>
                  <th className="py-1 pr-4">Описание</th>
                  <th className="py-1">Действия</th>
                </tr>
              </thead>
              <tbody>
                {occupancies.map((item) => (
                  <tr key={item.id} className="border-t border-olive/10 align-top">
                    <td className="py-1 pr-4 text-olive">{formatOccupancyPeriod(item)}</td>
                    <td className="py-1 pr-4 text-olive">{item.guestLabel}</td>
                    <td className="py-1 pr-4 text-olive">
                      {item.guestPhone || item.guestContacts
                        ? [item.guestPhone, item.guestContacts].filter(Boolean).join(" / ")
                        : "Не указаны"}
                    </td>
                    <td className="py-1 pr-4 text-olive">{item.description ?? "—"}</td>
                    <td className="py-1">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => startEditOccupancy(item)}>
                          Изменить
                        </Button>
                        <Button variant="secondary" onClick={() => void deleteOccupancy(item.id)}>
                          Удалить
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-olive/15 bg-white p-3">
        <h5 className="text-sm font-semibold text-olive">Параметры периодов (цены)</h5>
        {room.prices.length === 0 ? (
          <p className="mt-2 text-sm text-olive/70">Периоды цен пока не добавлены.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-olive/65">
                  <th className="py-1 pr-4">Период</th>
                  <th className="py-1 pr-4">Цена</th>
                  <th className="py-1 pr-4">Мин. гостей</th>
                  <th className="py-1">Действия</th>
                </tr>
              </thead>
              <tbody>
                {room.prices.map((item) => (
                  <tr key={item.id} className="border-t border-olive/10">
                    <td className="py-1 pr-4 text-olive">
                      {formatIsoDate(item.dateFrom)} - {formatIsoDate(item.dateTo)}
                    </td>
                    <td className="py-1 pr-4 text-olive">
                      {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(item.price)}{" "}
                      {item.currency}
                    </td>
                    <td className="py-1 pr-4 text-olive">
                      {item.minGuests === null ? "Без ограничений" : item.minGuests}
                    </td>
                    <td className="py-1">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => startEditPrice(item)}>
                          Изменить
                        </Button>
                        <Button variant="secondary" onClick={() => void deletePrice(item.id)}>
                          Удалить
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
