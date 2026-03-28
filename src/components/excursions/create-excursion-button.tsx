// UI component for create excursion button in the excursions module.
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CreateExcursionButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const onCreate = () => {
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/excursions", { method: "POST" });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось создать черновик экскурсии");
        return;
      }

      const body = (await response.json()) as { item: { id: string } };
      router.push(`/dashboard/excursions/${body.item.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Button onClick={onCreate} disabled={isPending}>
        {isPending ? "Создание..." : "Добавить экскурсию"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
