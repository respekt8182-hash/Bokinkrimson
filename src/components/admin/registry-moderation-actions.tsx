"use client";

// Client component for registry moderation actions in the admin module.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RegistryModerationActionsProps = {
  propertyId: string;
  pendingRegistryNumber: string;
};

type RegistryModerationAction = "approve" | "reject";

export function RegistryModerationActions({
  propertyId,
  pendingRegistryNumber,
}: RegistryModerationActionsProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(action: RegistryModerationAction) {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/properties/${propertyId}/registry-moderation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment.trim(),
        }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Не удалось обработать проверку КСР");
        return;
      }

      setSuccess(action === "approve" ? "КСР подтвержден" : "КСР отклонен");
      if (action === "approve") {
        setComment("");
      }
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <p className="text-sm font-semibold text-amber-900">
        Проверка КСР: {pendingRegistryNumber}
      </p>
      <p className="mt-1 text-xs text-amber-800">
        После подтверждения номер станет видимым в карточке объекта.
      </p>

      <label className="mt-3 block space-y-1">
        <span className="text-sm font-medium text-olive">Комментарий модератора</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20"
          placeholder="Причина отклонения или пометка по проверке"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void submit("approve")} disabled={isSaving}>
          Подтвердить КСР
        </Button>
        <Button variant="ghost" onClick={() => void submit("reject")} disabled={isSaving}>
          Отклонить КСР
        </Button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-green-700">{success}</p> : null}
    </section>
  );
}
