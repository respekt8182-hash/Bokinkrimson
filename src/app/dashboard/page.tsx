// Next.js page for route /dashboard.
import { ArrowRight, Bus, Building2, MessageSquareText, Search, TentTree } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardVisualHero, DashboardVisualPanel } from "@/components/dashboard/dashboard-visual";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";

const sectionCards = [
  {
    href: "/dashboard/objects",
    title: "Недвижимость",
    text: "Жильё, номера, удобства, календарь и публикация.",
    image: "/dashboard-prof/sections-housing.png",
    icon: Building2,
    tone: "text-primary",
  },
  {
    href: "/dashboard/excursions",
    title: "Экскурсии",
    text: "Маршруты, программы, расписание и заявки гостей.",
    image: "/dashboard-prof/sections-excursions.png",
    icon: TentTree,
    tone: "text-terra",
  },
  {
    href: "/dashboard/transfers",
    title: "Трансферы",
    text: "Автопарк, направления, цены и публикация услуг.",
    image: "/dashboard-prof/sections-transfers.png",
    icon: Bus,
    tone: "text-primary",
  },
];

function SeagullIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 13.5C9.8 5.8 15.8 5.6 20 14.3C24.2 5.6 30.2 5.8 36 13.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.6 12.2C16.5 13.6 18.3 14.3 20 14.3C21.7 14.3 23.5 13.6 25.4 12.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard");
  }

  const firstName = session.firstName?.trim() || "друг";

  return (
    <div className="space-y-5">
      <DashboardVisualHero
        eyebrow={`Добро пожаловать, ${firstName}!`}
        title="Что вы хотите сделать?"
        description="Здесь владельцы управляют объявлениями о недвижимости, экскурсиях и трансферах. Если вы гость и хотите оставить отзыв, перейдите к поиску на сайте и откройте нужную карточку."
        image="/dashboard-prof/main.png"
        imagePosition="right center"
      >
        <p className="inline-flex items-center gap-3 font-heading text-xl italic leading-8 text-primary/75 sm:text-2xl">
          <span>Ваш бизнес - часть путешествия</span>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary shadow-[0_10px_24px_rgba(15,118,110,0.14)]">
            <SeagullIcon className="h-5 w-7" />
          </span>
        </p>
      </DashboardVisualHero>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.45fr)]">
        <Link
          href="/"
          className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-[24px] border border-primary/14 bg-white/90 p-5 text-olive shadow-[0_18px_55px_rgba(15,118,110,0.09)] transition hover:-translate-y-0.5 hover:border-primary/28 hover:shadow-[0_26px_70px_rgba(15,118,110,0.12)] sm:p-7"
        >
          <span className="absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-primary/8" />
          <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
            <AppIcon icon={MessageSquareText} className="h-5 w-5" />
          </span>
          <span className="relative">
            <span className="block font-heading text-2xl font-semibold">Оставить отзыв</span>
            <span className="mt-1 block text-sm leading-relaxed text-olive/62">
              Откроется главная страница с поиском. Найдите недвижимость, экскурсию или трансфер и
              перейдите к отзывам в карточке.
            </span>
          </span>
          <span className="relative inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(15,118,110,0.2)]">
            Перейти к поиску
            <AppIcon icon={Search} className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <DashboardVisualPanel className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                Размещение объявлений
              </p>
              <h2 className="mt-1 font-heading text-3xl font-semibold text-olive">Мои разделы</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {sectionCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative min-h-[215px] overflow-hidden rounded-2xl border border-olive/10 bg-cream/45 p-4 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_45px_rgba(15,118,110,0.12)]"
              >
                <span
                  className="absolute inset-0 opacity-60 transition group-hover:scale-105 group-hover:opacity-75"
                  style={{
                    backgroundImage: `linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(255,253,248,0.9) 38%, rgba(255,253,248,0.56) 66%, rgba(255,253,248,0.2) 100%), linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.18) 48%, rgba(58,43,35,0.08)), url(${card.image})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover, cover, cover",
                  }}
                />
                <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/88 ring-1 ring-primary/10">
                  <AppIcon icon={card.icon} className={`h-6 w-6 ${card.tone}`} />
                </span>
                <span className="relative mt-12 block">
                  <span className="block font-heading text-2xl font-semibold text-olive">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-olive/62">
                    {card.text}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    Открыть
                    <AppIcon
                      icon={ArrowRight}
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                    />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </DashboardVisualPanel>
      </div>
    </div>
  );
}
