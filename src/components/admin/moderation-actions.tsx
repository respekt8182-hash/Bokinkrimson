// UI component for moderation actions in the admin module.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ModerationAction = "approve" | "reject";

type ModerationActionsProps = {
  propertyId: string;
  currentStatus: string;
  initialComment: string;
};

export function ModerationActions({
  propertyId,
  currentStatus,
  initialComment,
}: ModerationActionsProps) {
  const router = useRouter();
  const [comment, setComment] = useState(initialComment);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(action: ModerationAction) {
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/properties/${propertyId}/moderation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment,
        }),
      });

      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Не удалось изменить статус объекта");
        return;
      }

      setSuccess("Статус объекта обновлен.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function clearComment() {
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_moderation_comment",
        }),
      });

      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Не удалось удалить комментарий");
        return;
      }

      setComment("");
      setSuccess("Комментарий удален.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-olive/10 bg-white p-4">
      <h2 className="text-xl text-olive">Действия модератора</h2>
      <p className="mt-1 text-sm text-olive/70">
        Текущий статус: <span className="font-semibold text-olive">{currentStatus}</span>
      </p>

      <label className="mt-3 block space-y-1">
        <span className="text-sm font-medium text-olive">Комментарий владельцу</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={5}
          maxLength={2000}
          className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20"
          placeholder="Причина отклонения или замечания по карточке"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void submit("approve")} disabled={isSaving}>
          Одобрить и опубликовать
        </Button>
        <Button variant="ghost" onClick={() => void submit("reject")} disabled={isSaving}>
          Отклонить
        </Button>
        <Button
          variant="ghost"
          onClick={() => void clearComment()}
          disabled={isSaving || !comment.trim()}
        >
          Удалить комментарий
        </Button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-green-700">{success}</p> : null}
    </section>
  );
}
