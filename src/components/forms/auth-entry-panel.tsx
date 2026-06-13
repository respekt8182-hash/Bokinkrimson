"use client";

// Shared auth-layout panel wrapper used by login, register, and password reset screens.
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { AppIcon } from "@/components/ui/app-icon";
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
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="grid w-full max-w-[340px] grid-cols-2 rounded-2xl border border-olive/8 bg-cream/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={cn(
              "inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
              isLoginTab
                ? "bg-white text-olive shadow-[0_10px_24px_-18px_rgba(58,43,35,0.55),inset_0_1px_0_rgba(255,255,255,0.92)]"
                : "text-olive/68 hover:text-olive",
            )}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={cn(
              "inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
              !isLoginTab
                ? "bg-white text-olive shadow-[0_10px_24px_-18px_rgba(58,43,35,0.55),inset_0_1px_0_rgba(255,255,255,0.92)]"
                : "text-olive/68 hover:text-olive",
            )}
          >
            Регистрация
          </button>
        </div>
      </div>

      {isLoginTab ? (
        <section className="space-y-5">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl text-olive md:text-[28px]">Добро пожаловать обратно</h1>
            <p className="text-sm leading-6 text-olive/62">
              Войдите, чтобы управлять бронированиями и объявлениями.
            </p>
          </div>

          <LoginForm nextPath={nextPath} />

          <div className="flex items-center gap-4 text-xs font-medium text-olive/42">
            <span className="h-px flex-1 bg-olive/10" />
            или
            <span className="h-px flex-1 bg-olive/10" />
          </div>

          <div className="text-center text-sm text-olive/58">
            Ещё нет аккаунта?{" "}
            <button
              type="button"
              onClick={() => setTab("register")}
              className="font-semibold text-primary hover:underline"
            >
              Зарегистрироваться
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl text-olive md:text-[28px]">Создайте аккаунт</h1>
            <p className="text-sm leading-6 text-olive/62">
              Размещайте жильё, бронируйте услуги и общайтесь с клиентами напрямую.
            </p>
          </div>

          <RegisterForm />

          <div className="flex gap-4 rounded-2xl border border-terra/10 bg-terra/[0.055] p-4 text-sm text-olive/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-terra shadow-sm">
              <AppIcon icon={ShieldCheck} className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-terra-ink">
                Без комиссии за бронирование
              </span>
              <span className="mt-1 block leading-5">
                Размещайтесь один раз и работайте напрямую с клиентами. Подходит отелям, гостевым
                домам, владельцам жилья и организаторам экскурсий.
              </span>
            </span>
          </div>

          <p className="text-center text-sm text-olive/58">
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => setTab("login")}
              className="font-semibold text-primary hover:underline"
            >
              Войти
            </button>
          </p>
        </section>
      )}
    </div>
  );
}
