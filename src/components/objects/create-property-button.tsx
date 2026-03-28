"use client";

// Client component for create property button in the objects module.
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CreatePropertyButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
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

  function onCreateNewObject() {
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/properties", { method: "POST" });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось создать черновик");
        return;
      }

      const body = (await response.json()) as { item: { id: string } };
      router.push(`/dashboard/objects/${body.item.id}/about`);
      router.refresh();
      closeModal();
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={openModal}>Добавить объект</Button>

      {isModalVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl text-olive">Выберите действие</h3>
                <p className="mt-1 text-sm text-olive/75">
                  Создайте новый объект.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/20 text-olive hover:bg-cream"
                aria-label="Закрыть"
              >
                x
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <Button onClick={onCreateNewObject} disabled={isPending}>
                {isPending ? "Создание..." : "Создать новый объект"}
              </Button>
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
