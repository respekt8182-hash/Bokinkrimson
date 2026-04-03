// Standalone admin login page — outside the admin layout.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Неверные данные");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f5] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0f766e] shadow-lg">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1
            className="text-3xl font-bold text-[#3a2b23]"
            style={{ fontFamily: "var(--font-heading, 'Yeseva One', serif)" }}
          >
            Панель администратора
          </h1>
          <p className="mt-2 text-sm text-[#3a2b23]/55">Введите данные для входа</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-[#3a2b23]/10 bg-white/94 p-6 shadow-xl shadow-[#3a2b23]/5"
        >
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#3a2b23]">Логин</span>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-[#3a2b23]/20 bg-white px-4 py-3 text-sm text-[#3a2b23] outline-none transition-colors focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
              placeholder="admin"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#3a2b23]">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[#3a2b23]/20 bg-white px-4 py-3 text-sm text-[#3a2b23] outline-none transition-colors focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
              placeholder="Пароль"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#115e59] disabled:opacity-60"
          >
            {loading ? "Вход..." : "Войти в админ-панель"}
          </button>
        </form>
      </div>
    </div>
  );
}
