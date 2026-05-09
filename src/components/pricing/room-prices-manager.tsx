"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  defaultRoomPriceType,
  getRoomPriceShortUnit,
  getRoomPriceUnitText,
  type RoomPriceType,
} from "@/lib/pricing";
import type { SerializedRoom } from "@/lib/rooms";

// Owner-side UI for step 10:
// - period price CRUD per room
// - quick link to full-screen chessboard workspace
// - stay-price preview by dates
type RoomPricesManagerProps = {
  propertyId: string;
  initialRooms: SerializedRoom[];
  onChanged?: () => Promise<void>;
};

type PricePreview =
  | {
      ok: true;
      nights: number;
      total: number;
      currency: string;
      breakdown: Array<{ date: string; price: number }>;
    }
  | {
      ok: false;
      message: string;
      missingDates: string[];
    };

function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

export function RoomPricesManager({ propertyId, initialRooms, onChanged }: RoomPricesManagerProps) {
  const [rooms, setRooms] = useState<SerializedRoom[]>(initialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState(initialRooms[0]?.id ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [priceType, setPriceType] = useState<RoomPriceType>(defaultRoomPriceType);
  const [minGuestsInput, setMinGuestsInput] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [previewCheckIn, setPreviewCheckIn] = useState("");
  const [previewCheckOut, setPreviewCheckOut] = useState("");
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const refreshRooms = useCallback(async () => {
    // Reuses room endpoint so pricing step always reflects the latest room/price state.
    const response = await fetch(`/api/properties/${propertyId}/rooms`);
    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { items: SerializedRoom[] };
    setRooms(body.items);
    setSelectedRoomId((prev) => {
      if (prev && body.items.some((room) => room.id === prev)) {
        return prev;
      }
      return body.items[0]?.id ?? "";
    });
  }, [propertyId]);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  async function notifyChanged() {
    if (onChanged) {
      await onChanged();
    }
  }

  function clearPriceForm() {
    setDateFrom("");
    setDateTo("");
    setPriceInput("");
    setPriceType(defaultRoomPriceType);
    setMinGuestsInput("");
    setCurrency("RUB");
  }

  async function savePrice() {
    setError("");
    setPreview(null);

    if (!selectedRoomId) {
      setError("Выберите номер");
      return;
    }

    if (!dateFrom || !dateTo) {
      setError("Укажите даты начала и окончания");
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
      if (parsedMinGuests > 40) {
        setError("Минимум гостей не может быть больше 40");
        return;
      }
      if (selectedRoom && parsedMinGuests > selectedRoom.beds + selectedRoom.extraBeds) {
        setError(
          `Минимум гостей не может превышать вместимость выбранного номера (${selectedRoom.beds + selectedRoom.extraBeds})`,
        );
        return;
      }
      normalizedMinGuests = parsedMinGuests;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/properties/${propertyId}/rooms/${selectedRoomId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          price: normalizedPrice,
          priceType,
          minGuests: normalizedMinGuests,
          currency,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось сохранить цену");
        return;
      }

      await refreshRooms();
      await notifyChanged();
      clearPriceForm();
    } finally {
      setIsSaving(false);
    }
  }

  async function calculatePreview() {
    setError("");
    setPreview(null);

    if (!selectedRoomId) {
      setError("Выберите номер");
      return;
    }

    if (!previewCheckIn || !previewCheckOut) {
      setError("Укажите даты заезда и выезда для предпросмотра");
      return;
    }

    setIsPreviewLoading(true);
    try {
      const url = `/api/properties/${propertyId}/rooms/${selectedRoomId}/prices?checkIn=${encodeURIComponent(previewCheckIn)}&checkOut=${encodeURIComponent(previewCheckOut)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось рассчитать стоимость");
        return;
      }

      const body = (await response.json()) as { preview?: PricePreview };
      if (!body.preview) {
        setError("Расчет не получен");
        return;
      }

      setPreview(body.preview);
    } finally {
      setIsPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-olive/10 bg-white p-4">
        <h3 className="text-xl text-olive">Цены по периодам</h3>

        {rooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-olive/30 p-3 text-sm text-olive/60">
            Сначала добавьте хотя бы один номер во вкладке «Номера».
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-olive">Номер</span>
              <select
                className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
                value={selectedRoomId}
                onChange={(event) => {
                  setSelectedRoomId(event.target.value);
                  setPreview(null);
                  setError("");
                }}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
              <Input
                type="number"
                min={1}
                step="0.01"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                placeholder={
                  priceType === "PER_PERSON" ? "Цена за человека" : "Цена за комнату/ночь"
                }
              />
              <Input
                type="number"
                min={1}
                max={40}
                value={minGuestsInput}
                onChange={(event) => setMinGuestsInput(event.target.value)}
                placeholder="Мин. гостей"
              />
              <Input
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                placeholder="RUB"
                maxLength={3}
              />
            </div>

            <div className="grid max-w-md grid-cols-2 gap-1 rounded-2xl border border-olive/12 bg-white p-1">
              {(["PER_ROOM", "PER_PERSON"] as const).map((type) => {
                const isSelected = priceType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPriceType(type)}
                    className={[
                      "h-10 rounded-xl px-3 text-xs font-semibold transition sm:text-sm",
                      isSelected
                        ? "bg-primary text-white"
                        : "text-olive/70 hover:bg-cream hover:text-olive",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <span className="hidden sm:inline">{getRoomPriceUnitText(type)}</span>
                    <span className="sm:hidden">/{getRoomPriceShortUnit(type)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void savePrice()} disabled={isSaving}>
                {isSaving ? "Сохранение..." : "Добавить период"}
              </Button>
              <Button variant="ghost" onClick={clearPriceForm} disabled={isSaving}>
                Очистить форму
              </Button>
            </div>
          </>
        )}
      </section>

      {selectedRoom ? (
        <section className="space-y-3 rounded-2xl border border-olive/10 bg-white p-4">
          <h3 className="text-lg text-olive">Предпросмотр стоимости</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              type="date"
              value={previewCheckIn}
              onChange={(event) => setPreviewCheckIn(event.target.value)}
            />
            <Input
              type="date"
              value={previewCheckOut}
              onChange={(event) => setPreviewCheckOut(event.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => void calculatePreview()}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? "Расчет..." : "Рассчитать"}
            </Button>
          </div>

          {preview ? (
            preview.ok ? (
              <div className="rounded-xl bg-cream p-3 text-sm text-olive">
                <p>
                  Ночей: <span className="font-semibold">{preview.nights}</span>
                </p>
                <p>
                  Итого:{" "}
                  <span className="font-semibold">
                    {formatMoney(preview.total, preview.currency)}
                  </span>
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <p>{preview.message}</p>
                {preview.missingDates.length > 0 ? (
                  <p className="mt-1">Без цены: {preview.missingDates.join(", ")}</p>
                ) : null}
              </div>
            )
          ) : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
