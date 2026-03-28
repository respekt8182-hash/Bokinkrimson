// UI component for admin reset password action in the admin module.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminResetPasswordActionProps = {
  userId: string;
  userEmail: string | null;
};

type ResetPasswordResponse = {
  error?: string;
  temporaryPassword?: string;
  item?: {
    completedRequestsCount: number;
  };
};

export function AdminResetPasswordAction({ userId, userEmail }: AdminResetPasswordActionProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ password: string; count: number } | null>(null);
  const [error, setError] = useState("");

  async function copyToClipboard(value: string) {
    if (!value || !navigator.clipboard) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Пароль должен содержать не менее 8 символов");
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
        setError(body.error ?? "Не удалось сбросить пароль");
        return;
      }

      setResult({
        password: body.temporaryPassword ?? newPassword,
        count: body.item?.completedRequestsCount ?? 0,
      });
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch {
      setError("Не удалось выполнить сброс пароля. Проверьте соединение и попробуйте снова.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-olive/10 bg-white p-4">
      <h2 className="text-xl text-olive">Сброс пароля</h2>
      <p className="mt-1 text-sm text-olive/70">
        Установите новый пароль для <span className="font-semibold text-olive">{userEmail ?? "пользователя"}</span>.
      </p>

      {result ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
            Пароль успешно изменён. Закрыто запросов: {result.count}.
          </p>
          <p className="rounded-xl bg-cream px-3 py-2 text-sm text-olive">
            Установленный пароль: <span className="font-mono font-semibold">{result.password}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void copyToClipboard(result.password)} className="text-xs py-2">
              Скопировать
            </Button>
            <Button variant="ghost" onClick={() => setResult(null)} className="text-xs py-2">
              Сбросить ещё раз
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-olive">Новый пароль</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={8}
              placeholder="Минимум 8 символов"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-olive">Подтвердить пароль</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={8}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Установить пароль"}
          </Button>
        </form>
      )}
    </section>
  );
}
