"use client";

import { ArrowBigDown, ArrowBigUp, Trash2 } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ContentPhotoManager } from "@/components/excursions/editor/content-photo-manager";
import {
  EXCURSION_PROGRAM_PHOTO_LIMIT,
  formatItineraryItemIndexLabel,
  getItineraryDayPhotoUrls,
  getItineraryItemNoun,
  ITINERARY_ITEM_LABEL_OPTIONS,
  ITINERARY_ITEM_LABEL_VALUES,
  resolveItineraryItemLabel,
  type ItineraryDay,
  type ItineraryItemLabel,
} from "@/types/excursions";

type TourDaysEditorProps = {
  days: ItineraryDay[];
  itemLabel: ItineraryItemLabel;
  onChange: (days: ItineraryDay[]) => void;
  onItemLabelChange: (value: ItineraryItemLabel) => void;
  onUploadPhotos: (dayIndex: number, files: FileList | null) => void;
  onMovePhoto: (dayIndex: number, photoIndex: number, direction: -1 | 1) => void;
  onMakePhotoFirst: (dayIndex: number, photoIndex: number) => void;
  onRemovePhoto: (dayIndex: number, photoIndex: number) => void;
  disabled?: boolean;
  uploadingDayIndex?: number | null;
};

const itineraryItemLabelOptions = ITINERARY_ITEM_LABEL_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items: string[] | undefined): string {
  return (items ?? []).join(", ");
}

function isGeneratedTitle(title: string, dayNumber: number): boolean {
  const normalizedTitle = title.trim();
  return ITINERARY_ITEM_LABEL_VALUES.some(
    (value) => normalizedTitle === formatItineraryItemIndexLabel(value, dayNumber),
  );
}

function normalizeDays(days: ItineraryDay[], itemLabel: ItineraryItemLabel): ItineraryDay[] {
  return days.map((day, index) => {
    const nextDayNumber = index + 1;
    const shouldSyncGeneratedTitle =
      isGeneratedTitle(day.title, day.day) || isGeneratedTitle(day.title, nextDayNumber);

    return {
      ...day,
      day: nextDayNumber,
      itemLabel,
      title: shouldSyncGeneratedTitle
        ? formatItineraryItemIndexLabel(itemLabel, nextDayNumber)
        : day.title,
    };
  });
}

function createDay(index: number, itemLabel: ItineraryItemLabel): ItineraryDay {
  return {
    day: index + 1,
    itemLabel,
    title: formatItineraryItemIndexLabel(itemLabel, index + 1),
    description: "",
    locations: [],
    included: [],
    activities: [],
    photoUrls: [],
  };
}

export function TourDaysEditor({
  days,
  itemLabel,
  onChange,
  onItemLabelChange,
  onUploadPhotos,
  onMovePhoto,
  onMakePhotoFirst,
  onRemovePhoto,
  disabled = false,
  uploadingDayIndex = null,
}: TourDaysEditorProps) {
  const itemNoun = getItineraryItemNoun(itemLabel, 1);

  function updateDay(index: number, patch: Partial<ItineraryDay>) {
    onChange(
      days.map((day, current) => (current === index ? { ...day, ...patch, itemLabel } : day)),
    );
  }

  function addDay() {
    onChange(normalizeDays([...days, createDay(days.length, itemLabel)], itemLabel));
  }

  function removeDay(index: number) {
    onChange(
      normalizeDays(
        days.filter((_, current) => current !== index),
        itemLabel,
      ),
    );
  }

  function moveDay(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= days.length) {
      return;
    }

    const next = [...days];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(normalizeDays(next, itemLabel));
  }

  function handleItemLabelChange(value: string) {
    const nextLabel = resolveItineraryItemLabel(value);
    onItemLabelChange(nextLabel);
    onChange(normalizeDays(days, nextLabel));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/12 bg-cream/35 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-olive">Формат пунктов программы</h4>
            <p className="text-xs text-olive/60">
              Выберите, как будут называться шаги тура: день, этап, шаг или пункт.
            </p>
          </div>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Название пункта</span>
            <Select
              value={itemLabel}
              onChange={handleItemLabelChange}
              options={itineraryItemLabelOptions}
            />
          </label>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive/20 bg-cream/35 px-4 py-5 text-sm text-olive/55">
          Добавьте хотя бы один пункт программы. Для тура этот блок помогает показать маршрут
          последовательно и понятно.
        </div>
      ) : null}

      {days.map((day, index) => {
        const dayPhotoUrls = getItineraryDayPhotoUrls(day);

        return (
          <div
            key={`${day.day}-${index}`}
            className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {formatItineraryItemIndexLabel(itemLabel, day.day)}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveDay(index, -1)}
                  disabled={disabled || index === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:opacity-35"
                  aria-label={`Поднять ${itemNoun} ${day.day}`}
                >
                  <AppIcon icon={ArrowBigUp} className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDay(index, 1)}
                  disabled={disabled || index === days.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-olive/55 transition hover:bg-cream disabled:opacity-35"
                  aria-label={`Опустить ${itemNoun} ${day.day}`}
                >
                  <AppIcon icon={ArrowBigDown} className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeDay(index)}
                  disabled={disabled}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                  aria-label={`Удалить ${itemNoun} ${day.day}`}
                >
                  <AppIcon icon={Trash2} className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Название пункта</span>
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
                  placeholder={`Коротко о том, чем запомнится этот ${itemNoun}`}
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
                placeholder={`Что происходит в этот ${itemNoun}, какой ритм, какие впечатления, как проходит маршрут`}
              />
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Ключевые точки / локации</span>
                <textarea
                  value={joinList(day.locations)}
                  onChange={(event) =>
                    updateDay(index, { locations: splitList(event.target.value) })
                  }
                  rows={3}
                  className="w-full resize-none rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Симферополь, Бахчисарай, Ай-Петри"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Начало</span>
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
                  <span className="text-sm font-medium text-olive">
                    Что включено в этот {itemNoun}
                  </span>
                  <Input
                    value={joinList(day.included)}
                    onChange={(event) =>
                      updateDay(index, { included: splitList(event.target.value) })
                    }
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
                  onChange={(event) =>
                    updateDay(index, { activities: splitList(event.target.value) })
                  }
                  placeholder="СПА, дегустация, прогулка"
                />
              </label>
            </div>

            <ContentPhotoManager
              title={`Фото ${itemNoun}`}
              description={`Показываются рядом с описанием ${itemNoun} и учитываются в общей карточке.`}
              photoUrls={dayPhotoUrls}
              limit={EXCURSION_PROGRAM_PHOTO_LIMIT}
              addLabel={`Добавить фото ${itemNoun}`}
              emptyText={`Фото для этого блока пока не выбраны.`}
              disabled={disabled}
              isUploading={uploadingDayIndex === index}
              onUpload={(files) => onUploadPhotos(index, files)}
              onMove={(photoIndex, direction) => onMovePhoto(index, photoIndex, direction)}
              onMakeFirst={(photoIndex) => onMakePhotoFirst(index, photoIndex)}
              onRemove={(photoIndex) => onRemovePhoto(index, photoIndex)}
            />
          </div>
        );
      })}

      <Button type="button" variant="secondary" onClick={addDay} disabled={disabled}>
        {`Добавить ${itemNoun}`}
      </Button>
    </div>
  );
}
