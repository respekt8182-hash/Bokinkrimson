"use client";

import { CalendarDays, Check, Copy, Phone, User, Users, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { cn } from "@/lib/cn";

type ExcursionLeadFormProps = {
  excursionTitle: string;
  priceLabel: string;
  durationLabel: string;
  locationName: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  phone: string | null;
  organizerName: string;
};

export function ExcursionLeadForm({
  excursionTitle,
  priceLabel,
  durationLabel,
  locationName,
  whatsappUrl,
  telegramUrl,
  phone,
  organizerName,
}: ExcursionLeadFormProps) {
  const [name, setName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const buildMessage = useCallback(() => {
    const lines: string[] = [
      "Добрый день! Нашёл вашу программу на сайте \"Крым Вокруг\".",
      "",
      `Интересует: "${excursionTitle}"`,
    ];
    if (locationName) lines.push(`Локация: ${locationName}`);
    if (name.trim()) lines.push(`Имя: ${name.trim()}`);
    if (userPhone.trim()) lines.push(`Телефон: ${userPhone.trim()}`);
    if (date) {
      const d = new Date(date);
      const formatted = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
      lines.push(`Желаемая дата: ${formatted}`);
    }
    if (guests.trim()) lines.push(`Количество человек: ${guests.trim()}`);
    if (message.trim()) {
      lines.push("");
      lines.push(`Комментарий: ${message.trim()}`);
    }
    lines.push("");
    lines.push("Буду благодарен за ответ!");
    return lines.join("\n");
  }, [excursionTitle, locationName, name, userPhone, date, guests, message]);

  const handleCopy = useCallback(async () => {
    const text = buildMessage();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [buildMessage]);

  const encodedMessage = encodeURIComponent(buildMessage());

  const whatsappHref = whatsappUrl
    ? `${whatsappUrl}${whatsappUrl.includes("?") ? "&" : "?"}text=${encodedMessage}`
    : null;

  const telegramHref = telegramUrl
    ? telegramUrl
    : null;

  return (
    <div className="space-y-4">
      <form ref={formRef} className="space-y-3" onSubmit={(e) => e.preventDefault()}>
        {/* Name */}
        <div className="relative">
          <label htmlFor="lead-name" className="sr-only">Ваше имя</label>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/30">
            <AppIcon icon={User} className="h-4 w-4" />
          </span>
          <input
            id="lead-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            className="w-full rounded-xl border border-olive/12 bg-cream/40 py-3 pl-10 pr-4 text-sm text-olive placeholder:text-olive/35 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* Phone */}
        <div className="relative">
          <label htmlFor="lead-phone" className="sr-only">Телефон</label>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/30">
            <AppIcon icon={Phone} className="h-4 w-4" />
          </span>
          <input
            id="lead-phone"
            type="tel"
            value={userPhone}
            onChange={(e) => setUserPhone(e.target.value)}
            placeholder="+7 (___) ___-__-__"
            className="w-full rounded-xl border border-olive/12 bg-cream/40 py-3 pl-10 pr-4 text-sm text-olive placeholder:text-olive/35 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* Date & Guests row */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative">
            <label htmlFor="lead-date" className="sr-only">Дата</label>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/30">
              <AppIcon icon={CalendarDays} className="h-4 w-4" />
            </span>
            <input
              id="lead-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-olive/12 bg-cream/40 py-3 pl-10 pr-3 text-sm text-olive placeholder:text-olive/35 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="relative">
            <label htmlFor="lead-guests" className="sr-only">Кол-во человек</label>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/30">
              <AppIcon icon={Users} className="h-4 w-4" />
            </span>
            <input
              id="lead-guests"
              type="number"
              min={1}
              max={100}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder="Человек"
              className="w-full rounded-xl border border-olive/12 bg-cream/40 py-3 pl-10 pr-3 text-sm text-olive placeholder:text-olive/35 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="lead-message" className="sr-only">Комментарий</label>
          <textarea
            id="lead-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Комментарий или вопрос (необязательно)"
            rows={2}
            className="w-full resize-none rounded-xl border border-olive/12 bg-cream/40 px-4 py-3 text-sm text-olive placeholder:text-olive/35 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </form>

      {/* Send buttons */}
      <div className="space-y-2">
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#20BD5A] active:scale-[0.98]"
          >
            <ContactBrandMark brand="whatsapp" className="h-5 w-5" />
            Написать в WhatsApp
          </a>
        )}
        {telegramHref && (
          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2AABEE] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#229ED9] active:scale-[0.98]"
          >
            <ContactBrandMark brand="telegram" className="h-5 w-5" />
            Написать в Telegram
          </a>
        )}
        {!whatsappHref && !telegramHref && phone && (
          <a
            href={`tel:${phone}`}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white"
          >
            <AppIcon icon={Phone} className="h-4 w-4" />
            Позвонить
          </a>
        )}
      </div>

      {/* Copy message button */}
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98]",
          copied
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-olive/15 bg-white text-olive/70 hover:bg-cream hover:text-olive",
        )}
      >
        <AppIcon icon={copied ? Check : Copy} className="h-4 w-4" />
        {copied ? "Сообщение скопировано!" : "Скопировать сообщение"}
      </button>

      <p className="text-center text-[11px] text-olive/35">
        Заполните форму и отправьте сообщение организатору в мессенджер
      </p>
    </div>
  );
}

/* ─── Mobile Lead Modal ─── */

type ExcursionLeadModalProps = ExcursionLeadFormProps & {
  open: boolean;
  onClose: () => void;
  priceTo: number | null;
  priceFrom: number | null;
  currency: string;
};

export function ExcursionLeadModal({
  open,
  onClose,
  priceTo,
  priceFrom,
  currency,
  ...formProps
}: ExcursionLeadModalProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-midnight/55 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-[440px] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
          <div>
            <h3 className="text-[15px] font-semibold text-olive">Оставить заявку</h3>
            <p className="text-xs text-olive/50">
              {formProps.priceLabel}
              {formProps.durationLabel ? ` · ${formProps.durationLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
          >
            <AppIcon icon={X} className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ExcursionLeadForm {...formProps} />
        </div>
      </div>
    </>
  );
}
