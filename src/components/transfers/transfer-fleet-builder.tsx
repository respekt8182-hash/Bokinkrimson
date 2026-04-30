"use client";

import {
  BriefcaseBusiness,
  Bus,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Plus,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { accommodationPhotoUploadAccept } from "@/lib/photo-upload";
import {
  createEmptyTransferFleetItem,
  createTransferFleetId,
  maxTransferServiceTags,
  type TransferFleetItem,
  transferPriceUnitOptions,
  transferServiceTagOptions,
  transferTransportKindOptions,
} from "@/lib/transfers";

type TransferFleetBuilderProps = {
  transferId: string;
  initialFleet: TransferFleetItem[];
  initialServiceTags: string[];
  onChange?: (fleet: TransferFleetItem[], serviceTags: string[]) => void;
};

const inputClass =
  "w-full rounded-2xl border border-olive/12 bg-white px-3.5 py-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

const textareaClass = `${inputClass} min-h-[96px] resize-y`;

function stringifyFleet(items: TransferFleetItem[]): string {
  return JSON.stringify(items);
}

function stringifyServiceTags(items: string[]): string {
  return JSON.stringify(items);
}

export function TransferFleetBuilder({
  transferId,
  initialFleet,
  initialServiceTags,
  onChange,
}: TransferFleetBuilderProps) {
  const [fleet, setFleet] = useState<TransferFleetItem[]>(
    initialFleet.length > 0 ? initialFleet : [createEmptyTransferFleetItem()],
  );
  const [serviceTags, setServiceTags] = useState<string[]>(initialServiceTags);
  const [customTag, setCustomTag] = useState("");
  const [uploadingVehicleId, setUploadingVehicleId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const photoUrls = useMemo(
    () => fleet.map((item) => item.photoUrl?.trim() ?? "").filter(Boolean),
    [fleet],
  );
  const tagLimitReached = serviceTags.length >= maxTransferServiceTags;

  useEffect(() => {
    onChange?.(fleet, serviceTags);
  }, [fleet, onChange, serviceTags]);

  function updateFleetItem(id: string, patch: Partial<TransferFleetItem>) {
    setFleet((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addFleetItem() {
    setFleet((current) => [
      ...current,
      {
        ...createEmptyTransferFleetItem(),
        id: createTransferFleetId("vehicle"),
        title: `Транспорт ${current.length + 1}`,
      },
    ]);
  }

  function removeFleetItem(id: string) {
    setFleet((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.length > 0 ? next : [createEmptyTransferFleetItem()];
    });
  }

  function moveFleetItem(id: string, direction: "up" | "down") {
    setFleet((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function toggleServiceTag(tag: string) {
    setServiceTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      if (current.length >= maxTransferServiceTags) {
        return current;
      }

      return [...current, tag];
    });
  }

  function addCustomTag() {
    const normalized = customTag.trim();
    if (!normalized) {
      return;
    }

    setServiceTags((current) => {
      if (current.includes(normalized) || current.length >= maxTransferServiceTags) {
        return current;
      }

      return [...current, normalized];
    });
    setCustomTag("");
  }

  async function uploadPhoto(vehicleId: string, file: File | null) {
    if (!file) {
      return;
    }

    setError("");
    setUploadingVehicleId(vehicleId);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/transfers/${transferId}/photos`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? "Не удалось загрузить фото транспорта.");
        return;
      }

      updateFleetItem(vehicleId, { photoUrl: body.url });
    } catch {
      setError("Не удалось загрузить фото транспорта.");
    } finally {
      setUploadingVehicleId(null);
    }
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="fleetJson" value={stringifyFleet(fleet)} />
      <input type="hidden" name="serviceTagsJson" value={stringifyServiceTags(serviceTags)} />
      <input type="hidden" name="photoUrls" value={photoUrls.join("\n")} />

      <div className="rounded-[24px] bg-[#f7f4eb] p-4 ring-1 ring-olive/8">
        <div className="flex justify-end">
          <span className="rounded-full border border-dashed border-olive/16 px-3 py-1 text-xs font-semibold text-olive/55">
            {serviceTags.length > 0
              ? `${serviceTags.length}/${maxTransferServiceTags} тегов`
              : "Теги помогут в поиске"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {transferServiceTagOptions.map((tag) => {
            const active = serviceTags.includes(tag);
            const disabled = !active && tagLimitReached;

            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleServiceTag(tag)}
                disabled={disabled}
                className={
                  active
                    ? "rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white"
                    : "rounded-full border border-olive/12 bg-white px-3.5 py-2 text-xs font-semibold text-olive/72 transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:border-olive/8 disabled:text-olive/35"
                }
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomTag();
              }
            }}
            placeholder="Добавить свой тег услуги"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={tagLimitReached || customTag.trim().length === 0}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-primary/24 bg-primary/8 px-4 text-sm font-semibold text-primary transition hover:bg-primary/12 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AppIcon icon={Plus} className="h-4 w-4" />
            Добавить тег
          </button>
        </div>

        <p className="mt-3 text-xs text-olive/52">
          {tagLimitReached
            ? `Лимит достигнут: оставьте не больше ${maxTransferServiceTags} тегов.`
            : `Можно выбрать еще ${maxTransferServiceTags - serviceTags.length} тегов.`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-olive">Автопарк и транспорт</p>
            <p className="mt-1 text-sm leading-6 text-olive/62">
              Добавьте один автомобиль или целый автопарк. Первый транспорт станет главным в
              карточке и пойдет в каталог как основа предложения.
            </p>
          </div>
          <button
            type="button"
            onClick={addFleetItem}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <AppIcon icon={Plus} className="h-4 w-4" />
            Добавить транспорт
          </button>
        </div>

        <div className="space-y-4">
          {fleet.map((item, index) => (
            <article
              key={item.id}
              className="rounded-[26px] border border-olive/10 bg-white p-5 shadow-[0_14px_36px_rgba(58,43,35,0.05)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-olive">
                    {item.title || `Транспорт ${index + 1}`}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-olive/54">
                    Заполните тип транспорта, модель, цену, вместимость и добавьте главное фото.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveFleetItem(item.id, "up")}
                    disabled={index === 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-olive/12 bg-white text-olive transition hover:border-primary/22 hover:text-primary disabled:opacity-40"
                    aria-label="Поднять выше"
                  >
                    <AppIcon icon={ChevronUp} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFleetItem(item.id, "down")}
                    disabled={index === fleet.length - 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-olive/12 bg-white text-olive transition hover:border-primary/22 hover:text-primary disabled:opacity-40"
                    aria-label="Опустить ниже"
                  >
                    <AppIcon icon={ChevronDown} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFleetItem(item.id)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    <AppIcon icon={Trash2} className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-[24px] border border-dashed border-olive/16 bg-cream/70">
                    <div className="aspect-[4/3] bg-cream">
                      {item.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photoUrl}
                          alt={item.title || item.vehicleModel || "Транспорт"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-olive/46">
                          <AppIcon icon={Bus} className="h-7 w-7" />
                          Главное фото транспорта
                        </div>
                      )}
                    </div>

                    <div className="border-t border-olive/10 p-3">
                      <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/22 hover:text-primary">
                        <AppIcon icon={ImageIcon} className="h-4 w-4" />
                        {uploadingVehicleId === item.id ? "Загрузка..." : "Загрузить фото"}
                        <input
                          type="file"
                          accept={accommodationPhotoUploadAccept}
                          className="sr-only"
                          disabled={uploadingVehicleId !== null}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            void uploadPhoto(item.id, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {item.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => updateFleetItem(item.id, { photoUrl: null })}
                          className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive/72 transition hover:border-rose-200 hover:text-rose-600"
                        >
                          Убрать фото
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">Название транспорта</span>
                    <input
                      value={item.title}
                      onChange={(event) => updateFleetItem(item.id, { title: event.target.value })}
                      placeholder="Например: Семейный минивэн"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Вид транспорта</span>
                    <select
                      value={item.transportKind}
                      onChange={(event) =>
                        updateFleetItem(item.id, { transportKind: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Выберите вид</option>
                      {transferTransportKindOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Класс</span>
                    <input
                      value={item.vehicleClass}
                      onChange={(event) =>
                        updateFleetItem(item.id, { vehicleClass: event.target.value })
                      }
                      placeholder="Комфорт, бизнес, туристический"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">Модель или описание</span>
                    <input
                      value={item.vehicleModel}
                      onChange={(event) =>
                        updateFleetItem(item.id, { vehicleModel: event.target.value })
                      }
                      placeholder="Hyundai Staria, Mercedes Sprinter, УАЗ Патриот"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-olive">
                      <AppIcon icon={Users} className="h-4 w-4 text-primary" />
                      Пассажиры
                    </span>
                    <input
                      value={item.seats ?? ""}
                      onChange={(event) =>
                        updateFleetItem(item.id, {
                          seats:
                            event.target.value.trim() === ""
                              ? null
                              : Number.parseInt(event.target.value, 10) || null,
                        })
                      }
                      inputMode="numeric"
                      placeholder="4"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-olive">
                      <AppIcon icon={BriefcaseBusiness} className="h-4 w-4 text-primary" />
                      Багажные места
                    </span>
                    <input
                      value={item.luggage ?? ""}
                      onChange={(event) =>
                        updateFleetItem(item.id, {
                          luggage:
                            event.target.value.trim() === ""
                              ? null
                              : Number.parseInt(event.target.value, 10) || null,
                        })
                      }
                      inputMode="numeric"
                      placeholder="2"
                      className={inputClass}
                    />
                    <span className="block text-xs leading-5 text-olive/50">
                      Считайте стандартные чемоданы/сумки, а не килограммы.
                    </span>
                  </label>

                  <label className="space-y-1.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-olive">
                      <AppIcon icon={WalletCards} className="h-4 w-4 text-primary" />
                      Цена от, ₽
                    </span>
                    <input
                      value={item.priceFrom ?? ""}
                      onChange={(event) =>
                        updateFleetItem(item.id, {
                          priceFrom:
                            event.target.value.trim() === ""
                              ? null
                              : Number(event.target.value.replace(",", ".")) || null,
                        })
                      }
                      inputMode="decimal"
                      placeholder="2000"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-olive">Единица цены</span>
                    <select
                      value={item.priceUnitLabel}
                      onChange={(event) =>
                        updateFleetItem(item.id, { priceUnitLabel: event.target.value })
                      }
                      className={inputClass}
                    >
                      {transferPriceUnitOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">Уточнение по багажу</span>
                    <input
                      value={item.luggageNote}
                      onChange={(event) =>
                        updateFleetItem(item.id, { luggageNote: event.target.value })
                      }
                      placeholder="Например: 2 чемодана + ручная кладь, лыжи по согласованию"
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-olive">
                      Что важно знать о транспорте
                    </span>
                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        updateFleetItem(item.id, { description: event.target.value })
                      }
                      placeholder="Детское кресло, кондиционер, помощь с багажом, высокий клиренс, поездки ночью, встреча с табличкой"
                      className={textareaClass}
                    />
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
