"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminListingVisibilityToggleProps = {
  endpoint: string;
  entityLabel: string;
  isVisible: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
};

export function AdminListingVisibilityToggle({
  endpoint,
  entityLabel,
  isVisible,
  disabled = false,
  disabledReason = null,
}: AdminListingVisibilityToggleProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublishedVisible: !isVisible }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? `Не удалось изменить видимость ${entityLabel}.`);
        return;
      }

      router.refresh();
    } catch {
      setError(`Не удалось изменить видимость ${entityLabel}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const title =
    disabled && disabledReason
      ? disabledReason
      : isVisible
        ? `Скрыть ${entityLabel}`
        : `Показать ${entityLabel}`;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={disabled || isSubmitting}
        className="inline-flex items-center gap-2 rounded-2xl border border-olive/12 bg-white px-3.5 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        title={title}
      >
        {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {isVisible ? "Скрыть" : "Показать"}
      </button>

      {disabled && disabledReason ? (
        <p className="text-xs text-olive/60">{disabledReason}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
