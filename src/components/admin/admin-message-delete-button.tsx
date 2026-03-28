"use client";

// Client component for admin message delete button in the admin module.

import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminMessageDeleteButtonProps = {
  messageId: string;
};

export function AdminMessageDeleteButton({ messageId }: AdminMessageDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (!window.confirm("Удалить сообщение?")) {
      return;
    }

    setError("");
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/messages/${messageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось удалить сообщение");
        return;
      }

      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={isDeleting}
        className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Удаление..." : "Удалить"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
