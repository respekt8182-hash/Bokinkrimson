// UI component for login form in the forms module.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/phone-input";
import { loginSchema } from "@/lib/schemas/auth";

type LoginFormProps = {
  nextPath?: string;
};

type LoginResponse = {
  error?: string;
  user?: {
    role: "USER" | "ADMIN";
  };
};

function resolveLoginErrorMessage(status: number, bodyError?: string): string {
  if (status === 503) {
    return "Вход временно недоступен. Проверьте подключение к базе данных и повторите попытку.";
  }

  if (status >= 500) {
    return "Ошибка сервера. Попробуйте снова чуть позже.";
  }

  return bodyError ?? "Ошибка входа";
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({
    countryCode: "+7",
    phone: "",
  });
  const [password, setPassword] = useState("");

  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerError("");
      setPhoneError("");
      setPasswordError("");

      const fullPhone = phoneValue.countryCode + phoneValue.phone;
      const parsed = loginSchema.safeParse({ phone: fullPhone, password });

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        if (fieldErrors.phone?.[0]) setPhoneError(fieldErrors.phone[0]);
        if (fieldErrors.password?.[0]) setPasswordError(fieldErrors.password[0]);
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: fullPhone, password }),
        });

        let body: LoginResponse = {};
        try {
          body = (await response.json()) as LoginResponse;
        } catch {
          body = {};
        }

        if (!response.ok) {
          setServerError(resolveLoginErrorMessage(response.status, body.error));
          setIsSubmitting(false);
          return;
        }

        const fallbackPath = body.user?.role === "ADMIN" ? "/admin" : "/dashboard";
        router.push(nextPath || fallbackPath);
        router.refresh();
      } catch {
        setServerError("Не удалось выполнить вход. Проверьте соединение и попробуйте снова.");
        setIsSubmitting(false);
      }
    },
    [phoneValue, password, nextPath, router],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-olive">
          Телефон
        </label>
        <PhoneInput
          id="phone"
          value={phoneValue}
          onChange={setPhoneValue}
          hasError={!!phoneError}
        />
        {phoneError ? <p className="mt-1 text-xs text-red-600">{phoneError}</p> : null}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-olive">
            Пароль
          </label>
          <Link href="/auth/forgot-password" className="text-xs text-terra hover:underline">
            Забыли пароль?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/22 pr-28"
          />
          <button
            type="button"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            className="absolute inset-y-0 right-2 my-auto inline-flex h-10 items-center rounded-md px-2.5 text-sm font-semibold text-olive/78 transition hover:bg-cream"
          >
            {isPasswordVisible ? "Скрыть" : "Показать"}
          </button>
        </div>
        {passwordError ? <p className="mt-1 text-xs text-red-600">{passwordError}</p> : null}
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Вход..." : "Войти"}
      </Button>
    </form>
  );
}
