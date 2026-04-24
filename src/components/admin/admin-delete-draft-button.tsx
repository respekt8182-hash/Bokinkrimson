"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type AdminDeleteDraftButtonProps = {
  endpoint: string;
  draftLabel: string;
  entityName: string;
  buttonLabel?: string;
  confirmLabel?: string;
  redirectTo?: string;
  description?: string;
  buttonVariant?: "primary" | "secondary" | "ghost";
  buttonClassName?: string;
};

type DeleteResponse = {
  error?: string;
};

export function AdminDeleteDraftButton({
  endpoint,
  draftLabel,
  entityName,
  buttonLabel = "Удалить черновик",
  confirmLabel = "Подтвердить удаление",
  redirectTo,
  description,
  buttonVariant = "ghost",
  buttonClassName,
}: AdminDeleteDraftButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    if (!isAcknowledged) {
      setError("Подтвердите удаление черновика.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as DeleteResponse;
        setError(body.error ?? "Не удалось удалить черновик.");
        return;
      }

      setIsOpen(false);
      setIsAcknowledged(false);

      if (redirectTo) {
        router.push(redirectTo);
      }

      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={buttonVariant}
        onClick={() => {
          setError("");
          setIsAcknowledged(false);
          setIsOpen(true);
        }}
        className={buttonClassName}
      >
        {buttonLabel}
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl text-olive">Удалить черновик</h3>
                <p className="mt-1 text-sm text-olive/75">
                  {draftLabel}:{" "}
                  <span className="font-semibold text-olive">{entityName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setError("");
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/20 text-olive hover:bg-cream"
                aria-label="Закрыть"
              >
                x
              </button>
            </div>

            <p className="mt-4 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
              {description ??
                "Черновик будет полностью удалён из системы и из кабинета пользователя. Действие необратимо."}
            </p>

            <label className="mt-3 flex items-start gap-2 text-sm text-olive">
              <input
                type="checkbox"
                checked={isAcknowledged}
                onChange={(event) => setIsAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-olive/30"
              />
              <span>Подтверждаю, что этот черновик нужно удалить без возможности восстановления.</span>
            </label>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  setError("");
                }}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={!isAcknowledged || isSubmitting}
                className="bg-terra text-white hover:bg-terra/88"
              >
                {isSubmitting ? "Удаление..." : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
