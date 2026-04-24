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
  item?: {
    resetIssuedAt?: string;
    resetExpiresAt?: string;
    passwordUpdatedAt?: string;
    passwordUpdatedDirectly?: boolean;
  };
};

export function AdminResetPasswordAction({ userId, userEmail }: AdminResetPasswordActionProps) {
  const router = useRouter();
  const [directForm, setDirectForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isDirectSubmitting, setIsDirectSubmitting] = useState(false);
  const [isLinkSubmitting, setIsLinkSubmitting] = useState(false);
  const [directSuccessAt, setDirectSuccessAt] = useState<string | null>(null);
  const [directError, setDirectError] = useState("");
  const [linkResult, setLinkResult] = useState<ResetPasswordResponse["item"] | null>(null);
  const [linkError, setLinkError] = useState("");

  async function handleDirectSubmit() {
    setDirectError("");
    setDirectSuccessAt(null);

    if (directForm.newPassword.length < 8) {
      setDirectError("Новый пароль должен содержать минимум 8 символов.");
      return;
    }

    if (directForm.newPassword !== directForm.confirmPassword) {
      setDirectError("Пароли не совпадают.");
      return;
    }

    setIsDirectSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "direct",
          newPassword: directForm.newPassword,
          confirmPassword: directForm.confirmPassword,
        }),
      });

      const body = (await response.json()) as ResetPasswordResponse;
      if (!response.ok) {
        setDirectError(body.error ?? "Не удалось обновить пароль");
        return;
      }

      setDirectSuccessAt(body.item?.passwordUpdatedAt ?? new Date().toISOString());
      setDirectForm({ newPassword: "", confirmPassword: "" });
      router.refresh();
    } catch {
      setDirectError("Не удалось обновить пароль. Проверьте соединение и попробуйте снова.");
    } finally {
      setIsDirectSubmitting(false);
    }
  }

  async function handleLinkSubmit() {
    setIsLinkSubmitting(true);
    setLinkError("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });

      const body = (await response.json()) as ResetPasswordResponse;
      if (!response.ok || !body.item) {
        setLinkError(body.error ?? "Не удалось отправить ссылку для сброса");
        return;
      }

      setLinkResult(body.item);
      router.refresh();
    } catch {
      setLinkError("Не удалось отправить ссылку. Проверьте соединение и попробуйте снова.");
    } finally {
      setIsLinkSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-olive/10 bg-white p-4">
      <h2 className="text-xl text-olive">Смена и сброс пароля</h2>
      <p className="mt-1 text-sm text-olive/70">
        Если пользователь не помнит пароль, админ может сразу задать новый или отправить ссылку на
        email.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-cream/70 p-4">
          <h3 className="text-base font-semibold text-olive">Задать новый пароль вручную</h3>
          <p className="mt-1 text-sm text-olive/70">
            Пароль обновится сразу. Потом его нужно передать пользователю безопасным способом.
          </p>

          {directSuccessAt ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
                Пароль обновлён.
              </p>
              <p className="rounded-xl bg-white px-3 py-2 text-sm text-olive">
                Время обновления:{" "}
                <span className="font-semibold">
                  {new Date(directSuccessAt).toLocaleString("ru-RU")}
                </span>
              </p>
              <Button
                variant="ghost"
                onClick={() => setDirectSuccessAt(null)}
                className="text-xs py-2"
              >
                Задать другой пароль
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-olive">Новый пароль</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={directForm.newPassword}
                  onChange={(event) =>
                    setDirectForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-olive">Повторите пароль</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={directForm.confirmPassword}
                  onChange={(event) =>
                    setDirectForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                />
              </label>
              {directError ? <p className="text-sm text-red-600">{directError}</p> : null}
              <Button
                type="button"
                onClick={() => void handleDirectSubmit()}
                disabled={isDirectSubmitting}
              >
                {isDirectSubmitting ? "Сохраняем..." : "Задать новый пароль"}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-olive/10 bg-white p-4">
          <h3 className="text-base font-semibold text-olive">Отправить ссылку на email</h3>
          <p className="mt-1 text-sm text-olive/70">
            Администратор отправит одноразовую ссылку на{" "}
            <span className="font-semibold text-olive">{userEmail ?? "email пользователя"}</span>.
          </p>

          {linkResult ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
                Ссылка для сброса отправлена.
              </p>
              {linkResult.resetExpiresAt ? (
                <p className="rounded-xl bg-cream px-3 py-2 text-sm text-olive">
                  Действует до:{" "}
                  <span className="font-semibold">
                    {new Date(linkResult.resetExpiresAt).toLocaleString("ru-RU")}
                  </span>
                </p>
              ) : null}
              <Button variant="ghost" onClick={() => setLinkResult(null)} className="text-xs py-2">
                Отправить ещё раз
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-olive/70">
                Пользователь сам задаст новый пароль по одноразовой ссылке.
              </p>
              {!userEmail ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  У пользователя нет email, поэтому лучше задать новый пароль вручную.
                </p>
              ) : null}
              {linkError ? <p className="text-sm text-red-600">{linkError}</p> : null}
              <Button
                type="button"
                onClick={() => void handleLinkSubmit()}
                disabled={isLinkSubmitting || !userEmail}
              >
                {isLinkSubmitting ? "Отправка..." : "Отправить ссылку для сброса"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
