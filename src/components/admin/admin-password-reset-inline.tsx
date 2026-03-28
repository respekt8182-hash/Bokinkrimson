// Inline password reset form for pending requests in the admin password-resets list.
"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminPasswordResetInlineProps = {
  userId: string;
  userEmail: string | null;
};

type ResetPasswordResponse = {
  error?: string;
};

export function AdminPasswordResetInline({ userId, userEmail }: AdminPasswordResetInlineProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Минимум 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
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
        Пароль установлен
      </span>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-1.5">
      <p className="sr-only">Сброс пароля для {userEmail}</p>
      <div className="relative">
        <Input
          type={showNew ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Новый пароль"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={8}
          className="h-8 px-2.5 py-1 pr-7 text-xs"
        />
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="absolute inset-y-0 right-2 flex items-center text-olive/40 hover:text-olive/70"
        >
          <AppIcon icon={showNew ? EyeOff : Eye} className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
        <Input
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Подтвердить"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={8}
          className="h-8 px-2.5 py-1 pr-7 text-xs"
        />
        <button
          type="button"
          onClick={() => setShowConfirm((v) => !v)}
          className="absolute inset-y-0 right-2 flex items-center text-olive/40 hover:text-olive/70"
        >
          <AppIcon icon={showConfirm ? EyeOff : Eye} className="h-4 w-4" />
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full text-xs py-2">
        {isSubmitting ? "..." : "Подтвердить"}
      </Button>
    </form>
  );
}
