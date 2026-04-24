"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ArrowRight, CircleAlert, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Не удалось выполнить вход.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Сервер недоступен. Проверьте, что приложение запущено.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.18),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(14,116,144,0.16),transparent_32%),linear-gradient(180deg,#f7f4ef_0%,#f1ebe2_48%,#f8f7f3_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[-7rem] h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute inset-x-0 top-24 mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <div className="w-full">
          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_26px_80px_rgba(58,43,35,0.16)] backdrop-blur-2xl sm:p-7">
              <div className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.72))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-8">
                <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/65">
                        Админ-панель
                      </p>
                      <h1 className="mt-2 text-3xl leading-tight text-olive sm:text-4xl">
                        Вход в админ-панель
                      </h1>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-olive">Логин</span>
                    <div className="rounded-2xl border border-olive/12 bg-white/90 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
                      <input
                        type="text"
                        value={login}
                        onChange={(event) => setLogin(event.target.value)}
                        required
                        autoFocus
                        autoComplete="username"
                        placeholder="Введите логин"
                        className="h-14 w-full border-none bg-transparent text-base text-olive outline-none placeholder:text-olive/32"
                      />
                    </div>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-olive">Пароль</span>
                    <div className="relative rounded-2xl border border-olive/12 bg-white/90 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="Введите пароль"
                        className="h-14 w-full border-none bg-transparent pr-24 text-base text-olive outline-none placeholder:text-olive/32"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                        title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-olive/60 transition hover:bg-sand/70 hover:text-olive"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#0f766e_46%,#164e63_100%)] px-5 text-base font-semibold text-white shadow-[0_18px_38px_rgba(15,118,110,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_40px_rgba(15,118,110,0.3)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span>{loading ? "Входим..." : "Войти в админку"}</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
