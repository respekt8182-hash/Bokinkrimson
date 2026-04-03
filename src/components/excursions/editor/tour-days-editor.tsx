"use client";

import { ArrowBigDown, ArrowBigUp, Trash2 } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ItineraryDay } from "@/types/excursions";

type TourDaysEditorProps = {
  days: ItineraryDay[];
  onChange: (days: ItineraryDay[]) => void;
};

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items: string[] | undefined): string {
  return (items ?? []).join(", ");
}

function createDay(index: number): ItineraryDay {
  return {
    day: index + 1,
    title: `День ${index + 1}`,
    description: "",
    locations: [],
    included: [],
    activities: [],
  };
}

function renumber(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day, index) => ({ ...day, day: index + 1 }));
}

export function TourDaysEditor({ days, onChange }: TourDaysEditorProps) {
  function updateDay(index: number, patch: Partial<ItineraryDay>) {
    onChange(days.map((day, current) => (current === index ? { ...day, ...patch } : day)));
  }

  function addDay() {
    onChange(renumber([...days, createDay(days.length)]));
  }

  function removeDay(index: number) {
    onChange(renumber(days.filter((_, current) => current !== index)));
  }

  function moveDay(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= days.length) {
      return;
    }

    const next = [...days];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(renumber(next));
  }

  return (
    <div className="space-y-3">
      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive/20 bg-cream/35 px-4 py-5 text-sm text-olive/55">
          Добавьте хотя бы один день программы. Для многодневного тура это главный блок публичной карточки.
        </div>
      ) : null}

      {days.map((day, index) => (
        <div key={`${day.day}-${index}`} className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              День {day.day}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveDay(index, -1)}
                disabled={index === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:opacity-35"
                aria-label={`Поднять день ${day.day}`}
              >
                <AppIcon icon={ArrowBigUp} className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveDay(index, 1)}
                disabled={index === days.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:opacity-35"
                aria-label={`Опустить день ${day.day}`}
              >
                <AppIcon icon={ArrowBigDown} className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeDay(index)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                aria-label={`Удалить день ${day.day}`}
              >
                <AppIcon icon={Trash2} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Название дня</span>
              <Input
                value={day.title}
                onChange={(event) => updateDay(index, { title: event.target.value })}
                placeholder="Например: Южный берег и винодельня"
                maxLength={120}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Короткая подводка</span>
              <Input
                value={day.teaser ?? ""}
                onChange={(event) => updateDay(index, { teaser: event.target.value })}
                placeholder="Коротко о том, чем запомнится день"
                maxLength={240}
              />
            </label>
          </div>

          <label className="mt-3 block space-y-1.5">
            <span className="text-sm font-medium text-olive">Подробное описание</span>
            <textarea
              value={day.description}
              onChange={(event) => updateDay(index, { description: event.target.value })}
              rows={4}
              maxLength={4000}
              className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Что происходит в этот день, какой ритм, какие впечатления, как проходит маршрут"
            />
          </label>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Ключевые точки / локации</span>
              <textarea
                value={joinList(day.locations)}
                onChange={(event) => updateDay(index, { locations: splitList(event.target.value) })}
                rows={3}
                className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Симферополь, Бахчисарай, Ай-Петри"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Старт дня</span>
                <Input
                  type="time"
                  value={day.startTime ?? ""}
                  onChange={(event) => updateDay(index, { startTime: event.target.value })}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Завершение</span>
                <Input
                  type="time"
                  value={day.endTime ?? ""}
                  onChange={(event) => updateDay(index, { endTime: event.target.value })}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-olive">Что включено в этот день</span>
                <Input
                  value={joinList(day.included)}
                  onChange={(event) => updateDay(index, { included: splitList(event.target.value) })}
                  placeholder="трансфер, гид, дегустация"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Питание</span>
              <Input
                value={day.meals ?? ""}
                onChange={(event) => updateDay(index, { meals: event.target.value })}
                placeholder="завтрак и ужин"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Размещение / ночёвка</span>
              <Input
                value={day.accommodation ?? ""}
                onChange={(event) => updateDay(index, { accommodation: event.target.value })}
                placeholder="гостевой дом в Ялте"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-olive">Доп. активности</span>
              <Input
                value={joinList(day.activities)}
                onChange={(event) => updateDay(index, { activities: splitList(event.target.value) })}
                placeholder="СПА, дегустация, прогулка"
              />
            </label>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={addDay}>
        Добавить день
      </Button>
    </div>
  );
}
