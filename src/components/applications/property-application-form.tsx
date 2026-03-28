// UI component for property application form in the applications module.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoomOption = {
  id: string;
  title: string;
};

type PropertyApplicationFormProps = {
  submitUrl: string;
  entityPath: string;
  entityName: string;
  entityLabel: "объекту" | "экскурсии";
  receiveRequests: boolean;
  fallbackPhone: string | null;
  rooms: RoomOption[];
  isAuthenticated: boolean;
  defaultContactName: string;
  defaultContactEmail: string;
};

type CreateApplicationResponse = {
  error?: string;
  code?: string;
};

export function PropertyApplicationForm({
  submitUrl,
  entityPath,
  entityName,
  entityLabel,
  receiveRequests,
  fallbackPhone,
  rooms,
  isAuthenticated,
  defaultContactName,
  defaultContactEmail,
}: PropertyApplicationFormProps) {
  const [roomId, setRoomId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [guestsCount, setGuestsCount] = useState(2);
  const [message, setMessage] = useState("");
  const [contactName, setContactName] = useState(defaultContactName);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [authRequired, setAuthRequired] = useState(false);

  const authLoginHref = useMemo(
    () => `/auth/login?next=${encodeURIComponent(entityPath)}`,
    [entityPath],
  );
  const authRegisterHref = useMemo(
    () => `/auth/register?next=${encodeURIComponent(entityPath)}`,
    [entityPath],
  );

  async function submit() {
    setError("");
    setSuccess("");
    setAuthRequired(false);

    if (!dateFrom || !dateTo) {
      setError("Укажите даты заезда и выезда");
      return;
    }

    if (!contactName.trim() || !contactPhone.trim() || !contactEmail.trim()) {
      setError("Заполните контактные данные");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomId || null,
          dateFrom,
          dateTo,
          guestsCount,
          message: message.trim() ? message.trim() : null,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as CreateApplicationResponse;
        if (response.status === 401 || body.code === "AUTH_REQUIRED") {
          setAuthRequired(true);
        }
        setError(body.error ?? "Не удалось отправить заявку");
        return;
      }

      setSuccess("Заявка отправлена. Владелец или организатор увидит ее в личном кабинете.");
      setMessage("");
      setRoomId("");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!receiveRequests) {
    return (
      <section className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
        <h2 className="text-2xl text-olive">Заявка</h2>
        <p className="mt-2 text-sm text-olive/75">
          Владелец отключил прием заявок через сайт.
        </p>
        {fallbackPhone ? (
          <p className="mt-1 text-sm text-olive">
            Связаться по телефону: <span className="font-semibold">{fallbackPhone}</span>
          </p>
        ) : null}
      </section>
    );
  }

  if (!isAuthenticated || authRequired) {
    return (
      <section className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
        <h2 className="text-2xl text-olive">Отправить заявку</h2>
        <p className="mt-2 text-sm text-olive/75">
          Чтобы отправить заявку по {entityLabel} «{entityName}», войдите в аккаунт или зарегистрируйтесь.
        </p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={authLoginHref}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Войти
          </Link>
          <Link
            href={authRegisterHref}
            className="rounded-xl border border-olive/25 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
      <h2 className="text-2xl text-olive">Отправить заявку</h2>
      <p className="mt-1 text-sm text-olive/70">
        Запрос уйдет владельцу или организатору в раздел «Заявки».
      </p>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.length > 0 ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-olive">Номер (опционально)</span>
              <select
                className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              >
                <option value="">Любой подходящий номер</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
          <Input
            type="number"
            min={1}
            max={20}
            value={guestsCount}
            onChange={(event) => setGuestsCount(Number(event.target.value) || 1)}
            placeholder="Количество гостей"
          />
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-olive">Комментарий</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20"
            placeholder="Уточнения по времени, пожелания, вопросы..."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Ваше имя"
          />
          <Input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="Телефон"
          />
        </div>
        <Input
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="Email"
        />

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void submit()} disabled={isSubmitting}>
            {isSubmitting ? "Отправка..." : "Отправить заявку"}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}
    </section>
  );
}

