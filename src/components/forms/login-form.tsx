// UI component for login form in the forms module.
"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/phone-input";
import { loginSchema } from "@/lib/schemas/auth";

type LoginFormProps = {
  nextPath?: string;
};

type LoginResponse = {
  error?: string;
  retryAfterSeconds?: number;
  user?: {
    role: "USER" | "ADMIN";
  };
};

function formatWaitTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseRetryAfter(value: string | null, fallback?: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return typeof fallback === "number" && fallback > 0 ? Math.ceil(fallback) : 0;
}

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
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({
    countryCode: "+7",
    phone: "",
  });
  const [password, setPassword] = useState("");

  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const isLockedOut = lockoutSeconds > 0;
  const visibleServerError = isLockedOut
    ? `Слишком много попыток входа. Подождите ${formatWaitTime(lockoutSeconds)} и попробуйте снова.`
    : serverError;

  useEffect(() => {
    if (!isLockedOut) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLockoutSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [isLockedOut, lockoutSeconds]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (lockoutSeconds > 0) {
        return;
      }

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
          if (response.status === 429) {
            const retryAfterSeconds = parseRetryAfter(
              response.headers.get("Retry-After"),
              body.retryAfterSeconds,
            );
            if (retryAfterSeconds > 0) {
              setLockoutSeconds(retryAfterSeconds);
              setServerError("");
              setIsSubmitting(false);
              return;
            }
          }

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
    [phoneValue, password, nextPath, router, lockoutSeconds],
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
            className="w-full rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 pr-12 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/22"
          />
          <button
            type="button"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
            title={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
            className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-olive/72 transition hover:bg-cream hover:text-olive"
          >
            <AppIcon icon={isPasswordVisible ? EyeOff : Eye} className="h-4 w-4" />
          </button>
        </div>
        {passwordError ? <p className="mt-1 text-xs text-red-600">{passwordError}</p> : null}
      </div>

      {visibleServerError ? <p className="text-sm text-red-600">{visibleServerError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting || isLockedOut}>
        {isLockedOut
          ? `Подождите ${formatWaitTime(lockoutSeconds)}`
          : isSubmitting
            ? "Вход..."
            : "Войти"}
      </Button>
    </form>
  );
}
