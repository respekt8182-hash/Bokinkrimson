"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ResetPasswordFormProps = {
  initialToken: string;
};

export function ResetPasswordForm({ initialToken }: ResetPasswordFormProps) {
  const [token] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Ссылка для сброса пароля недействительна.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Новый пароль должен содержать минимум 8 символов.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        setError(body.error ?? "Не удалось изменить пароль.");
        return;
      }

      setSuccess("Пароль успешно изменён. Теперь можно войти с новым паролем.");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="block text-sm font-medium text-olive">
          Новый пароль
        </label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-olive">
          Повторите пароль
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Сохраняем..." : "Сменить пароль"}
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="rounded-lg bg-sage/25 px-3 py-2 text-sm text-olive">{success}</p> : null}
    </form>
  );
}
