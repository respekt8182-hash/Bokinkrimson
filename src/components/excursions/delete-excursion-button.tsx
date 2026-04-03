"use client";

// Client component for delete excursion button in the excursions module.
import { ExcursionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type DeleteExcursionButtonProps = {
  excursionId: string;
  excursionTitle: string;
  excursionStatus: ExcursionStatus;
};

type DeleteExcursionResponse = {
  error?: string;
};

function getStatusDeleteHint(status: ExcursionStatus): string {
  if (status === ExcursionStatus.DRAFT) {
    return "Черновик удалится сразу и без возможности восстановления.";
  }

  if (status === ExcursionStatus.PUBLISHED) {
    return "Опубликованная программа будет снята с публикации и удалена без возможности восстановления.";
  }

  if (status === ExcursionStatus.PENDING_MODERATION) {
    return "Программа на модерации будет удалена из кабинета. Восстановление не предусмотрено.";
  }

  if (status === ExcursionStatus.NEEDS_FIX || status === ExcursionStatus.REJECTED) {
    return "Программа со статусом модерации будет удалена без возможности восстановления.";
  }

  return "Программа будет удалена без возможности восстановления.";
}

export function DeleteExcursionButton({
  excursionId,
  excursionTitle,
  excursionStatus,
}: DeleteExcursionButtonProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const warningText = getStatusDeleteHint(excursionStatus);

  async function confirmDelete() {
    if (!isAcknowledged) {
      setError("Подтвердите согласие перед удалением");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/excursions/${excursionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json()) as DeleteExcursionResponse;
        setError(body.error ?? "Не удалось удалить программу");
        return;
      }

      setSuccess("Программа удалена");
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
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        onClick={openModal}
        className="border border-terra/45 text-terra hover:bg-terra/10 hover:text-terra"
      >
        Удалить программу
      </Button>

      {success ? <p className="max-w-xl text-xs text-green-700">{success}</p> : null}
      {error && !isModalOpen ? <p className="max-w-xl text-xs text-red-600">{error}</p> : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
            <h3 className="text-xl text-olive">Подтверждение удаления</h3>
            <p className="mt-2 text-sm text-olive/80">
              Вы удаляете программу <span className="font-semibold text-olive">{excursionTitle}</span>.
            </p>
            <p className="mt-2 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">{warningText}</p>

            <label className="mt-3 flex items-start gap-2 text-sm text-olive">
              <input
                type="checkbox"
                checked={isAcknowledged}
                onChange={(event) => setIsAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-olive/30"
              />
              <span>Я понимаю, что программа будет удалена.</span>
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
