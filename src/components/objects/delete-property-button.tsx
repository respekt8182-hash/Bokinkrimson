// UI component for delete property button in the objects module.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROPERTY_OWNER_DELETE_RETENTION_DAYS } from "@/lib/property-owner-delete";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type DeletePropertyButtonProps = {
  propertyId: string;
  propertyName: string;
  propertyStatus: string;
  className?: string;
  buttonClassName?: string;
};

type DeletePropertyResponse = {
  error?: string;
  mode?: "soft" | "hard";
  restoreUntil?: string;
  message?: string;
};

export function DeletePropertyButton({
  propertyId,
  propertyName,
  propertyStatus,
  className,
  buttonClassName,
}: DeletePropertyButtonProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isPublished = propertyStatus === "PUBLISHED";

  async function confirmDelete() {
    if (!isAcknowledged) {
      setError("Подтвердите согласие перед удалением");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acknowledged: true,
        }),
      });

      const body = (await response.json()) as DeletePropertyResponse;

      if (!response.ok) {
        setError(body.error ?? "Не удалось удалить объект");
        return;
      }

      if (body.mode === "soft") {
        const restoreUntil = body.restoreUntil
          ? new Date(body.restoreUntil).toLocaleString("ru-RU")
          : null;
        setSuccess(
          restoreUntil
            ? `Объект удален из кабинета. Если удаление ошибочное, обратитесь к администрации сайта до ${restoreUntil} для восстановления`
            : `Объект удален из кабинета. Если удаление ошибочное, обратитесь к администрации сайта в течение ${PROPERTY_OWNER_DELETE_RETENTION_DAYS} дней`,
        );
      } else {
        setSuccess("Объект полностью удален без возможности восстановления");
      }

      setIsModalOpen(false);
      setIsAcknowledged(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function openModal() {
    setError("");
    setIsAcknowledged(false);
    setIsModalOpen(true);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        onClick={openModal}
        className={cn(
          "border border-terra/45 text-terra hover:bg-terra/10 hover:text-terra",
          buttonClassName,
        )}
      >
        Удалить объект
      </Button>

      {success ? <p className="max-w-xl text-xs text-green-700">{success}</p> : null}
      {error && !isModalOpen ? <p className="max-w-xl text-xs text-red-600">{error}</p> : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
            <h3 className="text-xl text-olive">Подтверждение удаления</h3>
            <p className="mt-2 text-sm text-olive/80">
              Вы удаляете объект <span className="font-semibold text-olive">{propertyName}</span>.
            </p>
            <p className="mt-2 text-sm text-olive/80">
              Если объект был оплачен, оплата за размещение не возвращается.
            </p>
            {isPublished ? (
              <p className="mt-2 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                Объект сейчас опубликован. Он исчезнет из вашего кабинета и из публичного каталога.
                Восстановление возможно только через администрацию в течение{" "}
                {PROPERTY_OWNER_DELETE_RETENTION_DAYS} дней.
              </p>
            ) : (
              <p className="mt-2 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                Этот объект будет удален полностью и без возможности восстановления.
              </p>
            )}

            <label className="mt-3 flex items-start gap-2 text-sm text-olive">
              <input
                type="checkbox"
                checked={isAcknowledged}
                onChange={(event) => setIsAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-olive/30"
              />
              <span>
                Я точно соглашаюсь и понимаю, что объект удалится. Если объект был оплачен, оплата
                не вернется.
              </span>
            </label>

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
                onClick={() => void confirmDelete()}
                disabled={!isAcknowledged || isSubmitting}
                className="bg-terra text-white hover:bg-terra/88"
              >
                {isSubmitting ? "Удаление..." : "Подтверждаю удаление"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
