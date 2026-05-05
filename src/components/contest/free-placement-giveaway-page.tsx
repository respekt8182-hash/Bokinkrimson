"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Car,
  Clock3,
  Compass,
  House,
  Landmark,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";

const contestPostUrl = "https://vk.com/wall-237324106_17";
const contestCommunityUrl = "https://vk.com/krymvokrug";
const contestTargetDateMs = new Date("2026-05-09T00:00:00+03:00").getTime();

const prizeItems = [
  { title: "Жильё", text: "Гостевой дом, апартаменты, отель, номер или домик.", icon: House },
  {
    title: "Экскурсия",
    text: "Авторская прогулка, групповая или индивидуальная поездка.",
    icon: Compass,
  },
  { title: "Тур", text: "Маршрут по Крыму, программа отдыха или активный выезд.", icon: Landmark },
  { title: "Трансфер", text: "Поездки, встреча гостей, маршрут или автопарк.", icon: Car },
];

const participationSteps = [
  "Подпишитесь на сообщество ВКонтакте «Крым Вокруг».",
  "Сделайте репост конкурсной записи к себе на страницу.",
  "Оставьте страницу открытой до подведения итогов.",
  "Проверьте, что на странице есть 20+ друзей.",
];

const certificateRules = [
  "Сертификат действует на бесплатное размещение на сайте krymvokrug.ru сроком на 365 дней.",
  "Победитель сам решает, кому передать сертификат: себе, родственникам, друзьям или знакомым.",
  "Сертификат можно подарить бесплатно.",
  "Перепродажа сертификата запрещена.",
];

function pluralize(value: number, variants: [string, string, string]): string {
  const absolute = Math.abs(value);
  const lastTwo = absolute % 100;
  const last = absolute % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return variants[2];
  }

  if (last === 1) {
    return variants[0];
  }

  if (last >= 2 && last <= 4) {
    return variants[1];
  }

  return variants[2];
}

function getCountdownParts(nowMs: number | null): { label: string; value: string }[] {
  if (nowMs === null) {
    return [
      { label: "дней", value: "--" },
      { label: "часов", value: "--" },
      { label: "минут", value: "--" },
      { label: "секунд", value: "--" },
    ];
  }

  const totalSeconds = Math.max(0, Math.floor((contestTargetDateMs - nowMs) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [
    { label: pluralize(days, ["день", "дня", "дней"]), value: String(days) },
    { label: pluralize(hours, ["час", "часа", "часов"]), value: String(hours).padStart(2, "0") },
    {
      label: pluralize(minutes, ["минута", "минуты", "минут"]),
      value: String(minutes).padStart(2, "0"),
    },
    {
      label: pluralize(seconds, ["секунда", "секунды", "секунд"]),
      value: String(seconds).padStart(2, "0"),
    },
  ];
}

export function FreePlacementGiveawayPage() {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());

    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const countdownParts = useMemo(() => getCountdownParts(nowMs), [nowMs]);
  const isFinished = nowMs !== null && nowMs >= contestTargetDateMs;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <section className="overflow-hidden rounded-[32px] bg-white/94 shadow-[0_22px_60px_rgba(58,43,35,0.12)] ring-1 ring-olive/10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-foam)_86%,white)_0%,white_48%,color-mix(in_oklab,var(--color-sand)_72%,white)_100%)] p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-primary">
                <AppIcon icon={Sparkles} className="h-3.5 w-3.5" />
                Розыгрыш
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/35 px-3 py-1 text-xs font-semibold text-olive/75">
                <AppIcon
                  icon={CalendarDays}
                  className="h-3.5 w-3.5 text-[color:var(--icon-highlight)]"
                />
                Итоги 9 мая
              </span>
            </div>

            <h1 className="mt-5 font-heading text-3xl leading-tight text-midnight md:text-5xl md:leading-[1.08]">
              Бесплатное размещение на «Крым Вокруг» на 365 дней
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-olive/75">
              Разыгрываем сертификат на размещение объекта для отдыхающих в Крыму. Участвовать могут
              не только владельцы бизнеса: репост могут сделать друзья, родственники, знакомые или
              любые близкие люди.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={contestPostUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/18 transition hover:bg-primary-hover"
              >
                <AppIcon icon={Share2} className="h-4 w-4 text-white" />
                Открыть конкурсный пост
              </a>
              <a
                href={contestCommunityUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-olive ring-1 ring-olive/12 transition hover:bg-foam"
              >
                <AppIcon
                  icon={ArrowUpRight}
                  className="h-4 w-4 text-[color:var(--icon-communication)]"
                />
                Группа ВКонтакте
              </a>
            </div>
          </div>

          <div className="bg-midnight p-6 text-white md:p-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/54">
                  {isFinished ? "Итоги конкурса" : "До итогов"}
                </p>
                <p className="mt-1 text-xl font-semibold">9 мая 2026</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/12">
                <AppIcon icon={Clock3} className="h-5 w-5 text-sage" />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {countdownParts.map((part) => (
                <div
                  key={part.label}
                  className="min-w-0 rounded-2xl bg-white/[0.08] p-2 text-center ring-1 ring-white/10 sm:p-3"
                >
                  <span className="block text-2xl font-black tabular-nums text-white">
                    {part.value}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.65rem] font-semibold text-white/56 sm:text-xs">
                    {part.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-white/[0.08] p-5 ring-1 ring-white/10">
              <p className="text-sm font-semibold text-white">Главное</p>
              <p className="mt-2 text-sm leading-7 text-white/72">
                Победитель получит сертификат на 365 дней размещения. Его можно использовать для
                себя или передать тому, кому пригодится продвижение на сайте.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {prizeItems.map((item) => (
          <div key={item.title} className="rounded-2xl bg-white/88 p-5 ring-1 ring-olive/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <AppIcon icon={item.icon} className="h-5 w-5 text-[color:var(--icon-site)]" />
            </span>
            <h2 className="mt-4 text-base font-bold text-midnight">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-olive/68">{item.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] bg-white/92 p-6 ring-1 ring-olive/10 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Как участвовать
          </p>
          <h2 className="mt-3 font-heading text-2xl leading-tight text-midnight md:text-3xl">
            Сделайте 4 простых шага
          </h2>
          <ol className="mt-5 space-y-3">
            {participationSteps.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-2xl bg-cream/70 p-4 ring-1 ring-olive/8">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm leading-7 text-olive/78">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] bg-sand/72 p-6 ring-1 ring-olive/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra">
              Условия сертификата
            </p>
            <ul className="mt-4 space-y-3">
              {certificateRules.map((rule) => (
                <li key={rule} className="flex gap-3 text-sm leading-7 text-olive/75">
                  <AppIcon icon={BadgeCheck} className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] bg-white/92 p-6 ring-1 ring-olive/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Кто может сделать репост
            </p>
            <div className="mt-4 flex gap-3 text-sm leading-7 text-olive/75">
              <AppIcon
                icon={Users}
                className="mt-1 h-5 w-5 shrink-0 text-[color:var(--icon-identity)]"
              />
              <p>
                Участвовать могут владельцы жилья или бизнеса, а также друзья, родственники,
                знакомые, дети или любые близкие люди. Победитель сам решает, кому передать
                сертификат.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] bg-midnight p-6 text-white ring-1 ring-olive/10 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/54">
              Финальный шаг
            </p>
            <h2 className="mt-2 font-heading text-2xl leading-tight md:text-3xl">
              Подпишитесь и сделайте репост конкурсной записи
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              Итоги подведём 9 мая в группе ВКонтакте «Крым Вокруг». Страница участника должна
              оставаться открытой до подведения итогов.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
            <a
              href={contestPostUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-sage px-5 py-3 text-sm font-bold text-midnight transition hover:bg-white"
            >
              <AppIcon icon={Share2} className="h-4 w-4" />
              Конкурсный пост
            </a>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white/[0.08] px-5 py-3 text-sm font-bold text-white ring-1 ring-white/12 transition hover:bg-white/12"
            >
              На главную
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
