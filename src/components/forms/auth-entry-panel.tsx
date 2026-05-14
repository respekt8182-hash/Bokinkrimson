"use client";

// Shared auth-layout panel wrapper used by login, register, and password reset screens.
import { useState } from "react";
import { cn } from "@/lib/cn";
import { LoginForm } from "@/components/forms/login-form";
import { RegisterForm } from "@/components/forms/register-form";

type AuthEntryPanelProps = {
  nextPath?: string;
  defaultTab?: "login" | "register";
};

export function AuthEntryPanel({ nextPath, defaultTab = "login" }: AuthEntryPanelProps) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const isLoginTab = tab === "login";

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-olive/14 bg-cream/80 p-1">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={cn(
              "inline-flex min-h-10 items-center rounded-lg px-4 py-1.5 text-sm font-semibold transition",
              isLoginTab ? "bg-white text-olive shadow-sm" : "text-olive/70 hover:text-olive",
            )}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={cn(
              "inline-flex min-h-10 items-center rounded-lg px-4 py-1.5 text-sm font-semibold transition",
              !isLoginTab ? "bg-white text-olive shadow-sm" : "text-olive/70 hover:text-olive",
            )}
          >
            Регистрация
          </button>
        </div>
      </div>

      {isLoginTab ? (
        <section className="space-y-4">
          <LoginForm nextPath={nextPath} />

          <div className="rounded-xl border border-olive/14 bg-cream/70 p-3 text-sm text-olive/75">
            Еще не зарегистрированы?{" "}
            <button
              type="button"
              onClick={() => setTab("register")}
              className="font-semibold text-terra hover:underline"
            >
              Это очень просто
            </button>
            .
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <RegisterForm />

          <div className="rounded-xl border border-dashed border-olive/20 bg-white/65 p-3 text-sm text-olive/70">
            Разместитесь один раз и работайте напрямую с клиентами: без дополнительных комиссий,
            взносов и процентов с бронирований. Удобно отелям, гостевым домам, владельцам жилья и
            съемщикам, потому что итоговая цена остается честнее.
          </div>

          <p className="text-sm text-olive/72">
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => setTab("login")}
              className="font-semibold text-terra hover:underline"
            >
              Войти
            </button>
            .
          </p>
        </section>
      )}
    </div>
  );
}
