"use client";

import { ExcursionOfferType } from "@prisma/client";
import { Compass, Map as MapIcon, Plus, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const creationOptions = [
  {
    type: ExcursionOfferType.EXCURSION,
    title: "Экскурсия",
    text: "Короткий маршрут, почасовая длительность, расписание и этапы.",
    icon: Compass,
  },
  {
    type: ExcursionOfferType.TOUR,
    title: "Тур",
    text: "Заезды, маршрут по точкам, программа по дням, проживание и питание.",
    icon: MapIcon,
  },
];

export function CreateExcursionButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isQueryModalOpen = searchParams.get("create") === "1";
  const isModalVisible = isModalOpen || isQueryModalOpen;

  function openModal() {
    setError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setError("");

    if (searchParams.get("create") === "1") {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("create");
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }

  function onCreate(offerType: ExcursionOfferType) {
    setError("");

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
  }

  return (
    <div className="w-full space-y-2 min-[420px]:w-auto">
      <Button
        onClick={openModal}
        disabled={isPending}
        className="dashboard-create-action h-14 w-full justify-center gap-2 rounded-[18px] px-6 text-base min-[420px]:w-auto"
      >
        <AppIcon icon={Plus} className="h-4 w-4" />
        {isPending ? "Создание..." : "Добавить программу"}
      </Button>

      {isModalVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl text-olive">Новая программа</h3>
                <p className="mt-1 text-sm text-olive/75">
                  Создайте карточку тура или экскурсии и заполните ее по шагам.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/20 text-olive hover:bg-cream"
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {creationOptions.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => onCreate(option.type)}
                  disabled={isPending}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border border-olive/12 bg-white px-4 py-3 text-left transition",
                    "hover:border-primary/35 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-55",
                  )}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                    <AppIcon icon={option.icon} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-olive">{option.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-olive/55">
                      {option.text}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
