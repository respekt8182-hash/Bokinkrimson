"use client";

// Floating support widget that lets owners send context-bound messages to admins.

import { MessageCircleMore, SendHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type MessageSourceType = "OBJECT" | "EXCURSION";

type SupportContext = {
  sourceType: MessageSourceType;
  propertyId: string | null;
  excursionId: string | null;
  title: string;
};

function resolveSupportContext(pathname: string): SupportContext | null {
  const objectMatch = pathname.match(/^\/dashboard\/objects\/([^/?#]+)/);
  if (objectMatch) {
    return {
      sourceType: "OBJECT",
      propertyId: decodeURIComponent(objectMatch[1]),
      excursionId: null,
      title: "Сообщение по объекту",
    };
  }

  const excursionMatch = pathname.match(/^\/dashboard\/excursions\/([^/?#]+)/);
  if (excursionMatch) {
    return {
      sourceType: "EXCURSION",
      propertyId: null,
      excursionId: decodeURIComponent(excursionMatch[1]),
      title: "Сообщение по экскурсии",
    };
  }

  return null;
}

export function AdminMessageWidget() {
  const pathname = usePathname() ?? "";
  const context = useMemo(() => resolveSupportContext(pathname), [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!context) {
    return null;
  }
  const activeContext = context;

  async function onSubmit() {
    const trimmed = message.trim();
    setError("");
    setSuccess("");

    if (trimmed.length < 10) {
      setError("Введите сообщение минимум 10 символов");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: activeContext.sourceType,
          propertyId: activeContext.propertyId,
          excursionId: activeContext.excursionId,
          message: trimmed,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось отправить сообщение");
        return;
      }

      setMessage("");
      setSuccess("Сообщение отправлено администрации");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className={
        isOpen
          ? "fixed inset-x-2 bottom-2 z-[60] sm:left-auto sm:right-4 sm:bottom-4"
          : "fixed right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] z-[60] sm:right-4 sm:bottom-4"
      }
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-primary px-0 py-0 text-sm font-semibold text-white shadow-lg transition hover:bg-primary/90 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5"
        >
          <MessageCircleMore className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Написать администрации</span>
        </button>
      ) : (
        <section className="w-full rounded-2xl border border-olive/15 bg-white p-4 shadow-2xl sm:w-[320px] sm:max-w-[calc(100vw-2rem)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-olive">Написать администрации</h3>
              <p className="text-xs text-olive/65">{activeContext.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-olive/20 text-olive hover:bg-cream"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Опишите вопрос для администрации"
            className="mt-3 w-full rounded-xl border border-olive/20 bg-white px-3 py-2 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra"
          />

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setError("");
                setSuccess("");
              }}
              className="rounded-xl border border-olive/20 px-3 py-2 text-xs font-semibold text-olive hover:bg-cream"
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-65"
            >
              <SendHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{isSending ? "Отправка..." : "Отправить"}</span>
            </button>
          </div>

          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {success ? <p className="mt-2 text-xs text-green-700">{success}</p> : null}
        </section>
      )}
    </div>
  );
}
