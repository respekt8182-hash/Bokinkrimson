"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type AdminSoftDeleteActionProps = {
  deleteEndpoint: string;
  restoreEndpoint: string;
  entityLabel: string;
  entityName: string;
  isPendingDeletion: boolean;
  restoreUntil?: string | null;
  deleteButtonLabel?: string;
  restoreButtonLabel?: string;
  disabled?: boolean;
  disabledReason?: string | null;
};

type DeleteResponse = {
  error?: string;
  restoreUntil?: string | null;
};

export function AdminSoftDeleteAction({
  deleteEndpoint,
  restoreEndpoint,
  entityLabel,
  entityName,
  isPendingDeletion,
  restoreUntil,
  deleteButtonLabel = "Удалить",
  restoreButtonLabel = "Отмена удаления",
  disabled = false,
  disabledReason = null,
}: AdminSoftDeleteActionProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const restoreUntilLabel = useMemo(() => {
    if (!restoreUntil) {
      return null;
    }

    return new Date(restoreUntil).toLocaleString("ru-RU");
  }, [restoreUntil]);

  async function handleDelete() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(deleteEndpoint, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as DeleteResponse | null;

      if (!response.ok) {
        setError(body?.error ?? `Не удалось удалить ${entityLabel}.`);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
    } catch {
      setError(`Не удалось удалить ${entityLabel}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestore() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(restoreEndpoint, { method: "POST" });
      const body = (await response.json().catch(() => null)) as DeleteResponse | null;

      if (!response.ok) {
        setError(body?.error ?? `Не удалось вернуть ${entityLabel}.`);
        return;
      }

      router.refresh();
    } catch {
      setError(`Не удалось вернуть ${entityLabel}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      {isPendingDeletion ? (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleRestore()}
            disabled={disabled || isSubmitting}
            className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            title={disabled && disabledReason ? disabledReason : undefined}
          >
            {isSubmitting ? "Возвращаем..." : restoreButtonLabel}
          </Button>
          {restoreUntilLabel ? (
            <p className="text-xs text-olive/60">Удаление можно отменить до {restoreUntilLabel}.</p>
          ) : null}
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError("");
              setIsModalOpen(true);
            }}
            disabled={disabled || isSubmitting}
            className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
            title={disabled && disabledReason ? disabledReason : undefined}
          >
            {deleteButtonLabel}
          </Button>

          {isModalOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
              <div className="w-full max-w-xl rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
                <h3 className="text-xl text-olive">Подтверждение удаления</h3>
                <p className="mt-2 text-sm text-olive/80">
                  Вы удаляете {entityLabel}{" "}
                  <span className="font-semibold text-olive">{entityName}</span>.
                </p>
                <p className="mt-2 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                  Элемент будет скрыт сразу, а окончательное удаление произойдет через сутки. До
                  этого момента действие можно отменить.
                </p>

                {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsModalOpen(false);
                      setError("");
                    }}
                    disabled={isSubmitting}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={isSubmitting}
                    className="bg-terra text-white hover:bg-terra/88"
                  >
                    {isSubmitting ? "Удаление..." : "Подтверждаю удаление"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {disabled && disabledReason ? <p className="text-xs text-olive/60">{disabledReason}</p> : null}
      {error && !isModalOpen ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
