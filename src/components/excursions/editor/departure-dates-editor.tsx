"use client";

import { Trash2 } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DepartureDateItem = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  capacity: string;
  priceOverride: string;
};

type DepartureDatesEditorProps = {
  items: DepartureDateItem[];
  onChange: (items: DepartureDateItem[]) => void;
};

function createItem(): DepartureDateItem {
  return {
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "",
    capacity: "",
    priceOverride: "",
  };
}

export function DepartureDatesEditor({ items, onChange }: DepartureDatesEditorProps) {
  function updateItem(index: number, patch: Partial<DepartureDateItem>) {
    onChange(items.map((item, current) => (current === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...items, createItem()]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, current) => current !== index));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive/20 bg-cream/35 px-4 py-5 text-sm text-olive/55">
          Добавьте конкретные заезды тура. Эти даты используются и для валидации публикации, и для публичного блока ближайших стартов.
        </div>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-olive">Заезд {index + 1}</p>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50"
              aria-label={`Удалить заезд ${index + 1}`}
            >
              <AppIcon icon={Trash2} className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Дата старта</span>
              <Input
                type="date"
                value={item.startDate}
                onChange={(event) => updateItem(index, { startDate: event.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Время старта</span>
              <Input
                type="time"
                value={item.startTime}
                onChange={(event) => updateItem(index, { startTime: event.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Мест</span>
              <Input
                type="number"
                min={1}
                value={item.capacity}
                onChange={(event) => updateItem(index, { capacity: event.target.value })}
                placeholder="12"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Дата окончания</span>
              <Input
                type="date"
                value={item.endDate}
                onChange={(event) => updateItem(index, { endDate: event.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Время окончания</span>
              <Input
                type="time"
                value={item.endTime}
                onChange={(event) => updateItem(index, { endTime: event.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Цена для заезда</span>
              <Input
                type="number"
                min={0}
                value={item.priceOverride}
                onChange={(event) => updateItem(index, { priceOverride: event.target.value })}
                placeholder="Необязательно"
              />
            </label>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={addItem}>
        Добавить заезд
      </Button>
    </div>
  );
}
