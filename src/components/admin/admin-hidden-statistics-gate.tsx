"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";
import {
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { HIDDEN_STATS_PIN, HIDDEN_STATS_SESSION_KEY } from "@/lib/admin-hidden-statistics";
import { cn } from "@/lib/cn";

type AdminHiddenStatisticsGateProps = {
  children: React.ReactNode;
};

function subscribeNoop() {
  return () => {};
}

function getStoredAccessSnapshot(): boolean {
  try {
    return window.sessionStorage.getItem(HIDDEN_STATS_SESSION_KEY) === "granted";
  } catch {
    return false;
  }
}

function getServerAccessSnapshot(): boolean {
  return false;
}

export function AdminHiddenStatisticsGate({ children }: AdminHiddenStatisticsGateProps) {
  const hasStoredAccess = useSyncExternalStore(
    subscribeNoop,
    getStoredAccessSnapshot,
    getServerAccessSnapshot,
  );
  const [hasAcceptedPin, setHasAcceptedPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pin.trim() !== HIDDEN_STATS_PIN) {
      setError("Неверный PIN-код");
      return;
    }

    try {
      window.sessionStorage.setItem(HIDDEN_STATS_SESSION_KEY, "granted");
    } catch {
      // Access remains in memory when sessionStorage is unavailable.
    }

    setError(null);
    setHasAcceptedPin(true);
  }

  if (hasStoredAccess || hasAcceptedPin) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Скрытый раздел"
        title="Статистика карточек"
        description="Раздел доступен только после подтверждения PIN-кода в текущей сессии админ-панели."
      />

      <AdminPanel
        title="Вход по PIN-коду"
        description="После закрытия сессии доступ будет сброшен автоматически."
        className="mx-auto max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-olive">PIN-код</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value);
                setError(null);
              }}
              className={cn(adminInputClass, "mt-2 text-center text-lg tracking-[0.32em]")}
              autoFocus
              required
            />
          </label>

          {error ? <AdminNotice>{error}</AdminNotice> : null}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <KeyRound className="h-4 w-4" />
            Открыть статистику
          </button>
        </form>
      </AdminPanel>
    </div>
  );
}
