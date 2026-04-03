// UI component for create excursion button in the excursions module.
"use client";

import { ExcursionOfferType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CreateExcursionButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const onCreate = (offerType: ExcursionOfferType) => {
    setError("");
    setIsPickerOpen(false);

    startTransition(async () => {
      const response = await fetch("/api/excursions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerType }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось создать черновик программы");
        return;
      }

      const body = (await response.json()) as { item: { id: string } };
      router.push(`/dashboard/excursions/${body.item.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Button onClick={() => setIsPickerOpen((current) => !current)} disabled={isPending}>
          {isPending ? "Создание..." : "Добавить программу"}
        </Button>

        {isPickerOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-2xl border border-olive/10 bg-white p-3 shadow-xl">
            <p className="text-sm font-semibold text-olive">Что создаём?</p>
            <p className="mt-1 text-xs text-olive/55">
              Тип влияет на поля формы, логику публикации и публичную карточку.
            </p>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => onCreate(ExcursionOfferType.EXCURSION)}
                className="rounded-xl border border-olive/12 px-4 py-3 text-left transition hover:border-primary/35 hover:bg-primary/5"
              >
                <span className="block text-sm font-semibold text-olive">Экскурсия</span>
                <span className="mt-1 block text-xs text-olive/55">
                  Короткий маршрут, почасовая длительность, расписание и таймлайн по этапам.
                </span>
              </button>
              <button
                type="button"
                onClick={() => onCreate(ExcursionOfferType.TOUR)}
                className="rounded-xl border border-olive/12 px-4 py-3 text-left transition hover:border-primary/35 hover:bg-primary/5"
              >
                <span className="block text-sm font-semibold text-olive">Тур</span>
                <span className="mt-1 block text-xs text-olive/55">
                  Заезды, маршрут по точкам, программа по дням, проживание и питание.
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
