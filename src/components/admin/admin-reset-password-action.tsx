// UI component for admin reset password action in the admin module.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type AdminResetPasswordActionProps = {
  userId: string;
  userEmail: string | null;
};

type ResetPasswordResponse = {
  error?: string;
  item?: {
    resetIssuedAt: string;
    resetExpiresAt: string;
  };
};

export function AdminResetPasswordAction({ userId, userEmail }: AdminResetPasswordActionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResetPasswordResponse["item"] | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });

      const body = (await response.json()) as ResetPasswordResponse;
      if (!response.ok || !body.item) {
        setError(body.error ?? "Не удалось отправить ссылку для сброса");
        return;
      }

      setResult(body.item);
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
        Администратор отправит одноразовую ссылку на подтверждённый email{" "}
        <span className="font-semibold text-olive">{userEmail ?? "пользователя"}</span>.
      </p>

      {result ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
            Ссылка для сброса отправлена.
          </p>
          <p className="rounded-xl bg-cream px-3 py-2 text-sm text-olive">
            Действует до:{" "}
            <span className="font-semibold">
              {new Date(result.resetExpiresAt).toLocaleString("ru-RU")}
            </span>
          </p>
          <Button variant="ghost" onClick={() => setResult(null)} className="text-xs py-2">
            Отправить ещё раз
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-olive/70">
            В ответе API временный пароль больше не возвращается. Пользователь сам задаст новый пароль по одноразовой ссылке.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Отправка..." : "Отправить ссылку для сброса"}
          </Button>
        </div>
      )}
    </section>
  );
}
