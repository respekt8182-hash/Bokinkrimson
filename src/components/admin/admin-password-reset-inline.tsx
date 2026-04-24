// Inline password reset action for pending requests in the admin password-resets list.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type AdminPasswordResetInlineProps = {
  userId: string;
  userEmail: string | null;
};

type ResetPasswordResponse = {
  error?: string;
};

export function AdminPasswordResetInline({ userId, userEmail }: AdminPasswordResetInlineProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });

      const body = (await response.json()) as ResetPasswordResponse;
      if (!response.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError("Сбой сети. Повторите попытку.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center rounded-xl bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
        Ссылка отправлена
      </span>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-1.5">
      <p className="sr-only">Отправить ссылку для сброса пароля {userEmail}</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full text-xs py-2">
        {isSubmitting ? "..." : "Отправить ссылку"}
      </Button>
    </form>
  );
}
