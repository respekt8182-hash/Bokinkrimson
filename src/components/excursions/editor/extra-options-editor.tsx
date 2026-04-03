"use client";

import { Trash2 } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExcursionExtraOption } from "@/types/excursions";

type ExtraOptionsEditorProps = {
  items: ExcursionExtraOption[];
  onChange: (items: ExcursionExtraOption[]) => void;
};

function createOption(): ExcursionExtraOption {
  return {
    title: "",
    description: "",
    included: false,
    price: null,
  };
}

export function ExtraOptionsEditor({ items, onChange }: ExtraOptionsEditorProps) {
  function updateItem(index: number, patch: Partial<ExcursionExtraOption>) {
    onChange(items.map((item, current) => (current === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...items, createOption()]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, current) => current !== index));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive/20 bg-cream/35 px-4 py-5 text-sm text-olive/55">
          Здесь можно добавить допактивности, одноместное размещение, фотосопровождение и любые опции, которые влияют на выбор.
        </div>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Название</span>
              <Input
                value={item.title}
                onChange={(event) => updateItem(index, { title: event.target.value })}
                placeholder="Например: одноместное размещение"
                maxLength={120}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Стоимость</span>
              <Input
                type="number"
                min={0}
                value={item.price ?? ""}
                onChange={(event) =>
                  updateItem(index, {
                    price: event.target.value ? Number.parseFloat(event.target.value) : null,
                  })
                }
                placeholder="0"
                disabled={item.included}
              />
            </label>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="mt-6 inline-flex h-11 w-11 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50"
              aria-label={`Удалить опцию ${index + 1}`}
            >
              <AppIcon icon={Trash2} className="h-4 w-4" />
            </button>
          </div>

          <label className="mt-3 block space-y-1.5">
            <span className="text-sm font-medium text-olive">Описание</span>
            <textarea
              value={item.description ?? ""}
              onChange={(event) => updateItem(index, { description: event.target.value })}
              rows={3}
              maxLength={400}
              className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Коротко поясните, что получает турист"
            />
          </label>

          <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-olive">
            <input
              type="checkbox"
              checked={item.included}
              onChange={(event) =>
                updateItem(index, {
                  included: event.target.checked,
                  price: event.target.checked ? null : item.price ?? null,
                })
              }
              className="h-4 w-4 rounded border-olive/20 text-primary focus:ring-primary/25"
            />
            Уже входит в базовую цену
          </label>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={addItem}>
        Добавить опцию
      </Button>
    </div>
  );
}
